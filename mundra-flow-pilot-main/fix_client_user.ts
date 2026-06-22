import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CLIENT_ORG_ID = "ca37eade-8b22-47c7-b80c-53a7e65badec"; // "Test Client" org
const USER_EMAIL = "percentilelaa@gmail.com";

async function fixUser() {
  // Find the user's profile
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, organization_id")
    .eq("email", USER_EMAIL)
    .single();

  if (pErr || !profile) {
    console.error("Could not find profile for", USER_EMAIL, pErr);
    return;
  }

  console.log(`Found profile: ${profile.email} (id: ${profile.id})`);
  console.log(`  Current org: ${profile.organization_id}`);
  console.log(`  Moving to client org: ${CLIENT_ORG_ID}`);

  // Update profile to point to client org
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ organization_id: CLIENT_ORG_ID })
    .eq("id", profile.id);

  if (updateErr) {
    console.error("Failed to update profile:", updateErr);
    return;
  }

  console.log("✅ Profile organization updated successfully!");

  // Verify
  const { data: updated } = await supabase
    .from("profiles")
    .select("email, organization_id")
    .eq("id", profile.id)
    .single();

  const { data: org } = await supabase
    .from("organizations")
    .select("legal_name, org_type")
    .eq("id", updated?.organization_id)
    .single();

  console.log(`\nVerification:`);
  console.log(`  Email: ${updated?.email}`);
  console.log(`  Org: ${org?.legal_name} (type: ${org?.org_type})`);
}

fixUser().catch(console.error);
