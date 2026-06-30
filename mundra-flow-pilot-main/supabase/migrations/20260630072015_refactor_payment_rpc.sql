CREATE OR REPLACE FUNCTION record_payment_admin(
  p_org_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_ref_no TEXT,
  p_is_utcl BOOLEAN,
  p_is_client_to_utcl BOOLEAN,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  -- Insert the payment
  INSERT INTO payments (
    organization_id, amount, payment_date, payment_mode, reference_number, is_utcl_payment, is_client_to_utcl, status, verified_by
  ) VALUES (
    p_org_id, p_amount, p_payment_date, p_payment_mode, p_ref_no, p_is_utcl, p_is_client_to_utcl, 'approved', p_user_id
  ) RETURNING id INTO v_payment_id;

  -- (Optional) Update related dispatch requests or logs here...

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
