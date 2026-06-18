import { createClient } from "@supabase/supabase-js";
import { Database } from "./src/integrations/supabase/extended-types";

const supabase = createClient<Database>("https://abc.com", "abc");

const x = supabase.from("purchase_orders").insert({
    id: "123",
    organization_id: "123",
    po_number: "123",
    product_id: "123",
    original_quantity: 1,
    locked_rate: 1,
    total_value: 1,
    site_address: "123",
    delivery_contact: null,
    document_method: "upload",
    document_url: null,
    status: "123",
    created_by: "123",
    approved_by: "123"
});
