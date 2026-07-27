import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/auth.server";
import { requireAuth } from "@/integrations/auth/auth-middleware";

function ensureMundraOrg(orgType: string) {
  if (orgType !== "mundra") {
    throw new Error("Unauthorized: Mundra access required.");
  }
}

export const getPoFormats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(z.object({ organization_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    // Mundra staff can view any client's format; a client can only view its own.
    if (context.orgType !== "mundra" && context.organizationId !== data.organization_id) {
      throw new Error("Unauthorized: cannot view another organization's PO format.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: formats, error } = await supabase
      .from("po_formats")
      .select("*")
      .eq("organization_id", data.organization_id)
      .eq("is_active", true);

    if (error) throw new Error("Failed to fetch PO formats: " + error.message);
    return formats || [];
  });

export const upsertPoFormat = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid().optional(),
      organization_id: z.string().uuid(),
      format_name: z.string().min(1),
      template_schema: z.record(z.unknown()),
      is_active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // Only Mundra staff manage PO formats (matches the po_formats_modify RLS policy).
    ensureMundraOrg(context.orgType);

    const supabase = createSupabaseAdminClient();
    const { id, ...rest } = data;

    if (id) {
      const { error } = await supabase
        .from("po_formats")
        .update({
          format_name: rest.format_name,
          template_schema: rest.template_schema as any,
          is_active: rest.is_active ?? true,
        })
        .eq("id", id);
      if (error) throw new Error("Failed to update PO format: " + error.message);
    } else {
      const { error } = await supabase.from("po_formats").insert({
        organization_id: rest.organization_id,
        format_name: rest.format_name,
        template_schema: rest.template_schema as any,
        is_active: rest.is_active ?? true,
      });
      if (error) throw new Error("Failed to create PO format: " + error.message);
    }
    return { success: true };
  });
