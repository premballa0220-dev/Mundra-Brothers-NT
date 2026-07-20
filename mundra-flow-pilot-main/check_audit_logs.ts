import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
);

async function checkAuditLogs() {
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("action, table_name, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) console.error(error);
  else console.log(logs);
}
checkAuditLogs();
