
export const getAdminPaymentMonitoring = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    // Fetch all POs with their client details
    const { data: pos, error: posError } = await supabase
      .from("purchase_orders")
      .select("*, organizations(id, name, client_commercial_profiles(*)), dispatch_requests(quantity, status), payments(amount, status)");

    if (posError) throw new Error("Failed to fetch POs: " + posError.message);

    // Aggregate data
    const monitoringData = pos.map((po: any) => {
      const dispatchedQuantity = po.dispatch_requests
        ?.filter((dr: any) => dr.status === "approved" || dr.status === "dispatched" || dr.status === "delivered")
        .reduce((sum: number, dr: any) => sum + (dr.quantity || 0), 0) || 0;

      const amountPaid = po.payments
        ?.filter((p: any) => p.status === "approved" || p.status === "verified")
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

      return {
        id: po.id,
        organization_id: po.organization_id,
        po_number: po.po_number,
        client_name: po.organizations?.name || "Unknown Client",
        total_value: po.total_value,
        dispatched_quantity: dispatchedQuantity,
        amount_paid: amountPaid,
        remaining_balance: po.total_value - amountPaid,
        status: po.status,
        credit_limit: po.organizations?.client_commercial_profiles?.[0]?.credit_limit || 0,
      };
    });

    return monitoringData;
  });

export const recordPaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      purchaseOrderId: z.string().uuid(),
      amount: z.number().positive(),
      paymentDate: z.string(),
      paymentMode: z.string(),
      referenceNumber: z.string(),
    })
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const payment = {
      id: crypto.randomUUID(),
      organization_id: data.organizationId,
      purchase_order_id: data.purchaseOrderId,
      amount: data.amount,
      payment_date: data.paymentDate,
      payment_mode: data.paymentMode,
      reference_number: data.referenceNumber,
      status: "approved",
      verified_by: context.userId,
    };

    const { error } = await supabase.from("payments").insert(payment);
    if (error) throw new Error("Failed to record payment: " + error.message);

    await createAuditLog(context.userId, "RECORD_PAYMENT_ADMIN", "payments", payment.id, null, payment);
    return { success: true, payment };
  });
