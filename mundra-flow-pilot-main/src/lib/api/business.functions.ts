import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getMongoDb } from "@/integrations/mongo/client.server";
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
    const db = await getMongoDb();
    await db.collection("audit_logs").insertOne({
      _id: randomUUID(),
      id: randomUUID(),
      user_id: userId,
      action,
      table_name: tableName,
      record_id: recordId,
      previous_values: prev,
      new_values: next,
      created_at: new Date(),
    });
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
  const db = await getMongoDb();
  const products = await db.collection("products").find({ is_active: true }).toArray();
  return new Map(products.map((product: any) => [product.id, product]));
}

async function loadOrganizationsMap() {
  const db = await getMongoDb();
  const organizations = await db.collection("organizations").find().toArray();
  return new Map(organizations.map((org: any) => [org.id, org]));
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
    const db = await getMongoDb();
    const { organizationId, orgType } = context;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (orgType === "mundra") {
      const activeClients = await db
        .collection("organizations")
        .countDocuments({ org_type: "client", status: "active" });

      const profiles = await db.collection("client_commercial_profiles").find().toArray();
      const sanctionedCredit = profiles.reduce((sum: number, profile: any) => sum + Number(profile.credit_limit || 0), 0);

      const invoices = await db.collection("invoices").find({ status: { $ne: "paid" } }).toArray();
      const outstanding = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
      const overdue = invoices
        .filter((invoice: any) => invoice.due_date && invoice.due_date < todayStr)
        .reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);

      const posPending = await db.collection("purchase_orders").countDocuments({ status: "pending_approval" });
      const posBlocked = await db.collection("purchase_orders").countDocuments({ status: "blocked" });
      const dispatchPending = await db.collection("dispatch_requests").countDocuments({ status: "submitted" });
      const paymentsUnderVerification = await db.collection("payments").countDocuments({ status: "submitted" });
      const refundLettersPending = await db.collection("refund_letters").countDocuments({ status: "draft" });
      const balanceConfPending = await db.collection("balance_confirmations").countDocuments({ status: { $ne: "approved" } });
      const specialApprovalsActive = await db.collection("special_approvals").countDocuments({ status: "active" });

      return {
        isAdmin: true,
        portfolio: {
          activeClients,
          sanctionedCredit,
          recognizedExposure: outstanding,
          availableCredit: Math.max(0, sanctionedCredit - outstanding),
          overdueClients: 0,
          overdue90Plus: overdue,
        },
        queues: {
          posPending,
          posBlocked,
          dispatchPending,
          paymentsUnderVerification,
          refundLettersPending,
          balanceConfPending,
          specialApprovalsActive,
        },
      };
    }

    const commProfile = await db.collection("client_commercial_profiles").findOne({ organization_id: organizationId });
    const creditLimit = commProfile ? Number(commProfile.credit_limit || 0) : 0;

    const invoices = await db
      .collection("invoices")
      .find({ organization_id: organizationId, status: { $ne: "paid" } })
      .toArray();

    const outstanding = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
    const overdueInvoices = invoices.filter((invoice: any) => invoice.due_date && invoice.due_date < todayStr);
    const overdue = overdueInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
    const oldestOverdueDays = overdueInvoices.length
      ? Math.round((today.getTime() - new Date(overdueInvoices[0].due_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const pos = await db.collection("purchase_orders").countDocuments({ organization_id: organizationId });
    const activeDRs = await db
      .collection("dispatch_requests")
      .find({ organization_id: organizationId, status: { $in: ["approved", "auto_approved"] } })
      .toArray();
    const dispatchedQty = activeDRs.reduce((sum: number, dr: any) => sum + Number(dr.quantity || 0), 0);

    const pendingPOs = await db
      .collection("purchase_orders")
      .find({ organization_id: organizationId, status: { $in: ["submitted", "pending_approval"] } })
      .toArray();
    const pendingPoQty = pendingPOs.reduce((sum: number, po: any) => sum + Number(po.original_quantity || 0), 0);

    const pendingPaymentApprovals = await db.collection("payments").countDocuments({ organization_id: organizationId, status: "submitted" });
    const pendingBalanceConfirmations = await db.collection("balance_confirmations").countDocuments({ organization_id: organizationId, status: { $in: ["pending_upload", "under_review"] } });

    const blockedDispatches = await db.collection("dispatch_requests").find({ organization_id: organizationId, status: "blocked" }).toArray();

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
        activePOs: pos,
        pendingPoQty,
        dispatchedQty,
        pendingPaymentApprovals,
        pendingBalanceConfirmations,
      },
      blockedDispatches: blockedDispatches.map((d: any) => ({
        id: d.id,
        reason: Array.isArray(d.eligibility_result?.reasons)
          ? d.eligibility_result.reasons.join(", ")
          : "Blocked by eligibility rules",
        po: d.purchase_order_id,
        site: d.site_address,
      })),
    };
  });

