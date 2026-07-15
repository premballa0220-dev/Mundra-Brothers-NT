import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const supabaseUrl = env.match(/SUPABASE_URL=(.*)/)?.[1]?.trim();
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const org = {
    legal_name: "Test Client",
    org_type: "client",
    status: "active",
  };
  const { data, error } = await supabase.from("organizations").insert(org).select();
  console.log("Inserted:", data);
  console.log("Error:", error);
}
run();
