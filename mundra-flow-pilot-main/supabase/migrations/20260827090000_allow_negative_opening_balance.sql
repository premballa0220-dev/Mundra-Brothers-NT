-- Allow opening-balance invoices to carry a NEGATIVE amount so an invoice-level
-- credit (a "Cr" bill, e.g. "91.00 Cr") can be stored as its own invoice line
-- that subtracts from the client's Dr total — instead of being turned into an
-- on-account credit note. Normal (non opening-balance) invoices stay >= 0.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_amount_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_amount_check
  CHECK (amount >= 0 OR is_opening_balance = true);
