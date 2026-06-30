import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/auth.server";
import { requireAuth } from "@/integrations/auth/auth-middleware";
import type { AppRole, OrgType } from "@/lib/auth-types";

async function createAuditLog(
  userId: string | null,
  action: string,
  tableName: string,
  recordId: string,
  prev: any,
  next: any,
) {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      table_name: tableName,
      record_id: recordId,
      previous_values: prev || null,
      new_values: next || null,
    });
    if (error) console.error("Failed to write audit log Supabase error:", error);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

function isSuperAdmin(roles: AppRole[]) {
  return roles.includes("mundra_super_admin");
}

function ensureMundraOrg(orgType: OrgType) {
  if (orgType !== "mundra") {
    throw new Error("Unauthorized: Mundra access required.");
  }
}

function ensureClientOrg(orgType: OrgType) {
  if (orgType === "mundra") {
    throw new Error("Unauthorized: Client access required.");
  }
}

async function loadProductsMap() {
  const supabase = createSupabaseAdminClient();
  const { data: products } = await supabase.from("products").select("*").eq("is_active", true);
  return new Map((products || []).map((product: any) => [product.id, product]));
}

async function loadOrganizationsMap() {
  const supabase = createSupabaseAdminClient();
  const { data: organizations } = await supabase.from("organizations").select("*");
  return new Map((organizations || []).map((org: any) => [org.id, org]));
}

function withNestedOrganization(document: any, organizationsMap: Map<string, any>) {
  return {
    ...document,
    organization: document.organization_id ? organizationsMap.get(document.organization_id) ?? null : null,
  };
}

function withNestedProduct(document: any, productsMap: Map<string, any>) {
  return {
    ...document,
    product: document.product_id ? productsMap.get(document.product_id) ?? null : null,
  };
}

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    const { organizationId, orgType } = context;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (orgType === "mundra") {
      const { count: activeClients } = await supabase
        .from("organizations")
        .select("*", { count: "exact", head: true })
        .eq("org_type", "client")
        .eq("status", "active");

      const { data: profiles } = await supabase.from("client_commercial_profiles").select("credit_limit");
      const sanctionedCredit = (profiles || []).reduce((sum: number, profile: any) => sum + Number(profile.credit_limit || 0), 0);

      const { data: invoices } = await supabase.from("invoices").select("amount, due_date, organization_id").neq("status", "paid");
      const outstanding = (invoices || []).reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
      const overdueInvoices = (invoices || []).filter((invoice: any) => invoice.due_date && invoice.due_date < todayStr);
      const overdue = overdueInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
      const overdueClients = new Set(overdueInvoices.map((inv: any) => inv.organization_id)).size;

      const { count: posPending } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("status", "pending_approval");
      const { count: posBlocked } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("status", "blocked");
      const { count: dispatchPending } = await supabase.from("dispatch_requests").select("*", { count: "exact", head: true }).eq("status", "submitted");
      const { count: dispatchBlocked } = await supabase.from("dispatch_requests").select("*", { count: "exact", head: true }).eq("status", "blocked");
      const { count: paymentsUnderVerification } = await supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "submitted");
      const { count: refundLettersPending } = await supabase.from("refund_letters").select("*", { count: "exact", head: true }).eq("status", "draft");
      const { count: balanceConfPending } = await supabase.from("balance_confirmations").select("*", { count: "exact", head: true }).neq("status", "approved");
      const { count: specialApprovalsActive } = await supabase.from("special_approvals").select("*", { count: "exact", head: true }).eq("status", "active");

      return {
        isAdmin: true,
        portfolio: {
          activeClients: activeClients || 0,
          sanctionedCredit,
          recognizedExposure: outstanding,
          availableCredit: Math.max(0, sanctionedCredit - outstanding),
          overdueClients,
          overdue90Plus: overdue,
        },
        queues: {
          posPending: posPending || 0,
          posBlocked: posBlocked || 0,
          dispatchPending: dispatchPending || 0,
          dispatchBlocked: dispatchBlocked || 0,
          paymentsUnderVerification: paymentsUnderVerification || 0,
          refundLettersPending: refundLettersPending || 0,
          balanceConfPending: balanceConfPending || 0,
          specialApprovalsActive: specialApprovalsActive || 0,
        },
      };
    }

    const { data: commProfile } = await supabase.from("client_commercial_profiles").select("credit_limit").eq("organization_id", organizationId).single();
    const creditLimit = commProfile ? Number(commProfile.credit_limit || 0) : 0;

    const { data: invoices } = await supabase
      .from("invoices")
      .select("amount, due_date")
      .eq("organization_id", organizationId)
      .neq("status", "paid");

    const outstanding = (invoices || []).reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
    const overdueInvoices = (invoices || []).filter((invoice: any) => invoice.due_date && invoice.due_date < todayStr);
    const overdue = overdueInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
    const oldestOverdueDays = overdueInvoices.length
      ? Math.round((today.getTime() - new Date(overdueInvoices[0].due_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const { count: pos } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("organization_id", organizationId);
    
    const { data: activeDRs } = await supabase
      .from("dispatch_requests")
      .select("quantity")
      .eq("organization_id", organizationId)
      .in("status", ["approved", "auto_approved"]);
    const dispatchedQty = (activeDRs || []).reduce((sum: number, dr: any) => sum + Number(dr.quantity || 0), 0);

    const { data: pendingPOs } = await supabase
      .from("purchase_orders")
      .select("original_quantity")
      .eq("organization_id", organizationId)
      .in("status", ["submitted", "pending_approval"]);
    const pendingPoQty = (pendingPOs || []).reduce((sum: number, po: any) => sum + Number(po.original_quantity || 0), 0);

    const { count: pendingPaymentApprovals } = await supabase.from("payments").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "submitted");
    const { count: pendingBalanceConfirmations } = await supabase.from("balance_confirmations").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["pending_upload", "under_review"]);

    const { data: blockedDispatches } = await supabase.from("dispatch_requests").select("*, purchase_orders(po_number)").eq("organization_id", organizationId).eq("status", "blocked");

    return {
      isAdmin: false,
      financials: {
        creditLimit,
        utilizedExposure: outstanding,
        outstanding,
        overdue,
        oldestOverdueDays,
      },
      operations: {
        activePOs: pos || 0,
        pendingPoQty,
        dispatchedQty,
        pendingPaymentApprovals: pendingPaymentApprovals || 0,
        pendingBalanceConfirmations: pendingBalanceConfirmations || 0,
      },
      blockedDispatches: (blockedDispatches || []).map((d: any) => ({
        id: d.id,
        reason: d.eligibility_result && typeof d.eligibility_result === 'object' && Array.isArray((d.eligibility_result as any).reasons)
          ? (d.eligibility_result as any).reasons.join(", ")
          : "Blocked by eligibility rules",
        po: d.purchase_orders?.po_number || d.purchase_order_id,
        site: d.site_address,
      })),
    };
  });

export const getClients = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const supabase = createSupabaseAdminClient();
    const { data: organizations } = await supabase.from("organizations").select("*").eq("org_type", "client").order("created_at", { ascending: false });
    const orgIds = (organizations || []).map((org: any) => org.id);
    
    let profiles: any[] = [];
    let locations: any[] = [];
    let products: any[] = [];
    let creditHistory: any[] = [];
    
    if (orgIds.length > 0) {
      const [{ data: p }, { data: l }, { data: pr }, { data: c }] = await Promise.all([
        supabase.from("client_commercial_profiles").select("*").in("organization_id", orgIds),
        supabase.from("client_delivery_locations").select("*").in("organization_id", orgIds),
        supabase.from("client_approved_products").select("*").in("organization_id", orgIds),
        supabase.from("client_credit_history").select("*").in("organization_id", orgIds).order("created_at", { ascending: false }),
      ]);
      profiles = p || [];
      locations = l || [];
      products = pr || [];
      creditHistory = c || [];
    }
    
    const profilesByOrg = new Map(profiles.map((profile: any) => [profile.organization_id, profile]));

    return (organizations || []).map((org: any) => ({
      ...org,
      client_commercial_profile: profilesByOrg.get(org.id) ?? null,
      delivery_locations: locations.filter((loc) => loc.organization_id === org.id),
      approved_products: products.filter((prod) => prod.organization_id === org.id),
      credit_history: creditHistory.filter((hist) => hist.organization_id === org.id),
    }));
  });

