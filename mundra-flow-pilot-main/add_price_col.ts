import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function run() {
  const { error } = await supabase.rpc('exec_sql', {
    sql_string: 'ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_price NUMERIC;'
  });
  if (error) console.error('RPC Error:', error);
  else console.log('Successfully added base_price');
}
run();
