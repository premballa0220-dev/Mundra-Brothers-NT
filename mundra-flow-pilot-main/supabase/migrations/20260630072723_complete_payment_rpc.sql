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
  v_overpayment NUMERIC := 0;
  v_profile_id UUID;
  v_wallet_balance NUMERIC := 0;
  v_new_wallet_balance NUMERIC := 0;
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
    'RECORD_PAYMENT_ADMIN', 'payments', v_payment_id::TEXT, 
    jsonb_build_object(
      'id', v_payment_id,
      'amount', p_amount,
      'is_utcl_payment', p_is_utcl,
      'is_client_to_utcl', p_is_client_to_utcl
    ),
    p_user_id
  );

  -- 5. Wallet Credit on Overpayment (skip for UTCL payments)
  IF p_amount > v_remaining_balance AND p_is_utcl = FALSE AND p_po_id IS NOT NULL THEN
    v_overpayment := p_amount - v_remaining_balance;
    
    SELECT id, wallet_balance INTO v_profile_id, v_wallet_balance 
    FROM client_commercial_profiles 
    WHERE organization_id = p_org_id;

    IF v_profile_id IS NOT NULL THEN
      v_new_wallet_balance := COALESCE(v_wallet_balance, 0) + v_overpayment;
      
      UPDATE client_commercial_profiles 
      SET wallet_balance = v_new_wallet_balance 
      WHERE id = v_profile_id;

      INSERT INTO audit_logs (
        action, table_name, record_id, previous_values, new_values, user_id
      ) VALUES (
        'WALLET_CREDIT', 'client_commercial_profiles', v_profile_id::TEXT,
        jsonb_build_object('wallet_balance', v_wallet_balance),
        jsonb_build_object('wallet_balance', v_new_wallet_balance, 'reason', 'Overpayment of ' || v_overpayment || ' on PO ' || p_po_id),
        p_user_id
      );
    END IF;
  END IF;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