export const getClientDeliveryLocations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.orgType !== "client") throw new Error("Unauthorized");
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from("client_delivery_locations").select("*").eq("organization_id", context.organizationId);
    return data || [];
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      legalName: z.string().min(1),
      shortName: z.string().optional(),
      tradeName: z.string().optional(),
      gstNumber: z.string().optional(),
      panNumber: z.string().optional(),
      billingAddress: z.string().optional(),
      primaryContactName: z.string().optional(),
      primaryContactEmail: z.string().optional(),
      primaryContactPhone: z.string().regex(/^\d{10}$/, "Must be exactly 10 digits").optional().or(z.literal('')),
      creditLimit: z.number().nonnegative(),
      paymentTermsDays: z.number().nonnegative(),
      gracePeriodDays: z.number().nonnegative(),
      includeUndispatchedPos: z.boolean().default(false),
      includeDispatchedUnbilled: z.boolean().default(true),
      includeUnpaidInvoices: z.boolean().default(true),
      restrictions: z.string().optional(),
      deliveryLocations: z.array(z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        address: z.string().min(1),
        isDefault: z.boolean().default(false),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
      })).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) {
      throw new Error("Unauthorized: Only Mundra Super Admin can create clients.");
    }

    const supabase = createSupabaseAdminClient();
    const orgId = crypto.randomUUID();
    const org = {
      id: orgId,
      legal_name: data.legalName,
      short_name: data.shortName || null,
      trade_name: data.tradeName || null,
      org_type: "client" as const,
      gst_number: data.gstNumber || null,
      pan_number: data.panNumber || null,
      billing_address: data.billingAddress || null,
      primary_contact_name: data.primaryContactName || null,
      primary_contact_email: data.primaryContactEmail || null,
      primary_contact_phone: data.primaryContactPhone || null,
      status: "active" as const,
      status_reason: null,
    };

    const { error: orgError } = await supabase.from("organizations").insert(org);
    if (orgError) throw new Error("Failed to create organization: " + orgError.message);

    const profileId = crypto.randomUUID();
    const profile = {
      id: profileId,
      organization_id: orgId,
      credit_limit: data.creditLimit,
      payment_terms_days: data.paymentTermsDays,
      grace_period_days: data.gracePeriodDays,
      include_undispatched_pos: data.includeUndispatchedPos,
      include_dispatched_unbilled: data.includeDispatchedUnbilled,
      include_unpaid_invoices: data.includeUnpaidInvoices,
      restrictions: data.restrictions || null,
      commission_percentage: null,
    };
    const { error: profileError } = await supabase.from("client_commercial_profiles").insert(profile);
    if (profileError) throw new Error("Failed to create commercial profile: " + profileError.message);

    // Initial Credit History
    await supabase.from("client_credit_history").insert({
      organization_id: orgId,
      credit_limit: data.creditLimit,
      effective_from: new Date().toISOString().split('T')[0],
      created_by: context.userId,
    });

    if (data.deliveryLocations && data.deliveryLocations.length > 0) {
      const locations = data.deliveryLocations.map(loc => ({
        id: crypto.randomUUID(),
        organization_id: orgId,
        label: loc.label,
        address: loc.address,
        is_default: loc.isDefault,
        contact_person: loc.contactPerson || null,
        contact_phone: loc.contactPhone || null,
      }));
      await supabase.from("client_delivery_locations").insert(locations);
    }

    await createAuditLog(context.userId, "CREATE_CLIENT", "organizations", org.id, null, { org, profile });
    return { org, profile };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().min(1),
      legalName: z.string().min(1),
      shortName: z.string().optional(),
      tradeName: z.string().optional(),
      gstNumber: z.string().optional(),
      panNumber: z.string().optional(),
      billingAddress: z.string().optional(),
      primaryContactName: z.string().optional(),
      primaryContactEmail: z.string().optional(),
      primaryContactPhone: z.string().regex(/^\d{10}$/, "Must be exactly 10 digits").optional().or(z.literal('')),
      deliveryLocations: z.array(z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        address: z.string().min(1),
        isDefault: z.boolean().default(false),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
      })).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    try {
      const updates = {
        legal_name: data.legalName,
        short_name: data.shortName || null,
        trade_name: data.tradeName || null,
        gst_number: data.gstNumber || null,
        pan_number: data.panNumber || null,
        billing_address: data.billingAddress || null,
        primary_contact_name: data.primaryContactName || null,
        primary_contact_email: data.primaryContactEmail || null,
        primary_contact_phone: data.primaryContactPhone || null,
        updated_at: new Date().toISOString(),
      };

      const { error: orgError } = await supabase.from("organizations").update(updates).eq("id", data.organizationId);
      if (orgError) throw new Error("Failed to update organization: " + orgError.message);

      if (data.deliveryLocations) {
        await supabase.from("client_delivery_locations").delete().eq("organization_id", data.organizationId);
        if (data.deliveryLocations.length > 0) {
          const locations = data.deliveryLocations.map(loc => ({
            id: crypto.randomUUID(),
            organization_id: data.organizationId,
            label: loc.label,
            address: loc.address,
            is_default: loc.isDefault,
            contact_person: loc.contactPerson || null,
            contact_phone: loc.contactPhone || null,
          }));
          const { error: insertError } = await supabase.from("client_delivery_locations").insert(locations);
          if (insertError) throw new Error("Failed to insert locations: " + insertError.message);
        }
      }

      await createAuditLog(context.userId, "UPDATE_CLIENT", "organizations", data.organizationId, null, updates);

      // Fetch all users for this organization
      const { data: profiles } = await supabase.from("profiles").select("id").eq("organization_id", data.organizationId);
      
      // Create notifications for all users of the client organization
      if (profiles && profiles.length > 0) {
        const notifications = profiles.map((p: any) => ({
          id: crypto.randomUUID(),
          organization_id: data.organizationId,
          user_id: p.id,
          title: "Profile Updated",
          message: "Your organization details have been updated by Mundra admin.",
          is_read: false,
          link: "/client",
        }));
        
        const { error: notifError } = await supabase.from("notifications").insert(notifications);
        if (notifError) console.error("Failed to insert notifications:", notifError);
      }

      return { success: true };
    } catch (err: any) {
      console.error("updateClient failed:", err);
      throw new Error(err.message || "Failed to update client");
    }
  });

export const updateClientStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({
    organizationId: z.string().min(1),
    status: z.enum(["active", "suspended", "pending"]),
    reason: z.string().optional(),
  }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) {
      throw new Error("Unauthorized");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("organizations")
      .update({ status: data.status, status_reason: data.reason || null })
      .eq("id", data.organizationId);

    if (error) throw new Error("Failed to update status: " + error.message);
    
    await createAuditLog(context.userId, "UPDATE_ORG_STATUS", "organizations", data.organizationId, null, data);

    const { data: org } = await supabase.from("organizations").select("legal_name").eq("id", data.organizationId).single();
    const clientName = org?.legal_name || "A client";

    // Notify the client of their status change
    const title = `Account ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`;
    let message = `Your organization account status has been updated to ${data.status} by Mundra Administration.`;
    if (data.reason) {
      message += ` Reason: ${data.reason}`;
    }
    await broadcastNotification(supabase, title, message, "/client", data.organizationId);

    // Notify the admin team
    const adminMessage = `${clientName} account status has been updated to ${data.status}.` + (data.reason ? ` Reason: ${data.reason}` : "");
    await broadcastNotification(supabase, title, adminMessage, "/admin/clients", context.organizationId);

    return { success: true };
  });

