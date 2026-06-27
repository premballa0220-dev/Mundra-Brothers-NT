-- Migration to add client-specific letter details to balance_confirmations

ALTER TABLE balance_confirmations
ADD COLUMN outstanding_amount NUMERIC,
ADD COLUMN period_from DATE,
ADD COLUMN period_to DATE,
ADD COLUMN ref_no TEXT,
ADD COLUMN client_name TEXT,
ADD COLUMN client_address TEXT;
