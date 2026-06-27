import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // use service role or anon
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching POs...");
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, organizations(id, name, client_commercial_profiles(*)), dispatch_requests(quantity, status), payments(amount, status)");
  
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("DATA LENGTH:", data?.length);
    console.log("FIRST PO:", JSON.stringify(data?.[0], null, 2));
  }
}
test();