export const getClients = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = await getMongoDb();
    const organizations = await db.collection("organizations").find({ org_type: "client" }).toArray();
    const orgIds = organizations.map((org: any) => org.id);
    const profiles = await db.collection("client_commercial_profiles").find({ organization_id: { $in: orgIds } }).toArray();
    const profilesByOrg = new Map(profiles.map((profile: any) => [profile.organization_id, profile]));

    return organizations.map((org: any) => ({
      ...org,
      client_commercial_profile: profilesByOrg.get(org.id) ?? null,
    }));
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      legalName: z.string().min(1),
      shortName: z.string().optional(),
      gstNumber: z.string().optional(),
      panNumber: z.string().optional(),
      creditLimit: z.number().nonnegative(),
      paymentTermsDays: z.number().nonnegative(),
      gracePeriodDays: z.number().nonnegative(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    if (!isSuperAdmin(context.roles)) {
      throw new Error("Unauthorized: Only Mundra Super Admin can create clients.");
    }

    const db = await getMongoDb();
    const orgId = randomUUID();
    const org = {
      _id: orgId,
      id: orgId,
      legal_name: data.legalName,
      short_name: data.shortName || null,
      org_type: "client",
      gst_number: data.gstNumber || null,
      pan_number: data.panNumber || null,
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("organizations").insertOne(org);

    const profile = {
      _id: randomUUID(),
      id: randomUUID(),
      organization_id: orgId,
      credit_limit: data.creditLimit,
      payment_terms_days: data.paymentTermsDays,
      grace_period_days: data.gracePeriodDays,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db.collection("client_commercial_profiles").insertOne(profile);

    await createAuditLog(context.userId, "CREATE_CLIENT", "organizations", org.id, null, { org, profile });
    return { org, profile };
  });

export const getProducts = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = await getMongoDb();
    return await db.collection("products").find({ is_active: true }).sort({ name: 1 }).toArray();
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      name: z.string().min(1),
      grade: z.string().optional(),
      packaging: z.string().optional(),
      unit: z.string().default("MT"),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);

    const db = await getMongoDb();
    const productId = randomUUID();
    const product = {
      _id: productId,
      id: productId,
      name: data.name,
      grade: data.grade || null,
      packaging: data.packaging || null,
      unit: data.unit,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("products").insertOne(product);
    await createAuditLog(context.userId, "CREATE_PRODUCT", "products", product.id, null, product);
    return product;
  });

export const getRates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = await getMongoDb();
    const rates = await db.collection("rates").find().toArray();
    const productsMap = await loadProductsMap();
    const organizationsMap = await loadOrganizationsMap();

    return rates.map((rate: any) => ({
      ...rate,
      product: productsMap.get(rate.product_id) ?? null,
      organization: rate.organization_id ? organizationsMap.get(rate.organization_id) ?? null : null,
    }));
  });

export const createOrUpdateRate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
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

    const db = await getMongoDb();
    const id = randomUUID();
    const rate = {
      _id: id,
      id,
      product_id: data.productId,
      organization_id: data.organizationId,
      amount: data.amount,
      effective_from: data.effectiveFrom,
      effective_to: data.effectiveTo,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("rates").insertOne(rate);
    await createAuditLog(context.userId, "CREATE_RATE", "rates", rate.id, null, rate);
    return rate;
  });

