import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fix() {
  const email = "ameya.chandwadkar@gmail.com";
  console.log(`Looking for user: ${email}`);

  // Fetch the user
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error fetching users:", error.message);
    return;
  }

  const user = users.users.find((u) => u.email === email);
  if (!user) {
    console.log("User not found in auth.users.");
    return;
  }

  console.log(`Found user in auth.users: ${user.id}`);

  // Check profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) {
    console.log("Profile is missing! Deleting user from auth.users so they can sign up again.");
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error("Failed to delete user:", delError.message);
    } else {
      console.log("Successfully deleted broken user.");
    }
  } else {
    console.log("Profile exists:", profile);
  }
}

fix();
