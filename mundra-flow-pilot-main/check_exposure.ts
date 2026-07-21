import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
);

async function testExposure() {
  const { data: clients, error: clientErr } = await supabase
    .from("organizations")
    .select("id, legal_name")
    .eq("org_type", "client")
    .order("created_at", { ascending: false })
    .limit(3);

  if (clientErr) throw clientErr;

  const orgIds = clients.map((c) => c.id);

  const { data: invs } = await supabase
    .from("invoices")
    .select("*")
    .in("organization_id", orgIds)
    .eq("is_opening_balance", true);

  console.log("Opening Balance Invoices:", invs);

  const { data: drs } = await supabase
    .from("dispatch_requests")
    .select("organization_id, quantity, purchase_orders(locked_rate)")
    .in("organization_id", orgIds)
    .in("status", ["approved", "auto_approved", "pending_mundra", "submitted"]);

  console.log("Active Dispatches:", drs);

  const { data: pays } = await supabase
    .from("payments")
    .select("organization_id, amount")
    .in("organization_id", orgIds)
    .eq("is_client_to_utcl", true);

  console.log("Payments:", pays);
}
testExposure();
