-- =========================================================
-- PRODUCTS
-- =========================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT,
  packaging TEXT,
  unit TEXT NOT NULL DEFAULT 'MT',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_all" ON public.products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "products_modify_mundra_admin" ON public.products
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- RATES
-- =========================================================
CREATE TABLE public.rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL means generic/default rate
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_from <= effective_to)
);

CREATE INDEX idx_rates_product_org ON public.rates(product_id, organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rates TO authenticated;
GRANT ALL ON public.rates TO service_role;
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rates_select_policy" ON public.rates
  FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "rates_modify_mundra_admin" ON public.rates
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- CLIENT COMMERCIAL PROFILES
-- =========================================================
CREATE TABLE public.client_commercial_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  credit_limit NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  payment_terms_days INT NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  grace_period_days INT NOT NULL DEFAULT 0 CHECK (grace_period_days >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_commercial_profiles TO authenticated;
GRANT ALL ON public.client_commercial_profiles TO service_role;
ALTER TABLE public.client_commercial_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_profile_select" ON public.client_commercial_profiles
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "commercial_profile_modify_mundra" ON public.client_commercial_profiles
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- CLIENT SEALS & SIGNATORIES
-- =========================================================
CREATE TABLE public.client_seals_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  signatory_name TEXT NOT NULL,
  designation TEXT,
  signature_url TEXT,
  seal_url TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  is_authorized BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_seals_signatories TO authenticated;
GRANT ALL ON public.client_seals_signatories TO service_role;
ALTER TABLE public.client_seals_signatories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seals_select" ON public.client_seals_signatories
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "seals_modify" ON public.client_seals_signatories
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user())
  WITH CHECK (organization_id = public.current_org_id() OR public.is_mundra_user());

-- =========================================================
-- PURCHASE ORDERS
-- =========================================================
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  po_number TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  original_quantity NUMERIC(12, 3) NOT NULL CHECK (original_quantity > 0),
  locked_rate NUMERIC(12, 2) NOT NULL CHECK (locked_rate >= 0),
  total_value NUMERIC(15, 2) NOT NULL CHECK (total_value >= 0),
  site_address TEXT NOT NULL,
  delivery_contact TEXT,
  document_method TEXT NOT NULL CHECK (document_method IN ('upload', 'generate')),
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_orders_org ON public.purchase_orders(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_select" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "pos_insert_client" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY "pos_update_client" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND status IN ('draft', 'pending_approval'))
  WITH CHECK (organization_id = public.current_org_id() AND status IN ('draft', 'pending_approval'));

CREATE POLICY "pos_modify_mundra" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- DISPATCH REQUESTS
-- =========================================================
CREATE TABLE public.dispatch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  requested_date DATE NOT NULL,
  site_address TEXT NOT NULL,
  delivery_contact TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  eligibility_result JSONB,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_requests_org ON public.dispatch_requests(organization_id);
CREATE INDEX idx_dispatch_requests_po ON public.dispatch_requests(purchase_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_requests TO authenticated;
GRANT ALL ON public.dispatch_requests TO service_role;
ALTER TABLE public.dispatch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatches_select" ON public.dispatch_requests
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "dispatches_insert_client" ON public.dispatch_requests
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY "dispatches_update_client" ON public.dispatch_requests
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND status IN ('draft', 'submitted'))
  WITH CHECK (organization_id = public.current_org_id() AND status IN ('draft', 'submitted'));

CREATE POLICY "dispatches_modify_mundra" ON public.dispatch_requests
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- INVOICES
-- =========================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  dispatch_request_id UUID REFERENCES public.dispatch_requests(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_org ON public.invoices(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "invoices_modify" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- PAYMENTS
-- =========================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  payment_mode TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  bank_name TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_org ON public.payments(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY "payments_modify" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- INVOICE ALLOCATIONS
-- =========================================================
CREATE TABLE public.invoice_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount >= 0),
  tds_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (tds_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_allocations TO authenticated;
GRANT ALL ON public.invoice_allocations TO service_role;
ALTER TABLE public.invoice_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allocations_select" ON public.invoice_allocations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_id AND (p.organization_id = public.current_org_id() OR public.is_mundra_user())
  ));

CREATE POLICY "allocations_modify" ON public.invoice_allocations
  FOR ALL TO authenticated
  USING (public.is_mundra_user() OR EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_id AND p.organization_id = public.current_org_id() AND p.status = 'submitted'
  ))
  WITH CHECK (public.is_mundra_user() OR EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_id AND p.organization_id = public.current_org_id() AND p.status = 'submitted'
  ));

-- =========================================================
-- REFUND LETTERS
-- =========================================================
CREATE TABLE public.refund_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.refund_letters TO authenticated;
GRANT ALL ON public.refund_letters TO service_role;
ALTER TABLE public.refund_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_select" ON public.refund_letters
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "refunds_modify" ON public.refund_letters
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- BALANCE CONFIRMATIONS
-- =========================================================
CREATE TABLE public.balance_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  quarter_end_date DATE NOT NULL,
  source_pdf_url TEXT,
  signed_pdf_url TEXT,
  due_date DATE NOT NULL,
  block_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_upload',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, quarter_end_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.balance_confirmations TO authenticated;
GRANT ALL ON public.balance_confirmations TO service_role;
ALTER TABLE public.balance_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "confirmations_select" ON public.balance_confirmations
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "confirmations_update" ON public.balance_confirmations
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user())
  WITH CHECK (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "confirmations_insert" ON public.balance_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- SPECIAL APPROVALS
-- =========================================================
CREATE TABLE public.special_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exception_type TEXT NOT NULL,
  dispatch_request_id UUID REFERENCES public.dispatch_requests(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  max_amount_allowance NUMERIC(15, 2),
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_approvals TO authenticated;
GRANT ALL ON public.special_approvals TO service_role;
ALTER TABLE public.special_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specials_select" ON public.special_approvals
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "specials_modify" ON public.special_approvals
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- =========================================================
-- ISSUES
-- =========================================================
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  dispatch_request_id UUID REFERENCES public.dispatch_requests(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL,
  comments TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;
GRANT ALL ON public.issues TO service_role;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issues_select" ON public.issues
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "issues_insert" ON public.issues
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY "issues_update" ON public.issues
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user())
  WITH CHECK (organization_id = public.current_org_id() OR public.is_mundra_user());

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_mundra_user() OR user_id = auth.uid());

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'mundra_super_admin') OR public.has_role(auth.uid(), 'mundra_readonly'));

CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =========================================================
-- TRIGGERS FOR updated_at
-- =========================================================
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rates_updated BEFORE UPDATE ON public.rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_client_commercial_profiles_updated BEFORE UPDATE ON public.client_commercial_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_client_seals_signatories_updated BEFORE UPDATE ON public.client_seals_signatories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_purchase_orders_updated BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_dispatch_requests_updated BEFORE UPDATE ON public.dispatch_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoice_allocations_updated BEFORE UPDATE ON public.invoice_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_refund_letters_updated BEFORE UPDATE ON public.refund_letters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_balance_confirmations_updated BEFORE UPDATE ON public.balance_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_special_approvals_updated BEFORE UPDATE ON public.special_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_issues_updated BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
