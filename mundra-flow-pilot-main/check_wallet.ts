import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkWallet() {
  const { data, error } = await supabase
    .from("client_commercial_profiles")
    .select("organization_id, wallet_balance, organizations(legal_name)");

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("Client Commercial Profiles:");
  console.log(JSON.stringify(data, null, 2));
}

checkWallet();
