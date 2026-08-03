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
  p_manual_allocations JSONB,
  p_status TEXT,
  p_verified_by UUID
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
  v_first_dispatch_id UUID := NULL;
BEGIN
  IF p_dispatch_ids IS NOT NULL AND array_length(p_dispatch_ids, 1) > 0 THEN
    v_first_dispatch_id := p_dispatch_ids[1];
  END IF;

  -- 1. Insert the payment
  INSERT INTO payments (
    organization_id, purchase_order_id, dispatch_request_id, amount, payment_date, payment_mode, 
    reference_number, is_utcl_payment, is_client_to_utcl, is_advance, status, verified_by, verified_at
  ) VALUES (
    p_org_id, p_po_id, v_first_dispatch_id, p_amount, p_payment_date, p_payment_mode, 
    p_ref_no, p_is_utcl, p_is_client_to_utcl, p_is_advance, p_status, p_verified_by, CASE WHEN p_verified_by IS NOT NULL THEN NOW() ELSE NULL END
  ) RETURNING id INTO v_payment_id;

  -- 2. Link dispatches to this payment
  -- Fix: Only overwrite utcl_payment_id for Mundra-to-UTCL payments
  IF p_dispatch_ids IS NOT NULL AND array_length(p_dispatch_ids, 1) > 0 THEN
    IF COALESCE(p_is_client_to_utcl, FALSE) = FALSE THEN
      UPDATE dispatch_requests 
      SET utcl_payment_id = v_payment_id 
      WHERE id = ANY(p_dispatch_ids);
    END IF;
  END IF;

  -- 3. Process Allocations
  IF p_manual_allocations IS NOT NULL AND jsonb_array_length(p_manual_allocations) > 0 THEN
    -- MANUAL ALLOCATION
    FOR v_alloc_elem IN SELECT * FROM jsonb_array_elements(p_manual_allocations)
    LOOP
      -- Check if invoice_id is present (might be null if frontend sent a dispatch allocation)
      IF v_alloc_elem->>'invoice_id' IS NOT NULL THEN
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
      END IF;
    END LOOP;
  ELSE
    -- Priority Allocation: Dispatches selected in UI
    IF p_dispatch_ids IS NOT NULL AND array_length(p_dispatch_ids, 1) > 0 THEN
      FOR v_inv IN 
        SELECT id, amount 
        FROM invoices 
        WHERE organization_id = p_org_id 
        AND dispatch_request_id = ANY(p_dispatch_ids)
        AND status IN ('unpaid', 'partially_paid') 
        AND status != 'cancelled'
        ORDER BY invoice_date ASC, created_at ASC, id ASC
        FOR UPDATE
      LOOP
        IF v_remaining_payment <= 0 THEN
          EXIT;
        END IF;

        -- Calculate dynamic outstanding
        SELECT amount - COALESCE((SELECT SUM(allocated_amount) FROM invoice_allocations WHERE invoice_id = v_inv.id), 0)
        INTO v_outstanding
        FROM invoices WHERE id = v_inv.id;

        IF v_outstanding > 0 THEN
          v_to_allocate := LEAST(v_outstanding, v_remaining_payment);
          
          INSERT INTO invoice_allocations (invoice_id, payment_id, allocated_amount)
          VALUES (v_inv.id, v_payment_id, v_to_allocate);
          
          PERFORM update_invoice_status(v_inv.id);
          
          v_remaining_payment := v_remaining_payment - v_to_allocate;
          v_total_allocated := v_total_allocated + v_to_allocate;
        END IF;
      END LOOP;
    END IF;

    -- FIFO Allocation if still remaining
    IF v_remaining_payment > 0 THEN
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

        SELECT amount - COALESCE((SELECT SUM(allocated_amount) FROM invoice_allocations WHERE invoice_id = v_inv.id), 0)
        INTO v_outstanding
        FROM invoices WHERE id = v_inv.id;

        IF v_outstanding > 0 THEN
          v_to_allocate := LEAST(v_outstanding, v_remaining_payment);
          
          INSERT INTO invoice_allocations (invoice_id, payment_id, allocated_amount)
          VALUES (v_inv.id, v_payment_id, v_to_allocate);
          
          PERFORM update_invoice_status(v_inv.id);
          
          v_remaining_payment := v_remaining_payment - v_to_allocate;
          v_total_allocated := v_total_allocated + v_to_allocate;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'total_allocated', v_total_allocated,
    'remaining_unallocated', v_remaining_payment
  );
END;
$$ LANGUAGE plpgsql;
