import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const { data, error } = await supabase.from('organizations').select('*').limit(5);
  console.log("Error:", error);
  if (data && data.length > 0) {
    console.log("Columns returned:", Object.keys(data[0]));
    console.log("Data sample:", data.map(d => ({ legal_name: d.legal_name, party_code: d.party_code, tp_code: d.tp_code })));
  } else {
    console.log("No data returned");
  }
}

test();
