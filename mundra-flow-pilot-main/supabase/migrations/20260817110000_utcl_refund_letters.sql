-- =========================================================
-- UTCL REFUND LETTERS
-- Tracks refund letters from UTCL and whether payment has
-- been received by Mundra Brothers.
-- =========================================================
CREATE TABLE public.utcl_refund_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(15,2) NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_utcl_refund_letters_paid ON public.utcl_refund_letters(is_paid);
CREATE INDEX idx_utcl_refund_letters_created ON public.utcl_refund_letters(created_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utcl_refund_letters TO authenticated;
GRANT ALL ON public.utcl_refund_letters TO service_role;

-- Enable RLS
ALTER TABLE public.utcl_refund_letters ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only Mundra-side users can access
CREATE POLICY "utcl_refund_letters_select_mundra"
  ON public.utcl_refund_letters
  FOR SELECT TO authenticated
  USING (public.is_mundra_user());

CREATE POLICY "utcl_refund_letters_insert_mundra"
  ON public.utcl_refund_letters
  FOR INSERT TO authenticated
  WITH CHECK (public.is_mundra_user());

CREATE POLICY "utcl_refund_letters_update_mundra"
  ON public.utcl_refund_letters
  FOR UPDATE TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

CREATE POLICY "utcl_refund_letters_delete_mundra"
  ON public.utcl_refund_letters
  FOR DELETE TO authenticated
  USING (public.is_mundra_user());

-- Auto-update updated_at
CREATE TRIGGER trg_utcl_refund_letters_updated
  BEFORE UPDATE ON public.utcl_refund_letters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