export const updateClientCommercials = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({
    organizationId: z.string().min(1),
    creditLimit: z.number().nonnegative(),
    paymentTermsDays: z.number().nonnegative(),
    gracePeriodDays: z.number().nonnegative(),
    includeUndispatchedPos: z.boolean(),
    includeDispatchedUnbilled: z.boolean(),
    includeUnpaidInvoices: z.boolean(),
    restrictions: z.string().optional(),
  }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) {
      throw new Error("Unauthorized");
    }

    const supabase = createSupabaseAdminClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("client_commercial_profiles")
      .select("credit_limit, commission_percentage")
      .eq("organization_id", data.organizationId)
      .single();

    if (fetchErr && fetchErr.code !== "PGRST116") throw new Error("Failed to fetch current profile: " + fetchErr.message);

    let updateErr;
    if (fetchErr && fetchErr.code === "PGRST116") {
      const { error } = await supabase
        .from("client_commercial_profiles")
        .insert({
          id: crypto.randomUUID(),
          organization_id: data.organizationId,
          credit_limit: data.creditLimit,
          payment_terms_days: data.paymentTermsDays,
          grace_period_days: data.gracePeriodDays,
          include_undispatched_pos: data.includeUndispatchedPos,
          include_dispatched_unbilled: data.includeDispatchedUnbilled,
          include_unpaid_invoices: data.includeUnpaidInvoices,
          restrictions: data.restrictions || null,
          commission_percentage: (existing as any)?.commission_percentage || null,
        });
      updateErr = error;
    } else {
      const { error } = await supabase
        .from("client_commercial_profiles")
        .update({
          credit_limit: data.creditLimit,
          payment_terms_days: data.paymentTermsDays,
          grace_period_days: data.gracePeriodDays,
          include_undispatched_pos: data.includeUndispatchedPos,
          include_dispatched_unbilled: data.includeDispatchedUnbilled,
          include_unpaid_invoices: data.includeUnpaidInvoices,
          restrictions: data.restrictions || null,
        })
        .eq("organization_id", data.organizationId);
      updateErr = error;
    }

    if (updateErr) throw new Error("Failed to update commercial profile");

    // Add to history if credit limit changed
    if (!existing || existing.credit_limit !== data.creditLimit) {
      await supabase.from("client_credit_history").insert({
        organization_id: data.organizationId,
        credit_limit: data.creditLimit,
        effective_from: new Date().toISOString().split('T')[0],
        created_by: context.userId,
      });
    }

    await createAuditLog(context.userId, "UPDATE_COMMERCIALS", "client_commercial_profiles", data.organizationId, null, data);
    return { success: true };
  });
export const getProducts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const supabase = createSupabaseAdminClient();
    const { data: products } = await supabase.from("products").select("*, rates(*)").eq("is_active", true).order("name", { ascending: true });
    return (products || []).map((p: any) => {
      const activeGenericRate = (p.rates || []).find((r: any) => !r.organization_id && r.status === "active");
      const { rates, ...rest } = p;
      return {
        ...rest,
        basePrice: activeGenericRate ? activeGenericRate.amount : null
      };
    });
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      name: z.string().min(1),
      grade: z.string().optional(),
      packaging: z.string().optional(),
      unit: z.string().default("MT"),
      hsnCode: z.string().optional(),
      gstRate: z.number().optional(),
      basePrice: z.number().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);

    const supabase = createSupabaseAdminClient();
    const productId = crypto.randomUUID();
    const product = {
      id: productId,
      name: data.name,
      grade: data.grade || null,
      packaging: data.packaging || null,
      unit: data.unit,
      hsn_code: data.hsnCode || null,
      gst_rate: data.gstRate ?? null,
      is_active: true,
    };

    const { error } = await supabase.from("products").insert(product);
    if (error) throw new Error("Failed to create product: " + error.message);

    if (data.basePrice !== undefined) {
      await supabase.from("rates").insert({
        id: crypto.randomUUID(),
        product_id: product.id,
        organization_id: null,
        amount: data.basePrice,
        effective_from: new Date().toISOString().split("T")[0],
        status: "active"
      });
    }

    await createAuditLog(context.userId, "CREATE_PRODUCT", "products", product.id, null, product);
    return product;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      grade: z.string().optional(),
      packaging: z.string().optional(),
      unit: z.string().default("MT"),
      hsnCode: z.string().optional(),
      gstRate: z.number().optional(),
      basePrice: z.number().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);

    const supabase = createSupabaseAdminClient();
    const updates = {
      name: data.name,
      grade: data.grade || null,
      packaging: data.packaging || null,
      unit: data.unit,
      hsn_code: data.hsnCode || null,
      gst_rate: data.gstRate ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("products").update(updates).eq("id", data.id);
    if (error) throw new Error("Failed to update product: " + error.message);

    if (data.basePrice !== undefined) {
      const { data: activeRates } = await supabase.from("rates")
        .select("*")
        .eq("product_id", data.id)
        .is("organization_id", null)
        .eq("status", "active");
        
      const currentRate = activeRates?.[0];
      if (!currentRate || Number(currentRate.amount) !== Number(data.basePrice)) {
        if (currentRate) {
          await supabase.from("rates").update({ status: "inactive", effective_to: new Date().toISOString().split("T")[0] }).eq("id", currentRate.id);
        }
        await supabase.from("rates").insert({
          id: crypto.randomUUID(),
          product_id: data.id,
          organization_id: null,
          amount: data.basePrice,
          effective_from: new Date().toISOString().split("T")[0],
          status: "active"
        });
      }
    }

    await createAuditLog(context.userId, "UPDATE_PRODUCT", "products", data.id, null, updates);
    return { success: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);

    const supabase = createSupabaseAdminClient();
    
    // Check if product has any rates or POs tied to it (soft delete via is_active = false)
    const { count } = await supabase.from("rates").select("*", { count: "exact", head: true }).eq("product_id", data.id);
    if (count && count > 0) {
      // Soft delete if linked to rates
      const { error } = await supabase.from("products").update({ is_active: false }).eq("id", data.id);
      if (error) throw new Error("Failed to deactivate product: " + error.message);
      await createAuditLog(context.userId, "DEACTIVATE_PRODUCT", "products", data.id, null, { is_active: false });
    } else {
      // Hard delete if no relations
      const { error } = await supabase.from("products").delete().eq("id", data.id);
      if (error) throw new Error("Failed to delete product: " + error.message);
      await createAuditLog(context.userId, "DELETE_PRODUCT", "products", data.id, null, null);
    }
    
    return { success: true };
  });

export const getRates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const supabase = createSupabaseAdminClient();
    const { data: rates } = await supabase.from("rates").select("*");
    const productsMap = await loadProductsMap();
    const organizationsMap = await loadOrganizationsMap();

    return (rates || []).map((rate: any) => ({
      ...rate,
      product: productsMap.get(rate.product_id) ?? null,
      organization: rate.organization_id ? organizationsMap.get(rate.organization_id) ?? null : null,
    }));
  });

export const deleteRates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      ids: z.array(z.string().min(1)),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) {
      throw new Error("Unauthorized");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("rates").delete().in("id", data.ids);
    if (error) throw new Error("Failed to delete rates: " + error.message);
    
    await createAuditLog(context.userId, "DELETE_RATES", "rates", data.ids.join(","), null, null);
    return { success: true };
  });

