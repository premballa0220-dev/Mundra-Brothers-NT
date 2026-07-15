import fs from "fs";

const envFile = fs.readFileSync(".env", "utf-8");
const env = {};
envFile.split("\n").forEach((line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length > 0 && !key.startsWith("#")) {
    env[key.trim()] = val.join("=").trim();
  }
});

const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function forceApprove() {
  const userId = "d8a3bc40-df6f-499b-9030-3e723926acad";

  console.log("Approving user...");
  // Update profile to approved
  const res = await fetch(`${URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ approval_status: "approved" }),
  });

  if (!res.ok) {
    console.error("Failed to approve profile:", await res.text());
    return;
  }

  console.log("Profile approved!");

  console.log("Setting super admin role...");
  // Delete existing roles
  await fetch(`${URL}/rest/v1/user_roles?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
  });

  // Insert super admin role
  const roleRes = await fetch(`${URL}/rest/v1/user_roles`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, role: "mundra_super_admin" }),
  });

  if (!roleRes.ok) {
    console.error("Failed to set role:", await roleRes.text());
    return;
  }

  console.log("Role set to mundra_super_admin!");
  console.log("DONE! You can now log in.");
}

forceApprove();
