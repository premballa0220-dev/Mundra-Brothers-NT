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

async function checkProfile() {
  const userId = "d8a3bc40-df6f-499b-9030-3e723926acad";

  const res = await fetch(`${URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
  });

  if (!res.ok) {
    console.error("Failed", await res.text());
    return;
  }

  const profile = await res.json();
  console.log("Profile result:", JSON.stringify(profile, null, 2));
}

checkProfile();