async function runDispatchEligibilityCheck(dispatchRequestId: string, userId: string | null) {
  const supabase = createSupabaseAdminClient();
  const { data: dr } = await supabase.from("dispatch_requests").select("*").eq("id", dispatchRequestId).single();
  if (!dr) throw new Error("Dispatch request not found");

  const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", dr.purchase_order_id).single();
  if (!po) throw new Error("Purchase order not found for dispatch request");

  const orgId = dr.organization_id;
  const { data: commProfile } = await supabase.from("client_commercial_profiles").select("*").eq("organization_id", orgId).single();
  const creditLimit = commProfile ? Number(commProfile.credit_limit || 0) : 0;
  const paymentTerms = commProfile ? Number(commProfile.payment_terms_days || 30) : 30;
  const gracePeriod = commProfile ? Number(commProfile.grace_period_days || 0) : 0;

  const { data: org } = await supabase.from("organizations").select("status").eq("id", orgId).single();
  const organizationStatus = org?.status || "active";

  const { data: specials } = await supabase.from("special_approvals").select("*").eq("organization_id", orgId).eq("status", "active");
  const hasCreditOverride = (specials || []).some((s: any) => s.exception_type === "credit_limit");
  const hasTermsOverride = (specials || []).some((s: any) => s.exception_type === "overdue_payment");
  const hasConfOverride = (specials || []).some((s: any) => s.exception_type === "balance_confirmation");

  const { data: invoices } = await supabase.from("invoices").select("*").eq("organization_id", orgId).neq("status", "paid");
  const totalOutstanding = (invoices || []).reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);

  const dueDateFns = (invoices || []).map((invoice: any) => {
    const dueDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
    if (!dueDate) return null;
    dueDate.setDate(dueDate.getDate() + paymentTerms + gracePeriod);
    return dueDate;
  });
  const overdueInvoices = (invoices || []).filter((invoice: any, index: number) => {
    const dueDate = dueDateFns[index];
    return dueDate ? dueDate < new Date() : false;
  });
  const totalOverdue = overdueInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);

  const { data: activeDRs } = await supabase
    .from("dispatch_requests")
    .select("purchase_order_id, quantity")
    .eq("organization_id", orgId)
    .in("status", ["submitted", "auto_approved", "pending_mundra", "approved"]);

  const purchaseOrderIds = (activeDRs || []).map((item: any) => item.purchase_order_id);
  
  let purchaseOrders: any[] = [];
  if (purchaseOrderIds.length > 0) {
    const { data } = await supabase.from("purchase_orders").select("id, locked_rate").in("id", purchaseOrderIds);
    purchaseOrders = data || [];
  }
  const purchaseOrderMap = new Map(purchaseOrders.map((p: any) => [p.id, p]));

  const activeDispatchesValue = (activeDRs || []).reduce((sum: number, item: any) => {
    const itemPo = purchaseOrderMap.get(item.purchase_order_id);
    return sum + Number(item.quantity || 0) * Number(itemPo?.locked_rate || 0);
  }, 0);

  const includeUndispatched = commProfile?.include_undispatched_pos ?? false;
  const includeDispatched = commProfile?.include_dispatched_unbilled ?? true;
  const includeInvoices = commProfile?.include_unpaid_invoices ?? true;

  const currentVal = Number(dr.quantity || 0) * Number(po.locked_rate || 0);
  
  let totalExposure = 0;
  if (includeInvoices) totalExposure += totalOutstanding;
  if (includeDispatched) totalExposure += activeDispatchesValue;
  // Always include the current DR's value as it's the one we're checking, unless we include undispatched POs (in which case the PO value is already in exposure)
  totalExposure += currentVal;

  if (includeUndispatched) {
    // Fetch all approved POs and sum their remaining value
    const { data: approvedPOs } = await supabase
      .from("purchase_orders")
      .select("id, original_quantity, locked_rate")
      .eq("organization_id", orgId)
      .eq("status", "approved");
      
    let undispatchedValue = 0;
    if (approvedPOs && approvedPOs.length > 0) {
      // Get all approved dispatches for these POs to subtract from original_quantity
      const { data: allDispatches } = await supabase
        .from("dispatch_requests")
        .select("purchase_order_id, quantity")
        .in("purchase_order_id", approvedPOs.map((p: any) => p.id))
        .in("status", ["submitted", "auto_approved", "pending_mundra", "approved"]);
        
      for (const apo of approvedPOs) {
        const poDispatches = (allDispatches || []).filter((d: any) => d.purchase_order_id === apo.id);
        const dispatchedQty = poDispatches.reduce((s: number, d: any) => s + Number(d.quantity || 0), 0);
        const remainingQty = Math.max(0, Number(apo.original_quantity || 0) - dispatchedQty);
        undispatchedValue += remainingQty * Number(apo.locked_rate || 0);
      }
    }
    totalExposure += undispatchedValue;
    // If undispatched value is included, the currentVal is technically already part of undispatchedValue because the PO quantity hasn't been reduced by the currently checking DR yet (since the DR is just being evaluated).
    // Wait, the currently evaluating DR is already in `allDispatches` because it was just inserted before this function is called.
    // If it's already in `allDispatches`, then `dispatchedQty` includes it. So `undispatchedValue` is reduced by `currentVal`.
    // Thus `totalExposure += currentVal + undispatchedValue` is perfectly correct!
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const { data: overdueConfirmations } = await supabase
    .from("balance_confirmations")
    .select("id")
    .eq("organization_id", orgId)
    .neq("status", "approved")
    .lt("block_date", todayStr);
  const hasOverdueConfirmations = (overdueConfirmations || []).length > 0;

  const reasons: string[] = [];
  if (organizationStatus !== "active") {
    reasons.push("Client organization is inactive or suspended");
  }
  if (totalExposure > creditLimit && !hasCreditOverride) {
    reasons.push(
      `Credit limit breached — current exposure of ₹${totalExposure.toLocaleString()} exceeds the approved limit of ₹${creditLimit.toLocaleString()}`,
    );
  }
  if (totalOverdue > 0 && !hasTermsOverride) {
    reasons.push(`Client has ₹${totalOverdue.toLocaleString()} overdue beyond allowed terms`);
  }
  if (hasOverdueConfirmations && !hasConfOverride) {
    reasons.push("Quarterly balance confirmation is pending beyond the block date");
  }
  if (!po?.document_url) {
    reasons.push("Purchase Order authorized document is missing");
  }

  const passed = reasons.length === 0;
  const status = passed ? "auto_approved" : "blocked";
  const update = {
    status,
    eligibility_result: {
      passed,
      reasons,
      checked_at: new Date().toISOString(),
      details: {
        creditLimit,
        totalExposure,
        totalOverdue,
        hasOverdueConfirmations,
      },
    },
  };

  await supabase.from("dispatch_requests").update(update).eq("id", dispatchRequestId);
  const { data: updatedDr } = await supabase.from("dispatch_requests").select("*").eq("id", dispatchRequestId).single();
  await createAuditLog(userId, "EVALUATE_DISPATCH", "dispatch_requests", dispatchRequestId, dr, updatedDr);
  return updatedDr;
}

export const getPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("purchase_orders").select("*").order("created_at", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }

    const { data: purchaseOrders } = await query;

    const productsMap = await loadProductsMap();
    const organizationsMap = await loadOrganizationsMap();

    return (purchaseOrders || []).map((po: any) => ({
      ...po,
      product: productsMap.get(po.product_id) ?? null,
      organization: organizationsMap.get(po.organization_id) ?? null,
    }));
  });

export const getRatesForProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ productId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const { data: rates, error } = await supabase
      .from("rates")
      .select("*, organization:organizations(trade_name)")
      .eq("product_id", data.productId)
      .order("effective_from", { ascending: false });
    if (error) throw new Error("Failed to fetch rates");
    return rates;
  });

export const getApplicableRate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ productId: z.string().uuid(), organizationId: z.string().uuid().optional() }))
  .handler(async ({ data, context }) => {
    const orgId = context.orgType === "client" ? context.organizationId : data.organizationId;
    if (!orgId) throw new Error("Organization ID is required");
    
    const supabase = createSupabaseAdminClient();
    const today = new Date().toISOString().split("T")[0];

    // 1. Check client-specific rate
    const { data: clientRates } = await supabase
      .from("rates")
      .select("*")
      .eq("product_id", data.productId)
      .eq("organization_id", orgId)
      .eq("status", "active")
      .lte("effective_from", today)
      .order("effective_from", { ascending: false });

    const activeClientRate = clientRates?.find(r => !r.effective_to || r.effective_to >= today);
    if (activeClientRate) {
      return { rate: Number(activeClientRate.amount), source: "Client-Specific" };
    }

    // 2. Check generic rate
    const { data: genericRates } = await supabase
      .from("rates")
      .select("*")
      .eq("product_id", data.productId)
      .is("organization_id", null)
      .eq("status", "active")
      .lte("effective_from", today)
      .order("effective_from", { ascending: false });

    const activeGenericRate = genericRates?.find(r => !r.effective_to || r.effective_to >= today);
    if (activeGenericRate) {
      return { rate: Number(activeGenericRate.amount), source: "Generic Standard" };
    }

    return { rate: 0, source: "None" };
  });

