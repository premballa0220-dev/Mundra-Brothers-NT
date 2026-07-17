-- Drop the old record_payment_admin to replace it with the new comprehensive one
DROP FUNCTION IF EXISTS record_payment_admin(UUID, UUID, UUID[], NUMERIC, DATE, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION update_invoice_status(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_original_amount NUMERIC;
  v_allocated_amount NUMERIC;
BEGIN
  SELECT amount INTO v_original_amount FROM invoices WHERE id = p_invoice_id;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_allocated_amount 
  FROM invoice_allocations 
  WHERE invoice_id = p_invoice_id;

  IF v_allocated_amount >= v_original_amount THEN
    UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = p_invoice_id;
  ELSIF v_allocated_amount > 0 THEN
    UPDATE invoices SET status = 'partially_paid', updated_at = NOW() WHERE id = p_invoice_id;
  ELSE
    UPDATE invoices SET status = 'unpaid', updated_at = NOW() WHERE id = p_invoice_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_payment_with_allocations(
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
  p_user_id UUID,
  p_manual_allocations JSONB -- Array of objects: { invoice_id, allocated_amount, tds_amount }
) RETURNS JSONB AS $$
DECLARE
  v_payment_id UUID;
  v_remaining_payment NUMERIC := p_amount;
  v_inv RECORD;
  v_outstanding NUMERIC;
  v_to_allocate NUMERIC;
  v_inserted_allocations JSONB := '[]'::jsonb;
  v_alloc_elem JSONB;
  v_invoice_id UUID;
  v_allocated NUMERIC;
  v_tds NUMERIC;
  v_total_allocated NUMERIC := 0;
BEGIN
  -- 1. Insert the payment
  INSERT INTO payments (
    organization_id, purchase_order_id, amount, payment_date, payment_mode, 
    reference_number, is_utcl_payment, is_client_to_utcl, is_advance, status, verified_by, verified_at
  ) VALUES (
    p_org_id, p_po_id, p_amount, p_payment_date, p_payment_mode, 
    p_ref_no, p_is_utcl, p_is_client_to_utcl, p_is_advance, 'approved', p_user_id, NOW()
  ) RETURNING id INTO v_payment_id;

  -- 2. Link dispatches to this payment
  IF p_dispatch_ids IS NOT NULL AND array_length(p_dispatch_ids, 1) > 0 THEN
    UPDATE dispatch_requests 
    SET utcl_payment_id = v_payment_id 
    WHERE id = ANY(p_dispatch_ids);
  END IF;

  -- 3. Process Allocations
  IF p_manual_allocations IS NOT NULL AND jsonb_array_length(p_manual_allocations) > 0 THEN
    -- MANUAL ALLOCATION
    FOR v_alloc_elem IN SELECT * FROM jsonb_array_elements(p_manual_allocations)
    LOOP
      v_invoice_id := (v_alloc_elem->>'invoice_id')::UUID;
      v_allocated := (v_alloc_elem->>'allocated_amount')::NUMERIC;
      v_tds := COALESCE((v_alloc_elem->>'tds_amount')::NUMERIC, 0);

      IF v_allocated > 0 OR v_tds > 0 THEN
        -- Lock invoice
        SELECT amount - COALESCE((SELECT SUM(allocated_amount) FROM invoice_allocations WHERE invoice_id = v_invoice_id), 0)
        INTO v_outstanding
        FROM invoices
        WHERE id = v_invoice_id AND organization_id = p_org_id AND status != 'cancelled'
        FOR UPDATE;

        IF v_outstanding IS NULL THEN
          RAISE EXCEPTION 'Invoice % not found or not eligible', v_invoice_id;
        END IF;

        IF v_allocated > v_outstanding THEN
          RAISE EXCEPTION 'Cannot allocate % to invoice %, only % outstanding', v_allocated, v_invoice_id, v_outstanding;
        END IF;

        INSERT INTO invoice_allocations (invoice_id, payment_id, allocated_amount, tds_amount)
        VALUES (v_invoice_id, v_payment_id, v_allocated, v_tds);
        
        PERFORM update_invoice_status(v_invoice_id);
        
        v_remaining_payment := v_remaining_payment - v_allocated;
        v_total_allocated := v_total_allocated + v_allocated;
      END IF;
    END LOOP;
  ELSE
    -- AUTO FIFO ALLOCATION
    FOR v_inv IN 
      SELECT id, amount 
      FROM invoices 
      WHERE organization_id = p_org_id 
      AND status IN ('unpaid', 'partially_paid') 
      AND status != 'cancelled'
      ORDER BY invoice_date ASC, created_at ASC, id ASC
      FOR UPDATE
    LOOP
      IF v_remaining_payment <= 0 THEN
        EXIT;
      END IF;

      -- Calculate dynamic outstanding
      SELECT v_inv.amount - COALESCE(SUM(allocated_amount), 0) 
      INTO v_outstanding 
      FROM invoice_allocations 
      WHERE invoice_id = v_inv.id;

      IF v_outstanding > 0 THEN
        v_to_allocate := LEAST(v_remaining_payment, v_outstanding);
        
        INSERT INTO invoice_allocations (invoice_id, payment_id, allocated_amount, tds_amount)
        VALUES (v_inv.id, v_payment_id, v_to_allocate, 0);

        PERFORM update_invoice_status(v_inv.id);

        v_remaining_payment := v_remaining_payment - v_to_allocate;
        v_total_allocated := v_total_allocated + v_to_allocate;
        
        v_inserted_allocations := v_inserted_allocations || jsonb_build_object(
          'invoice_id', v_inv.id,
          'allocated_amount', v_to_allocate,
          'tds_amount', 0
        );
      END IF;
    END LOOP;
  END IF;

  IF v_remaining_payment < 0 THEN
    RAISE EXCEPTION 'Total allocation exceeds payment amount';
  END IF;

  -- 4. Create Audit Log for Payment
  INSERT INTO audit_logs (
    action, table_name, record_id, new_values, user_id
  ) VALUES (
    'RECORD_PAYMENT', 'payments', v_payment_id::TEXT, 
    jsonb_build_object(
      'id', v_payment_id,
      'amount', p_amount,
      'is_utcl_payment', p_is_utcl,
      'is_client_to_utcl', p_is_client_to_utcl,
      'allocations_total', v_total_allocated,
      'unallocated', v_remaining_payment,
      'fifo_generated_allocations', v_inserted_allocations
    ),
    p_user_id
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'total_allocated', v_total_allocated,
    'unallocated_amount', v_remaining_payment,
    'fifo_allocations', v_inserted_allocations
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