async function runDispatchEligibilityCheck(dispatchRequestId: string, userId: string | null) {
  const db = await getMongoDb();
  const dr = await db.collection("dispatch_requests").findOne({ id: dispatchRequestId });
  if (!dr) throw new Error("Dispatch request not found");

  const po = await db.collection("purchase_orders").findOne({ id: dr.purchase_order_id });
  if (!po) throw new Error("Purchase order not found for dispatch request");

  const orgId = dr.organization_id;
  const commProfile = await db.collection("client_commercial_profiles").findOne({ organization_id: orgId });
  const creditLimit = commProfile ? Number(commProfile.credit_limit || 0) : 0;
  const paymentTerms = commProfile ? Number(commProfile.payment_terms_days || 30) : 30;
  const gracePeriod = commProfile ? Number(commProfile.grace_period_days || 0) : 0;

  const org = await db.collection("organizations").findOne({ id: orgId });
  const organizationStatus = org?.status || "active";

  const specials = await db.collection("special_approvals").find({ organization_id: orgId, status: "active" }).toArray();
  const hasCreditOverride = specials.some((s: any) => s.exception_type === "credit_limit");
  const hasTermsOverride = specials.some((s: any) => s.exception_type === "overdue_payment");
  const hasConfOverride = specials.some((s: any) => s.exception_type === "balance_confirmation");

  const invoices = await db.collection("invoices").find({ organization_id: orgId, status: { $ne: "paid" } }).toArray();
  const totalOutstanding = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);

  const dueDateFns = invoices.map((invoice: any) => {
    const dueDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null;
    if (!dueDate) return null;
    dueDate.setDate(dueDate.getDate() + paymentTerms + gracePeriod);
    return dueDate;
  });
  const overdueInvoices = invoices.filter((invoice: any, index: number) => {
    const dueDate = dueDateFns[index];
    return dueDate ? dueDate < new Date() : false;
  });
  const totalOverdue = overdueInvoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);

  const activeDRs = await db
    .collection("dispatch_requests")
    .find({
      organization_id: orgId,
      status: { $in: ["submitted", "auto_approved", "pending_mundra", "approved"] },
    })
    .toArray();

  const purchaseOrderIds = activeDRs.map((item: any) => item.purchase_order_id);
  const purchaseOrders = await db
    .collection("purchase_orders")
    .find({ id: { $in: purchaseOrderIds } })
    .toArray();
  const purchaseOrderMap = new Map(purchaseOrders.map((po: any) => [po.id, po]));

  const activeDispatchesValue = activeDRs.reduce((sum: number, item: any) => {
    const itemPo = purchaseOrderMap.get(item.purchase_order_id);
    return sum + Number(item.quantity || 0) * Number(itemPo?.locked_rate || 0);
  }, 0);

  const currentVal = Number(dr.quantity || 0) * Number(po.locked_rate || 0);
  const totalExposure = totalOutstanding + activeDispatchesValue + currentVal;

  const todayStr = new Date().toISOString().split("T")[0];
  const overdueConfirmations = await db
    .collection("balance_confirmations")
    .find({ organization_id: orgId, status: { $ne: "approved" }, block_date: { $lt: todayStr } })
    .toArray();
  const hasOverdueConfirmations = overdueConfirmations.length > 0;

  const reasons: string[] = [];
  if (organizationStatus !== "active") {
    reasons.push("Client organization is inactive or suspended");
  }
  if (totalExposure > creditLimit && !hasCreditOverride) {
    reasons.push(
      `Credit limit exceeded (Exposure: ₹${totalExposure.toLocaleString()} vs Limit: ₹${creditLimit.toLocaleString()})`,
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
    updated_at: new Date(),
  };

  await db.collection("dispatch_requests").updateOne({ id: dispatchRequestId }, { $set: update });
  const updatedDr = await db.collection("dispatch_requests").findOne({ id: dispatchRequestId });
  await createAuditLog(userId, "EVALUATE_DISPATCH", "dispatch_requests", dispatchRequestId, dr, updatedDr);
  return updatedDr;
}