export const proposeProductRate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({
    productId: z.string().uuid(),
    organizationId: z.string().uuid().nullable(),
    amount: z.number().positive(),
    effectiveFrom: z.string(),
    effectiveTo: z.string().nullable(),
  }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) throw new Error("Unauthorized");

    const supabase = createSupabaseAdminClient();
    const rateId = crypto.randomUUID();
    const { error } = await supabase.from("rates").insert({
      id: rateId,
      product_id: data.productId,
      organization_id: data.organizationId,
      amount: data.amount,
      effective_from: data.effectiveFrom,
      effective_to: data.effectiveTo,
      status: "pending_approval",
      created_by: context.userId,
      approved_by: null,
    });
    if (error) throw new Error("Failed to propose rate: " + error.message);
    await createAuditLog(context.userId, "PROPOSE_RATE", "rates", rateId, null, data);
    return { success: true };
  });

export const approveProductRate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ rateId: z.string().uuid(), action: z.enum(["approve", "reject"]) }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) throw new Error("Unauthorized");

    const supabase = createSupabaseAdminClient();
    
    if (data.action === "reject") {
      await supabase.from("rates").update({ status: "rejected" }).eq("id", data.rateId);
      return { success: true };
    }

    // Approval Flow
    const { data: proposedRate } = await supabase.from("rates").select("*").eq("id", data.rateId).single();
    if (!proposedRate) throw new Error("Rate not found");

    // 1. Expire older overlapping rates
    let oldRatesQuery = supabase
      .from("rates")
      .update({ effective_to: new Date().toISOString().split("T")[0] })
      .eq("product_id", proposedRate.product_id)
      .eq("status", "active")
      .neq("id", data.rateId);
    
    if (proposedRate.organization_id) {
      oldRatesQuery = oldRatesQuery.eq("organization_id", proposedRate.organization_id);
    } else {
      oldRatesQuery = oldRatesQuery.is("organization_id", null);
    }
    await oldRatesQuery;

    // 2. Activate new rate
    await supabase.from("rates").update({ status: "active", approved_by: context.userId }).eq("id", data.rateId);

    // 3. PO Auto-Cancellation Logic
    // "identify every older PO with an undelivered balance for the affected product/client scope and cancel that pending balance"
    let poQuery = supabase
      .from("purchase_orders")
      .select("id, original_quantity")
      .eq("product_id", proposedRate.product_id)
      .eq("status", "approved");
    
    if (proposedRate.organization_id) {
      poQuery = poQuery.eq("organization_id", proposedRate.organization_id);
    }
    const { data: activePOs } = await poQuery;

    if (activePOs && activePOs.length > 0) {
      const { data: allDispatches } = await supabase
        .from("dispatch_requests")
        .select("purchase_order_id, quantity")
        .in("purchase_order_id", activePOs.map(p => p.id))
        .in("status", ["submitted", "auto_approved", "pending_mundra", "approved"]);

      for (const po of activePOs) {
        const dispatches = (allDispatches || []).filter(d => d.purchase_order_id === po.id);
        const dispatchedQty = dispatches.reduce((sum, d) => sum + Number(d.quantity), 0);
        if (Number(po.original_quantity) > dispatchedQty) {
          // Cancel pending balance by adjusting original_quantity to match what was already dispatched
          await supabase.from("purchase_orders")
            .update({ original_quantity: dispatchedQty })
            .eq("id", po.id);
          await createAuditLog(context.userId, "CANCEL_PO_BALANCE_RATE_CHANGE", "purchase_orders", po.id, { original: po.original_quantity }, { new: dispatchedQty });
        }
      }
    }

    await createAuditLog(context.userId, "APPROVE_RATE", "rates", data.rateId, null, { action: "approve" });

    if (data.action === "approve") {
      const { data: product } = await supabase.from("products").select("name").eq("id", proposedRate.product_id).single();
      const productName = product?.name || "a product";
      const title = "New Rate Approved";
      const message = `A new ${proposedRate.organization_id ? "client-specific " : "global "}rate of ${proposedRate.amount} for ${productName} has been approved.`;
      await broadcastNotification(supabase, title, message, "/client", proposedRate.organization_id);
    }

    return { success: true };
  });

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      poNumber: z.string().min(1),
      productId: z.string().uuid(),
      originalQuantity: z.number().positive(),
      lockedRate: z.number().positive(),
      isExceptionRate: z.boolean().default(false),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
      documentMethod: z.enum(["upload", "generate"]),
      documentUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureClientOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    let finalRate = data.lockedRate;
    let status = "pending_approval";

    if (!data.isExceptionRate) {
      // Validate rate matches applicable rate
      const { data: clientRates } = await supabase.from("rates").select("*").eq("product_id", data.productId).eq("organization_id", context.organizationId).eq("status", "active").lte("effective_from", new Date().toISOString().split("T")[0]).order("effective_from", { ascending: false });
      const { data: genRates } = await supabase.from("rates").select("*").eq("product_id", data.productId).is("organization_id", null).eq("status", "active").lte("effective_from", new Date().toISOString().split("T")[0]).order("effective_from", { ascending: false });
      
      const applicable = clientRates?.find(r => !r.effective_to || r.effective_to >= new Date().toISOString().split("T")[0]) 
                      || genRates?.find(r => !r.effective_to || r.effective_to >= new Date().toISOString().split("T")[0]);
      
      if (!applicable) throw new Error("No active rate found for this product.");
      finalRate = Number(applicable.amount);
    } else {
      // Exception rate requested, could use a special status if needed, but pending_approval works.
      // We will rely on UI to show a badge for "Exception Rate" if locked_rate != applicable_rate.
    }

    const poId = crypto.randomUUID();
    const purchaseOrder = {
      id: poId,
      organization_id: context.organizationId,
      po_number: data.poNumber,
      product_id: data.productId,
      original_quantity: data.originalQuantity,
      locked_rate: finalRate,
      total_value: data.originalQuantity * finalRate,
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      document_method: data.documentMethod,
      document_url: data.documentUrl || null,
      status,
      created_by: context.userId,
      approved_by: null,
    };

    const { error } = await supabase.from("purchase_orders").insert(purchaseOrder);
    if (error) throw new Error("Failed to create PO: " + error.message);

    await createAuditLog(context.userId, "CREATE_PO", "purchase_orders", purchaseOrder.id, null, purchaseOrder);
    return purchaseOrder;
  });

export const createPurchaseOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      productId: z.string().uuid(),
      originalQuantity: z.number().positive(),
      lockedRate: z.number().positive().optional(),
      isExceptionRate: z.boolean().default(false),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
      documentMethod: z.enum(["upload", "generate"]),
      attachmentUrl: z.string().optional(),
      paymentTermsDays: z.number().nonnegative().optional(),
      poNumber: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    
    let finalRate = data.lockedRate || 0;
    if (!data.isExceptionRate && !data.lockedRate) {
      const { data: clientRates } = await supabase.from("rates").select("*").eq("product_id", data.productId).eq("organization_id", data.organizationId).eq("status", "active").lte("effective_from", new Date().toISOString().split("T")[0]).order("effective_from", { ascending: false });
      const { data: genRates } = await supabase.from("rates").select("*").eq("product_id", data.productId).is("organization_id", null).eq("status", "active").lte("effective_from", new Date().toISOString().split("T")[0]).order("effective_from", { ascending: false });
      const applicable = clientRates?.find(r => !r.effective_to || r.effective_to >= new Date().toISOString().split("T")[0]) 
                      || genRates?.find(r => !r.effective_to || r.effective_to >= new Date().toISOString().split("T")[0]);
      if (!applicable) throw new Error("No active rate found for this product.");
      finalRate = Number(applicable.amount);
    }

    const poId = crypto.randomUUID();
    const purchaseOrder = {
      id: poId,
      organization_id: data.organizationId,
      product_id: data.productId,
      original_quantity: data.originalQuantity,
      locked_rate: finalRate,
      total_value: data.originalQuantity * finalRate,
      status: "approved",
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      document_method: data.documentMethod,
      document_url: data.attachmentUrl || null,
      po_number: data.poNumber,
      approved_by: context.userId,
      created_by: context.userId,
    };

    const { error } = await supabase.from("purchase_orders").insert(purchaseOrder);
    if (error) throw new Error("Failed to create purchase order: " + error.message);

    await createAuditLog(context.userId, "CREATE_PO_ADMIN", "purchase_orders", purchaseOrder.id, null, purchaseOrder);
    
    // Broadcast notification to client
    const title = "New Purchase Order Generated";
    const message = `Purchase Order ${data.poNumber} has been generated and approved by Mundra on your behalf.`;
    await broadcastNotification(supabase, title, message, "/client/purchase-orders", data.organizationId);

    // Broadcast notification to admin team
    const { data: org } = await supabase.from("organizations").select("legal_name").eq("id", data.organizationId).single();
    const clientName = org?.legal_name || "a client";
    const adminMessage = `Admin generated and approved Purchase Order ${data.poNumber} for ${clientName}.`;
    await broadcastNotification(supabase, "Admin PO Generated", adminMessage, "/admin/po-queue", context.organizationId);

    return purchaseOrder;
  });

