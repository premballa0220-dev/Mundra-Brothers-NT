
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.org_type AS ENUM ('mundra', 'client');
CREATE TYPE public.org_status AS ENUM ('active', 'suspended', 'pending');

CREATE TYPE public.app_role AS ENUM (
  -- Mundra-side
  'mundra_super_admin',
  'mundra_accounts',
  'mundra_po_dispatch',
  'mundra_approver',
  'mundra_readonly',
  -- Client-side
  'client_admin',
  'client_po_maker',
  'client_po_approver',
  'client_payment_maker',
  'client_payment_approver',
  'client_accounts',
  'client_readonly'
);

-- =========================================================
-- ORGANIZATIONS (tenants)
-- =========================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  short_name TEXT,
  org_type public.org_type NOT NULL,
  gst_number TEXT,
  pan_number TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  status public.org_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Seed the Mundra Brothers tenant (the operator org). All Mundra-side users belong here.
INSERT INTO public.organizations (id, legal_name, short_name, org_type, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Mundra Brothers', 'Mundra', 'mundra', 'active');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  full_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_org ON public.profiles(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES (separate to prevent privilege escalation)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY-DEFINER HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_mundra_user()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid() AND o.org_type = 'mundra'
  );
$$;

-- =========================================================
-- RLS POLICIES
-- =========================================================
-- Profiles: a user sees their own profile; Mundra users see all profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_mundra_user());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Organizations: a user sees their own org; Mundra users see all
CREATE POLICY "orgs_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "orgs_modify_mundra_admin" ON public.organizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'mundra_super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'mundra_super_admin'));

-- User roles: a user reads own roles; Mundra super admin reads all
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'mundra_super_admin'));

-- =========================================================
-- AUTO PROFILE CREATION ON SIGNUP
-- New users default to the Mundra org as 'mundra_readonly' so signups are not unauthorized,
-- but a Super Admin must re-assign organization + role to grant real access.
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_is_first BOOLEAN;
BEGIN
  -- Default to operator org
  v_org_id := '00000000-0000-0000-0000-000000000001';

  INSERT INTO public.profiles (id, organization_id, full_name, email, phone)
  VALUES (
    NEW.id,
    v_org_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );

  -- First-ever user becomes Mundra Super Admin to bootstrap the system
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO v_is_first;

  IF v_is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mundra_super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mundra_readonly');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
