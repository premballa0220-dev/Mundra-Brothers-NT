-- Add is_opening_balance to invoices
ALTER TABLE public.invoices 
ADD COLUMN is_opening_balance BOOLEAN NOT NULL DEFAULT false;

-- Add a partial unique index for idempotency 
-- We allow one opening balance per organization per invoice_date (e.g. consolidated),
-- but we rely on the existing UNIQUE(invoice_number) for bill-wise imports.
-- The specification states: "For bill-wise opening balances, use a unique external/reference number... Do not create a database constraint that contradicts the intended model."
-- Since the existing invoice_number is globally UNIQUE, we don't need a new UNIQUE index. 
-- We will enforce the format OB-{ORG_CODE}-{CUSTOMER_CODE}-{REFERENCE} in the RPC.
