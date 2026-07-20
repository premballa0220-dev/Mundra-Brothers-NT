import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
);

async function checkSync() {
  const { data: clients } = await supabase
    .from("organizations")
    .select("id, legal_name")
    .eq("org_type", "client")
    .eq("status", "active");
  const { data: profiles } = await supabase
    .from("client_commercial_profiles")
    .select("organization_id, credit_limit");

  for (const client of clients || []) {
    const profile = profiles?.find((p) => p.organization_id === client.id);
    const limit = profile ? profile.credit_limit : 0;

    const { data: dispatches } = await supabase
      .from("dispatch_requests")
      .select("quantity, purchase_orders(locked_rate)")
      .eq("organization_id", client.id)
      .in("status", ["approved", "auto_approved", "pending_mundra", "submitted"]);

    const { data: invoices } = await supabase
      .from("invoices")
      .select("amount")
      .eq("organization_id", client.id)
      .eq("is_opening_balance", true)
      .neq("status", "cancelled");

    const totalDebits = (dispatches || []).reduce(
      (sum, dr: any) =>
        sum + Number(dr.quantity || 0) * Number(dr.purchase_orders?.locked_rate || 0),
      0,
    ) + (invoices || []).reduce((sum, inv: any) => sum + Number(inv.amount || 0), 0);

    const { data: payments } = await supabase
      .from("payments")
      .select("amount")
      .eq("organization_id", client.id)
      .eq("is_client_to_utcl", true);

    const totalCredits = (payments || []).reduce((sum, p: any) => sum + Number(p.amount || 0), 0);

    const exposure = Math.max(0, totalDebits - totalCredits);

    console.log(`Client: ${client.legal_name}`);
    console.log(`- Limit: ${limit}`);
    console.log(`- Total Dispatches (Debits): ${totalDebits}`);
    console.log(`- Total Payments (Credits): ${totalCredits}`);
    console.log(`- Current Exposure: ${exposure}`);
    console.log(`- Available Credit: ${Math.max(0, limit - exposure)}`);
    console.log("---");
  }
}
checkSync();
