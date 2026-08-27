// Git test commit
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/auth.server";
import { requireAuth } from "@/integrations/auth/auth-middleware";
import type { AppRole, OrgType } from "@/lib/auth-types";

// Shape of the JSONB returned by the record_payment_with_allocations RPC.
type RecordPaymentRpcResult = {
  payment_id: string;
  total_allocated?: number;
  allocations?: unknown;
};

// The RPC's SQL params are nullable UUIDs, but supabase gen types them as
// non-null strings — allow null explicitly here.
const nullableUuid = (v: string | null | undefined) => (v ?? null) as unknown as string;

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

export function calculateClientExposure(
  profile: any,
  totalInvoicesValue: number,
  totalPaymentsValue: number,
  activeDispatchesValue: number,
  undispatchedPOsValue: number = 0
) {
  const includeInvoices = profile?.include_unpaid_invoices ?? true;
  const includeDispatched = profile?.include_dispatched_unbilled ?? true;
  const includeUndispatched = profile?.include_undispatched_pos ?? false;

  const invoiceBalance = totalInvoicesValue - totalPaymentsValue;
  let exposure = 0;

  if (invoiceBalance > 0) {
    if (includeInvoices) exposure += invoiceBalance;
  } else {
    exposure += invoiceBalance;
  }

  if (includeDispatched) exposure += activeDispatchesValue;
  if (includeUndispatched) exposure += undispatchedPOsValue;

  return Math.max(0, exposure);
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
    organization: document.organization_id
      ? (organizationsMap.get(document.organization_id) ?? null)
      : null,
  };
}

