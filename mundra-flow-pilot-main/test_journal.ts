import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
);

async function loadOrganizationsMap() {
  const { data: orgs } = await supabase.from("organizations").select("*");
  return new Map((orgs || []).map((o: any) => [o.id, o]));
}

async function getJournalEntries() {
  const organizationsMap = await loadOrganizationsMap();
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, total_value, locked_rate, original_quantity, created_at, status, organization_id",
    )
    .order("created_at", { ascending: false });
  const { data: dispatches } = await supabase
    .from("dispatch_requests")
    .select(
      "id, quantity, status, created_at, updated_at, site_address, organization_id, purchase_order_id, purchase_orders(po_number, locked_rate)",
    )
    .order("created_at", { ascending: false });
  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, amount, payment_date, payment_mode, reference_number, is_utcl_payment, is_client_to_utcl, is_advance, status, created_at, organization_id, purchase_order_id, purchase_orders(po_number)",
    )
    .order("payment_date", { ascending: false });

  const entries: any[] = [];
  for (const po of pos || []) {
    const org = organizationsMap.get(po.organization_id);
    entries.push({
      id: `po_${po.id}`,
      type: "mundra_to_utcl",
      timestamp: po.created_at,
      title: "PO Created — Mundra → UTCL",
      meta: { po_number: po.po_number, client_name: (org as any)?.legal_name || null },
    });
  }
  for (const dr of (dispatches || []) as any[]) {
    if (dr.status === "approved") {
      const org = organizationsMap.get(dr.organization_id);
      entries.push({
        id: `dr_${dr.id}`,
        type: "utcl_to_client",
        timestamp: dr.updated_at || dr.created_at,
        title: "Dispatch Approved — UTCL → Client",
        meta: {
          quantity: dr.quantity,
          locked_rate: dr.purchase_orders?.locked_rate || null,
          client_name: (org as any)?.legal_name || null,
        },
      });
    }
  }
  for (const p of (payments || []) as any[]) {
    if (p.is_client_to_utcl) {
      const org = organizationsMap.get(p.organization_id);
      entries.push({
        id: `pay_ctu_${p.id}`,
        type: "client_to_utcl",
        timestamp: p.payment_date,
        title: "Payment — Client → UTCL",
        meta: {
          amount: p.amount,
          client_name: (org as any)?.legal_name || null,
          po_number: p.purchase_orders?.po_number || null,
        },
      });
    }
  }
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return entries;
}

async function check() {
  const entries = await getJournalEntries();
  const paymentEntry = entries.find((e) => e.id === "pay_ctu_9166765a-c125-4403-813b-12a033f633d2");
  console.log("Payment Entry in Journal:", JSON.stringify(paymentEntry, null, 2));

  const dispatchEntry = entries.find((e) => e.id === "dr_53079a6a-15e9-42e8-991a-39cc0d932ffa");
  console.log("Dispatch Entry in Journal:", JSON.stringify(dispatchEntry, null, 2));
}
check();
