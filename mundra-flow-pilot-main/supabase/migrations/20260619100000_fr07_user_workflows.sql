-- =========================================================
-- FR-07: User Workflows & Approvals
-- =========================================================

-- ENUM updates for Profiles
CREATE TYPE public.user_approval_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status public.user_approval_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- =========================================================
-- WORKFLOW SETTINGS
-- =========================================================
CREATE TYPE public.workflow_type AS ENUM ('maker_only', 'maker_approver');

CREATE TABLE public.client_workflow_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_workflow public.workflow_type NOT NULL DEFAULT 'maker_approver',
  payment_workflow public.workflow_type NOT NULL DEFAULT 'maker_approver',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_workflow_settings TO authenticated;
GRANT ALL ON public.client_workflow_settings TO service_role;
ALTER TABLE public.client_workflow_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_select" ON public.client_workflow_settings
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "workflow_modify" ON public.client_workflow_settings
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user())
  WITH CHECK (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE TRIGGER trg_client_workflow_settings_updated BEFORE UPDATE ON public.client_workflow_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- UPDATE PROFILE CREATION TRIGGER
-- =========================================================
-- We drop and recreate the trigger function to read from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_is_first BOOLEAN;
  v_role TEXT;
  v_approval_status public.user_approval_status;
BEGIN
  -- Default to Mundra operator org if not provided via metadata
  v_org_id := COALESCE((NEW.raw_user_meta_data->>'organization_id')::UUID, '00000000-0000-0000-0000-000000000001');

  -- First-ever user gets super admin and bypasses approval
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO v_is_first;

  IF v_is_first THEN
    v_approval_status := 'approved';
  ELSE
    v_approval_status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, email, phone, approval_status)
  VALUES (
    NEW.id,
    v_org_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    v_approval_status
  );

  IF v_is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mundra_super_admin');
  ELSE
    -- If role is provided in metadata, use it, otherwise default to mundra_readonly
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'mundra_readonly');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role::public.app_role);
  END IF;

  RETURN NEW;
END;
$$;