function withNestedProduct(document: any, productsMap: Map<string, any>) {
  return {
    ...document,
    product: document.product_id ? (productsMap.get(document.product_id) ?? null) : null,
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

      const { data: profiles } = await supabase
        .from("client_commercial_profiles")
        .select("*");
      const profilesByOrg = new Map((profiles || []).map((p: any) => [p.organization_id, p]));
      
      const sanctionedCredit = (profiles || []).reduce(
        (sum: number, profile: any) => sum + Number(profile.credit_limit || 0),
        0,
      );

      const { data: allInvoices } = await supabase
        .from("invoices")
        .select("amount, due_date, organization_id, status, is_opening_balance")
        .neq("status", "cancelled");

      const invoicesByOrg = new Map<string, number>();
      const totalInvoicesByOrg = new Map<string, number>();
      for (const inv of allInvoices || []) {
        totalInvoicesByOrg.set(inv.organization_id, (totalInvoicesByOrg.get(inv.organization_id) || 0) + Number(inv.amount || 0));
        if (!inv.is_opening_balance) {
          invoicesByOrg.set(inv.organization_id, (invoicesByOrg.get(inv.organization_id) || 0) + Number(inv.amount || 0));
        }
      }

      const { data: obAllocations } = await supabase
        .from("invoice_allocations")
        .select("allocated_amount, invoices!inner(organization_id, is_opening_balance)")
        .eq("invoices.is_opening_balance", true);

      const obAllocationsByOrg = new Map<string, number>();
      for (const alloc of obAllocations || []) {
        const orgId = (alloc.invoices as any)?.organization_id;
        if (orgId) {
          obAllocationsByOrg.set(orgId, (obAllocationsByOrg.get(orgId) || 0) + Number(alloc.allocated_amount || 0));
        }
      }

      const { data: dispatches } = await supabase
        .from("dispatch_requests")
        .select("organization_id, quantity, purchase_orders(locked_rate)")
        .in("status", ["approved", "auto_approved", "pending_mundra", "submitted"]);
      
      const dispatchesByOrg = new Map<string, number>();
      for (const dr of dispatches || []) {
        const val = Number(dr.quantity || 0) * Number((dr.purchase_orders as any)?.locked_rate || 0);
        dispatchesByOrg.set(dr.organization_id, (dispatchesByOrg.get(dr.organization_id) || 0) + val);
      }

      const { data: payments } = await supabase
        .from("payments")
        .select("organization_id, amount, is_client_to_utcl, is_utcl_payment, status")
        .eq("status", "approved");
      
      const paymentsByOrg = new Map<string, number>();
      const mundraUtclPaymentsByOrg = new Map<string, number>();
      
      for (const p of payments || []) {
        if (p.is_client_to_utcl || !p.is_utcl_payment) {
          paymentsByOrg.set(p.organization_id, (paymentsByOrg.get(p.organization_id) || 0) + Number(p.amount || 0));
        } else if (p.is_utcl_payment && !p.is_client_to_utcl) {
          mundraUtclPaymentsByOrg.set(p.organization_id, (mundraUtclPaymentsByOrg.get(p.organization_id) || 0) + Number(p.amount || 0));
        }
      }

      const { data: allAllocations } = await supabase
        .from("invoice_allocations")
        .select("invoice_id, allocated_amount, invoices!inner(organization_id)");

      const allocationsByOrg = new Map<string, number>();
      const allocationsByInvoice = new Map<string, number>();
      for (const alloc of allAllocations || []) {
        const orgId = (alloc.invoices as any)?.organization_id;
        if (orgId) {
          allocationsByOrg.set(orgId, (allocationsByOrg.get(orgId) || 0) + Number(alloc.allocated_amount || 0));
          allocationsByInvoice.set(alloc.invoice_id, (allocationsByInvoice.get(alloc.invoice_id) || 0) + Number(alloc.allocated_amount || 0));
        }
      }

      let outstanding = 0;
      let operationalOutstanding = 0;
      const allOrgIds = new Set([
        ...totalInvoicesByOrg.keys(),
        ...dispatchesByOrg.keys(),
        ...paymentsByOrg.keys(),
        ...mundraUtclPaymentsByOrg.keys()
      ]);
      
      for (const orgId of allOrgIds) {
        const profile = profilesByOrg.get(orgId);
        const invTotal = invoicesByOrg.get(orgId) || 0;
        const totalInvTotal = totalInvoicesByOrg.get(orgId) || 0;
        const obAllocations = obAllocationsByOrg.get(orgId) || 0;
        const totalPayTotal = paymentsByOrg.get(orgId) || 0;
        const payTotal = totalPayTotal - obAllocations;
        const dispTotal = dispatchesByOrg.get(orgId) || 0;
        const mundraUtclTotal = mundraUtclPaymentsByOrg.get(orgId) || 0;
        
        operationalOutstanding += calculateClientExposure(profile, invTotal + mundraUtclTotal, payTotal, dispTotal, 0);
        outstanding += calculateClientExposure(profile, totalInvTotal + mundraUtclTotal, totalPayTotal, dispTotal, 0);
      }

      const unpaidInvoices = (allInvoices || []).filter(
        (invoice: any) => invoice.status !== "paid",
      );
      const overdueInvoices = unpaidInvoices.filter(
        (invoice: any) => invoice.is_opening_balance || (invoice.due_date && invoice.due_date < todayStr),
      );
      let overdue = 0;
      let overdueClientsSet = new Set<string>();
      
      for (const orgId of allOrgIds) {
        const orgOverdueInvoices = overdueInvoices.filter((i: any) => i.organization_id === orgId);
        let orgOverdueInvoicesTotal = 0;
        
        for (const inv of orgOverdueInvoices) {
          const alloc = allocationsByInvoice.get(inv.id) || 0;
          orgOverdueInvoicesTotal += Math.max(0, Number(inv.amount || 0) - alloc);
        }
        
        const mundraUtclTotal = mundraUtclPaymentsByOrg.get(orgId) || 0;
        const clientPayments = paymentsByOrg.get(orgId) || 0;
        const clientAllocations = allocationsByOrg.get(orgId) || 0;
        const unallocatedClientPayments = Math.max(0, clientPayments - clientAllocations);
        
        const orgOverdue = Math.max(0, orgOverdueInvoicesTotal + mundraUtclTotal - unallocatedClientPayments);
        
        overdue += orgOverdue;
        if (orgOverdue > 0) {
          overdueClientsSet.add(orgId);
        }
      }
      const overdueClients = overdueClientsSet.size;

      const { count: posPending } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval");
      const { count: posBlocked } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "blocked");
      const { count: dispatchPending } = await supabase
        .from("dispatch_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted");
      const { count: dispatchBlocked } = await supabase
        .from("dispatch_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "blocked");
      const { count: paymentsUnderVerification } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted");
      const { count: refundLettersPending } = await supabase
        .from("refund_letters")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft");
      const { count: balanceConfPending } = await supabase
        .from("balance_confirmations")
        .select("*", { count: "exact", head: true })
        .neq("status", "approved");
      const { count: specialApprovalsActive } = await supabase
        .from("special_approvals")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      return {
        isAdmin: true,
        portfolio: {
          activeClients: activeClients || 0,
          sanctionedCredit,
          recognizedExposure: outstanding,
          availableCredit: Math.max(0, sanctionedCredit - operationalOutstanding),
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

    const { data: commProfile } = await supabase
      .from("client_commercial_profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .single();
    const creditLimit = commProfile ? Number(commProfile.credit_limit || 0) : 0;

    const { data: allInvoices } = await supabase
      .from("invoices")
      .select("amount, due_date, status, is_opening_balance")
      .eq("organization_id", organizationId)
      .neq("status", "cancelled");
    const invoiceDebits = (allInvoices || []).reduce(
      (sum: number, invoice: any) => sum + Number(invoice.amount || 0),
      0,
    );

    const { data: dispatches } = await supabase
      .from("dispatch_requests")
      .select("quantity, purchase_orders(locked_rate)")
      .eq("organization_id", organizationId)
      .in("status", ["approved", "auto_approved", "pending_mundra", "submitted"]);
    const dispatchDebits = (dispatches || []).reduce(
      (sum: number, dr: any) =>
        sum + Number(dr.quantity || 0) * Number(dr.purchase_orders?.locked_rate || 0),
      0,
    );

    const { data: payments } = await supabase
      .from("payments")
      .select("amount, is_client_to_utcl, is_utcl_payment, status")
      .eq("organization_id", organizationId)
      .eq("status", "approved");
    const validClientPayments = (payments || []).filter(
      (p: any) => p.is_client_to_utcl || !p.is_utcl_payment,
    );
    const totalCredits = validClientPayments.reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0,
    );
    
    const mundraUtclPayments = (payments || []).filter(
      (p: any) => p.is_utcl_payment && !p.is_client_to_utcl,
    );
    const mundraUtclTotal = mundraUtclPayments.reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0,
    );

    const outstanding = calculateClientExposure(commProfile, invoiceDebits + mundraUtclTotal, totalCredits, dispatchDebits, 0);

    const { data: allAllocations } = await supabase
      .from("invoice_allocations")
      .select("invoice_id, allocated_amount, invoices!inner(organization_id)")
      .eq("invoices.organization_id", organizationId);

    const allocationsByInvoice = new Map<string, number>();
    const totalClientAllocations = (allAllocations || []).reduce((sum, alloc) => {
      allocationsByInvoice.set(alloc.invoice_id, (allocationsByInvoice.get(alloc.invoice_id) || 0) + Number(alloc.allocated_amount || 0));
      return sum + Number(alloc.allocated_amount || 0);
    }, 0);

    const unallocatedClientPayments = Math.max(0, totalCredits - totalClientAllocations);

    const unpaidInvoices = (allInvoices || []).filter((invoice: any) => invoice.status !== "paid");
    const overdueInvoices = unpaidInvoices.filter(
      (invoice: any) => invoice.is_opening_balance || (invoice.due_date && invoice.due_date < todayStr),
    );
    
    let orgOverdueInvoicesTotal = 0;
    for (const inv of overdueInvoices) {
      const alloc = allocationsByInvoice.get(inv.id) || 0;
      orgOverdueInvoicesTotal += Math.max(0, Number(inv.amount || 0) - alloc);
    }
    
    const overdue = Math.max(0, orgOverdueInvoicesTotal + mundraUtclTotal - unallocatedClientPayments);
    const oldestOverdueDays = overdueInvoices.length
      ? Math.round(
          (today.getTime() - new Date(overdueInvoices[0].due_date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    const { count: pos } = await supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);

    const { data: activeDRs } = await supabase
      .from("dispatch_requests")
      .select("quantity")
      .eq("organization_id", organizationId)
      .in("status", ["approved", "auto_approved"]);
    const dispatchedQty = (activeDRs || []).reduce(
      (sum: number, dr: any) => sum + Number(dr.quantity || 0),
      0,
    );

    const { data: pendingPOs } = await supabase
      .from("purchase_orders")
      .select("original_quantity")
      .eq("organization_id", organizationId)
      .in("status", ["submitted", "pending_approval"]);
    const pendingPoQty = (pendingPOs || []).reduce(
      (sum: number, po: any) => sum + Number(po.original_quantity || 0),
      0,
    );

    const { count: pendingPaymentApprovals } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "submitted");
    const { count: pendingBalanceConfirmations } = await supabase
      .from("balance_confirmations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["pending_upload", "under_review"]);

    const { data: blockedDispatches } = await supabase
      .from("dispatch_requests")
      .select("*, purchase_orders(po_number)")
      .eq("organization_id", organizationId)
      .eq("status", "blocked");

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
        reason:
          d.eligibility_result &&
          typeof d.eligibility_result === "object" &&
          Array.isArray((d.eligibility_result as any).reasons)
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
    const { data: organizations } = await supabase
      .from("organizations")
      .select("*")
      .eq("org_type", "client")
      .order("created_at", { ascending: false });
    const orgIds = (organizations || []).map((org: any) => org.id);

    let profiles: any[] = [];
    let locations: any[] = [];
    let products: any[] = [];
    let creditHistory: any[] = [];
    let allDispatches: any[] = [];
    let allPayments: any[] = [];
    let allInvoices: any[] = [];
    let billingAddresses: any[] = [];
    let obAllocationsByOrg = new Map<string, number>();

    if (orgIds.length > 0) {
      const [{ data: p }, { data: l }, { data: pr }, { data: c }, { data: dr }, { data: pay }, { data: inv }, { data: obAlloc }, { data: ba }] =
        await Promise.all([
          supabase.from("client_commercial_profiles").select("*").in("organization_id", orgIds),
          supabase.from("client_delivery_locations").select("*").in("organization_id", orgIds),
          supabase.from("client_approved_products").select("*").in("organization_id", orgIds),
          supabase
            .from("client_credit_history")
            .select("*")
            .in("organization_id", orgIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("dispatch_requests")
            .select("organization_id, quantity, purchase_orders(locked_rate)")
            .in("organization_id", orgIds)
            .in("status", ["approved", "auto_approved", "pending_mundra", "submitted"]),
          supabase
            .from("payments")
            .select("organization_id, amount")
            .in("organization_id", orgIds)
            .eq("is_client_to_utcl", true)
            .eq("status", "approved"),
          supabase
            .from("invoices")
            .select("*")
            .in("organization_id", orgIds)
            .neq("status", "cancelled"),
          supabase
            .from("invoice_allocations")
            .select("allocated_amount, invoices!inner(organization_id, is_opening_balance)")
            .in("invoices.organization_id", orgIds)
            .eq("invoices.is_opening_balance", true),
          supabase.from("client_billing_addresses").select("*").in("organization_id", orgIds),
        ]);
      profiles = p || [];
      locations = l || [];
      products = pr || [];
      creditHistory = c || [];
      allDispatches = dr || [];
      allPayments = pay || [];
      allInvoices = inv || [];
      billingAddresses = ba || [];
      
      for (const alloc of obAlloc || []) {
        const orgId = (alloc.invoices as any)?.organization_id;
        if (orgId) {
          obAllocationsByOrg.set(orgId, (obAllocationsByOrg.get(orgId) || 0) + Number(alloc.allocated_amount || 0));
        }
      }
    }

    const profilesByOrg = new Map(
      profiles.map((profile: any) => [profile.organization_id, profile]),
    );

    const dispatchDebitsByOrg = new Map<string, number>();
    for (const dr of allDispatches) {
      const val = Number(dr.quantity || 0) * Number((dr.purchase_orders as any)?.locked_rate || 0);
      dispatchDebitsByOrg.set(dr.organization_id, (dispatchDebitsByOrg.get(dr.organization_id) || 0) + val);
    }
    
    const invoiceDebitsByOrg = new Map<string, number>();
    const totalInvoiceDebitsByOrg = new Map<string, number>();
    for (const inv of allInvoices) {
      totalInvoiceDebitsByOrg.set(
        inv.organization_id,
        (totalInvoiceDebitsByOrg.get(inv.organization_id) || 0) + Number(inv.amount || 0),
      );
      if (!inv.is_opening_balance) {
        invoiceDebitsByOrg.set(
          inv.organization_id,
          (invoiceDebitsByOrg.get(inv.organization_id) || 0) + Number(inv.amount || 0),
        );
      }
    }

    const creditsByOrg = new Map<string, number>();
    for (const pay of allPayments) {
      creditsByOrg.set(
        pay.organization_id,
        (creditsByOrg.get(pay.organization_id) || 0) + Number(pay.amount || 0),
      );
    }

    return (organizations || []).map((org: any) => {
      const profile = profilesByOrg.get(org.id) ?? null;
      const invTotal = invoiceDebitsByOrg.get(org.id) || 0;
      const totalInvTotal = totalInvoiceDebitsByOrg.get(org.id) || 0;
      const obAllocations = obAllocationsByOrg.get(org.id) || 0;
      const totalPayTotal = creditsByOrg.get(org.id) || 0;
      const payTotal = totalPayTotal - obAllocations;
      const dispTotal = dispatchDebitsByOrg.get(org.id) || 0;
      
      const operational_exposure = calculateClientExposure(profile, invTotal, payTotal, dispTotal, 0);
      const total_exposure = calculateClientExposure(profile, totalInvTotal, totalPayTotal, dispTotal, 0);
      
      const creditLimit = profile ? Number(profile.credit_limit || 0) : 0;
      const availableCredit = Math.max(0, creditLimit - operational_exposure);

      return {
        ...org,
        client_commercial_profile: profile
          ? { ...profile, available_credit: availableCredit, current_exposure: total_exposure }
          : null,
        delivery_locations: locations.filter((loc) => loc.organization_id === org.id),
        billing_addresses: billingAddresses.filter((ba) => ba.organization_id === org.id),
        approved_products: products.filter((prod) => prod.organization_id === org.id),
        credit_history: creditHistory.filter((hist) => hist.organization_id === org.id),
        invoices: allInvoices.filter((inv) => inv.organization_id === org.id),
      };
    });
  });

export const getClientDeliveryLocations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.orgType !== "client") throw new Error("Unauthorized");
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("client_delivery_locations")
      .select("*")
      .eq("organization_id", context.organizationId);
    return data || [];
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      legalName: z.string().optional().default("New Client Organization"),
      shortName: z.string().optional(),
      tradeName: z.string().optional(),
      partyCode: z.string().optional(),
      tpCode: z.string().optional(),
      gstNumber: z.string().optional(),
      panNumber: z.string().optional(),
      billingAddress: z.string().optional(),
      primaryContactName: z.string().optional(),
      primaryContactEmail: z.string().optional(),
      primaryContactPhone: z.string().optional().nullable().or(z.literal("")),
      creditLimit: z.number().nonnegative().optional().default(0),
      annualInterestRate: z.number().nonnegative().optional().default(0),
      paymentTermsDays: z.number().nonnegative().optional().default(30),
      gracePeriodDays: z.number().nonnegative().optional().default(0),
      includeUndispatchedPos: z.boolean().default(false),
      includeDispatchedUnbilled: z.boolean().default(true),
      includeUnpaidInvoices: z.boolean().default(true),
      restrictions: z.string().optional(),
      deliveryLocations: z
        .array(
          z.object({
            id: z.string().optional(),
            label: z.string().optional().default("Main Location"),
            address: z.string().optional().default(""),
            isDefault: z.boolean().default(false),
            contactPerson: z.string().optional().nullable(),
            contactPhone: z.string().optional().nullable(),
          }),
        )
        .optional(),
      billingProfiles: z
        .array(
          z.object({
            id: z.string().optional(),
            gstNumber: z.string().optional().nullable(),
            billingAddress: z.string().optional().nullable(),
            isDefault: z.boolean().default(false),
          }),
        )
        .optional(),
      logoUrl: z.string().optional().nullable(),
      stampUrl: z.string().optional().nullable(),
      initialOpeningBalance: z.number().optional(),
      initialOpeningBalanceType: z.enum(["DR", "CR"]).optional().default("DR"),
      initialOpeningBalanceDate: z.string().optional(),
      openingInvoices: z
        .array(
          z.object({
            invoiceNumber: z.string().min(1),
            amount: z.number().positive(),
            date: z.string().min(1),
            mundraPaymentDate: z.string().optional(),
            type: z.enum(["DR", "CR"]).optional(),
          }),
        )
        .optional(),
      // Debit notes that make up part of the opening balance, alongside invoices.
      openingDebitNotes: z
        .array(
          z.object({
            amount: z.number().positive(),
            fromDate: z.string().min(1),
            toDate: z.string().min(1),
          }),
        )
        .optional(),
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
      party_code: data.partyCode || null,
      tp_code: data.tpCode || null,
      org_type: "client" as const,
      gst_number: data.gstNumber || null,
      pan_number: data.panNumber || null,
      billing_address: data.billingAddress || null,
      primary_contact_name: data.primaryContactName || null,
      primary_contact_email: data.primaryContactEmail || null,
      primary_contact_phone: data.primaryContactPhone || null,
      logo_url: data.logoUrl || null,
      stamp_url: data.stampUrl || null,
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
      annual_interest_rate: data.annualInterestRate,
      payment_terms_days: data.paymentTermsDays,
      grace_period_days: data.gracePeriodDays,
      include_undispatched_pos: data.includeUndispatchedPos,
      include_dispatched_unbilled: data.includeDispatchedUnbilled,
      include_unpaid_invoices: data.includeUnpaidInvoices,
      restrictions: data.restrictions || null,
      commission_percentage: null,
      // historical_invoices is JSONB, so debit notes are stored in the same list
      // with a type marker rather than needing their own column.
      historical_invoices: [
        ...(data.openingInvoices || []).map((inv) => ({ ...inv, type: inv.type || "DR" })),
        ...(data.openingDebitNotes || []).map((dn) => ({ ...dn, type: "debit_note" })),
      ],
    };
    const { error: profileError } = await supabase
      .from("client_commercial_profiles")
      .insert(profile as any);
    if (profileError)
      throw new Error("Failed to create commercial profile: " + profileError.message);

    // Initial Credit History
    await supabase.from("client_credit_history").insert({
      organization_id: orgId,
      credit_limit: data.creditLimit,
      effective_from: new Date().toISOString().split("T")[0],
      created_by: context.userId,
    });

    if (data.deliveryLocations && data.deliveryLocations.length > 0) {
      const locations = data.deliveryLocations.map((loc) => ({
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
    
    if (data.billingProfiles && data.billingProfiles.length > 0) {
      const profiles = data.billingProfiles.map((p) => ({
        id: crypto.randomUUID(),
        organization_id: orgId,
        gst_number: p.gstNumber || null,
        billing_address: p.billingAddress || null,
        is_default: p.isDefault,
      }));
      await supabase.from("client_billing_addresses").insert(profiles);
      
      // Update root organization with default profile if trigger hasn't fired yet
      const defaultProfile = profiles.find((p) => p.is_default) || profiles[0];
      if (defaultProfile) {
        org.gst_number = defaultProfile.gst_number;
        org.billing_address = defaultProfile.billing_address;
      }
    }
    await createAuditLog(context.userId, "CREATE_CLIENT", "organizations", org.id, null, {
      org,
      profile,
    });

    // Bill-wise opening balances: create one invoice row per opening invoice
    // using the REAL invoice number the user entered (e.g. "160"), so it shows
    // as-is in Client-to-UTCL and flows through the refund-letter machinery
    // exactly like a dispatch invoice (real number, per-bill allocation,
    // bifurcation). Debit notes that form part of the opening balance are also
    // created as opening-balance rows so exposure stays correct. Only when
    // nothing was itemised do we fall back to a single consolidated OB invoice.
    const obRows: any[] = [];
    const { data: mundraOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("org_type", "mundra")
      .limit(1)
      .maybeSingle();

    const hasItemizedRows = (data.openingInvoices && data.openingInvoices.length > 0) || (data.openingDebitNotes && data.openingDebitNotes.length > 0);

    for (const inv of data.openingInvoices || []) {
      // A Cr invoice is an invoice-level credit (e.g. the "91.00 Cr" bill): keep
      // it as its own opening-balance invoice line but with a NEGATIVE amount, so
      // it subtracts from the client's Dr total and reads as a Cr in the ledger —
      // distinct from a general on-account credit (the consolidated CR path below
      // still records that as a credit note).
      const signedAmount = inv.type === "CR" ? -Math.abs(inv.amount) : Math.abs(inv.amount);
      obRows.push({
        id: crypto.randomUUID(),
        organization_id: orgId,
        invoice_number: inv.invoiceNumber,
        amount: signedAmount,
        invoice_date: inv.date,
        due_date: inv.date,
        status: "unpaid",
        is_opening_balance: true,
      });
    }
    for (const dn of data.openingDebitNotes || []) {
      obRows.push({
        id: crypto.randomUUID(),
        organization_id: orgId,
        invoice_number: `DN-${orgId.slice(0, 8)}-${dn.fromDate}-${dn.toDate}`,
        amount: dn.amount,
        invoice_date: dn.toDate,
        due_date: dn.toDate,
        status: "unpaid",
        is_opening_balance: true,
      });
    }

    if (obRows.length > 0) {
      // A Cr invoice is a NEGATIVE opening-balance row, so it nets straight into
      // the invoice sum (Dr − Cr). It is never turned into a credit note, so the
      // on-account/credit row only ever holds genuine on-account credits.
      //
      // Bulk-insert in a couple of round trips rather than one row at a time — a
      // large itemised import (hundreds of bills) doing N sequential inserts plus
      // N sequential audit-log writes previously outran the serverless function's
      // time budget, crashed mid-way, and left the client half-created; retrying
      // then created a brand-new duplicate client each time. A duplicate
      // invoice_number (globally UNIQUE) would reject the whole batch, so any
      // numbers that already exist are pre-filtered out and reported, and
      // everything else goes in as one insert plus one batched audit-log insert.
      const allNumbers = obRows.map((r) => r.invoice_number);
      const { data: existingRows } = await supabase
        .from("invoices")
        .select("invoice_number")
        .in("invoice_number", allNumbers);
      const existingSet = new Set((existingRows || []).map((r: any) => r.invoice_number));

      const toInsert = obRows.filter((r) => !existingSet.has(r.invoice_number));
      for (const row of obRows.filter((r) => existingSet.has(r.invoice_number))) {
        console.error(`Skipped opening balance ${row.invoice_number}: invoice number already exists`);
      }

      if (toInsert.length > 0) {
        const { error: bulkErr } = await supabase.from("invoices").insert(toInsert);
        if (bulkErr) {
          console.error("Bulk opening-balance insert failed", bulkErr);
        } else {
          const auditRows = toInsert.map((row) => ({
            user_id: context.userId,
            action: "CREATE_OPENING_BALANCE",
            table_name: "invoices",
            record_id: row.id,
            previous_values: null,
            new_values: row,
          }));
          const { error: auditErr } = await supabase.from("audit_logs").insert(auditRows);
          if (auditErr) console.error("Failed to batch-write opening balance audit logs", auditErr);
        }
      }
    } else if (!hasItemizedRows && data.initialOpeningBalance !== undefined && data.initialOpeningBalanceDate) {
      // Consolidated single opening balance (no itemisation).
      if (data.initialOpeningBalanceType === "CR") {
        if (mundraOrg) {
          const cnRow = {
            id: crypto.randomUUID(),
            credit_note_number: `CN-OB-${Date.now().toString().slice(-6)}`,
            issue_date: data.initialOpeningBalanceDate,
            amount: data.initialOpeningBalance,
            reason: "Other" as const,
            remarks: "Initial Opening Balance Credit",
            issued_by_org_id: mundraOrg.id,
            issued_to_org_id: orgId,
            origin_type: "Dispatch" as const,
            origin_reference: "OPENING_BALANCE",
            status: "applied" as const,
            created_by: context.userId,
          };
          const { error: cnErr } = await supabase.from("credit_notes").insert(cnRow);
          if (cnErr) {
            console.error("Failed to create initial opening balance credit note", cnErr);
          } else {
            await createAuditLog(context.userId, "CREATE_CREDIT_NOTE", "credit_notes", cnRow.id, null, cnRow);
          }
        }
      } else {
        const invId = crypto.randomUUID();
        const inv = {
          id: invId,
          organization_id: orgId,
          invoice_number: `OB-${Date.now()}`,
          amount: data.initialOpeningBalance,
          invoice_date: data.initialOpeningBalanceDate,
          due_date: data.initialOpeningBalanceDate,
          status: "unpaid",
          is_opening_balance: true,
        };

        const { error: invError } = await supabase.from("invoices").insert(inv);
        if (invError) {
          console.error("Failed to create initial opening balance", invError);
        } else {
          await createAuditLog(context.userId, "CREATE_OPENING_BALANCE", "invoices", invId, null, inv);
        }
      }
    }

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
      partyCode: z.string().optional(),
      tpCode: z.string().optional(),
      gstNumber: z.string().optional(),
      panNumber: z.string().optional(),
      billingAddress: z.string().optional(),
      primaryContactName: z.string().optional(),
      primaryContactEmail: z.string().optional(),
      primaryContactPhone: z
        .string()
        .regex(/^\d{10}$/, "Must be exactly 10 digits")
        .optional()
        .or(z.literal("")),
      deliveryLocations: z
        .array(
          z.object({
            id: z.string().optional(),
            label: z.string().min(1),
            address: z.string().min(1),
            isDefault: z.boolean().default(false),
            contactPerson: z.string().optional(),
            contactPhone: z.string().optional(),
          }),
        )
        .optional(),
      billingProfiles: z
        .array(
          z.object({
            id: z.string().optional(),
            gstNumber: z.string().optional(),
            billingAddress: z.string().optional(),
            isDefault: z.boolean().default(false),
          }),
        )
        .optional(),
      logoUrl: z.string().optional().nullable(),
      stampUrl: z.string().optional().nullable(),
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
        logo_url: data.logoUrl || null,
        stamp_url: data.stampUrl || null,
        party_code: data.partyCode || null,
        tp_code: data.tpCode || null,
        gst_number: data.gstNumber || null,
        pan_number: data.panNumber || null,
        billing_address: data.billingAddress || null,
        primary_contact_name: data.primaryContactName || null,
        primary_contact_email: data.primaryContactEmail || null,
        primary_contact_phone: data.primaryContactPhone || null,
        updated_at: new Date().toISOString(),
      };

      const { error: orgError } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", data.organizationId);
      if (orgError) throw new Error("Failed to update organization: " + orgError.message);

      if (data.deliveryLocations) {
        await supabase
          .from("client_delivery_locations")
          .delete()
          .eq("organization_id", data.organizationId);
        if (data.deliveryLocations.length > 0) {
          const locations = data.deliveryLocations.map((loc) => ({
            id: crypto.randomUUID(),
            organization_id: data.organizationId,
            label: loc.label,
            address: loc.address,
            is_default: loc.isDefault,
            contact_person: loc.contactPerson || null,
            contact_phone: loc.contactPhone || null,
          }));
          const { error: insertError } = await supabase
            .from("client_delivery_locations")
            .insert(locations);
          if (insertError) throw new Error("Failed to insert locations: " + insertError.message);
        }
      }

      if (data.billingProfiles) {
        await supabase
          .from("client_billing_addresses")
          .delete()
          .eq("organization_id", data.organizationId);
        if (data.billingProfiles.length > 0) {
          const profiles = data.billingProfiles.map((p) => ({
            id: crypto.randomUUID(),
            organization_id: data.organizationId,
            gst_number: p.gstNumber || null,
            billing_address: p.billingAddress || null,
            is_default: p.isDefault,
          }));
          await supabase.from("client_billing_addresses").insert(profiles);
        }
      }

      await createAuditLog(
        context.userId,
        "UPDATE_CLIENT",
        "organizations",
        data.organizationId,
        null,
        updates,
      );

      // Fetch all users for this organization
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", data.organizationId);

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

      // Notify the admin team
      const { data: org } = await supabase.from("organizations").select("legal_name").eq("id", data.organizationId).single();
      const clientName = org?.legal_name || "A client";
      await broadcastNotification(
        supabase,
        "Client Profile Updated",
        `${clientName} profile was updated.`,
        "/admin/clients",
        context.organizationId
      );

      return { success: true };
    } catch (err: any) {
      console.error("updateClient failed:", err);
      throw new Error(err.message || "Failed to update client");
    }
  });

export const updateClientStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().min(1),
      status: z.enum(["active", "suspended", "pending"]),
      reason: z.string().optional(),
    }),
  )
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

    await createAuditLog(
      context.userId,
      "UPDATE_ORG_STATUS",
      "organizations",
      data.organizationId,
      null,
      data,
    );

    const { data: org } = await supabase
      .from("organizations")
      .select("legal_name")
      .eq("id", data.organizationId)
      .single();
    const clientName = org?.legal_name || "A client";

    // Notify the client of their status change
    const title = `Account ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`;
    let message = `Your organization account status has been updated to ${data.status} by Mundra Administration.`;
    if (data.reason) {
      message += ` Reason: ${data.reason}`;
    }
    await broadcastNotification(supabase, title, message, "/client", data.organizationId);

    // Notify the admin team
    const adminMessage =
      `${clientName} account status has been updated to ${data.status}.` +
      (data.reason ? ` Reason: ${data.reason}` : "");
    await broadcastNotification(
      supabase,
      title,
      adminMessage,
      "/admin/clients",
      context.organizationId,
    );

    return { success: true };
  });

