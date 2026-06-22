import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUsers() {
  // Get all profiles with their organization info
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, organization_id, is_active");

  console.log("=== ALL PROFILES ===");
  for (const p of profiles || []) {
    // Get org info
    const { data: org } = await supabase
      .from("organizations")
      .select("id, legal_name, org_type, trade_name")
      .eq("id", p.organization_id)
      .single();

    // Get roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", p.id);

    console.log(`\nEmail: ${p.email}`);
    console.log(`  Full Name: ${p.full_name}`);
    console.log(`  Org: ${org?.legal_name || org?.trade_name} (type: ${org?.org_type})`);
    console.log(`  Org ID: ${p.organization_id}`);
    console.log(`  Roles: ${roles?.map((r: any) => r.role).join(", ") || "none"}`);
    console.log(`  Active: ${p.is_active}`);
  }

  // Also list all organizations
  console.log("\n\n=== ALL ORGANIZATIONS ===");
  const { data: orgs } = await supabase.from("organizations").select("*");
  for (const org of orgs || []) {
    console.log(`\nOrg: ${org.legal_name} (${org.trade_name || "no trade name"})`);
    console.log(`  ID: ${org.id}`);
    console.log(`  Type: ${org.org_type}`);
    console.log(`  Status: ${org.status}`);
  }
}

checkUsers().catch(console.error);
