import { createClient } from "@supabase/supabase-js";

// @ts-ignore
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
  console.log("Fetching users...");
  const { data: users } = await supabase.auth.admin.listUsers();
  for (const u of users.users) {
    const { data: p } = await supabase.from("profiles").select("id").eq("id", u.id).single();
    if (!p) {
      console.log("Deleting broken user:", u.email);
      await supabase.auth.admin.deleteUser(u.id);
    }
  }
  console.log("Done");
}

cleanup();