export const deleteClientAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) {
      throw new Error("Unauthorized");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("organizations").delete().eq("id", data.organizationId);

    if (error) {
      if (error.message.includes("foreign key constraint") || error.message.includes("violates foreign key constraint")) {
        throw new Error("Cannot delete this client because it has associated records (e.g., invoices, POs).");
      }
      throw new Error("Failed to delete client: " + error.message);
    }
    
    await createAuditLog(context.userId, "DELETE_CLIENT", "organizations", data.organizationId, null, null);
    return { success: true };
  });

export const updateClientCommercials = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().min(1),
      creditLimit: z.number().nonnegative(),
      annualInterestRate: z.number().nonnegative().default(0),
      paymentTermsDays: z.number().nonnegative(),
      gracePeriodDays: z.number().nonnegative(),
      includeUndispatchedPos: z.boolean(),
      includeDispatchedUnbilled: z.boolean(),
      includeUnpaidInvoices: z.boolean(),
      restrictions: z.string().optional(),
    }),
  )
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

    if (fetchErr && fetchErr.code !== "PGRST116")
      throw new Error("Failed to fetch current profile: " + fetchErr.message);

    let updateErr;
    if (fetchErr && fetchErr.code === "PGRST116") {
      const { error } = await supabase.from("client_commercial_profiles").insert({
        id: crypto.randomUUID(),
        organization_id: data.organizationId,
        credit_limit: data.creditLimit,
        annual_interest_rate: data.annualInterestRate,
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
          annual_interest_rate: data.annualInterestRate,
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
        effective_from: new Date().toISOString().split("T")[0],
        created_by: context.userId,
      });
    }

    await createAuditLog(
      context.userId,
      "UPDATE_COMMERCIALS",
      "client_commercial_profiles",
      data.organizationId,
      null,
      data,
    );
    return { success: true };
  });
export const getProducts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const supabase = createSupabaseAdminClient();
    const { data: products } = await supabase
      .from("products")
      .select("*, rates(*)")
      .eq("is_active", true)
      .order("name", { ascending: true });
    return (products || []).map((p: any) => {
      const activeGenericRate = (p.rates || []).find(
        (r: any) => !r.organization_id && r.status === "active",
      );
      const { rates, ...rest } = p;
      return {
        ...rest,
        basePrice: activeGenericRate ? activeGenericRate.amount : null,
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
        status: "active",
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
      const { data: activeRates } = await supabase
        .from("rates")
        .select("*")
        .eq("product_id", data.id)
        .is("organization_id", null)
        .eq("status", "active");

      const currentRate = activeRates?.[0];
      if (!currentRate || Number(currentRate.amount) !== Number(data.basePrice)) {
        if (currentRate) {
          await supabase
            .from("rates")
            .update({ status: "inactive", effective_to: new Date().toISOString().split("T")[0] })
            .eq("id", currentRate.id);
        }
        await supabase.from("rates").insert({
          id: crypto.randomUUID(),
          product_id: data.id,
          organization_id: null,
          amount: data.basePrice,
          effective_from: new Date().toISOString().split("T")[0],
          status: "active",
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
    const { count } = await supabase
      .from("rates")
      .select("*", { count: "exact", head: true })
      .eq("product_id", data.id);
    if (count && count > 0) {
      // Soft delete if linked to rates
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", data.id);
      if (error) throw new Error("Failed to deactivate product: " + error.message);
      await createAuditLog(context.userId, "DEACTIVATE_PRODUCT", "products", data.id, null, {
        is_active: false,
      });
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
      organization: rate.organization_id
        ? (organizationsMap.get(rate.organization_id) ?? null)
        : null,
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
  const { data: dr } = await supabase
    .from("dispatch_requests")
    .select("*")
    .eq("id", dispatchRequestId)
    .single();
  if (!dr) throw new Error("Dispatch request not found");

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", dr.purchase_order_id)
    .single();
  if (!po) throw new Error("Purchase order not found for dispatch request");

  const orgId = dr.organization_id;
  const { data: commProfile } = await supabase
    .from("client_commercial_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .single();
  const creditLimit = commProfile ? Number(commProfile.credit_limit || 0) : 0;
  const paymentTerms = commProfile ? Number(commProfile.payment_terms_days || 30) : 30;
  const gracePeriod = commProfile ? Number(commProfile.grace_period_days || 0) : 0;

  const { data: org } = await supabase
    .from("organizations")
    .select("status")
    .eq("id", orgId)
    .single();
  const organizationStatus = org?.status || "active";

  const { data: specials } = await supabase
    .from("special_approvals")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "active");
  const hasCreditOverride = (specials || []).some((s: any) => s.exception_type === "credit_limit");
  const hasTermsOverride = (specials || []).some(
    (s: any) => s.exception_type === "overdue_payment",
  );
  const hasConfOverride = (specials || []).some(
    (s: any) => s.exception_type === "balance_confirmation",
  );

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("organization_id", orgId)
    .neq("status", "cancelled");
    
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, is_client_to_utcl, is_utcl_payment")
    .eq("organization_id", orgId)
    .eq("status", "approved");
    
  const clientPayments = (payments || []).filter((p: any) => p.is_client_to_utcl || !p.is_utcl_payment);
  const totalPayments = clientPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  
  const mundraUtclPayments = (payments || []).filter((p: any) => p.is_utcl_payment && !p.is_client_to_utcl);
  const mundraUtclTotal = mundraUtclPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const nonObInvoices = (invoices || []).filter((inv: any) => !inv.is_opening_balance);
  const totalOutstanding = nonObInvoices.reduce(
    (sum: number, invoice: any) => sum + Number(invoice.amount || 0),
    0,
  ) + mundraUtclTotal;

  const dueDateFns = (invoices || []).map((invoice: any) => {
    const dueDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
    if (!dueDate) return null;
    dueDate.setDate(dueDate.getDate() + paymentTerms + gracePeriod);
    return dueDate;
  });
  const overdueInvoices = (invoices || []).filter((invoice: any, index: number) => {
    if (invoice.status === "paid") return false;
    if (invoice.is_opening_balance) return true;
    const dueDate = dueDateFns[index];
    return dueDate ? dueDate < new Date() : false;
  });

  const { data: allAllocations } = await supabase
    .from("invoice_allocations")
    .select("invoice_id, allocated_amount, invoices!inner(organization_id)")
    .eq("invoices.organization_id", orgId);
    
  const allocationsByInvoice = new Map<string, number>();
  const totalClientAllocations = (allAllocations || []).reduce((sum, alloc) => {
    allocationsByInvoice.set(alloc.invoice_id, (allocationsByInvoice.get(alloc.invoice_id) || 0) + Number(alloc.allocated_amount || 0));
    return sum + Number(alloc.allocated_amount || 0);
  }, 0);
  const unallocatedClientPayments = Math.max(0, totalPayments - totalClientAllocations);

  let orgOverdueInvoicesTotal = 0;
  for (const inv of overdueInvoices) {
    const alloc = allocationsByInvoice.get(inv.id) || 0;
    orgOverdueInvoicesTotal += Math.max(0, Number(inv.amount || 0) - alloc);
  }
  const totalOverdue = Math.max(0, orgOverdueInvoicesTotal + mundraUtclTotal - unallocatedClientPayments);

  const { data: activeDRs } = await supabase
    .from("dispatch_requests")
    .select("purchase_order_id, purchase_order_item_id, quantity")
    .eq("organization_id", orgId)
    .in("status", ["submitted", "auto_approved", "pending_mundra", "approved"]);

  const purchaseOrderIds = (activeDRs || []).map((item: any) => item.purchase_order_id);

  let purchaseOrders: any[] = [];
  if (purchaseOrderIds.length > 0) {
    const { data } = await supabase
      .from("purchase_orders")
      .select("id, locked_rate")
      .in("id", purchaseOrderIds);
    purchaseOrders = data || [];
  }
  const purchaseOrderMap = new Map(purchaseOrders.map((p: any) => [p.id, p]));

  // Prefer the dispatch's own line-item rate; fall back to the PO rate
  // (matches the recalculate_wallet_balance DB function).
  const activeItemIds = (activeDRs || [])
    .map((d: any) => d.purchase_order_item_id)
    .filter(Boolean);
  const itemRateMap = new Map<string, number>();
  if (activeItemIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("purchase_order_items")
      .select("id, locked_rate")
      .in("id", activeItemIds);
    for (const it of itemRows || []) itemRateMap.set(it.id, Number(it.locked_rate || 0));
  }
  const rateForDr = (d: any): number => {
    if (d.purchase_order_item_id && itemRateMap.has(d.purchase_order_item_id)) {
      return itemRateMap.get(d.purchase_order_item_id)!;
    }
    return Number(purchaseOrderMap.get(d.purchase_order_id)?.locked_rate || 0);
  };

  const activeDispatchesValue = (activeDRs || []).reduce(
    (sum: number, item: any) => sum + Number(item.quantity || 0) * rateForDr(item),
    0,
  );

  const includeUndispatched = commProfile?.include_undispatched_pos ?? false;
  const includeDispatched = commProfile?.include_dispatched_unbilled ?? true;

  let currentRate = Number(po.locked_rate || 0);
  if (dr.purchase_order_item_id) {
    const { data: curItem } = await supabase
      .from("purchase_order_items")
      .select("locked_rate")
      .eq("id", dr.purchase_order_item_id)
      .single();
    if (curItem) currentRate = Number(curItem.locked_rate || 0);
  }
  const currentVal = Number(dr.quantity || 0) * currentRate;

  let undispatchedValue = 0;
  if (includeUndispatched) {
    const { data: approvedPOs } = await supabase
      .from("purchase_orders")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "approved");

    const approvedPoIds = (approvedPOs || []).map((p: any) => p.id);
    if (approvedPoIds.length > 0) {
      const { data: poItems } = await supabase
        .from("purchase_order_items")
        .select("id, purchase_order_id, original_quantity, locked_rate")
        .in("purchase_order_id", approvedPoIds);

      const { data: allDispatches } = await supabase
        .from("dispatch_requests")
        .select("purchase_order_item_id, quantity")
        .in("purchase_order_id", approvedPoIds)
        .in("status", ["submitted", "auto_approved", "pending_mundra", "approved"]);

      // Dispatched quantity per line item.
      const dispatchedByItem = new Map<string, number>();
      for (const d of allDispatches || []) {
        if (!d.purchase_order_item_id) continue;
        dispatchedByItem.set(
          d.purchase_order_item_id,
          (dispatchedByItem.get(d.purchase_order_item_id) || 0) + Number(d.quantity || 0),
        );
      }

      for (const item of poItems || []) {
        const dispatchedQty = dispatchedByItem.get(item.id) || 0;
        const remainingQty = Math.max(0, Number(item.original_quantity || 0) - dispatchedQty);
        undispatchedValue += remainingQty * Number(item.locked_rate || 0);
      }
    }
  }

  const { data: obAllocations } = await supabase
    .from("invoice_allocations")
    .select("allocated_amount, invoices!inner(organization_id, is_opening_balance)")
    .eq("invoices.organization_id", orgId)
    .eq("invoices.is_opening_balance", true);

  const totalObAllocations = (obAllocations || []).reduce(
    (sum: number, alloc: any) => sum + Number(alloc.allocated_amount || 0),
    0,
  );

  const operationalPayments = totalPayments - totalObAllocations;

  let totalExposure = calculateClientExposure(
    commProfile,
    totalOutstanding,
    operationalPayments,
    activeDispatchesValue,
    undispatchedValue
  );

  if (!includeDispatched && !includeUndispatched) {
    totalExposure += currentVal;
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
  const { data: updatedDr } = await supabase
    .from("dispatch_requests")
    .select("*")
    .eq("id", dispatchRequestId)
    .single();
  await createAuditLog(
    userId,
    "EVALUATE_DISPATCH",
    "dispatch_requests",
    dispatchRequestId,
    dr,
    updatedDr,
  );
  return updatedDr;
}

export const getPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("purchase_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }

    const { data: purchaseOrders } = await query;

    const productsMap = await loadProductsMap();
    const organizationsMap = await loadOrganizationsMap();

    // Attach line items (with product info) to each PO.
    const poIds = (purchaseOrders || []).map((po: any) => po.id);
    const itemsByPo = new Map<string, any[]>();
    if (poIds.length > 0) {
      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("*")
        .in("purchase_order_id", poIds);
      for (const it of items || []) {
        const arr = itemsByPo.get(it.purchase_order_id) || [];
        arr.push({ ...it, product: productsMap.get(it.product_id) ?? null });
        itemsByPo.set(it.purchase_order_id, arr);
      }
    }

    return (purchaseOrders || []).map((po: any) => ({
      ...po,
      product: productsMap.get(po.product_id) ?? null,
      organization: organizationsMap.get(po.organization_id) ?? null,
      items: itemsByPo.get(po.id) ?? [],
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
  .validator(
    z.object({ productId: z.string().uuid(), organizationId: z.string().uuid().optional() }),
  )
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

    const activeClientRate = clientRates?.find((r) => !r.effective_to || r.effective_to >= today);
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

    const activeGenericRate = genericRates?.find((r) => !r.effective_to || r.effective_to >= today);
    if (activeGenericRate) {
      return { rate: Number(activeGenericRate.amount), source: "Generic Standard" };
    }

    return { rate: 0, source: "None" };
  });

export const proposeProductRate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      productId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      amount: z.number().positive(),
      effectiveFrom: z.string(),
      effectiveTo: z.string().nullable(),
    }),
  )
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
    const { data: proposedRate } = await supabase
      .from("rates")
      .select("*")
      .eq("id", data.rateId)
      .single();
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
    await supabase
      .from("rates")
      .update({ status: "active", approved_by: context.userId })
      .eq("id", data.rateId);

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
        .in(
          "purchase_order_id",
          activePOs.map((p) => p.id),
        )
        .in("status", ["submitted", "auto_approved", "pending_mundra", "approved"]);

      for (const po of activePOs) {
        const dispatches = (allDispatches || []).filter((d) => d.purchase_order_id === po.id);
        const dispatchedQty = dispatches.reduce((sum, d) => sum + Number(d.quantity), 0);
        if (Number(po.original_quantity) > dispatchedQty) {
          // Cancel pending balance by adjusting original_quantity to match what was already dispatched
          await supabase
            .from("purchase_orders")
            .update({ original_quantity: dispatchedQty })
            .eq("id", po.id);
          await createAuditLog(
            context.userId,
            "CANCEL_PO_BALANCE_RATE_CHANGE",
            "purchase_orders",
            po.id,
            { original: po.original_quantity },
            { new: dispatchedQty },
          );
        }
      }
    }

    await createAuditLog(context.userId, "APPROVE_RATE", "rates", data.rateId, null, {
      action: "approve",
    });

    if (data.action === "approve") {
      const { data: product } = await supabase
        .from("products")
        .select("name")
        .eq("id", proposedRate.product_id)
        .single();
      const productName = product?.name || "a product";
      const title = "New Rate Approved";
      const message = `A new ${proposedRate.organization_id ? "client-specific " : "global "}rate of ${proposedRate.amount} for ${productName} has been approved.`;
      await broadcastNotification(
        supabase,
        title,
        message,
        "/client",
        proposedRate.organization_id,
      );

      await broadcastNotification(
        supabase,
        title,
        message,
        "/admin/settings",
        context.organizationId
      );
    }

    return { success: true };
  });

// Shared line-item shape for a multi-product PO.
const poLineItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  lockedRate: z.number().nonnegative(),
});

