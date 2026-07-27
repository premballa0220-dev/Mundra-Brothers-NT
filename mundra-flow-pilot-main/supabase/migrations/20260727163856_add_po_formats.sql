CREATE TABLE public.po_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  format_name TEXT NOT NULL,
  template_schema JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_formats_org ON public.po_formats(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_formats TO authenticated;
GRANT ALL ON public.po_formats TO service_role;

ALTER TABLE public.po_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_formats_select" ON public.po_formats
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR public.is_mundra_user());

CREATE POLICY "po_formats_modify" ON public.po_formats
  FOR ALL TO authenticated
  USING (public.is_mundra_user())
  WITH CHECK (public.is_mundra_user());

-- Add po_format_id to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN po_format_id UUID REFERENCES public.po_formats(id) ON DELETE SET NULL;
  
-- Add po_format_data to purchase_orders to store the filled out data matching the format
ALTER TABLE public.purchase_orders
  ADD COLUMN po_format_data JSONB DEFAULT '{}'::jsonb;

CREATE TRIGGER trg_po_formats_updated BEFORE UPDATE ON public.po_formats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Example of what a format schema might look like:
/*
INSERT INTO public.po_formats (organization_id, format_name, template_schema)
VALUES (
  'some-org-id', 
  'Standard Format', 
  '{
    "fields": [
      { "name": "department_code", "label": "Department Code", "type": "text", "required": true },
      { "name": "project_id", "label": "Project ID", "type": "text", "required": false }
    ]
  }'::jsonb
);
*/