export const getPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await getMongoDb();
    const filter: any = {};
    if (context.orgType !== "mundra") {
      filter.organization_id = context.organizationId;
    }

    const purchaseOrders = await db
      .collection("purchase_orders")
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();

    const productsMap = await loadProductsMap();
    const organizationsMap = await loadOrganizationsMap();

    return purchaseOrders.map((po: any) => ({
      ...po,
      product: productsMap.get(po.product_id) ?? null,
      organization: organizationsMap.get(po.organization_id) ?? null,
    }));
  });

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      poNumber: z.string().min(1),
      productId: z.string().uuid(),
      originalQuantity: z.number().positive(),
      lockedRate: z.number().positive(),
      siteAddress: z.string().min(1),
      deliveryContact: z.string().optional(),
      documentMethod: z.enum(["upload", "generate"]),
      documentUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureClientOrg(context.orgType);

    const db = await getMongoDb();
    const poId = randomUUID();
    const purchaseOrder = {
      _id: poId,
      id: poId,
      organization_id: context.organizationId,
      po_number: data.poNumber,
      product_id: data.productId,
      original_quantity: data.originalQuantity,
      locked_rate: data.lockedRate,
      total_value: data.originalQuantity * data.lockedRate,
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      document_method: data.documentMethod,
      document_url: data.documentUrl || null,
      status: "pending_approval",
      created_by: context.userId,
      approved_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("purchase_orders").insertOne(purchaseOrder);
    await createAuditLog(context.userId, "CREATE_PO", "purchase_orders", purchaseOrder.id, null, purchaseOrder);
    return purchaseOrder;
  });

export const updatePurchaseOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);

    const db = await getMongoDb();
    const prevPO = await db.collection("purchase_orders").findOne({ id: data.id });
    if (!prevPO) throw new Error("Purchase Order not found");

    await db.collection("purchase_orders").updateOne({ id: data.id }, { $set: { status: data.status, approved_by: context.userId, updated_at: new Date() } });
    const updatedPO = await db.collection("purchase_orders").findOne({ id: data.id });
    await createAuditLog(context.userId, "UPDATE_PO_STATUS", "purchase_orders", data.id, prevPO, updatedPO);
    return updatedPO;
  });

export const getDispatchRequests = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await getMongoDb();
    const filter: any = {};
    if (context.orgType !== "mundra") {
      filter.organization_id = context.organizationId;
    }

    const dispatchRequests = await db.collection("dispatch_requests").find(filter).sort({ created_at: -1 }).toArray();
    const purchaseOrderIds = dispatchRequests.map((dr: any) => dr.purchase_order_id);
    const purchaseOrders = await db.collection("purchase_orders").find({ id: { $in: purchaseOrderIds } }).toArray();
    const purchaseOrderMap = new Map(purchaseOrders.map((po: any) => [po.id, po]));
    const organizationsMap = await loadOrganizationsMap();

    return dispatchRequests.map((dr: any) => ({
      ...dr,
      purchase_order: purchaseOrderMap.get(dr.purchase_order_id) ?? null,
      organization: organizationsMap.get(dr.organization_id) ?? null,
    }));
  });

export const createDispatchRequest = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
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

    const db = await getMongoDb();
    const drId = randomUUID();
    const dispatchRequest = {
      _id: drId,
      id: drId,
      purchase_order_id: data.purchaseOrderId,
      organization_id: context.organizationId,
      quantity: data.quantity,
      requested_date: data.requestedDate,
      site_address: data.siteAddress,
      delivery_contact: data.deliveryContact || null,
      status: "submitted",
      eligibility_result: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("dispatch_requests").insertOne(dispatchRequest);
    await createAuditLog(context.userId, "CREATE_DISPATCH", "dispatch_requests", dispatchRequest.id, null, dispatchRequest);
    await runDispatchEligibilityCheck(dispatchRequest.id, context.userId);
    return dispatchRequest;
  });

export const evaluateDispatchEligibility = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    return await runDispatchEligibilityCheck(data.id, context.userId);
  });

export const updateDispatchRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);

    const db = await getMongoDb();
    const prevDr = await db.collection("dispatch_requests").findOne({ id: data.id });
    if (!prevDr) throw new Error("Dispatch request not found");

    await db.collection("dispatch_requests").updateOne({ id: data.id }, { $set: { status: data.status, approved_by: context.userId, updated_at: new Date() } });
    const dr = await db.collection("dispatch_requests").findOne({ id: data.id });
    await createAuditLog(context.userId, "UPDATE_DISPATCH_STATUS", "dispatch_requests", data.id, prevDr, dr);
    return dr;
  });

