-- Add annual_interest_rate to client_commercial_profiles
ALTER TABLE public.client_commercial_profiles 
ADD COLUMN IF NOT EXISTS annual_interest_rate NUMERIC(5, 2) DEFAULT 0 NOT NULL;
