CREATE OR REPLACE FUNCTION cancel_opening_balance(
  p_invoice_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_inv RECORD;
  v_alloc_count INT;
BEGIN
  -- Validate existence and lock row
  SELECT * INTO v_inv 
  FROM invoices 
  WHERE id = p_invoice_id 
  AND is_opening_balance = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opening balance % not found', p_invoice_id;
  END IF;

  IF v_inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'Opening balance is already cancelled';
  END IF;

  -- Check allocations
  SELECT COUNT(*) INTO v_alloc_count 
  FROM invoice_allocations 
  WHERE invoice_id = p_invoice_id;

  IF v_alloc_count > 0 THEN
    RAISE EXCEPTION 'Cannot cancel opening balance with active allocations. Delete the associated payments first.';
  END IF;

  -- Cancel the invoice
  UPDATE invoices 
  SET status = 'cancelled', updated_at = NOW() 
  WHERE id = p_invoice_id;

  -- Audit log
  INSERT INTO audit_logs (
    action, table_name, record_id, old_values, new_values, user_id
  ) VALUES (
    'CANCEL_OPENING_BALANCE', 'invoices', p_invoice_id::TEXT, 
    jsonb_build_object('status', v_inv.status),
    jsonb_build_object('status', 'cancelled'),
    p_user_id
  );

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
