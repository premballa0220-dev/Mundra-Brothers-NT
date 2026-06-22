-- =========================================================
-- ADD PRODUCT FIELDS (HSN CODE & GST RATE)
-- =========================================================

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS hsn_code TEXT,
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2);