export const getPayments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await getMongoDb();
    const filter: any = {};
    if (context.orgType !== "mundra") {
      filter.organization_id = context.organizationId;
    }

    const payments = await db.collection("payments").find(filter).sort({ payment_date: -1 }).toArray();
    const organizationsMap = await loadOrganizationsMap();
    return payments.map((payment: any) => withNestedOrganization(payment, organizationsMap));
  });

export const submitPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      amount: z.number().positive(),
      paymentDate: z.string(),
      paymentMode: z.string().min(1),
      referenceNumber: z.string().min(1),
      bankName: z.string().optional(),
      proofUrl: z.string().optional(),
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
    const db = await getMongoDb();

    const paymentId = randomUUID();
    const payment = {
      _id: paymentId,
      id: paymentId,
      organization_id: context.organizationId,
      amount: data.amount,
      payment_date: data.paymentDate,
      payment_mode: data.paymentMode,
      reference_number: data.referenceNumber,
      bank_name: data.bankName || null,
      proof_url: data.proofUrl || null,
      status: "submitted",
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("payments").insertOne(payment);

    if (data.allocations?.length) {
      const allocations = data.allocations
        .filter((allocation) => allocation.allocatedAmount > 0 || allocation.tdsAmount > 0)
        .map((allocation) => ({
          _id: randomUUID(),
          id: randomUUID(),
          payment_id: payment.id,
          invoice_id: allocation.invoiceId,
          allocated_amount: allocation.allocatedAmount,
          tds_amount: allocation.tdsAmount,
          created_at: new Date(),
        }));
      if (allocations.length) {
        await db.collection("invoice_allocations").insertMany(allocations);
      }
    }

    await createAuditLog(context.userId, "SUBMIT_PAYMENT", "payments", payment.id, null, {
      payment,
      allocations: data.allocations,
    });
    return payment;
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected", "under_verification"]),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const db = await getMongoDb();

    const prevPayment = await db.collection("payments").findOne({ id: data.id });
    if (!prevPayment) throw new Error("Payment not found");

    await db.collection("payments").updateOne(
      { id: data.id },
      { $set: { status: data.status, verified_by: context.userId, verified_at: new Date(), updated_at: new Date() } },
    );

    const payment = await db.collection("payments").findOne({ id: data.id });
    await createAuditLog(context.userId, "VERIFY_PAYMENT", "payments", data.id, prevPayment, payment);

    if (data.status === "approved" && payment) {
      await db.collection("refund_letters").insertOne({
        _id: randomUUID(),
        id: randomUUID(),
        payment_id: data.id,
        organization_id: payment.organization_id,
        status: "draft",
        created_at: new Date(),
      });
    }

    return payment;
  });

export const getInvoices = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await getMongoDb();
    const filter: any = {};
    if (context.orgType !== "mundra") {
      filter.organization_id = context.organizationId;
    }

    const invoices = await db.collection("invoices").find(filter).sort({ invoice_date: -1 }).toArray();
    const organizationsMap = await loadOrganizationsMap();
    return invoices.map((invoice: any) => withNestedOrganization(invoice, organizationsMap));
  });

export const getBalanceConfirmations = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await getMongoDb();
    const filter: any = {};
    if (context.orgType !== "mundra") {
      filter.organization_id = context.organizationId;
    }
    const confirmations = await db.collection("balance_confirmations").find(filter).sort({ quarter_end_date: -1 }).toArray();
    const organizationsMap = await loadOrganizationsMap();
    return confirmations.map((conf: any) => withNestedOrganization(conf, organizationsMap));
  });

export const createBalanceConfirmationPeriod = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      organizationId: z.string().uuid(),
      quarterEndDate: z.string(),
      dueDate: z.string(),
      blockDate: z.string(),
      sourcePdfUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const db = await getMongoDb();
    const id = randomUUID();
    const conf = {
      _id: id,
      id,
      organization_id: data.organizationId,
      quarter_end_date: data.quarterEndDate,
      due_date: data.dueDate,
      block_date: data.blockDate,
      source_pdf_url: data.sourcePdfUrl || null,
      signed_pdf_url: null,
      status: "pending_upload",
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("balance_confirmations").insertOne(conf);
    await createAuditLog(context.userId, "CREATE_BALANCE_CONF_PERIOD", "balance_confirmations", conf.id, null, conf);
    return conf;
  });