/**
 * Resolve the currently-applicable rate for a product/org (client-specific
 * override wins over the generic rate). Returns null if none is active.
 */
async function resolveApplicableRate(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  productId: string,
  organizationId: string,
): Promise<number | null> {
  const today = new Date().toISOString().split("T")[0];
  const { data: clientRates } = await supabase
    .from("rates")
    .select("*")
    .eq("product_id", productId)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .lte("effective_from", today)
    .order("effective_from", { ascending: false });
  const { data: genRates } = await supabase
    .from("rates")
    .select("*")
    .eq("product_id", productId)
    .is("organization_id", null)
    .eq("status", "active")
    .lte("effective_from", today)
    .order("effective_from", { ascending: false });

  const applicable =
    clientRates?.find((r: any) => !r.effective_to || r.effective_to >= today) ||
    genRates?.find((r: any) => !r.effective_to || r.effective_to >= today);
  return applicable ? Number(applicable.amount) : null;
}

/**
 * Build the line-item rows for a PO, resolving each rate against the rate master
 * unless an exception rate was explicitly requested.
 */
async function buildPoItems(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  poId: string,
  organizationId: string,
  items: Array<{ productId: string; quantity: number; lockedRate: number }>,
  isExceptionRate: boolean,
) {
  const rows = [];
  for (const item of items) {
    let finalRate = item.lockedRate;
    if (!isExceptionRate) {
      const applicable = await resolveApplicableRate(supabase, item.productId, organizationId);
      if (applicable === null) {
        throw new Error("No active rate found for one of the selected products.");
      }
      finalRate = applicable;
    }
    rows.push({
      id: crypto.randomUUID(),
      purchase_order_id: poId,
      product_id: item.productId,
      original_quantity: item.quantity,
      locked_rate: finalRate,
      total_value: item.quantity * finalRate,
    });
  }
  return rows;
}

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      poNumber: z.string().min(1),
      items: z.array(poLineItemSchema).min(1),
      isExceptionRate: z.boolean().default(false),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
      documentMethod: z.enum(["upload", "generate"]),
      documentUrl: z.string().optional(),
      poFormatId: z.string().uuid().optional().nullable(),
      poFormatData: z.record(z.unknown()).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureClientOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const poId = crypto.randomUUID();
    const itemRows = await buildPoItems(
      supabase,
      poId,
      context.organizationId,
      data.items,
      data.isExceptionRate,
    );

    const poTotal = itemRows.reduce((s, it) => s + it.total_value, 0);
    const first = itemRows[0];
    const purchaseOrder = {
      id: poId,
      organization_id: context.organizationId,
      po_number: data.poNumber,
      // Legacy single-product columns kept populated from the first line for
      // backward compatibility; the source of truth is purchase_order_items.
      product_id: first.product_id,
      original_quantity: first.original_quantity,
      locked_rate: first.locked_rate,
      total_value: poTotal,
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      document_method: data.documentMethod,
      document_url: data.documentUrl || null,
      po_format_id: data.poFormatId || null,
      po_format_data: data.poFormatData || null,
      status: "pending_approval",
      created_by: context.userId,
      approved_by: null,
    };

    const { error } = await supabase.from("purchase_orders").insert(purchaseOrder);
    if (error) throw new Error("Failed to create PO: " + error.message);

    const { error: itemsError } = await supabase.from("purchase_order_items").insert(itemRows);
    if (itemsError) {
      // Roll back the header so we never leave an item-less PO behind.
      await supabase.from("purchase_orders").delete().eq("id", poId);
      throw new Error("Failed to create PO line items: " + itemsError.message);
    }

    await createAuditLog(context.userId, "CREATE_PO", "purchase_orders", poId, null, {
      ...purchaseOrder,
      items: itemRows,
    });

    const { data: mundraOrg } = await supabase.from("organizations").select("id").eq("type", "mundra").single();
    if (mundraOrg) {
      const { data: clientOrg } = await supabase.from("organizations").select("legal_name").eq("id", context.organizationId).single();
      const clientName = clientOrg?.legal_name || "A client";
      await broadcastNotification(
        supabase,
        "New Purchase Order Submitted",
        `${clientName} has submitted Purchase Order ${data.poNumber}.`,
        "/admin/po-queue",
        mundraOrg.id
      );
    }

    return { ...purchaseOrder, items: itemRows };
  });

export const createPurchaseOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      poNumber: z.string().min(1),
      items: z
        .array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().positive(),
            lockedRate: z.number().nonnegative().optional(),
          }),
        )
        .min(1),
      isExceptionRate: z.boolean().default(false),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
      documentMethod: z.enum(["upload", "generate"]),
      documentUrl: z.string().optional(),
      paymentTermsDays: z.number().nonnegative().optional(),
      poFormatId: z.string().uuid().optional().nullable(),
      poFormatData: z.record(z.unknown()).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const poId = crypto.randomUUID();

    // Resolve each line item's rate (admin may override per line, else rate master).
    const itemRows = [];
    for (const item of data.items) {
      let finalRate = item.lockedRate ?? 0;
      if (!data.isExceptionRate && !item.lockedRate) {
        const applicable = await resolveApplicableRate(
          supabase,
          item.productId,
          data.organizationId,
        );
        if (applicable === null) {
          throw new Error("No active rate found for one of the selected products.");
        }
        finalRate = applicable;
      }
      itemRows.push({
        id: crypto.randomUUID(),
        purchase_order_id: poId,
        product_id: item.productId,
        original_quantity: item.quantity,
        locked_rate: finalRate,
        total_value: item.quantity * finalRate,
      });
    }

    const poTotal = itemRows.reduce((s, it) => s + it.total_value, 0);
    const first = itemRows[0];
    const purchaseOrder = {
      id: poId,
      organization_id: data.organizationId,
      // Legacy single-product columns from the first line for compatibility.
      product_id: first.product_id,
      original_quantity: first.original_quantity,
      locked_rate: first.locked_rate,
      total_value: poTotal,
      status: "approved",
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      document_method: data.documentMethod,
      document_url: data.documentUrl || null,
      po_number: data.poNumber,
      po_format_id: data.poFormatId || null,
      po_format_data: data.poFormatData || null,
      approved_by: context.userId,
      created_by: context.userId,
    };

    const { error } = await supabase.from("purchase_orders").insert(purchaseOrder);
    if (error) throw new Error("Failed to create purchase order: " + error.message);

    const { error: itemsError } = await supabase.from("purchase_order_items").insert(itemRows);
    if (itemsError) {
      await supabase.from("purchase_orders").delete().eq("id", poId);
      throw new Error("Failed to create PO line items: " + itemsError.message);
    }

    await createAuditLog(
      context.userId,
      "CREATE_PO_ADMIN",
      "purchase_orders",
      purchaseOrder.id,
      null,
      purchaseOrder,
    );

    // Broadcast notification to client
    const title = "New Purchase Order Generated";
    const message = `Purchase Order ${data.poNumber} has been generated and approved by Mundra on your behalf.`;
    await broadcastNotification(
      supabase,
      title,
      message,
      "/client/purchase-orders",
      data.organizationId,
    );

    // Broadcast notification to admin team
    const { data: org } = await supabase
      .from("organizations")
      .select("legal_name")
      .eq("id", data.organizationId)
      .single();
    const clientName = org?.legal_name || "a client";
    const adminMessage = `Admin generated and approved Purchase Order ${data.poNumber} for ${clientName}.`;
    await broadcastNotification(
      supabase,
      "Admin PO Generated",
      adminMessage,
      "/admin/po-queue",
      context.organizationId,
    );

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
    const { data: prevPO } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!prevPO) throw new Error("Purchase Order not found");

    await supabase
      .from("purchase_orders")
      .update({ status: data.status, approved_by: context.userId })
      .eq("id", data.id);
    const { data: updatedPO } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", data.id)
      .single();

    await createAuditLog(
      context.userId,
      "UPDATE_PO_STATUS",
      "purchase_orders",
      data.id,
      prevPO,
      updatedPO,
    );

    if (updatedPO && (data.status === "approved" || data.status === "rejected")) {
      const title = `Purchase Order ${updatedPO.po_number} ${data.status === "approved" ? "Approved" : "Rejected"}`;
      const message = `Your purchase order has been marked as ${data.status.replace("_", " ")} by Mundra.`;
      await broadcastNotification(
        supabase,
        title,
        message,
        "/client/purchase-orders",
        updatedPO.organization_id,
      );

      const { data: org } = await supabase.from("organizations").select("legal_name").eq("id", updatedPO.organization_id).single();
      const clientName = org?.legal_name || "a client";
      const adminMessage = `Purchase Order ${updatedPO.po_number} for ${clientName} has been ${data.status.replace("_", " ")}.`;
      
      await broadcastNotification(
        supabase,
        title,
        adminMessage,
        "/admin/po-queue",
        context.organizationId
      );
    }

    return updatedPO;
  });

export const getDispatchRequests = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("dispatch_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }

    const { data: dispatchRequests } = await query;
    const purchaseOrderIds = (dispatchRequests || []).map((dr: any) => dr.purchase_order_id);

    let purchaseOrders: any[] = [];
    if (purchaseOrderIds.length > 0) {
      const { data } = await supabase
        .from("purchase_orders")
        .select("*, payments(amount, status, is_utcl_payment, is_client_to_utcl)")
        .in("id", purchaseOrderIds);
      purchaseOrders = data || [];
    }
    const purchaseOrderMap = new Map(purchaseOrders.map((po: any) => [po.id, po]));
    const organizationsMap = await loadOrganizationsMap();

    // Attach the specific line item (with product) each dispatch draws from.
    const itemIds = (dispatchRequests || [])
      .map((dr: any) => dr.purchase_order_item_id)
      .filter(Boolean);
    const itemMap = new Map<string, any>();
    if (itemIds.length > 0) {
      const productsMap = await loadProductsMap();
      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("*")
        .in("id", itemIds);
      for (const it of items || []) {
        itemMap.set(it.id, { ...it, product: productsMap.get(it.product_id) ?? null });
      }
    }

    // Attach the invoice raised for each dispatch, with how much of it is still
    // outstanding. Recording a payment against a dispatch needs this so the money
    // can be allocated to that dispatch's own invoice instead of being auto-FIFO'd
    // onto the client's oldest invoice.
    const invoiceByDispatch = new Map<string, any>();
    const drIds = (dispatchRequests || []).map((dr: any) => dr.id);
    if (drIds.length > 0) {
      const { data: invRows } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, amount, dispatch_request_id, status, invoice_allocations(allocated_amount)")
        .in("dispatch_request_id", drIds)
        .neq("status", "cancelled");

      for (const inv of invRows || []) {
        if (!inv.dispatch_request_id) continue;
        const allocated = (inv.invoice_allocations || []).reduce(
          (s: number, a: any) => s + (Number(a.allocated_amount) || 0),
          0,
        );
        invoiceByDispatch.set(inv.dispatch_request_id, {
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          amount: Number(inv.amount) || 0,
          outstanding: Math.max(0, (Number(inv.amount) || 0) - allocated),
        });
      }
    }

    return (dispatchRequests || []).map((dr: any) => ({
      ...dr,
      purchase_order: purchaseOrderMap.get(dr.purchase_order_id) ?? null,
      purchase_order_item: dr.purchase_order_item_id
        ? (itemMap.get(dr.purchase_order_item_id) ?? null)
        : null,
      invoice: invoiceByDispatch.get(dr.id) ?? null,
      organization: organizationsMap.get(dr.organization_id) ?? null,
    }));
  });

