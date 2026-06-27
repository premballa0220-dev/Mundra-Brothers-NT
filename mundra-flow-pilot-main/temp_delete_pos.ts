
export const deletePurchaseOrdersAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ ids: z.array(z.string().uuid()) }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    
    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .in("id", data.ids);

    if (error) {
      throw new Error("Failed to delete Purchase Orders: " + error.message);
    }

    await createAuditLog(context.userId, "DELETE_PURCHASE_ORDERS_ADMIN", "purchase_orders", null, null, { deleted_ids: data.ids });
    return { success: true };
  });
