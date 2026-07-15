import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
);

async function run() {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "*, organizations(id, legal_name, client_commercial_profiles(*)), dispatch_requests(quantity, status), payments(amount, status)",
    );

  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("Found POs:", data.length);
  }
}
run();