export const createDispatchRequest = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      purchaseOrderId: z.string().uuid(),
      // One entry per product line the client wants to dispatch.
      lines: z
        .array(
          z.object({
            purchaseOrderItemId: z.string().uuid(),
            quantity: z.number().positive(),
            requestedDate: z.string(),
          }),
        )
        .min(1),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
      invoiceNumber: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureClientOrg(context.orgType);

    const supabase = createSupabaseAdminClient();
    const created: any[] = [];

    // Each product line becomes its own dispatch request (single-product),
    // so downstream credit/dispatch/ledger logic stays per-product.
    for (const line of data.lines) {
      const drId = crypto.randomUUID();
      const dispatchRequest = {
        id: drId,
        purchase_order_id: data.purchaseOrderId,
        purchase_order_item_id: line.purchaseOrderItemId,
        organization_id: context.organizationId,
        quantity: line.quantity,
        requested_date: line.requestedDate,
        site_address: data.siteAddress,
        delivery_contact: data.deliveryContact || null,
        invoice_number: data.invoiceNumber || null,
        status: "submitted",
        eligibility_result: null,
        approved_by: null,
      };

      const { error } = await supabase.from("dispatch_requests").insert(dispatchRequest);
      if (error) throw new Error("Failed to create dispatch request: " + error.message);

      await createAuditLog(
        context.userId,
        "CREATE_DISPATCH",
        "dispatch_requests",
        drId,
        null,
        dispatchRequest,
      );
      await runDispatchEligibilityCheck(drId, context.userId);
      created.push(dispatchRequest);
    }

    const { data: mundraOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("type", "mundra")
      .single();

    if (mundraOrg) {
      const { data: clientOrg } = await supabase
        .from("organizations")
        .select("legal_name")
        .eq("id", context.organizationId)
        .single();
      const clientName = clientOrg?.legal_name || "a client";
      
      await broadcastNotification(
        supabase,
        "New Dispatch Request",
        `${data.lines.length} new dispatch request(s) submitted by ${clientName}.`,
        "/admin/dispatches",
        mundraOrg.id
      );
    }

    return created;
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
    const { data: prevDr } = await supabase
      .from("dispatch_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!prevDr) throw new Error("Dispatch request not found");

    await supabase
      .from("dispatch_requests")
      .update({ status: data.status, approved_by: context.userId })
      .eq("id", data.id);

    // Auto-generate invoice if the dispatch is approved
    if (data.status === "approved" && prevDr.status !== "approved") {
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("dispatch_request_id", data.id)
        .single();

      if (!existingInvoice) {
        const { data: poItem } = await supabase
          .from("purchase_order_items")
          .select("locked_rate")
          .eq("id", prevDr.purchase_order_item_id)
          .single();

        if (poItem) {
          const invoiceAmount = Number(prevDr.quantity) * Number(poItem.locked_rate);
          const invoiceNumber = prevDr.invoice_number || `INV-${Date.now().toString().slice(-6)}-${data.id.slice(0, 4).toUpperCase()}`;

          // Fetch payment terms for the client to calculate due_date correctly
          const { data: profile } = await supabase
            .from("client_commercial_profiles")
            .select("payment_terms_days")
            .eq("organization_id", prevDr.organization_id)
            .single();
            
          const termsDays = profile?.payment_terms_days || 0;
          const invoiceDate = new Date(prevDr.requested_date);
          const dueDate = new Date(invoiceDate);
          dueDate.setDate(dueDate.getDate() + termsDays);

          const { error: invError } = await supabase.from("invoices").insert({
            id: crypto.randomUUID(),
            organization_id: prevDr.organization_id,
            dispatch_request_id: data.id,
            invoice_number: invoiceNumber,
            invoice_date: prevDr.requested_date,
            due_date: dueDate.toISOString().split('T')[0],
            amount: invoiceAmount,
            status: "unpaid",
            is_opening_balance: false,
          });
          
          if (invError) {
             console.error("Failed to auto-generate invoice:", invError);
          }
        }
      }
    }

    const { data: dr } = await supabase
      .from("dispatch_requests")
      .select("*")
      .eq("id", data.id)
      .single();

    await createAuditLog(
      context.userId,
      "UPDATE_DISPATCH_STATUS",
      "dispatch_requests",
      data.id,
      prevDr,
      dr,
    );

    if (dr && data.status !== prevDr.status) {
      const title = `Dispatch Request ${data.status.charAt(0).toUpperCase() + data.status.slice(1).replace("_", " ")}`;
      const message = `Your dispatch request has been marked as ${data.status.replace("_", " ")} by Mundra.`;
      await broadcastNotification(
        supabase,
        title,
        message,
        "/client", 
        dr.organization_id,
      );

      const { data: org } = await supabase.from("organizations").select("legal_name").eq("id", dr.organization_id).single();
      const clientName = org?.legal_name || "a client";
      const adminMessage = `Dispatch Request for ${clientName} has been marked as ${data.status.replace("_", " ")}.`;

      await broadcastNotification(
        supabase,
        title,
        adminMessage,
        "/admin/dispatches",
        context.organizationId
      );
    }
    
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
    return (payments || []).map((payment: any) =>
      withNestedOrganization(payment, organizationsMap),
    );
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
      purchaseOrderId: z.string().uuid().optional(),
      dispatchRequestIds: z.array(z.string().uuid()).optional(),
      allocations: z
        .array(
          z.object({
            invoiceId: z.string().uuid(),
            allocatedAmount: z.number().nonnegative(),
            tdsAmount: z.number().nonnegative(),
          }),
        )
        .optional(),
    })
  )
  .handler(async ({ data, context }) => {
    ensureClientOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const paymentId = crypto.randomUUID();
    const payment = {
      id: paymentId,
      organization_id: context.organizationId,
      purchase_order_id: data.purchaseOrderId || null,
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

    const { data: paymentResult, error: paymentError } = await supabase.rpc("record_payment_with_allocations", {
      p_org_id: context.organizationId,
      p_po_id: nullableUuid(data.purchaseOrderId),
      p_dispatch_ids: data.dispatchRequestIds || [],
      p_amount: data.amount,
      p_payment_date: data.paymentDate,
      p_payment_mode: data.paymentMode,
      p_ref_no: data.referenceNumber,
      p_is_utcl: data.isUtclPayment ?? false,
      p_is_client_to_utcl: true,
      p_is_advance: data.isAdvance ?? false,
      p_user_id: context.userId,
      p_manual_allocations: data.allocations || [],
      p_status: "submitted",
      p_verified_by: nullableUuid(null)
    });

    if (paymentError) throw new Error("Failed to insert payment: " + paymentError.message);
    const rpcResult = paymentResult as RecordPaymentRpcResult | null;
    if (!rpcResult?.payment_id) throw new Error("Payment RPC returned no payment_id");

    // Fetch the inserted payment to return it to the client
    const { data: insertedPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", rpcResult.payment_id)
      .single();

    return insertedPayment;
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

    const { data: prevPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", data.id)
      .single();
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

    const { data: newPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", data.id)
      .single();
    await createAuditLog(
      context.userId,
      "EDIT_PAYMENT",
      "payments",
      data.id,
      prevPayment,
      newPayment,
    );

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

    const { data: prevPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!prevPayment) throw new Error("Payment not found");

    await supabase
      .from("payments")
      .update({
        status: data.status,
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", data.id)
      .single();
    await createAuditLog(
      context.userId,
      "VERIFY_PAYMENT",
      "payments",
      data.id,
      prevPayment,
      payment,
    );

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
    let query = supabase
      .from("invoices")
      .select("*, invoice_allocations(allocated_amount)")
      .order("invoice_date", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }

    const { data: invoices } = await query;
    const orgIds = [...new Set((invoices || []).map((i: any) => i.organization_id).filter(Boolean))];
    
    let profilesMap = new Map();
    if (orgIds.length > 0) {
      const { data: profiles } = await supabase
        .from("client_commercial_profiles")
        .select("organization_id, historical_invoices")
        .in("organization_id", orgIds);
      profilesMap = new Map((profiles || []).map((p: any) => [p.organization_id, p]));
    }

    const organizationsMap = await loadOrganizationsMap();
    return (invoices || []).map((invoice: any) => {
      const nested = withNestedOrganization(invoice, organizationsMap);
      const allocated = (invoice.invoice_allocations || []).reduce(
        (s: number, a: any) => s + (Number(a.allocated_amount) || 0),
        0,
      );
      nested.allocated_amount = allocated;
      nested.outstanding = Math.max(0, (Number(invoice.amount) || 0) - allocated);
      if (invoice.is_opening_balance) {
        nested.historical_invoices = profilesMap.get(invoice.organization_id)?.historical_invoices || [];
      }
      return nested;
    });
  });

export const getClientStatement = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid().optional(),
      startDate: z.string(),
      endDate: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const targetOrgId = context.orgType === "client" ? context.organizationId : data.organizationId;
    if (!targetOrgId) throw new Error("Organization ID is required");

    // Fetch opening balances
    const { data: obInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, amount, created_at")
      .eq("organization_id", targetOrgId)
      .eq("is_opening_balance", true)
      .neq("status", "cancelled");

    const { data: clientProfile } = await supabase
      .from("client_commercial_profiles")
      .select("historical_invoices")
      .eq("organization_id", targetOrgId)
      .single();

    // Fetch dispatches
    const { data: dispatches } = await supabase
      .from("dispatch_requests")
      .select("id, requested_date, quantity, created_at, updated_at, status, purchase_orders(locked_rate, po_number)")
      .eq("organization_id", targetOrgId)
      .in("status", ["approved", "auto_approved"]);

    // Fetch payments
    const { data: payments } = await supabase
      .from("payments")
      .select("id, payment_date, amount, payment_mode, reference_number, is_client_to_utcl, is_utcl_payment, created_at")
      .eq("organization_id", targetOrgId);

    // Fetch Credit Notes
    const { data: creditNotes } = await supabase
      .from("credit_notes")
      .select("id, issue_date, amount, credit_note_number, created_at, status, issued_to_org_id, issued_by_org_id")
      .or(`issued_to_org_id.eq.${targetOrgId},issued_by_org_id.eq.${targetOrgId}`)
      .in("status", ["issued", "applied"]);

    // Fetch Debit Notes
    const { data: debitNotes } = await supabase
      .from("debit_notes")
      .select("id, issue_date, amount, debit_note_number, created_at, status, issued_to_org_id, issued_by_org_id")
      .or(`issued_to_org_id.eq.${targetOrgId},issued_by_org_id.eq.${targetOrgId}`)
      .in("status", ["issued", "applied"]);

    const rawEntries: any[] = [];

    const histList: any[] = (clientProfile as any)?.historical_invoices || [];
    // Opening balances are now one invoice row per bill. Show each on its own
    // line with its real invoice number; attach only its matching historical
    // entry (by invoice number) so the breakdown isn't repeated on every row.
    // A single consolidated OB invoice (legacy) still shows the whole breakdown.
    const isConsolidated = (obInvoices || []).length <= 1;
    for (const ob of obInvoices || []) {
      const matched = histList.filter(
        (h: any) => String(h.invoiceNumber ?? "") === String(ob.invoice_number ?? ""),
      );
      rawEntries.push({
        id: `ob_${ob.id}`,
        type: "opening_balance",
        timestamp: ob.invoice_date,
        created_at: ob.created_at,
        title: isConsolidated ? "Opening Balance" : `Opening Balance (${ob.invoice_number})`,
        meta: {
          amount: ob.amount,
          invoice_number: ob.invoice_number,
          client_name: targetOrgId,
          historical_invoices: isConsolidated ? histList : matched,
        },
      });
    }

    for (const dr of dispatches || []) {
      rawEntries.push({
        id: `dr_${dr.id}`,
        type: "utcl_to_client",
        timestamp: dr.requested_date || dr.created_at.split("T")[0],
        created_at: dr.created_at,
        title: "Material Dispatch",
        meta: { quantity: dr.quantity, locked_rate: dr.purchase_orders?.locked_rate, po_number: dr.purchase_orders?.po_number, client_name: targetOrgId },
      });
    }

    for (const p of payments || []) {
      if (p.is_client_to_utcl) {
        rawEntries.push({
          id: `pay_${p.id}`,
          type: "client_to_utcl",
          timestamp: p.payment_date,
          created_at: p.created_at,
          title: `Payment Received (${p.payment_mode})`,
          meta: { amount: p.amount, reference_number: p.reference_number, client_name: targetOrgId },
        });
      }
    }

    for (const cn of creditNotes || []) {
      // Check if it belongs to this client (they might be issued by or issued to)
      // Usually issued_to is client for CN if Mundra issues it. If they are in either, we count it.
      rawEntries.push({
        id: `cn_${cn.id}`,
        type: "credit_note",
        timestamp: cn.issue_date,
        created_at: cn.created_at,
        title: `Credit Note — ${cn.credit_note_number}`,
        meta: {
          amount: cn.amount,
          status: cn.status,
          credit_note_number: cn.credit_note_number,
          reference_number: cn.credit_note_number,
          client_name: targetOrgId,
        },
      });
    }

    for (const dn of debitNotes || []) {
      rawEntries.push({
        id: `dn_${dn.id}`,
        type: "debit_note",
        timestamp: dn.issue_date,
        created_at: dn.created_at,
        title: `Debit Note — ${dn.debit_note_number}`,
        meta: {
          amount: dn.amount,
          status: dn.status,
          debit_note_number: dn.debit_note_number,
          reference_number: dn.debit_note_number,
          client_name: targetOrgId,
        },
      });
    }

    const { calculateLedgerBalances } = await import("../ledger");
    const calculatedRows = calculateLedgerBalances(rawEntries);

    // Filter into historical and period
    const historicalRows = calculatedRows.filter((r) => r.timestamp < data.startDate && r.isPosting);
    const periodRows = calculatedRows.filter((r) => r.timestamp >= data.startDate && r.timestamp <= data.endDate && r.isPosting);

    let historicalBalance = 0;
    if (historicalRows.length > 0) {
      historicalBalance = historicalRows[historicalRows.length - 1].runningBalance;
    }

    const statement = [];
    if (historicalRows.length > 0 || periodRows.length > 0) {
      statement.push({
        id: "bbf",
        date: data.startDate,
        particulars: "Balance Brought Forward",
        reference: "—",
        debit: historicalBalance > 0 ? historicalBalance : 0,
        credit: historicalBalance < 0 ? Math.abs(historicalBalance) : 0,
        runningBalance: historicalBalance,
        isSynthetic: true,
      });
    }

    for (const row of periodRows) {
      statement.push({
        id: row.id,
        date: row.timestamp,
        particulars: row.title,
        reference:
          row.meta.credit_note_number ||
          row.meta.debit_note_number ||
          row.meta.invoice_number ||
          row.meta.reference_number ||
          row.meta.po_number ||
          "—",
        debit: row.debit,
        credit: row.credit,
        runningBalance: row.runningBalance,
      });
    }

    let closingBalance = historicalBalance;
    if (periodRows.length > 0) {
      closingBalance = periodRows[periodRows.length - 1].runningBalance;
    }

    if (historicalRows.length > 0 || periodRows.length > 0) {
      statement.push({
        id: "cb",
        date: data.endDate,
        particulars: "Closing Balance",
        reference: "—",
        debit: closingBalance > 0 ? closingBalance : 0,
        credit: closingBalance < 0 ? Math.abs(closingBalance) : 0,
        runningBalance: closingBalance,
        isSynthetic: true,
      });
    }

    return {
      historicalBalance,
      closingBalance,
      statement,
    };
  });

export const createOpeningBalance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      amount: z.number().positive(),
      invoiceDate: z.string(),
      reference: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    
    // Check if organization exists to generate the prefix
    const { data: org } = await supabase
      .from("organizations")
      .select("trade_name, legal_name")
      .eq("id", data.organizationId)
      .single();
      
    if (!org) {
      throw new Error("Organization not found");
    }
    
    const orgCode = org.trade_name ? org.trade_name.substring(0, 3).toUpperCase() : "ORG";
    const ref = data.reference || `OB-${Date.now().toString().slice(-4)}`;
    const invoiceNumber = `OB-${orgCode}-${ref}`;

    const { data: inserted, error } = await supabase.from("invoices").insert({
      id: crypto.randomUUID(),
      organization_id: data.organizationId,
      invoice_number: invoiceNumber,
      amount: data.amount,
      invoice_date: data.invoiceDate,
      due_date: data.invoiceDate,
      status: "unpaid",
      is_opening_balance: true,
    }).select().single();

    if (error) {
      if (error.code === '23505') {
        throw new Error("Duplicate opening balance reference found.");
      }
      console.error(error);
      throw new Error("Failed to create opening balance");
    }

    await createAuditLog(
      context.userId,
      "CREATE_OPENING_BALANCE",
      "invoices",
      inserted.id,
      null,
      inserted,
    );

    return inserted;
  });

export const cancelOpeningBalanceAction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ invoiceId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    
    const { data: result, error } = await supabase.rpc('cancel_opening_balance', {
      p_invoice_id: data.invoiceId,
      p_user_id: context.userId
    });
    
    if (error) {
      console.error("Cancel OB error:", error);
      throw new Error(error.message || "Failed to cancel opening balance");
    }
    return result;
  });


export const getBalanceConfirmations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("balance_confirmations")
      .select("*")
      .order("quarter_end_date", { ascending: false });
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

    await createAuditLog(
      context.userId,
      "CREATE_BALANCE_CONF_PERIOD",
      "balance_confirmations",
      conf.id,
      null,
      conf,
    );
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
    const { data: prevConf } = await supabase
      .from("balance_confirmations")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!prevConf) throw new Error("Record not found");

    if (context.orgType !== "mundra" && prevConf.organization_id !== context.organizationId) {
      throw new Error("Unauthorized: Cross-tenant modification attempt blocked.");
    }

    await supabase
      .from("balance_confirmations")
      .update({
        signed_pdf_url: data.signedPdfUrl,
        status: "under_review",
      })
      .eq("id", data.id);

    const { data: conf } = await supabase
      .from("balance_confirmations")
      .select("*")
      .eq("id", data.id)
      .single();
    await createAuditLog(
      context.userId,
      "UPLOAD_BALANCE_CONF",
      "balance_confirmations",
      data.id,
      prevConf,
      conf,
    );
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
    const { data: prevConf } = await supabase
      .from("balance_confirmations")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!prevConf) throw new Error("Record not found");

    if (context.orgType !== "mundra" && prevConf.organization_id !== context.organizationId) {
      throw new Error("Unauthorized: Cross-tenant modification attempt blocked.");
    }

    await supabase
      .from("balance_confirmations")
      .update({
        status: "Approved",
      })
      .eq("id", data.id);

    const { data: conf } = await supabase
      .from("balance_confirmations")
      .select("*")
      .eq("id", data.id)
      .single();
    await createAuditLog(
      context.userId,
      "CLIENT_APPROVE_BALANCE_CONF",
      "balance_confirmations",
      data.id,
      prevConf,
      conf,
    );
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
    const { data: prevConf } = await supabase
      .from("balance_confirmations")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!prevConf) throw new Error("Record not found");

    await supabase
      .from("balance_confirmations")
      .update({
        status: data.status,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    const { data: conf } = await supabase
      .from("balance_confirmations")
      .select("*")
      .eq("id", data.id)
      .single();
    await createAuditLog(
      context.userId,
      "VERIFY_BALANCE_CONF",
      "balance_confirmations",
      data.id,
      prevConf,
      conf,
    );
    return conf;
  });

