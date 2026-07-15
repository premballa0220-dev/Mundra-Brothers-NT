import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testWallet() {
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .eq("legal_name", "Ameya traders")
    .limit(1);
  if (orgs && orgs.length > 0) {
    const orgId = orgs[0].id;
    const { error } = await supabase
      .from("client_commercial_profiles")
      .update({ wallet_balance: 25000 })
      .eq("organization_id", orgId);

    if (error) {
      console.error("Failed to update wallet", error);
    } else {
      console.log("Successfully injected ₹25,000 into Ameya traders wallet for testing!");
    }
  }
}

testWallet();
