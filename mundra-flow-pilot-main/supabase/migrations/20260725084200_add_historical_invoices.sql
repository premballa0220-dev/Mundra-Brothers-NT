ALTER TABLE public.client_commercial_profiles
ADD COLUMN IF NOT EXISTS historical_invoices JSONB DEFAULT '[]'::jsonb;