export const getSpecialApprovals = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("special_approvals")
      .select("*")
      .order("created_at", { ascending: false });
    if (context.orgType !== "mundra") {
      query = query.eq("organization_id", context.organizationId);
    }
    const { data: approvals } = await query;
    const organizationsMap = await loadOrganizationsMap();
    return (approvals || []).map((approval: any) =>
      withNestedOrganization(approval, organizationsMap),
    );
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

    await createAuditLog(
      context.userId,
      "CREATE_SPECIAL_APPROVAL",
      "special_approvals",
      sa.id,
      null,
      sa,
    );
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

export const getAllOrganizations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const supabase = createSupabaseAdminClient();
    const { data: organizations, error } = await supabase
      .from("organizations")
      .select("id, legal_name, org_type")
      .order("legal_name", { ascending: true });

    if (error) throw new Error("Failed to fetch organizations: " + error.message);
    return organizations || [];
  });

export const getAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const allowedRoles = ["mundra_super_admin", "mundra_readonly"] as const;
    if (!context.roles.some((role) => allowedRoles.includes(role as any))) {
      throw new Error("Unauthorized access to audit logs");
    }

    const supabase = createSupabaseAdminClient();
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });
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
    }),
  )
  .handler(async ({ data, context }) => {
    if (!context.roles.includes("client_admin") && !context.roles.includes("mundra_super_admin")) {
      throw new Error("Unauthorized");
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("client_workflow_settings").upsert({
      organization_id: context.organizationId,
      po_workflow: data.poWorkflow,
      payment_workflow: data.paymentWorkflow,
      updated_by: context.userId,
    });

    if (error) {
      throw new Error("Failed to update workflow settings: " + error.message);
    }

    await createAuditLog(
      context.userId,
      "UPDATE_WORKFLOW_SETTINGS",
      "client_workflow_settings",
      context.organizationId,
      null,
      data,
    );
    return { success: true };
  });

export async function broadcastNotification(
  supabase: any,
  title: string,
  message: string,
  link: string | null = null,
  targetOrganizationId: string | null = null,
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
    supabase
      .from("notifications")
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

export const createCreditNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      creditNoteNumber: z.string().min(1),
      issueDate: z.string(),
      amount: z.number().positive(),
      reason: z.string(),
      remarks: z.string().optional(),
      issuedByOrgId: z.string().uuid(),
      issuedToOrgId: z.string().uuid(),
      originType: z.enum(["PO", "Dispatch", "Payment"]),
      originReference: z.string().min(1),
      status: z.enum(["draft", "issued", "applied", "cancelled"]).default("draft"),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: note, error } = await supabase
      .from("credit_notes")
      .insert({
        credit_note_number: data.creditNoteNumber,
        issue_date: data.issueDate,
        amount: data.amount,
        reason: data.reason as any,
        remarks: data.remarks || null,
        issued_by_org_id: data.issuedByOrgId,
        issued_to_org_id: data.issuedToOrgId,
        origin_type: data.originType,
        origin_reference: data.originReference,
        status: data.status,
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error("Failed to create credit note: " + error.message);

    await createAuditLog(context.userId, "CREATE_CREDIT_NOTE", "credit_notes", note.id, null, note);
    return { success: true, note };
  });

export const createDebitNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      debitNoteNumber: z.string().min(1),
      issueDate: z.string(),
      amount: z.number().positive(),
      reason: z.string(),
      remarks: z.string().optional(),
      issuedByOrgId: z.string().uuid(),
      issuedToOrgId: z.string().uuid(),
      originType: z.enum(["PO", "Dispatch", "Payment"]),
      originReference: z.string().min(1),
      status: z.enum(["draft", "issued", "applied", "cancelled"]).default("draft"),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: note, error } = await supabase
      .from("debit_notes")
      .insert({
        debit_note_number: data.debitNoteNumber,
        issue_date: data.issueDate,
        amount: data.amount,
        reason: data.reason as any,
        remarks: data.remarks || null,
        issued_by_org_id: data.issuedByOrgId,
        issued_to_org_id: data.issuedToOrgId,
        origin_type: data.originType,
        origin_reference: data.originReference,
        status: data.status,
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error("Failed to create debit note: " + error.message);

    await createAuditLog(context.userId, "CREATE_DEBIT_NOTE", "debit_notes", note.id, null, note);
    return { success: true, note };
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
    const { data: locations } = await supabase
      .from("client_delivery_locations")
      .select("*")
      .eq("organization_id", data.organizationId);
    return locations || [];
  });

export const createDispatchRequestAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().uuid(),
      purchaseOrderId: z.string().uuid(),
      lines: z
        .array(
          z.object({
            purchaseOrderItemId: z.string().uuid(),
            quantity: z.number().positive(),
            requestedDate: z.string(),
          }),
        )
        .min(1),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
      invoiceNumber: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const created: any[] = [];

    for (const line of data.lines) {
      const drId = crypto.randomUUID();
      const dispatchRequest = {
        id: drId,
        purchase_order_id: data.purchaseOrderId,
        purchase_order_item_id: line.purchaseOrderItemId,
        organization_id: data.organizationId,
        quantity: line.quantity,
        requested_date: line.requestedDate,
        site_address: data.siteAddress,
        delivery_contact: data.deliveryContact || null,
        invoice_number: data.invoiceNumber || null,
        status: "submitted",
        eligibility_result: null,
        approved_by: null,
      };
      const { error } = await supabase.from("dispatch_requests").insert(dispatchRequest);
      if (error) throw new Error("Failed to create dispatch request: " + error.message);
      await createAuditLog(
        context.userId,
        "CREATE_DISPATCH_REQUEST_ADMIN",
        "dispatch_requests",
        drId,
        null,
        dispatchRequest,
      );
      created.push(dispatchRequest);
    }
    return created;
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
      invoiceNumber: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const { data: prevDr } = await supabase
      .from("dispatch_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!prevDr) throw new Error("Dispatch request not found");

    const updateData = {
      purchase_order_id: data.purchaseOrderId,
      quantity: data.quantity,
      requested_date: data.requestedDate,
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      invoice_number: data.invoiceNumber || null,
    };

    const { error } = await supabase.from("dispatch_requests").update(updateData).eq("id", data.id);
    if (error) throw new Error("Failed to update dispatch request: " + error.message);

    const { data: updatedDr } = await supabase
      .from("dispatch_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    await createAuditLog(
      context.userId,
      "EDIT_DISPATCH_REQUEST_ADMIN",
      "dispatch_requests",
      data.id,
      prevDr,
      updatedDr,
    );
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
      .select(
        "*, organizations(id, legal_name, client_commercial_profiles(*)), dispatch_requests(quantity, status), payments(id, amount, status, payment_date, payment_mode, reference_number, is_utcl_payment, is_advance)",
      );

    if (posError) {
      console.error("POSTGREST ERROR:", posError);
      throw new Error("Failed to fetch POs: " + posError.message);
    }

    // Aggregate data
    const monitoringData = pos.map((po: any) => {
      const dispatchedQuantity =
        po.dispatch_requests
          ?.filter(
            (dr: any) =>
              dr.status === "approved" || dr.status === "dispatched" || dr.status === "delivered",
          )
          .reduce((sum: number, dr: any) => sum + (dr.quantity || 0), 0) || 0;

      const amountPaid =
        po.payments
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
        payments_history:
          po.payments
            ?.filter((p: any) => p.status === "approved" || p.status === "verified")
            .sort(
              (a: any, b: any) =>
                new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
            ) || [],
      };
    });

    return monitoringData;
  });

export const getJournalEntries = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    const organizationsMap = await loadOrganizationsMap();

    // Fetch all POs (Mundra -> UTCL events)
    const { data: pos } = await supabase
      .from("purchase_orders")
      .select(
        "id, po_number, total_value, locked_rate, original_quantity, created_at, status, organization_id",
      )
      .order("created_at", { ascending: false });

    // Fetch all dispatches with their PO number (UTCL -> Client events)
    const { data: dispatches } = await supabase
      .from("dispatch_requests")
      .select(
        "id, quantity, status, created_at, updated_at, requested_date, site_address, organization_id, purchase_order_id, purchase_orders(po_number, locked_rate)",
      )
      .order("created_at", { ascending: false });

    // Fetch all payments with their PO number
    const { data: payments } = await supabase
      .from("payments")
      .select(
        "id, amount, payment_date, payment_mode, reference_number, is_utcl_payment, is_client_to_utcl, is_advance, status, created_at, organization_id, purchase_order_id, purchase_orders(po_number)",
      )
      .order("payment_date", { ascending: false });

    // Fetch Credit Notes
    const { data: creditNotes } = await supabase
      .from("credit_notes")
      .select("*, created_at")
      .order("issue_date", { ascending: false });

    // Fetch Debit Notes
    const { data: debitNotes } = await supabase
      .from("debit_notes")
      .select("*, created_at")
      .order("issue_date", { ascending: false });

    // Fetch Opening Balances
    const { data: openingBalances } = await supabase
      .from("invoices")
      .select("*, created_at")
      .eq("is_opening_balance", true)
      .neq("status", "cancelled")
      .order("invoice_date", { ascending: false });

    // Fetch UTCL Refund Letters (Paid only)
    const { data: refundLetters } = await supabase
      .from("utcl_refund_letters")
      .select("*")
      .eq("is_paid", true)
      .order("paid_at", { ascending: false });

    const entries: any[] = [];

    // 1. PO creation = Mundra -> UTCL
    for (const po of pos || []) {
      const org = organizationsMap.get(po.organization_id);
      entries.push({
        id: `po_${po.id}`,
        type: "mundra_to_utcl",
        timestamp: po.created_at,
        created_at: po.created_at,
        title: "PO Created — Mundra → UTCL",
        meta: {
          po_number: po.po_number,
          total_value: po.total_value,
          locked_rate: po.locked_rate,
          quantity: po.original_quantity,
          status: po.status,
          client_name: (org as any)?.legal_name || null,
        },
      });
    }

    // 2. Approved dispatches = UTCL -> Client
    for (const dr of (dispatches || []) as any[]) {
      if (dr.status === "approved" || dr.status === "auto_approved") {
        const org = organizationsMap.get(dr.organization_id);
        entries.push({
          id: `dr_${dr.id}`,
          type: "utcl_to_client",
          timestamp: dr.updated_at || dr.created_at,
          created_at: dr.created_at,
          title: "Dispatch Approved — UTCL → Client",
          meta: {
            dispatch_id: dr.id,
            po_number: dr.purchase_orders?.po_number || null,
            locked_rate: dr.purchase_orders?.locked_rate || null,
            quantity: dr.quantity,
            requested_date: dr.requested_date || null,
            site_address: dr.site_address,
            client_name: (org as any)?.legal_name || null,
          },
        });
      }
    }

    // 3. Client -> UTCL payments
    for (const p of (payments || []) as any[]) {
      if (p.is_client_to_utcl) {
        const org = organizationsMap.get(p.organization_id);
        entries.push({
          id: `pay_ctu_${p.id}`,
          type: "client_to_utcl",
          timestamp: p.payment_date,
          created_at: p.created_at,
          title: "Payment — Client → UTCL",
          meta: {
            amount: p.amount,
            payment_mode: p.payment_mode,
            reference_number: p.reference_number,
            po_number: p.purchase_orders?.po_number || null,
            client_name: (org as any)?.legal_name || null,
            payment_id: p.id,
            purchase_order_id: p.purchase_order_id,
          },
        });
      }
    }

    // 4. Mundra payment to UTCL (non-client-to-utcl, is_utcl_payment) -> UTCL Corporate Ledger Debit
    for (const p of (payments || []) as any[]) {
      if (p.is_utcl_payment && !p.is_client_to_utcl) {
        entries.push({
          id: `pay_mtu_${p.id}`,
          type: "mundra_to_utcl_payment",
          timestamp: p.payment_date,
          created_at: p.created_at,
          title: "Payment — Mundra → UTCL",
          meta: {
            amount: p.amount,
            payment_mode: p.payment_mode,
            reference_number: p.reference_number,
            po_number: p.purchase_orders?.po_number || null,
            client_name: "UTCL Corporate Account",
            payment_id: p.id,
          },
        });
      }
    }

    // 4b. UTCL refund to Mundra -> UTCL Corporate Ledger Credit
    for (const rl of refundLetters || []) {
      entries.push({
        id: `refund_${rl.id}`,
        type: "utcl_to_mundra_refund",
        timestamp: rl.paid_at || rl.updated_at,
        created_at: rl.created_at,
        title: "Refund Received — UTCL → Mundra",
        meta: {
          amount: rl.amount,
          reference_number: rl.reference_number,
          client_name: "UTCL Corporate Account",
        },
      });
    }

    // 5. Credit Notes
    for (const cn of creditNotes || []) {
      const orgTo = organizationsMap.get(cn.issued_to_org_id);
      const orgBy = organizationsMap.get(cn.issued_by_org_id);
      const clientName =
        orgTo?.org_type === "client"
          ? orgTo.legal_name
          : orgBy?.org_type === "client"
            ? orgBy.legal_name
            : null;

      entries.push({
        id: `cn_${cn.id}`,
        type: "credit_note",
        timestamp: cn.issue_date,
        created_at: cn.created_at,
        title: `Credit Note — ${cn.credit_note_number}`,
        meta: {
          credit_note_number: cn.credit_note_number,
          reference_number: cn.credit_note_number || cn.origin_reference,
          amount: cn.amount,
          reason: cn.reason,
          issued_by: orgBy?.legal_name || "Unknown",
          issued_to: orgTo?.legal_name || "Unknown",
          issued_by_org_id: cn.issued_by_org_id,
          issued_to_org_id: cn.issued_to_org_id,
          origin_type: cn.origin_type,
          origin_reference: cn.origin_reference,
          status: cn.status,
          client_name: clientName,
        },
      });
    }

    // 6. Debit Notes
    for (const dn of debitNotes || []) {
      const orgTo = organizationsMap.get(dn.issued_to_org_id);
      const orgBy = organizationsMap.get(dn.issued_by_org_id);
      const clientName =
        orgTo?.org_type === "client"
          ? orgTo.legal_name
          : orgBy?.org_type === "client"
            ? orgBy.legal_name
            : null;

      entries.push({
        id: `dn_${dn.id}`,
        type: "debit_note",
        timestamp: dn.issue_date,
        created_at: dn.created_at,
        title: `Debit Note — ${dn.debit_note_number}`,
        meta: {
          debit_note_number: dn.debit_note_number,
          reference_number: dn.debit_note_number || dn.origin_reference,
          amount: dn.amount,
          reason: dn.reason,
          issued_by: orgBy?.legal_name || "Unknown",
          issued_to: orgTo?.legal_name || "Unknown",
          issued_by_org_id: dn.issued_by_org_id,
          issued_to_org_id: dn.issued_to_org_id,
          origin_type: dn.origin_type,
          origin_reference: dn.origin_reference,
          status: dn.status,
          client_name: clientName,
        },
      });
    }

    // 7. Opening Balances
    const obOrgIds = (openingBalances || []).map((ob: any) => ob.organization_id);
    let profilesMap = new Map();
    if (obOrgIds.length > 0) {
      const { data: profiles } = await supabase
        .from("client_commercial_profiles")
        .select("organization_id, historical_invoices")
        .in("organization_id", obOrgIds);
      profilesMap = new Map((profiles || []).map((p: any) => [p.organization_id, p]));
    }

    for (const ob of openingBalances || []) {
      const org = organizationsMap.get(ob.organization_id);
      entries.push({
        id: `ob_${ob.id}`,
        type: "opening_balance",
        timestamp: ob.invoice_date,
        created_at: ob.created_at,
        title: ob.invoice_number ? `Opening Balance (${ob.invoice_number})` : "Opening Balance",
        meta: {
          amount: ob.amount,
          invoice_number: ob.invoice_number,
          reference_number: ob.invoice_number,
          client_name: (org as any)?.legal_name || null,
          historical_invoices: profilesMap.get(ob.organization_id)?.historical_invoices || [],
        },
      });
    }

    // Sort by timestamp descending
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return entries;
  });

