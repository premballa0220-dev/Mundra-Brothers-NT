-- =========================================================
-- Multi-product Purchase Orders (line items)
--
-- BACKWARD-COMPATIBLE / ADDITIVE. Safe to run while the current
-- (single-product) app is live:
--   * adds a new purchase_order_items table
--   * adds a nullable dispatch_requests.purchase_order_item_id
--   * backfills existing POs -> one line item each, and links
--     existing dispatches to that item
--   * updates the wallet/credit recalculation to use the line-item
--     rate when present, else falls back to the PO's locked_rate
--     (so dispatches created by the OLD code keep calculating right)
-- Legacy columns on purchase_orders (product_id / original_quantity /
-- locked_rate / total_value) are intentionally KEPT for compatibility.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Line-item table
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  original_quantity NUMERIC(12, 3) NOT NULL CHECK (original_quantity > 0),
  locked_rate NUMERIC(12, 2) NOT NULL CHECK (locked_rate >= 0),
  total_value NUMERIC(15, 2) NOT NULL CHECK (total_value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.purchase_order_items(purchase_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Mirror the purchase_orders RLS, scoped through the parent PO.
DROP POLICY IF EXISTS "poi_select" ON public.purchase_order_items;
CREATE POLICY "poi_select" ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND (po.organization_id = public.current_org_id() OR public.is_mundra_user())
  ));

DROP POLICY IF EXISTS "poi_insert_client" ON public.purchase_order_items;
CREATE POLICY "poi_insert_client" ON public.purchase_order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND po.organization_id = public.current_org_id()
  ));

DROP POLICY IF EXISTS "poi_update_client" ON public.purchase_order_items;
CREATE POLICY "poi_update_client" ON public.purchase_order_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND po.organization_id = public.current_org_id()
      AND po.status IN ('draft', 'pending_approval')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
      AND po.organization_id = public.current_org_id()
      AND po.status IN ('draft', 'pending_approval')
  ));

DROP POLICY IF EXISTS "poi_modify_mundra" ON public.purchase_order_items;
CREATE POLICY "poi_modify_mundra" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- ---------------------------------------------------------
-- 2. Dispatch -> which line item it draws from
-- ---------------------------------------------------------
ALTER TABLE public.dispatch_requests
  ADD COLUMN IF NOT EXISTS purchase_order_item_id UUID
  REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_dispatch_po_item
  ON public.dispatch_requests(purchase_order_item_id);

-- ---------------------------------------------------------
-- 3. Backfill existing data (idempotent)
-- ---------------------------------------------------------
-- 3a. One line item per existing PO, copied from its single-product columns.
INSERT INTO public.purchase_order_items
  (purchase_order_id, product_id, original_quantity, locked_rate, total_value, created_at, updated_at)
SELECT po.id, po.product_id, po.original_quantity, po.locked_rate, po.total_value, po.created_at, po.updated_at
FROM public.purchase_orders po
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_order_items poi WHERE poi.purchase_order_id = po.id
);

-- 3b. Point existing dispatches at their PO's (now single) line item.
UPDATE public.dispatch_requests dr
SET purchase_order_item_id = poi.id
FROM public.purchase_order_items poi
WHERE poi.purchase_order_id = dr.purchase_order_id
  AND dr.purchase_order_item_id IS NULL;

-- ---------------------------------------------------------
-- 4. Wallet/credit recalculation: use the line-item rate when the
--    dispatch has one, else fall back to the PO's locked_rate.
--    (LEFT JOIN + COALESCE keeps old-code dispatches correct.)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_wallet_balance(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_credits NUMERIC := 0;
  v_total_debits NUMERIC := 0;
  v_ob_allocations NUMERIC := 0;
  v_expected_wallet_balance NUMERIC := 0;
BEGIN
  -- 1. Total Credits (all payments made by client to UTCL)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_credits
  FROM payments
  WHERE organization_id = p_org_id
    AND is_client_to_utcl = TRUE;

  -- 2. Total Debits (active dispatches x their line-item rate, else PO rate)
  SELECT COALESCE(SUM(dr.quantity * COALESCE(poi.locked_rate, po.locked_rate)), 0)
  INTO v_total_debits
  FROM dispatch_requests dr
  JOIN purchase_orders po ON dr.purchase_order_id = po.id
  LEFT JOIN purchase_order_items poi ON dr.purchase_order_item_id = poi.id
  WHERE dr.organization_id = p_org_id
    AND dr.status IN ('approved', 'auto_approved', 'pending_mundra', 'submitted');

  -- 3. Active allocations against active opening balances
  SELECT COALESCE(SUM(ia.allocated_amount), 0)
  INTO v_ob_allocations
  FROM invoice_allocations ia
  JOIN invoices i ON ia.invoice_id = i.id
  WHERE i.organization_id = p_org_id
    AND i.is_opening_balance = TRUE
    AND i.status != 'cancelled';

  -- 4. Expected wallet balance
  v_expected_wallet_balance := GREATEST(0, v_total_credits - v_total_debits - v_ob_allocations);

  -- 5. Persist
  UPDATE client_commercial_profiles
  SET wallet_balance = v_expected_wallet_balance,
      updated_at = NOW()
  WHERE organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------
-- 5. Keep the wallet in sync when a line item's rate/quantity changes
--    (rates now live on the line item, not just the PO).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_recalculate_wallet_from_po_item()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_po_id UUID;
BEGIN
  v_po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  SELECT organization_id INTO v_org_id FROM public.purchase_orders WHERE id = v_po_id;
  IF v_org_id IS NOT NULL THEN
    PERFORM recalculate_wallet_balance(v_org_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_po_items_wallet_sync ON public.purchase_order_items;
CREATE TRIGGER trigger_po_items_wallet_sync
AFTER INSERT OR DELETE OR UPDATE OF locked_rate, original_quantity
ON public.purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_wallet_from_po_item();
