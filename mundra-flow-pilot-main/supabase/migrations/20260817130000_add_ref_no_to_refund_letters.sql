-- Add reference_number column to refund_letters table
ALTER TABLE public.refund_letters
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_refund_letters_reference_number 
ON public.refund_letters(reference_number);