export const getAdminUTCLPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: payments, error } = await supabase
      .from("payments")
      .select(
        `
        *,
        organizations (
          legal_name
        ),
        purchase_orders (
          po_number
        ),
        dispatch_requests!utcl_payment_id (
          id,
          quantity,
          site_address,
          invoice_number,
          purchase_orders (
            po_number,
            organizations (
              legal_name
            )
          )
        ),
        direct_dispatch:dispatch_requests!payments_dispatch_request_id_fkey (
          id,
          invoice_number
        ),
        invoice_allocations (
          invoice_id,
          invoices (
            invoice_number
          )
        )
      `,
      )
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
      allocations: z.array(z.any()).optional(),
    }).refine((data) => {
      if (data.isUtclPayment && !data.isClientToUtcl) {
        return !!data.purchaseOrderId || (data.dispatchRequestIds && data.dispatchRequestIds.length > 0);
      }
      return true;
    }, { message: "Mundra to UTCL payments strictly require a linked PO or Dispatch Request." })
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: paymentResult, error } = await supabase.rpc("record_payment_with_allocations", {
      p_org_id: data.organizationId,
      p_po_id: nullableUuid(data.purchaseOrderId),
      p_dispatch_ids: data.dispatchRequestIds || [],
      p_amount: data.amount,
      p_payment_date: data.paymentDate,
      p_payment_mode: data.paymentMode,
      p_ref_no: data.referenceNumber,
      p_is_utcl: data.isUtclPayment ?? false,
      p_is_client_to_utcl: data.isClientToUtcl ?? false,
      p_is_advance: data.isAdvance ?? false,
      p_user_id: context.userId,
      p_manual_allocations: data.allocations || [],
      p_status: "approved",
      p_verified_by: context.userId,
    });

    if (error) throw new Error("Failed to record payment via RPC: " + error.message);
    const rpcResult = paymentResult as RecordPaymentRpcResult | null;
    if (!rpcResult?.payment_id) throw new Error("Payment RPC returned no payment_id");

    // Fetch the inserted payment to return it to the client
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", rpcResult.payment_id)
      .single();

    return { success: true, payment };
  });

export const deletePurchaseOrdersAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(z.object({ ids: z.array(z.string().uuid()) }))
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.from("purchase_orders").delete().in("id", data.ids);

    if (error) {
      if (error.code === "23503") {
        throw new Error(
          "Cannot delete Purchase Order(s) that have associated dispatch requests or payments. Please 'Reject' them instead.",
        );
      }
      throw new Error("Failed to delete Purchase Orders: " + error.message);
    }

    await createAuditLog(
      context.userId,
      "DELETE_PURCHASE_ORDERS_ADMIN",
      "purchase_orders",
      data.ids.join(",").substring(0, 50),
      null,
      { deleted_ids: data.ids },
    );
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
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: oldPayment, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", data.id)
      .single();
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

    await createAuditLog(
      context.userId,
      "UPDATE_PAYMENT_ADMIN",
      "payments",
      data.id,
      oldPayment,
      data,
    );
    return { success: true };
  });

export const deletePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: oldPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", data.id)
      .single();

    const { error } = await supabase.from("payments").delete().eq("id", data.id);
    if (error) throw new Error("Failed to delete payment: " + error.message);

    await createAuditLog(
      context.userId,
      "DELETE_PAYMENT_ADMIN",
      "payments",
      data.id,
      oldPayment,
      null,
    );
    return { success: true };
  });

// =========================================================
// TALLY EXPORT
// =========================================================
export const getExcelExportData = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(
    z.object({
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const fromDate = data?.fromDate;
    const toDate = data?.toDate;

    // 1. Client Ledger Masters
    const { data: clients } = await supabase
      .from("organizations")
      .select("id, legal_name, trade_name, billing_address, gst_number, pan_number")
      .eq("org_type", "client")
      .eq("status", "active");

    // 2. Invoices (Sales Vouchers)
    let invoiceQuery = supabase
      .from("invoices")
      .select("*, organizations(legal_name, trade_name)")
      .order("invoice_date", { ascending: true });
    if (fromDate) invoiceQuery = invoiceQuery.gte("invoice_date", fromDate);
    if (toDate) invoiceQuery = invoiceQuery.lte("invoice_date", toDate);
    const { data: invoices } = await invoiceQuery;

    // 3. Payments (Receipt Vouchers)
    let paymentQuery = supabase
      .from("payments")
      .select("*, organizations(legal_name, trade_name)")
      .order("payment_date", { ascending: true });
    if (fromDate) paymentQuery = paymentQuery.gte("payment_date", fromDate);
    if (toDate) paymentQuery = paymentQuery.lte("payment_date", toDate);
    const { data: payments } = await paymentQuery;

    // 3a. Purchase Orders
    let poQuery = supabase
      .from("purchase_orders")
      .select("*, organizations(legal_name, trade_name)")
      .order("created_at", { ascending: true });
    if (fromDate) poQuery = poQuery.gte("created_at", fromDate);
    if (toDate) poQuery = poQuery.lte("created_at", toDate);
    const { data: pos } = await poQuery;

    // 3b. Dispatch Requests
    let dispatchQuery = supabase
      .from("dispatch_requests")
      .select("*, organizations(legal_name, trade_name), purchase_orders(po_number)")
      .order("created_at", { ascending: true });
    if (fromDate) dispatchQuery = dispatchQuery.gte("created_at", fromDate);
    if (toDate) dispatchQuery = dispatchQuery.lte("created_at", toDate);
    const { data: dispatches } = await dispatchQuery;

    // 4. Credit Notes
    let cnQuery = supabase
      .from("credit_notes")
      .select("*, issued_to:organizations!credit_notes_issued_to_org_id_fkey(legal_name, trade_name)")
      .neq("status", "cancelled")
      .order("issue_date", { ascending: true });
    if (fromDate) cnQuery = cnQuery.gte("issue_date", fromDate);
    if (toDate) cnQuery = cnQuery.lte("issue_date", toDate);
    const { data: creditNotes } = await cnQuery;

    // 5. Debit Notes
    let dnQuery = supabase
      .from("debit_notes")
      .select("*, issued_to:organizations!debit_notes_issued_to_org_id_fkey(legal_name, trade_name)")
      .neq("status", "cancelled")
      .order("issue_date", { ascending: true });
    if (fromDate) dnQuery = dnQuery.gte("issue_date", fromDate);
    if (toDate) dnQuery = dnQuery.lte("issue_date", toDate);
    const { data: debitNotes } = await dnQuery;

    return {
      clients: clients || [],
      invoices: invoices || [],
      payments: payments || [],
      pos: pos || [],
      dispatches: dispatches || [],
      creditNotes: creditNotes || [],
      debitNotes: debitNotes || [],
      exportedAt: new Date().toISOString(),
      fromDate: fromDate || null,
      toDate: toDate || null,
    };
  });

export const getJournalFeed = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.orgType !== "mundra") {
      throw new Error("Unauthorized: Only mundra admin can view journal feed.");
    }
    const supabase = createSupabaseAdminClient();
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("id, action, table_name, created_at, user_id")
      .gte("created_at", `${todayStr}T00:00:00Z`)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("Failed to fetch journal feed: " + error.message);
    }

    const userIds = Array.from(new Set((logs || []).map((l: any) => l.user_id).filter(Boolean)));
    
    let profilesMap = new Map();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds as string[]);
      profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    }

    return (logs || []).map((log: any) => {
      const profile = profilesMap.get(log.user_id);
      return {
        ...log,
        user_name: profile?.full_name || profile?.email || "System/Unknown",
      };
    });
  });

export const getInterestSummary = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.orgType !== "client") throw new Error("Unauthorized");
    const supabase = createSupabaseAdminClient();
    const today = new Date();
    
    // Fetch profile for terms and interest rate
    const { data: profile } = await supabase
      .from("client_commercial_profiles")
      .select("annual_interest_rate, payment_terms_days, grace_period_days")
      .eq("organization_id", context.organizationId)
      .single();
      
    if (!profile) return [];

    const rate = Number(profile.annual_interest_rate || 0);
    const graceDays = Number(profile.grace_period_days || 0);
    
    // Fetch invoices and their allocations
    const { data: invoices } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        status,
        is_opening_balance,
        invoice_allocations (
          allocated_amount,
          payments (
            payment_date,
            status
          )
        )
      `)
      .eq("organization_id", context.organizationId)
      .neq("status", "cancelled");

    if (!invoices) return [];

    const summaries: any[] = [];

    for (const inv of invoices) {
      if (inv.is_opening_balance) continue; // Skip opening balance for now unless instructed otherwise
      const dueDate = new Date(inv.due_date);
      const graceCutoff = new Date(dueDate);
      graceCutoff.setDate(graceCutoff.getDate() + graceDays);

      let totalInterest = 0;
      let totalAllocated = 0;
      const amount = Number(inv.amount || 0);

      // Calculate interest on paid portions (allocations)
      const allocations = Array.isArray(inv.invoice_allocations) ? inv.invoice_allocations : [];
      for (const alloc of allocations) {
        const payment = alloc.payments;
        if (!payment || Array.isArray(payment) || payment.status !== "approved") continue; // only count approved payments

        const allocAmount = Number(alloc.allocated_amount || 0);
        totalAllocated += allocAmount;
        
        const payDate = new Date(payment.payment_date);
        if (payDate > graceCutoff) {
          const overdueDays = Math.max(0, Math.ceil((payDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
          const interest = allocAmount * (rate / 100) * (overdueDays / 365);
          totalInterest += interest;
        }
      }

      // Calculate interest on unpaid portion
      const unallocated = Math.max(0, amount - totalAllocated);
      if (unallocated > 0 && today > graceCutoff) {
        const overdueDays = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        const interest = unallocated * (rate / 100) * (overdueDays / 365);
        totalInterest += interest;
      }

      let status = "Settled";
      if (unallocated > 0) status = "Pending";
      
      // Determine max overdue days to display
      let maxOverdueDays = 0;
      if (unallocated > 0 && today > dueDate) {
        maxOverdueDays = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      } else {
        for (const alloc of allocations) {
           const payment = alloc.payments;
           if (payment && !Array.isArray(payment) && payment.status === "approved") {
             const payDate = new Date(payment.payment_date);
             if (payDate > dueDate) {
                const days = Math.max(0, Math.ceil((payDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
                if (days > maxOverdueDays) maxOverdueDays = days;
             }
           }
        }
      }

      // Only push rows that actually accrued interest (or could accrue)
      if (totalInterest > 0) {
        summaries.push({
          id: inv.id,
          reference: inv.invoice_number,
          date: inv.invoice_date,
          principal: amount,
          dueDate: inv.due_date,
          actualPaymentDate: status === "Settled" ? "Fully Paid" : "Unpaid/Partial", // Simplified for table
          overdueDays: maxOverdueDays,
          rate,
          interest: totalInterest,
          status
        });
      }
    }

    return summaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

export const getAdminOverdueReport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      clientId: z.string().optional().or(z.literal("all")),
    })
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) throw new Error("Unauthorized");
    
    const supabase = createSupabaseAdminClient();
    const today = new Date();

    let query = supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_date,
        due_date,
        amount,
        status,
        is_opening_balance,
        organization_id,
        organizations (
          legal_name,
          trade_name
        ),
        invoice_allocations (
          allocated_amount
        )
      `)
      .in("status", ["unpaid", "partially_paid"])
      .neq("is_opening_balance", true);

    if (data.clientId && data.clientId !== "all") {
      query = query.eq("organization_id", data.clientId);
    }

    const { data: invoices, error } = await query;
    if (error || !invoices) return [];

    const orgIds = Array.from(new Set(invoices.map((i: any) => i.organization_id)));
    const { data: profiles } = await supabase
      .from("client_commercial_profiles")
      .select("organization_id, grace_period_days, annual_interest_rate")
      .in("organization_id", orgIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.organization_id, p]));

    const report = invoices.map((inv: any) => {
      const amount = Number(inv.amount || 0);
      const allocations = Array.isArray(inv.invoice_allocations) ? inv.invoice_allocations : [];
      const totalAllocated = allocations.reduce((sum: number, alloc: any) => sum + Number(alloc.allocated_amount || 0), 0);
      const unpaidAmount = Math.max(0, amount - totalAllocated);

      const dueDate = new Date(inv.due_date);
      const profile = profileMap.get(inv.organization_id);
      const graceDays = Number(profile?.grace_period_days || 0);
      const rate = Number(profile?.annual_interest_rate || 0);
      
      const graceCutoff = new Date(dueDate);
      graceCutoff.setDate(graceCutoff.getDate() + graceDays);

      let overdueDays = 0;
      let isInGracePeriod = false;
      let accruedInterest = 0;

      if (today > dueDate) {
        overdueDays = Math.max(0, Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        if (today <= graceCutoff) {
          isInGracePeriod = true;
        } else if (unpaidAmount > 0) {
          // Calculate interest from day 31 (due date) if they exceed grace period
          accruedInterest = unpaidAmount * (rate / 100) * (overdueDays / 365);
        }
      }

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        client_name: inv.organizations?.trade_name || inv.organizations?.legal_name || "Unknown Client",
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        amount,
        unpaid_amount: unpaidAmount,
        overdue_days: overdueDays,
        is_in_grace_period: isInGracePeriod,
        accrued_interest: accruedInterest,
        status: inv.status
      };
    }).filter((r: any) => r.unpaid_amount > 0);

    return report.sort((a, b) => b.overdue_days - a.overdue_days);
  });

export const getClientOrganization = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(
    z.object({
      organizationId: z.string().optional(), // Admin passes this, client uses context
    }).optional()
  )
  .handler(async ({ data, context }) => {
    const supabase = createSupabaseAdminClient();
    const orgId = context.orgType === "mundra" && data?.organizationId ? data.organizationId : context.organizationId;
    
    if (!orgId) throw new Error("Organization ID required");
    
    const { data: org, error } = await supabase
      .from("organizations")
      .select("*, billing_addresses:client_billing_addresses(*)")
      .eq("id", orgId)
      .single();
      
    if (error) throw new Error(error.message);
    return org;
  });

