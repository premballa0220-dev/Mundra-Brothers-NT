-- Add tracking columns to refund_letters table
ALTER TABLE public.refund_letters
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC;

-- Create an index to quickly sum allocated amounts per payment
CREATE INDEX IF NOT EXISTS idx_refund_letters_payment_amount 
ON public.refund_letters(payment_id, allocated_amount);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
