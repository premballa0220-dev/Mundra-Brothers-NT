ALTER TABLE public.client_commercial_profiles
ADD COLUMN historical_invoices JSONB DEFAULT '[]'::jsonb;