export const getRefundEligibleAllocations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    // Fetch all client-to-utcl payments
    const { data: payments, error } = await supabase
      .from("payments")
      .select(`
        id,
        amount,
        payment_date,
        payment_mode,
        reference_number,
        is_client_to_utcl,
        status,
        organization_id,
        is_advance,
        dispatch_requests!payments_dispatch_request_id_fkey (
          id,
          invoice_number,
          quantity,
          purchase_orders (
            locked_rate
          ),
          invoices (
            id,
            invoice_number,
            invoice_date,
            amount
          )
        ),
        linked_dispatches:dispatch_requests!utcl_payment_id (
          id,
          invoice_number,
          quantity,
          purchase_orders (
            locked_rate
          ),
          invoices (
            id,
            invoice_number,
            invoice_date,
            amount
          )
        ),
        purchase_orders!payments_purchase_order_id_fkey (
          po_number
        ),
        organizations (
          trade_name,
          legal_name,
          party_code,
          tp_code
        ),
        invoice_allocations (
          id,
          allocated_amount,
          tds_amount,
          invoice_id,
          invoices (
            id,
            invoice_number,
            invoice_date,
            amount
          )
        )
      `)
      .eq("is_client_to_utcl", true)
      .in("status", ["submitted", "approved"]);

    if (error) {
      console.error("Failed to fetch refund eligible payments:", error);
      throw new Error(error.message);
    }

    // Fetch refund letters to calculate used amounts
    // @ts-ignore: allocated_amount might not be in types.ts yet
    const { data: refundLetters, error: rlError } = await supabase
      .from("refund_letters")
      .select("payment_id, allocated_amount");
      
    if (rlError) {
       console.warn("Refund letters query error:", rlError.message);
       // Ignore error to prevent crashing if columns are missing
    }
    
    // Calculate how much of each payment has been used in refund letters
    const refundedAmounts: Record<string, number> = {};
    const fullyRefunded = new Set<string>();
    
    if (refundLetters) {
      for (const rl of refundLetters as any[]) {
        if (rl.allocated_amount !== undefined && rl.allocated_amount !== null) {
          refundedAmounts[rl.payment_id] = (refundedAmounts[rl.payment_id] || 0) + Number(rl.allocated_amount);
        } else {
          // If no allocated_amount column exists or it's null, assume fully refunded
          fullyRefunded.add(rl.payment_id);
        }
      }
    }

    const eligibleItems: any[] = [];
    const clientOrgIds = new Set<string>();

    for (const p of payments || []) {
      if (fullyRefunded.has(p.id)) continue;
      
      const usedAmount = refundedAmounts[p.id] || 0;
      const remainingAmount = Math.max(0, p.amount - usedAmount);
      
      if (remainingAmount <= 0) continue;
      
      clientOrgIds.add(p.organization_id);

      if (p.invoice_allocations && p.invoice_allocations.length > 0) {
        // Payment has allocations, push each allocation
        for (const alloc of p.invoice_allocations) {
          // If a payment is partially refunded, we just pass the remaining amount
          // The frontend will figure out how to allocate it.
          eligibleItems.push({
            id: alloc.id,
            allocated_amount: alloc.allocated_amount,
            tds_amount: (alloc as any).tds_amount ?? 0,
            payment_id: p.id,
            invoice_id: alloc.invoice_id,
            payments: {
              id: p.id,
              amount: p.amount,
              payment_date: p.payment_date,
              payment_mode: p.payment_mode,
              reference_number: (p as any).reference_number ?? null,
              is_client_to_utcl: p.is_client_to_utcl,
              status: p.status,
              organization_id: p.organization_id,
              is_advance: (p as any).is_advance,
              remaining_amount: remainingAmount
            },
            invoices: {
              ...alloc.invoices,
              organizations: p.organizations // Attach org from payment
            }
          });
        }
      } else {
        // Payment is unallocated (e.g. delay in linking or on-account).
        // A dispatch reaches the payment either through payments.dispatch_request_id
        // (set from fifo_payment_rpc_fix_4 onward) or through
        // dispatch_requests.utcl_payment_id (older RPCs). Try both, so the real
        // invoice number is used instead of falling back to the PO number.
        const linked = (p as any).linked_dispatches;
        const dr =
          p.dispatch_requests ||
          (Array.isArray(linked) ? linked[0] : linked) ||
          null;
        const po = p.purchase_orders;
        let invoiceNumber = "Unlinked Payment";
        let invoiceAmount = p.amount;
        let invoiceId = null;
        let invoiceDate = null;

        if (dr) {
          const matchingInvoice = dr.invoices && dr.invoices.length > 0 ? dr.invoices[0] : null;
          
          if (matchingInvoice) {
            invoiceId = matchingInvoice.id;
            invoiceNumber = matchingInvoice.invoice_number;
            invoiceAmount = matchingInvoice.amount;
            invoiceDate = matchingInvoice.invoice_date;
          } else {
            invoiceNumber = dr.invoice_number || `Dispatch (Qty: ${dr.quantity} MT)`;
            const rate = dr.purchase_orders?.locked_rate || 0;
            if (rate > 0 && dr.quantity > 0) {
              invoiceAmount = dr.quantity * rate;
            }
          }
        } else if (po) {
          invoiceNumber = po.po_number || "PO Payment";
        }

        eligibleItems.push({
          id: p.id, // use payment ID as the unique key
          allocated_amount: p.amount, // assume full amount is available
          payment_id: p.id,
          invoice_id: invoiceId,
          payments: {
            id: p.id,
            amount: p.amount,
            payment_date: p.payment_date,
            payment_mode: p.payment_mode,
            reference_number: (p as any).reference_number ?? null,
            is_client_to_utcl: p.is_client_to_utcl,
            status: p.status,
            organization_id: p.organization_id,
            is_advance: (p as any).is_advance,
            remaining_amount: remainingAmount
          },
          invoices: {
            id: invoiceId,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            amount: invoiceAmount, 
            organizations: p.organizations
          }
        });
      }
    }
    
    // Fetch pending invoices for the clients who have eligible payments
    const pendingInvoices: any[] = [];
    if (clientOrgIds.size > 0) {
      const { data: invs, error: invError } = await supabase
        .from("invoices")
        .select(`
          id, invoice_number, invoice_date, amount, organization_id,
          organizations(trade_name, legal_name, party_code, tp_code),
          invoice_allocations(allocated_amount)
        `)
        .in("organization_id", Array.from(clientOrgIds))
        .in("status", ["unpaid", "partially_paid"])
        // An opening balance is a carried-forward figure, not a UTCL dispatch,
        // so it can never be claimed on a refund letter. Without this it is
        // always the oldest row and FIFO swallowed every payment into it.
        .eq("is_opening_balance", false)
        .order("invoice_date", { ascending: true });
        
      if (!invError && invs) {
        for (const inv of invs) {
          const totalAllocated = inv.invoice_allocations?.reduce((sum: number, a: any) => sum + (Number(a.allocated_amount) || 0), 0) || 0;
          const outstanding = Math.max(0, inv.amount - totalAllocated);
          
          if (outstanding > 0) {
            pendingInvoices.push({
              ...inv,
              outstanding_amount: outstanding
            });
          }
        }
      }
    }

    // The refund letter's "Payment Details" and "Date of Payment" columns must
    // show the MUNDRA-to-UTCL payment, not the client's. Starting from
    // invoice.dispatch_request_id, a Mundra payment can be linked to that
    // dispatch three different ways, so all three are tried (most specific
    // first) before giving up and leaving the cells blank.
    const mundraPaymentByInvoice: Record<string, { payment_date: string; payment_mode: string }> = {};
    const allInvoiceIds = Array.from(
      new Set([
        ...eligibleItems.map((e: any) => e.invoice_id).filter(Boolean),
        ...pendingInvoices.map((i: any) => i.id).filter(Boolean),
      ]),
    );

    if (allInvoiceIds.length > 0) {
      const { data: invRows } = await supabase
        .from("invoices")
        .select("id, dispatch_request_id")
        .in("id", allInvoiceIds);

      const dispatchIds = Array.from(
        new Set((invRows || []).map((r: any) => r.dispatch_request_id).filter(Boolean)),
      );

      if (dispatchIds.length > 0) {
        const { data: drRows } = await supabase
          .from("dispatch_requests")
          .select("id, purchase_order_id, utcl_payment_id")
          .in("id", dispatchIds);

        // Pull every Mundra-to-UTCL payment for these clients, then match it to
        // a dispatch by any of the three ways one can be linked. Relying on
        // dispatch.utcl_payment_id alone loses the payment whenever a later
        // client-to-UTCL payment overwrote that column (RPC versions before
        // fifo_payment_rpc_fix_3 did exactly that).
        const { data: mundraPays } = await supabase
          .from("payments")
          .select(
            "id, payment_date, payment_mode, dispatch_request_id, purchase_order_id, is_utcl_payment, is_client_to_utcl",
          )
          .in("organization_id", Array.from(clientOrgIds))
          .eq("is_utcl_payment", true);

        const mundraOnly = (mundraPays || []).filter((mp: any) => !mp.is_client_to_utcl);

        const byId = new Map<string, any>();
        const byDispatch = new Map<string, any>();
        const byPo = new Map<string, any>();
        // Newest payment wins when several cover the same reference.
        const newer = (a: any, b: any) =>
          !a || new Date(b.payment_date).getTime() >= new Date(a.payment_date).getTime() ? b : a;

        for (const mp of mundraOnly) {
          byId.set(mp.id, mp);
          if (mp.dispatch_request_id) {
            byDispatch.set(mp.dispatch_request_id, newer(byDispatch.get(mp.dispatch_request_id), mp));
          }
          if (mp.purchase_order_id) {
            byPo.set(mp.purchase_order_id, newer(byPo.get(mp.purchase_order_id), mp));
          }
        }

        const drById = new Map<string, any>();
        for (const dr of drRows || []) drById.set(dr.id, dr);

        for (const r of invRows || []) {
          if (!r.dispatch_request_id) continue;
          const dr = drById.get(r.dispatch_request_id);
          if (!dr) continue;

          // Most specific link first, then broaden.
          const mp =
            (dr.utcl_payment_id ? byId.get(dr.utcl_payment_id) : undefined) ||
            byDispatch.get(dr.id) ||
            (dr.purchase_order_id ? byPo.get(dr.purchase_order_id) : undefined);

          if (!mp) continue;
          mundraPaymentByInvoice[r.id] = {
            payment_date: mp.payment_date,
            payment_mode: mp.payment_mode,
          };
        }
      }
    }

    // Opening-balance exception: a bill-wise opening balance has no PO/dispatch
    // and therefore no Mundra-to-UTCL payment, so the loop above leaves its
    // payment-date cell blank ("payment to UTCL not found"). For these bills the
    // "Mundra paid UTCL" date is the mundraPaymentDate the user recorded at
    // client creation (kept per bill in historical_invoices). Fill it in here.
    const obInvoiceIds = allInvoiceIds.filter((id) => !mundraPaymentByInvoice[id]);
    if (obInvoiceIds.length > 0) {
      const { data: obRows } = await supabase
        .from("invoices")
        .select("id, invoice_number, organization_id, is_opening_balance")
        .in("id", obInvoiceIds)
        .eq("is_opening_balance", true);

      const obOrgIds = Array.from(
        new Set((obRows || []).map((r: any) => r.organization_id).filter(Boolean)),
      );
      const histByOrg = new Map<string, any[]>();
      if (obOrgIds.length > 0) {
        const { data: profiles } = await supabase
          .from("client_commercial_profiles")
          .select("organization_id, historical_invoices")
          .in("organization_id", obOrgIds);
        for (const p of (profiles || []) as any[]) {
          histByOrg.set(p.organization_id, p.historical_invoices || []);
        }
      }

      for (const ob of obRows || []) {
        const hist = histByOrg.get(ob.organization_id) || [];
        const match = hist.find(
          (h: any) => String(h.invoiceNumber ?? "") === String(ob.invoice_number ?? ""),
        );
        const mundraDate = match?.mundraPaymentDate || match?.date || null;
        if (mundraDate) {
          mundraPaymentByInvoice[ob.id] = {
            payment_date: mundraDate,
            payment_mode: "Opening Balance",
          };
        }
      }
    }

    return { eligibleItems, pendingInvoices, mundraPaymentByInvoice };
  });

export const markPaymentsAsRefunded = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    z.object({
      paymentIds: z.array(z.string()).optional(),
      allocations: z.array(z.object({
        paymentId: z.string(),
        invoiceId: z.string().nullable().optional(),
        amount: z.number().optional(),
        isNewAllocation: z.boolean().optional() // Flag to persist FIFO/Advance allocations
      })).optional(),
      reference_number: z.string().optional(),
      total_amount: z.number().optional()
    })
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();
    
    // Determine payment IDs from either payload
    const paymentIds = data.paymentIds || data.allocations?.map(a => a.paymentId) || [];
    if (paymentIds.length === 0) return { success: true };
    
    // We need organization_id for refund_letters. Let's fetch the payments first.
    const { data: payments, error: pError } = await supabase
      .from("payments")
      .select("id, organization_id")
      .in("id", paymentIds);
      
    if (pError) throw new Error(pError.message);
    
    const orgMap = Object.fromEntries((payments || []).map((p: any) => [p.id, p.organization_id]));
    
    // 1. Process explicit allocations that need to be saved (FIFO or Advance)
    if (data.allocations && data.allocations.length > 0) {
      const newInvoiceAllocations = data.allocations
        .filter(a => a.isNewAllocation && a.invoiceId && a.amount && a.amount > 0)
        .map(a => ({
          payment_id: a.paymentId,
          invoice_id: a.invoiceId!,
          allocated_amount: a.amount!
        }));
        
      if (newInvoiceAllocations.length > 0) {
        const { error: allocError } = await supabase
          .from("invoice_allocations")
          .insert(newInvoiceAllocations);
        if (allocError) {
          console.error("Failed to insert invoice allocations:", allocError);
        }
      }
    }

    // 2. Insert into refund_letters
    const refundRows: any[] = [];
    if (data.allocations && data.allocations.length > 0) {
      for (const a of data.allocations) {
        if (!orgMap[a.paymentId]) continue;
        refundRows.push({
          payment_id: a.paymentId,
          organization_id: orgMap[a.paymentId],
          invoice_id: a.invoiceId || null,
          allocated_amount: a.amount || null,
          status: 'generated',
          reference_number: data.reference_number || null
        });
      }
    } else {
      // Legacy backward compatibility
      for (const pid of paymentIds) {
        if (!orgMap[pid]) continue;
        refundRows.push({
          payment_id: pid,
          organization_id: orgMap[pid],
          status: 'generated',
          reference_number: data.reference_number || null
        });
      }
    }
    
    if (refundRows.length > 0) {
      // @ts-ignore: invoice_id and allocated_amount might not be in types.ts yet
      const { error } = await supabase
        .from("refund_letters")
        .insert(refundRows);
        
      if (error && !error.message.includes("allocated_amount")) {
        throw new Error(error.message);
      } else if (error && error.message.includes("allocated_amount")) {
        // Fallback for when migration hasn't run yet
        const fallbackRows = refundRows.map(r => ({
          payment_id: r.payment_id,
          organization_id: r.organization_id,
          status: r.status,
          reference_number: r.reference_number
        }));
        const { error: fallbackError } = await supabase.from("refund_letters").insert(fallbackRows);
        if (fallbackError) throw new Error(fallbackError.message);
      }
    }
    
    // 3. Auto-insert into utcl_refund_letters so it appears in the UTCL to Mundra tab
    if (data.reference_number && data.total_amount !== undefined && data.total_amount > 0) {
      const { data: existing } = await supabase
        .from("utcl_refund_letters")
        .select("id")
        .eq("reference_number", data.reference_number)
        .maybeSingle();

      if (!existing) {
        const { error: utclErr } = await supabase
          .from("utcl_refund_letters")
          .insert({
            reference_number: data.reference_number,
            amount: data.total_amount
          });
        if (utclErr) {
          console.error("Failed to insert into utcl_refund_letters:", utclErr);
        }
      } else {
        // Update amount if it already exists but amount might be 0
        const { error: utclUpdateErr } = await supabase
          .from("utcl_refund_letters")
          .update({ amount: data.total_amount })
          .eq("id", existing.id);
        if (utclUpdateErr) {
          console.error("Failed to update utcl_refund_letters:", utclUpdateErr);
        }
      }
    }
    
    return { success: true };
  });

export const getRefundLetterReferences = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("refund_letters")
      .select("reference_number")
      .not("reference_number", "is", null);

    if (error) {
      console.error("Error fetching refund letter references:", error);
      return [];
    }

    const uniqueRefs = Array.from(new Set((data || []).map(r => r.reference_number).filter(Boolean)));
    return uniqueRefs.sort((a, b) => (b as string).localeCompare(a as string));
  });

export const getUtclRefundLetters = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("utcl_refund_letters")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching utcl refund letters:", error);
      throw error;
    }

    return data;
  });

export const createUtclRefundLetter = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { reference_number: string; amount: number }) => d)
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { data: result, error } = await supabase
      .from("utcl_refund_letters")
      .insert({
        reference_number: data.reference_number,
        amount: data.amount,
        created_by: context.userId ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  });

export const updateUtclRefundLetterStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: { id: string; is_paid: boolean }) => d)
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("utcl_refund_letters")
      .update({
        is_paid: data.is_paid,
        paid_at: data.is_paid ? new Date().toISOString() : null,
      })
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });
