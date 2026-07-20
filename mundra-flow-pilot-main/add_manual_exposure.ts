import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
);

async function increaseExposure() {
  // 1. Get the first active client
  const { data: clients, error: clientError } = await supabase
    .from("organizations")
    .select("id, legal_name")
    .eq("org_type", "client")
    .eq("status", "active")
    .limit(1);

  if (clientError || !clients || clients.length === 0) {
    console.error("No active clients found.");
    return;
  }

  const client = clients[0];
  console.log(`Found client: ${client.legal_name} (ID: ${client.id})`);

  // 2. Insert a 20k opening balance invoice
  const inv = {
    organization_id: client.id,
    invoice_number: `MANUAL-OB-${Date.now()}`,
    amount: 20000,
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: new Date().toISOString().split("T")[0],
    status: "unpaid",
    is_opening_balance: true,
  };

  const { error: invError } = await supabase.from("invoices").insert(inv);

  if (invError) {
    console.error("Failed to insert invoice:", invError);
  } else {
    console.log(`Successfully inserted 20,000 debit for ${client.legal_name}!`);
  }
}

increaseExposure();
