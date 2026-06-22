import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log("Fetching auth.users...");
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error fetching users:", error);
    return;
  }
  console.log(`Found ${users.users.length} users in auth.users`);
  for (const u of users.users) {
    console.log(`- ${u.email} (id: ${u.id})`);
  }

  console.log("\nFetching profiles...");
  const { data: profiles, error: pError } = await supabase.from("profiles").select("*");
  if (pError) {
    console.error("Error fetching profiles:", pError);
    return;
  }
  console.log(`Found ${profiles.length} profiles`);
  for (const p of profiles) {
    console.log(`- ${p.email} (status: ${p.approval_status})`);
  }
}

run();
