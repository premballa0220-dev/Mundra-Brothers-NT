-- =========================================================
-- CREATE CLIENT BILLING ADDRESSES TABLE
-- =========================================================
CREATE TABLE public.client_billing_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  gst_number TEXT,
  billing_address TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_billing_addresses TO authenticated;
GRANT ALL ON public.client_billing_addresses TO service_role;
ALTER TABLE public.client_billing_addresses ENABLE ROW LEVEL SECURITY;

-- Policies (same as delivery locations)
CREATE POLICY "client_billing_addresses_select" ON public.client_billing_addresses
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "client_billing_addresses_insert" ON public.client_billing_addresses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_mundra_user());

CREATE POLICY "client_billing_addresses_update" ON public.client_billing_addresses
  FOR UPDATE TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

CREATE POLICY "client_billing_addresses_delete" ON public.client_billing_addresses
  FOR DELETE TO authenticated
  USING (public.is_mundra_user());

-- Sync trigger: Keep the first is_default = true in sync with organizations
CREATE OR REPLACE FUNCTION public.sync_default_billing_address()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.is_default = true THEN
      UPDATE public.organizations
      SET 
        gst_number = NEW.gst_number,
        billing_address = NEW.billing_address
      WHERE id = NEW.organization_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_default = true THEN
      -- If the default was deleted, we might want to clear or pick another one. 
      -- For simplicity, we just leave the organizations table as-is or clear it.
      -- Let's leave it as-is to avoid accidental data loss.
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_billing_address_change
  AFTER INSERT OR UPDATE OR DELETE ON public.client_billing_addresses
  FOR EACH ROW EXECUTE FUNCTION public.sync_default_billing_address();
