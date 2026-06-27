-- Add commission_percentage to client_commercial_profiles
ALTER TABLE client_commercial_profiles
ADD COLUMN IF NOT EXISTS commission_percentage numeric(5,2);