export const updatePurchaseOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);

    const supabase = createSupabaseAdminClient();
    const { data: prevPO } = await supabase.from("purchase_orders").select("*").eq("id", data.id).single();
    if (!prevPO) throw new Error("Purchase Order not found");

    await supabase.from("purchase_orders").update({ status: data.status, approved_by: context.userId }).eq("id", data.id);
    const { data: updatedPO } = await supabase.from("purchase_orders").select("*").eq("id", data.id).single();
    
    await createAuditLog(context.userId, "UPDATE_PO_STATUS", "purchase_orders", data.id, prevPO, updatedPO);

    if (updatedPO && (data.status === "approved" || data.status === "rejected")) {
      const title = `Purchase Order ${updatedPO.po_number} ${data.status === "approved" ? "Approved" : "Rejected"}`;
      const message = `Your purchase order has been marked as ${data.status.replace("_", " ")} by Mundra.`;
      await broadcastNotification(supabase, title, message, "/client/purchase-orders", updatedPO.organization_id);
    }

    return updatedPO;
  });

export const getDispatchRequests = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("dispatch_requests").select("*").order("created_at", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }

    const { data: dispatchRequests } = await query;
    const purchaseOrderIds = (dispatchRequests || []).map((dr: any) => dr.purchase_order_id);
    
    let purchaseOrders: any[] = [];
    if (purchaseOrderIds.length > 0) {
      const { data } = await supabase.from("purchase_orders").select("*, payments(amount, status, is_utcl_payment)").in("id", purchaseOrderIds);
      purchaseOrders = data || [];
    }
    const purchaseOrderMap = new Map(purchaseOrders.map((po: any) => [po.id, po]));
    const organizationsMap = await loadOrganizationsMap();

    return (dispatchRequests || []).map((dr: any) => ({
      ...dr,
      purchase_order: purchaseOrderMap.get(dr.purchase_order_id) ?? null,
      organization: organizationsMap.get(dr.organization_id) ?? null,
    }));
  });

export const createDispatchRequest = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      purchaseOrderId: z.string().uuid(),
      quantity: z.number().positive(),
      requestedDate: z.string(),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureClientOrg(context.orgType);

    const supabase = createSupabaseAdminClient();
    const drId = crypto.randomUUID();
    const dispatchRequest = {
      id: drId,
      purchase_order_id: data.purchaseOrderId,
      organization_id: context.organizationId,
      quantity: data.quantity,
      requested_date: data.requestedDate,
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      status: "submitted",
      eligibility_result: null,
      approved_by: null,
    };

    const { error } = await supabase.from("dispatch_requests").insert(dispatchRequest);
    if (error) throw new Error("Failed to create dispatch request: " + error.message);

    await createAuditLog(context.userId, "CREATE_DISPATCH", "dispatch_requests", dispatchRequest.id, null, dispatchRequest);
    await runDispatchEligibilityCheck(dispatchRequest.id, context.userId);
    return dispatchRequest;
  });

export const evaluateDispatchEligibility = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    return await runDispatchEligibilityCheck(data.id, context.userId);
  });

export const updateDispatchRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);

    const supabase = createSupabaseAdminClient();
    const { data: prevDr } = await supabase.from("dispatch_requests").select("*").eq("id", data.id).single();
    if (!prevDr) throw new Error("Dispatch request not found");

    await supabase.from("dispatch_requests").update({ status: data.status, approved_by: context.userId }).eq("id", data.id);
    const { data: dr } = await supabase.from("dispatch_requests").select("*").eq("id", data.id).single();
    
    await createAuditLog(context.userId, "UPDATE_DISPATCH_STATUS", "dispatch_requests", data.id, prevDr, dr);
    return dr;
  });

export const getPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("payments").select("*").order("payment_date", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }

    const { data: payments } = await query;
    const organizationsMap = await loadOrganizationsMap();
    return (payments || []).map((payment: any) => withNestedOrganization(payment, organizationsMap));
  });

export const submitPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      amount: z.number().positive(),
      paymentDate: z.string(),
      paymentMode: z.string().min(1),
      referenceNumber: z.string().min(1),
      bankName: z.string().optional(),
      proofUrl: z.string().optional(),
      isUtclPayment: z.boolean().optional(),
      isAdvance: z.boolean().optional(),
      allocations: z
        .array(
          z.object({
            invoiceId: z.string().uuid(),
            allocatedAmount: z.number().nonnegative(),
            tdsAmount: z.number().nonnegative(),
          }),
        )
        .optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureClientOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const paymentId = crypto.randomUUID();
    const payment = {
      id: paymentId,
      organization_id: context.organizationId,
      purchase_order_id: null,
      amount: data.amount,
      payment_date: data.paymentDate,
      payment_mode: data.paymentMode,
      reference_number: data.referenceNumber,
      bank_name: data.bankName || null,
      proof_url: data.proofUrl || null,
      is_utcl_payment: data.isUtclPayment ?? false,
      is_advance: data.isAdvance ?? false,
      status: "submitted",
      verified_by: null,
      verified_at: null,
    };

    const { error: paymentError } = await supabase.from("payments").insert(payment);
    if (paymentError) throw new Error("Failed to insert payment: " + paymentError.message);

    if (data.allocations?.length) {
      const allocations = data.allocations
        .filter((allocation) => allocation.allocatedAmount > 0 || allocation.tdsAmount > 0)
        .map((allocation) => ({
          id: crypto.randomUUID(),
          payment_id: payment.id,
          invoice_id: allocation.invoiceId,
          allocated_amount: allocation.allocatedAmount,
          tds_amount: allocation.tdsAmount,
        }));
      if (allocations.length) {
        const { error: allocError } = await supabase.from("invoice_allocations").insert(allocations);
        if (allocError) console.error("Failed to insert invoice allocations:", allocError);
      }
    }

    await createAuditLog(context.userId, "SUBMIT_PAYMENT", "payments", payment.id, null, {
      payment,
      allocations: data.allocations,
    });
    return payment;
  });

export const editPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      amount: z.number().positive(),
      paymentDate: z.string(),
      paymentMode: z.string(),
      referenceNumber: z.string(),
      bankName: z.string().optional(),
      proofUrl: z.string().optional(),
      isUtclPayment: z.boolean().optional(),
      isAdvance: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    
    const { data: prevPayment } = await supabase.from("payments").select("*").eq("id", data.id).single();
    if (!prevPayment) throw new Error("Payment not found");

    if (context.orgType !== "mundra" && prevPayment.organization_id !== context.organizationId) {
      throw new Error("Unauthorized to edit this payment");
    }

    const updated = {
      amount: data.amount,
      payment_date: data.paymentDate,
      payment_mode: data.paymentMode,
      reference_number: data.referenceNumber,
      bank_name: data.bankName || null,
      proof_url: data.proofUrl || null,
      is_utcl_payment: data.isUtclPayment ?? prevPayment.is_utcl_payment,
      is_advance: data.isAdvance ?? prevPayment.is_advance,
    };

    const { error } = await supabase.from("payments").update(updated).eq("id", data.id);
    if (error) throw new Error("Failed to edit payment: " + error.message);

    const { data: newPayment } = await supabase.from("payments").select("*").eq("id", data.id).single();
    await createAuditLog(context.userId, "EDIT_PAYMENT", "payments", data.id, prevPayment, newPayment);

    return newPayment;
  });


