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

async function fix() {
  const email = "ameya.chandwadkar@gmail.com";
  console.log("Looking for user:", email);

  // List users
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
  });

  if (!res.ok) {
    console.error("Failed to list users", await res.text());
    return;
  }

  const usersRes = await res.json();
  const users = usersRes.users;
  const user = users.find((u) => u.email === email);

  if (!user) {
    console.log("User not found in auth.users.");
    return;
  }

  console.log("Found user ID:", user.id);

  const delRes = await fetch(`${URL}/auth/v1/admin/users/${user.id}`, {
    method: "DELETE",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
  });

  if (!delRes.ok) {
    console.error("Failed to delete user", await delRes.text());
  } else {
    console.log("SUCCESS! User deleted.");
  }
}

fix();
