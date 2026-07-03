-- Function to strictly recalculate and update the wallet balance for a given client organization
CREATE OR REPLACE FUNCTION recalculate_wallet_balance(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_credits NUMERIC := 0;
  v_total_debits NUMERIC := 0;
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

  -- 3. Calculate Expected Wallet Balance
  v_expected_wallet_balance := GREATEST(0, v_total_credits - v_total_debits);

  -- 4. Update the client_commercial_profiles table
  UPDATE client_commercial_profiles
  SET wallet_balance = v_expected_wallet_balance,
      updated_at = NOW()
  WHERE organization_id = p_org_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function that determines the relevant organization_id and calls the recalculation
CREATE OR REPLACE FUNCTION trigger_recalculate_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org_id := OLD.organization_id;
  ELSE
    v_org_id := NEW.organization_id;
  END IF;

  -- Call the recalculation function
  PERFORM recalculate_wallet_balance(v_org_id);
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on payments table
DROP TRIGGER IF EXISTS trigger_payments_wallet_sync ON payments;
CREATE TRIGGER trigger_payments_wallet_sync
AFTER INSERT OR UPDATE OF amount, status, is_client_to_utcl OR DELETE
ON payments
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_wallet();

-- Trigger on dispatch_requests table
DROP TRIGGER IF EXISTS trigger_dispatches_wallet_sync ON dispatch_requests;
CREATE TRIGGER trigger_dispatches_wallet_sync
AFTER INSERT OR UPDATE OF quantity, status OR DELETE
ON dispatch_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_wallet();

-- Trigger on purchase_orders table (if locked rate changes, dispatches change value)
DROP TRIGGER IF EXISTS trigger_pos_wallet_sync ON purchase_orders;
CREATE TRIGGER trigger_pos_wallet_sync
AFTER UPDATE OF locked_rate
ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_wallet();


-- Update record_payment_admin to remove the manual wallet credit logic 
-- since the trigger now fully covers it
CREATE OR REPLACE FUNCTION record_payment_admin(
  p_org_id UUID,
  p_po_id UUID,
  p_dispatch_ids UUID[],
  p_amount NUMERIC,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_ref_no TEXT,
  p_is_utcl BOOLEAN,
  p_is_client_to_utcl BOOLEAN,
  p_is_advance BOOLEAN,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_po_total NUMERIC := 0;
  v_amount_paid NUMERIC := 0;
  v_remaining_balance NUMERIC := 0;
BEGIN
  -- 1. Calculate remaining balance if tied to a PO
  IF p_po_id IS NOT NULL THEN
    SELECT total_value INTO v_po_total FROM purchase_orders WHERE id = p_po_id;
    
    IF v_po_total IS NULL THEN
      RAISE EXCEPTION 'Purchase Order not found';
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_amount_paid 
    FROM payments 
    WHERE purchase_order_id = p_po_id 
    AND (status = 'approved' OR status = 'verified');

    v_remaining_balance := GREATEST(0, v_po_total - v_amount_paid);
  END IF;

  -- 2. Insert the payment
  INSERT INTO payments (
    organization_id, purchase_order_id, amount, payment_date, payment_mode, 
    reference_number, is_utcl_payment, is_client_to_utcl, is_advance, status, verified_by, verified_at
  ) VALUES (
    p_org_id, p_po_id, p_amount, p_payment_date, p_payment_mode, 
    p_ref_no, p_is_utcl, p_is_client_to_utcl, p_is_advance, 'approved', p_user_id, NOW()
  ) RETURNING id INTO v_payment_id;

  -- 3. Link dispatches to this payment
  IF array_length(p_dispatch_ids, 1) > 0 THEN
    UPDATE dispatch_requests 
    SET utcl_payment_id = v_payment_id 
    WHERE id = ANY(p_dispatch_ids);
  END IF;

  -- 4. Create Audit Log for Payment
  INSERT INTO audit_logs (
    action, table_name, record_id, new_values, user_id
  ) VALUES (
    'RECORD_PAYMENT_ADMIN', 'payments', v_payment_id, 
    jsonb_build_object(
      'id', v_payment_id,
      'amount', p_amount,
      'is_utcl_payment', p_is_utcl,
      'is_client_to_utcl', p_is_client_to_utcl
    ),
    p_user_id
  );

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