export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected", "under_verification"]),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: prevPayment } = await supabase.from("payments").select("*").eq("id", data.id).single();
    if (!prevPayment) throw new Error("Payment not found");

    await supabase.from("payments").update({ 
      status: data.status, 
      verified_by: context.userId, 
      verified_at: new Date().toISOString() 
    }).eq("id", data.id);

    const { data: payment } = await supabase.from("payments").select("*").eq("id", data.id).single();
    await createAuditLog(context.userId, "VERIFY_PAYMENT", "payments", data.id, prevPayment, payment);

    if (data.status === "approved" && payment) {
      await supabase.from("refund_letters").insert({
        id: crypto.randomUUID(),
        payment_id: data.id,
        organization_id: payment.organization_id,
        status: "draft",
        document_url: null,
      });
    }

    return payment;
  });

export const getInvoices = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("invoices").select("*").order("invoice_date", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }

    const { data: invoices } = await query;
    const organizationsMap = await loadOrganizationsMap();
    return (invoices || []).map((invoice: any) => withNestedOrganization(invoice, organizationsMap));
  });

export const getBalanceConfirmations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("balance_confirmations").select("*").order("quarter_end_date", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }
    const { data: confirmations } = await query;
    const organizationsMap = await loadOrganizationsMap();
    return (confirmations || []).map((conf: any) => withNestedOrganization(conf, organizationsMap));
  });

export const createBalanceConfirmationPeriod = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      quarterEndDate: z.string(),
      dueDate: z.string(),
      blockDate: z.string(),
      sourcePdfUrl: z.string().optional(),
      outstandingAmount: z.number().optional(),
      periodFrom: z.string().optional(),
      periodTo: z.string().optional(),
      refNo: z.string().optional(),
      clientName: z.string().optional(),
      clientAddress: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const id = crypto.randomUUID();
    const conf = {
      id,
      organization_id: data.organizationId,
      quarter_end_date: data.quarterEndDate,
      due_date: data.dueDate,
      block_date: data.blockDate,
      outstanding_amount: data.outstandingAmount ?? null,
      period_from: data.periodFrom ?? null,
      period_to: data.periodTo ?? null,
      ref_no: data.refNo ?? null,
      client_name: data.clientName ?? null,
      client_address: data.clientAddress ?? null,
      source_pdf_url: data.sourcePdfUrl || null,
      signed_pdf_url: null,
      status: "pending_upload",
      reviewed_by: null,
      reviewed_at: null,
    };

    const { error } = await supabase.from("balance_confirmations").insert(conf);
    if (error) throw new Error("Failed to create balance confirmation: " + error.message);

    await createAuditLog(context.userId, "CREATE_BALANCE_CONF_PERIOD", "balance_confirmations", conf.id, null, conf);
    return conf;
  });

export const uploadBalanceConfirmation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      signedPdfUrl: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const { data: prevConf } = await supabase.from("balance_confirmations").select("*").eq("id", data.id).single();
    if (!prevConf) throw new Error("Record not found");

    if (context.orgType !== "mundra" && prevConf.organization_id !== context.organizationId) {
      throw new Error("Unauthorized: Cross-tenant modification attempt blocked.");
    }

    await supabase.from("balance_confirmations").update({
      signed_pdf_url: data.signedPdfUrl,
      status: "under_review"
    }).eq("id", data.id);

    const { data: conf } = await supabase.from("balance_confirmations").select("*").eq("id", data.id).single();
    await createAuditLog(context.userId, "UPLOAD_BALANCE_CONF", "balance_confirmations", data.id, prevConf, conf);
    return conf;
  });

export const clientApproveBalanceConfirmation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const { data: prevConf } = await supabase.from("balance_confirmations").select("*").eq("id", data.id).single();
    if (!prevConf) throw new Error("Record not found");

    if (context.orgType !== "mundra" && prevConf.organization_id !== context.organizationId) {
      throw new Error("Unauthorized: Cross-tenant modification attempt blocked.");
    }

    await supabase.from("balance_confirmations").update({
      status: "Approved"
    }).eq("id", data.id);

    const { data: conf } = await supabase.from("balance_confirmations").select("*").eq("id", data.id).single();
    await createAuditLog(context.userId, "CLIENT_APPROVE_BALANCE_CONF", "balance_confirmations", data.id, prevConf, conf);
    return conf;
  });

export const verifyBalanceConfirmation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["Approved", "rejected"]),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const { data: prevConf } = await supabase.from("balance_confirmations").select("*").eq("id", data.id).single();
    if (!prevConf) throw new Error("Record not found");

    await supabase.from("balance_confirmations").update({
      status: data.status,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString()
    }).eq("id", data.id);

    const { data: conf } = await supabase.from("balance_confirmations").select("*").eq("id", data.id).single();
    await createAuditLog(context.userId, "VERIFY_BALANCE_CONF", "balance_confirmations", data.id, prevConf, conf);
    return conf;
  });

export const getSpecialApprovals = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("special_approvals").select("*").order("created_at", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }
    const { data: approvals } = await query;
    const organizationsMap = await loadOrganizationsMap();
    return (approvals || []).map((approval: any) => withNestedOrganization(approval, organizationsMap));
  });

export const createSpecialApproval = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      exceptionType: z.string().min(1),
      maxAmountAllowance: z.number().optional(),
      startDate: z.string(),
      expiryDate: z.string(),
      reason: z.string().min(1),
      dispatchRequestId: z.string().uuid().optional(),
      purchaseOrderId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const id = crypto.randomUUID();
    const sa = {
      id,
      organization_id: data.organizationId,
      exception_type: data.exceptionType,
      max_amount_allowance: data.maxAmountAllowance || null,
      start_date: data.startDate,
      expiry_date: data.expiryDate,
      reason: data.reason,
      dispatch_request_id: data.dispatchRequestId || null,
      purchase_order_id: data.purchaseOrderId || null,
      status: "active",
      approved_by: context.userId,
    };

    const { error } = await supabase.from("special_approvals").insert(sa);
    if (error) throw new Error("Failed to create special approval: " + error.message);

    await createAuditLog(context.userId, "CREATE_SPECIAL_APPROVAL", "special_approvals", sa.id, null, sa);
    return sa;
  });

export const getIssues = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("issues").select("*").order("created_at", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }
    const { data: issues } = await query;
    const organizationsMap = await loadOrganizationsMap();
    return (issues || []).map((issue: any) => withNestedOrganization(issue, organizationsMap));
  });

export const createIssue = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      issueType: z.string().min(1),
      comments: z.string().optional(),
      dispatchRequestId: z.string().uuid().optional(),
      attachmentUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const id = crypto.randomUUID();
    const issue = {
      id,
      organization_id: context.organizationId,
      dispatch_request_id: data.dispatchRequestId || null,
      issue_type: data.issueType,
      comments: data.comments || null,
      attachment_url: data.attachmentUrl || null,
      status: "open",
      assigned_to: null,
    };

    const { error } = await supabase.from("issues").insert(issue);
    if (error) throw new Error("Failed to create issue: " + error.message);

    await createAuditLog(context.userId, "CREATE_ISSUE", "issues", issue.id, null, issue);
    return issue;
  });

export const getAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const allowedRoles = ["mundra_super_admin", "mundra_readonly"] as const;
    if (!context.roles.some((role) => allowedRoles.includes(role as any))) {
      throw new Error("Unauthorized access to audit logs");
    }

    const supabase = createSupabaseAdminClient();
    const { data: logs } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
    return logs || [];
  });

export const getWorkflowSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    const orgId = context.organizationId;
    const { data, error } = await supabase
      .from("client_workflow_settings")
      .select("*")
      .eq("organization_id", orgId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error("Failed to fetch workflow settings: " + error.message);
    }
    return data || { po_workflow: "maker_approver", payment_workflow: "maker_approver" };
  });

