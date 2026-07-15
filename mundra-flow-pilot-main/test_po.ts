import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
);

async function check() {
  const { data: po } = await supabase.from("purchase_orders").select("*").eq("po_number", "7");
  console.log("PO:", JSON.stringify(po, null, 2));

  if (po && po.length > 0) {
    const { data: pay } = await supabase
      .from("payments")
      .select("*")
      .eq("purchase_order_id", po[0].id);
    console.log("Payments:", JSON.stringify(pay, null, 2));
    const { data: dr } = await supabase
      .from("dispatch_requests")
      .select("*")
      .eq("purchase_order_id", po[0].id);
    console.log("Dispatches:", JSON.stringify(dr, null, 2));
  } else {
    // maybe PO number is string matching '7' anywhere
    const { data: po_like } = await supabase
      .from("purchase_orders")
      .select("*")
      .ilike("po_number", "%7%");
    console.log("POs like 7:", JSON.stringify(po_like, null, 2));
  }
}
check();
