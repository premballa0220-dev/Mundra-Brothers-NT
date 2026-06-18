-- =========================================================
-- FR-05: Client Master & Commercial Terms
-- =========================================================

-- Organizations Table Additions
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS trade_name TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS primary_contact_name TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- Client Commercial Profiles Additions
ALTER TABLE public.client_commercial_profiles ADD COLUMN IF NOT EXISTS include_undispatched_pos BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.client_commercial_profiles ADD COLUMN IF NOT EXISTS include_dispatched_unbilled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.client_commercial_profiles ADD COLUMN IF NOT EXISTS include_unpaid_invoices BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.client_commercial_profiles ADD COLUMN IF NOT EXISTS restrictions TEXT;

-- New Table: client_delivery_locations
CREATE TABLE IF NOT EXISTS public.client_delivery_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_delivery_locations_org ON public.client_delivery_locations(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_delivery_locations TO authenticated;
GRANT ALL ON public.client_delivery_locations TO service_role;
ALTER TABLE public.client_delivery_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_locations_select" ON public.client_delivery_locations
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "delivery_locations_modify" ON public.client_delivery_locations
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- New Table: client_approved_products
CREATE TABLE IF NOT EXISTS public.client_approved_products (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_approved_products TO authenticated;
GRANT ALL ON public.client_approved_products TO service_role;
ALTER TABLE public.client_approved_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_products_select" ON public.client_approved_products
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "approved_products_modify" ON public.client_approved_products
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- New Table: client_credit_history
CREATE TABLE IF NOT EXISTS public.client_credit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  credit_limit NUMERIC(15, 2) NOT NULL CHECK (credit_limit >= 0),
  effective_from DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_credit_history_org ON public.client_credit_history(organization_id);

GRANT SELECT, INSERT ON public.client_credit_history TO authenticated;
GRANT ALL ON public.client_credit_history TO service_role;
ALTER TABLE public.client_credit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_history_select" ON public.client_credit_history
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "credit_history_insert" ON public.client_credit_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_mundra_user());

-- Triggers for updated_at
CREATE TRIGGER trg_client_delivery_locations_updated BEFORE UPDATE ON public.client_delivery_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