export const updateWorkflowSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      poWorkflow: z.enum(["maker_only", "maker_approver"]),
      paymentWorkflow: z.enum(["maker_only", "maker_approver"]),
    })
  )
  .handler(async ({ data, context }) => {
    if (!context.roles.includes("client_admin") && !context.roles.includes("mundra_super_admin")) {
      throw new Error("Unauthorized");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("client_workflow_settings")
      .upsert({
        organization_id: context.organizationId,
        po_workflow: data.poWorkflow,
        payment_workflow: data.paymentWorkflow,
        updated_by: context.userId,
      });

    if (error) {
      throw new Error("Failed to update workflow settings: " + error.message);
    }

    await createAuditLog(context.userId, "UPDATE_WORKFLOW_SETTINGS", "client_workflow_settings", context.organizationId, null, data);
    return { success: true };
  });


export async function broadcastNotification(
  supabase: any,
  title: string,
  message: string,
  link: string | null = null,
  targetOrganizationId: string | null = null
) {
  let query = supabase.from("profiles").select("id, organization_id").eq("is_active", true);
  if (targetOrganizationId) {
    query = query.eq("organization_id", targetOrganizationId);
  }
  const { data: profiles, error } = await query;
  if (error || !profiles || profiles.length === 0) return;

  const notifications = profiles.map((p: any) => ({
    id: crypto.randomUUID(),
    organization_id: p.organization_id,
    user_id: p.id,
    title,
    message,
    is_read: false,
    link,
  }));

  const { error: notifError } = await supabase.from("notifications").insert(notifications);
  if (notifError) console.error("Failed to insert notifications:", notifError);
}

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

    // Asynchronously delete notifications older than 40 days to save DB space
    supabase.from("notifications")
      .delete()
      .lt("created_at", fortyDaysAgo.toISOString())
      .then(({ error }) => {
        if (error) console.error("Failed to prune old notifications:", error);
      });

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .gte("created_at", fortyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to fetch notifications: " + error.message);
    return data || [];
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    
    if (error) throw new Error("Failed to delete notification: " + error.message);
    return { success: true };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    
    if (error) throw new Error("Failed to mark notification as read: " + error.message);
    return { success: true };
  });


export const getClientDeliveryLocationsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const { data: locations } = await supabase.from("client_delivery_locations").select("*").eq("organization_id", data.organizationId);
    return locations || [];
  });

export const createDispatchRequestAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      purchaseOrderId: z.string().uuid(),
      quantity: z.number().positive(),
      requestedDate: z.string(),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const drId = crypto.randomUUID();
    const dispatchRequest = {
      id: drId,
      purchase_order_id: data.purchaseOrderId,
      organization_id: data.organizationId,
      quantity: data.quantity,
      requested_date: data.requestedDate,
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      status: "submitted",
      eligibility_result: null,
      approved_by: null,
    };
    const { error } = await supabase.from("dispatch_requests").insert(dispatchRequest);
    if (error) throw new Error("Failed to create dispatch request: " + error.message);
    await createAuditLog(context.userId, "CREATE_DISPATCH_REQUEST_ADMIN", "dispatch_requests", dispatchRequest.id, null, dispatchRequest);
    return dispatchRequest;
  });

export const editDispatchRequestAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      purchaseOrderId: z.string().uuid(),
      quantity: z.number().positive(),
      requestedDate: z.string(),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const { data: prevDr } = await supabase.from("dispatch_requests").select("*").eq("id", data.id).single();
    if (!prevDr) throw new Error("Dispatch request not found");

    const updateData = {
      purchase_order_id: data.purchaseOrderId,
      quantity: data.quantity,
      requested_date: data.requestedDate,
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
    };

    const { error } = await supabase.from("dispatch_requests").update(updateData).eq("id", data.id);
    if (error) throw new Error("Failed to update dispatch request: " + error.message);

    const { data: updatedDr } = await supabase.from("dispatch_requests").select("*").eq("id", data.id).single();
    await createAuditLog(context.userId, "EDIT_DISPATCH_REQUEST_ADMIN", "dispatch_requests", data.id, prevDr, updatedDr);
    return updatedDr;
  });

export const getAdminPaymentMonitoring = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    // Fetch all POs with their client details
    const { data: pos, error: posError } = await supabase
      .from("purchase_orders")
      .select("*, organizations(id, legal_name, client_commercial_profiles(*)), dispatch_requests(quantity, status), payments(id, amount, status, payment_date, payment_mode, reference_number, is_utcl_payment, is_advance)");

    if (posError) {
      console.error("POSTGREST ERROR:", posError);
      throw new Error("Failed to fetch POs: " + posError.message);
    }

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
        client_name: po.organizations?.legal_name || "Unknown Client",
        total_value: po.total_value,
        dispatched_quantity: dispatchedQuantity,
        amount_paid: amountPaid,
        remaining_balance: Math.max(0, po.total_value - amountPaid),
        status: po.status,
        credit_limit: po.organizations?.client_commercial_profiles?.credit_limit || 0,
        wallet_balance: po.organizations?.client_commercial_profiles?.wallet_balance || 0,
        payments_history: po.payments?.filter((p: any) => p.status === "approved" || p.status === "verified").sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()) || [],
      };
    });

    return monitoringData;
  });

export const getAdminUTCLPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    
    const { data: payments, error } = await supabase
      .from("payments")
      .select(`
        *,
        dispatch_requests!utcl_payment_id (
          id,
          quantity,
          site_address,
          purchase_orders (
            po_number,
            organizations (
              legal_name
            )
          )
        )
      `)
      .eq("is_utcl_payment", true)
      .order("payment_date", { ascending: false });
      
    if (error) {
      console.error("Failed to fetch UTCL payments:", error);
      throw new Error("Failed to fetch UTCL payments: " + error.message);
    }
    
    return payments;
  });

export const recordPaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      purchaseOrderId: z.string().uuid().optional(),
      dispatchRequestIds: z.array(z.string().uuid()).optional(),
      amount: z.number().positive(),
      paymentDate: z.string(),
      paymentMode: z.string(),
      referenceNumber: z.string(),
      isUtclPayment: z.boolean().optional(),
      isAdvance: z.boolean().optional(),
      isClientToUtcl: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: paymentId, error } = await supabase.rpc("record_payment_admin", {
      p_org_id: data.organizationId,
      p_po_id: data.purchaseOrderId || null,
      p_dispatch_ids: data.dispatchRequestIds || [],
      p_amount: data.amount,
      p_payment_date: data.paymentDate,
      p_payment_mode: data.paymentMode,
      p_ref_no: data.referenceNumber,
      p_is_utcl: data.isUtclPayment ?? false,
      p_is_client_to_utcl: data.isClientToUtcl ?? false,
      p_is_advance: data.isAdvance ?? false,
      p_user_id: context.userId,
    });

    if (error) throw new Error("Failed to record payment via RPC: " + error.message);

    // Fetch the inserted payment to return it to the client
    const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single();

    return { success: true, payment };
  });

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

    await createAuditLog(context.userId, "DELETE_PURCHASE_ORDERS_ADMIN", "purchase_orders", data.ids.join(",").substring(0, 50), null, { deleted_ids: data.ids });
    return { success: true };
  });

export const updatePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      amount: z.number().positive(),
      paymentDate: z.string(),
      paymentMode: z.string(),
      referenceNumber: z.string(),
    })
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: oldPayment, error: fetchError } = await supabase.from("payments").select("*").eq("id", data.id).single();
    if (fetchError || !oldPayment) throw new Error("Payment not found");

    const { error } = await supabase
      .from("payments")
      .update({
        amount: data.amount,
        payment_date: data.paymentDate,
        payment_mode: data.paymentMode,
        reference_number: data.referenceNumber,
      })
      .eq("id", data.id);

    if (error) throw new Error("Failed to update payment: " + error.message);

    await createAuditLog(context.userId, "UPDATE_PAYMENT_ADMIN", "payments", data.id, oldPayment, data);
    return { success: true };
  });

export const deletePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
    })
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: oldPayment } = await supabase.from("payments").select("*").eq("id", data.id).single();
    
    const { error } = await supabase.from("payments").delete().eq("id", data.id);
    if (error) throw new Error("Failed to delete payment: " + error.message);

    await createAuditLog(context.userId, "DELETE_PAYMENT_ADMIN", "payments", data.id, oldPayment, null);
    return { success: true };
  });
