-- 1. Update the recalculate_wallet_balance function to subtract active allocations against active OBs.
CREATE OR REPLACE FUNCTION recalculate_wallet_balance(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_credits NUMERIC := 0;
  v_total_debits NUMERIC := 0;
  v_ob_allocations NUMERIC := 0;
  v_expected_wallet_balance NUMERIC := 0;
BEGIN
  -- 1. Calculate Total Credits (All payments made by client to UTCL)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_credits
  FROM payments
  WHERE organization_id = p_org_id
  AND is_client_to_utcl = TRUE;

  -- 2. Calculate Total Debits (All active dispatch requests multiplied by their PO locked rate)
  SELECT COALESCE(SUM(dr.quantity * po.locked_rate), 0)
  INTO v_total_debits
  FROM dispatch_requests dr
  JOIN purchase_orders po ON dr.purchase_order_id = po.id
  WHERE dr.organization_id = p_org_id
  AND dr.status IN ('approved', 'auto_approved', 'pending_mundra', 'submitted');

  -- 3. Calculate active allocations against active opening balances
  SELECT COALESCE(SUM(ia.allocated_amount), 0)
  INTO v_ob_allocations
  FROM invoice_allocations ia
  JOIN invoices i ON ia.invoice_id = i.id
  WHERE i.organization_id = p_org_id
  AND i.is_opening_balance = TRUE
  AND i.status != 'cancelled';

  -- 4. Calculate Expected Wallet Balance
  v_expected_wallet_balance := GREATEST(0, v_total_credits - v_total_debits - v_ob_allocations);

  -- 5. Update the client_commercial_profiles table
  UPDATE client_commercial_profiles
  SET wallet_balance = v_expected_wallet_balance,
      updated_at = NOW()
  WHERE organization_id = p_org_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add triggers for invoice_allocations
CREATE OR REPLACE FUNCTION trigger_recalculate_wallet_from_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Get org_id from the invoice
    SELECT organization_id INTO v_org_id FROM invoices WHERE id = OLD.invoice_id;
  ELSE
    SELECT organization_id INTO v_org_id FROM invoices WHERE id = NEW.invoice_id;
  END IF;

  IF v_org_id IS NOT NULL THEN
    PERFORM recalculate_wallet_balance(v_org_id);
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_allocations_wallet_sync ON invoice_allocations;
CREATE TRIGGER trigger_allocations_wallet_sync
AFTER INSERT OR UPDATE OF allocated_amount OR DELETE
ON invoice_allocations
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_wallet_from_allocation();

-- 3. Add trigger for invoices (specifically for status changes like cancellation of OB)
CREATE OR REPLACE FUNCTION trigger_recalculate_wallet_from_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- We only care about changes to opening balances that could affect the wallet
  IF (TG_OP = 'UPDATE' AND NEW.is_opening_balance = TRUE AND OLD.status != NEW.status) OR 
     (TG_OP = 'DELETE' AND OLD.is_opening_balance = TRUE) THEN
    PERFORM recalculate_wallet_balance(COALESCE(NEW.organization_id, OLD.organization_id));
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoices_wallet_sync ON invoices;
CREATE TRIGGER trigger_invoices_wallet_sync
AFTER UPDATE OF status OR DELETE
ON invoices
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_wallet_from_invoice();
