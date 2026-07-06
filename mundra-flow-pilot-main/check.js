
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('dispatch_requests')
    .select('id, quantity, requested_date, created_at, updated_at, purchase_orders!inner(po_number)');
  console.log(JSON.stringify(data, null, 2));
}
main();

