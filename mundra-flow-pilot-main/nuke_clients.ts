import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function nukeAllClientData() {
  console.log("=== NUKING ALL CLIENT DATA ===\n");

  // 1. Get all client organization IDs
  const { data: clientOrgs } = await supabase
    .from("organizations")
    .select("id, legal_name")
    .eq("org_type", "client");

  const orgIds = (clientOrgs || []).map((o) => o.id);
  console.log(`Found ${orgIds.length} client organizations:`);
  for (const org of clientOrgs || []) {
    console.log(`  - ${org.legal_name} (${org.id})`);
  }

  if (orgIds.length === 0) {
    console.log("No client organizations found. Nothing to delete.");
    return;
  }

  // Delete in FK-safe order (children first, parents last)

  // 2. Audit Logs (references many tables, but not FK-constrained typically)
  const { count: auditCount } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact", head: true });
  const { error: auditErr } = await supabase
    .from("audit_logs")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all
  console.log(`Audit Logs: deleted ${auditCount ?? "all"} rows ${auditErr ? "ERROR: " + auditErr.message : "✓"}`);

  // 3. Notifications
  const { error: notifErr } = await supabase
    .from("notifications")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Notifications: ${notifErr ? "ERROR: " + notifErr.message : "✓"}`);

  // 4. Balance Confirmations
  const { error: bcErr } = await supabase
    .from("balance_confirmations")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Balance Confirmations: ${bcErr ? "ERROR: " + bcErr.message : "✓"}`);

  // 5. Refund Letters
  const { error: rlErr } = await supabase
    .from("refund_letters")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Refund Letters: ${rlErr ? "ERROR: " + rlErr.message : "✓"}`);

  // 6. Special Approvals
  const { error: saErr } = await supabase
    .from("special_approvals")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Special Approvals: ${saErr ? "ERROR: " + saErr.message : "✓"}`);

  // 7. Issues
  const { error: issErr } = await supabase
    .from("issues")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Issues: ${issErr ? "ERROR: " + issErr.message : "✓"}`);

  // 8. Invoice Allocations (child of invoices)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id")
    .in("organization_id", orgIds);
  const invoiceIds = (invoices || []).map((i) => i.id);
  if (invoiceIds.length > 0) {
    const { error: iaErr } = await supabase
      .from("invoice_allocations")
      .delete()
      .in("invoice_id", invoiceIds);
    console.log(`Invoice Allocations: ${iaErr ? "ERROR: " + iaErr.message : "✓"}`);
  }

  // 9. Invoices
  const { error: invErr } = await supabase
    .from("invoices")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Invoices: ${invErr ? "ERROR: " + invErr.message : "✓"}`);

  // 10. ALL Payments (both mundra-to-utcl and client-to-utcl)
  // First unlink dispatch_requests from payments
  const { error: unlinkErr } = await supabase
    .from("dispatch_requests")
    .update({ utcl_payment_id: null })
    .in("organization_id", orgIds);
  console.log(`Unlink Dispatches from Payments: ${unlinkErr ? "ERROR: " + unlinkErr.message : "✓"}`);

  const { error: payErr } = await supabase
    .from("payments")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Payments (client org): ${payErr ? "ERROR: " + payErr.message : "✓"}`);

  // Also delete any Mundra-to-UTCL payments (is_utcl_payment = true, not client_to_utcl)
  // These may reference POs from client orgs
  const { data: clientPOs } = await supabase
    .from("purchase_orders")
    .select("id")
    .in("organization_id", orgIds);
  const poIds = (clientPOs || []).map((po) => po.id);
  if (poIds.length > 0) {
    // Unlink any remaining dispatches
    const { error: unlinkErr2 } = await supabase
      .from("dispatch_requests")
      .update({ utcl_payment_id: null })
      .in("purchase_order_id", poIds);

    const { error: mundraPayErr } = await supabase
      .from("payments")
      .delete()
      .in("purchase_order_id", poIds);
    console.log(`Payments (Mundra-to-UTCL via PO): ${mundraPayErr ? "ERROR: " + mundraPayErr.message : "✓"}`);
  }

  // 11. Dispatch Requests
  const { error: drErr } = await supabase
    .from("dispatch_requests")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Dispatch Requests: ${drErr ? "ERROR: " + drErr.message : "✓"}`);

  // 12. Purchase Orders
  const { error: poErr } = await supabase
    .from("purchase_orders")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Purchase Orders: ${poErr ? "ERROR: " + poErr.message : "✓"}`);

  // 13. Client Commercial sub-tables
  const { error: ccErr } = await supabase
    .from("client_credit_history")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Client Credit History: ${ccErr ? "ERROR: " + ccErr.message : "✓"}`);

  const { error: capErr } = await supabase
    .from("client_approved_products")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Client Approved Products: ${capErr ? "ERROR: " + capErr.message : "✓"}`);

  const { error: cdlErr } = await supabase
    .from("client_delivery_locations")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Client Delivery Locations: ${cdlErr ? "ERROR: " + cdlErr.message : "✓"}`);

  const { error: cwsErr } = await supabase
    .from("client_workflow_settings")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Client Workflow Settings: ${cwsErr ? "ERROR: " + cwsErr.message : "✓"}`);

  const { error: ccpErr } = await supabase
    .from("client_commercial_profiles")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Client Commercial Profiles: ${ccpErr ? "ERROR: " + ccpErr.message : "✓"}`);

  // 14. Client Rates
  const { error: ratesErr } = await supabase
    .from("rates")
    .delete()
    .in("organization_id", orgIds);
  console.log(`Rates (client-specific): ${ratesErr ? "ERROR: " + ratesErr.message : "✓"}`);

  // 15. Profiles (users) tied to client orgs
  const { data: clientProfiles } = await supabase
    .from("profiles")
    .select("id")
    .in("organization_id", orgIds);
  
  if (clientProfiles && clientProfiles.length > 0) {
    const { error: profErr } = await supabase
      .from("profiles")
      .delete()
      .in("organization_id", orgIds);
    console.log(`Client User Profiles: deleted ${clientProfiles.length} ${profErr ? "ERROR: " + profErr.message : "✓"}`);
  }

  // 16. Finally, delete the client organizations themselves
  const { error: orgErr } = await supabase
    .from("organizations")
    .delete()
    .eq("org_type", "client");
  console.log(`Client Organizations: ${orgErr ? "ERROR: " + orgErr.message : "✓"}`);

  console.log("\n=== DONE. All client data has been wiped. ===");
}

nukeAllClientData();