export const uploadBalanceConfirmation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      id: z.string().uuid(),
      signedPdfUrl: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = await getMongoDb();
    const prevConf = await db.collection("balance_confirmations").findOne({ id: data.id });
    if (!prevConf) throw new Error("Record not found");

    if (context.orgType !== "mundra" && prevConf.organization_id !== context.organizationId) {
      throw new Error("Unauthorized: Cross-tenant modification attempt blocked.");
    }

    await db.collection("balance_confirmations").updateOne(
      { id: data.id },
      { $set: { signed_pdf_url: data.signedPdfUrl, status: "under_review", updated_at: new Date() } },
    );

    const conf = await db.collection("balance_confirmations").findOne({ id: data.id });
    await createAuditLog(context.userId, "UPLOAD_BALANCE_CONF", "balance_confirmations", data.id, prevConf, conf);
    return conf;
  });

export const verifyBalanceConfirmation = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
    }),
  )
  .handler(async ({ data, context }) => {
    ensureMundraOrg(context.orgType);
    const db = await getMongoDb();
    const prevConf = await db.collection("balance_confirmations").findOne({ id: data.id });
    if (!prevConf) throw new Error("Record not found");

    await db.collection("balance_confirmations").updateOne(
      { id: data.id },
      { $set: { status: data.status, reviewed_by: context.userId, reviewed_at: new Date(), updated_at: new Date() } },
    );

    const conf = await db.collection("balance_confirmations").findOne({ id: data.id });
    await createAuditLog(context.userId, "VERIFY_BALANCE_CONF", "balance_confirmations", data.id, prevConf, conf);
    return conf;
  });

export const getSpecialApprovals = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await getMongoDb();
    const filter: any = {};
    if (context.orgType !== "mundra") {
      filter.organization_id = context.organizationId;
    }
    const approvals = await db.collection("special_approvals").find(filter).sort({ created_at: -1 }).toArray();
    const organizationsMap = await loadOrganizationsMap();
    return approvals.map((approval: any) => withNestedOrganization(approval, organizationsMap));
  });

export const createSpecialApproval = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
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
    const db = await getMongoDb();
    const id = randomUUID();
    const sa = {
      _id: id,
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
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("special_approvals").insertOne(sa);
    await createAuditLog(context.userId, "CREATE_SPECIAL_APPROVAL", "special_approvals", sa.id, null, sa);
    return sa;
  });

export const getIssues = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await getMongoDb();
    const filter: any = {};
    if (context.orgType !== "mundra") {
      filter.organization_id = context.organizationId;
    }
    const issues = await db.collection("issues").find(filter).sort({ created_at: -1 }).toArray();
    const organizationsMap = await loadOrganizationsMap();
    return issues.map((issue: any) => withNestedOrganization(issue, organizationsMap));
  });

export const createIssue = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .input(
    z.object({
      issueType: z.string().min(1),
      comments: z.string().optional(),
      dispatchRequestId: z.string().uuid().optional(),
      attachmentUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = await getMongoDb();
    const id = randomUUID();
    const issue = {
      _id: id,
      id,
      organization_id: context.organizationId,
      dispatch_request_id: data.dispatchRequestId || null,
      issue_type: data.issueType,
      comments: data.comments || null,
      attachment_url: data.attachmentUrl || null,
      status: "open",
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db.collection("issues").insertOne(issue);
    await createAuditLog(context.userId, "CREATE_ISSUE", "issues", issue.id, null, issue);
    return issue;
  });

export const getAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const allowedRoles = ["mundra_super_admin", "mundra_readonly"] as const;
    if (!context.roles.some((role) => allowedRoles.includes(role))) {
      throw new Error("Unauthorized access to audit logs");
    }

    const db = await getMongoDb();
    return await db.collection("audit_logs").find().sort({ created_at: -1 }).toArray();
  });
