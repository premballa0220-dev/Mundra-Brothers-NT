import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('*, organizations(id, legal_name)')
    .eq('is_client_to_utcl', true)
    .is('dispatch_request_id', null);

  if (pErr) {
    console.error(pErr);
    return;
  }
  
  console.log(`Found ${payments.length} unlinked client-to-utcl payments.`);

  for (const payment of payments) {
    console.log(`Payment: ${payment.amount} for ${payment.organizations.legal_name}`);
    
    // Find the most recent dispatch request for this org
    const { data: drs, error: dErr } = await supabase
      .from('dispatch_requests')
      .select('id, quantity, invoice_number')
      .eq('organization_id', payment.organization_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (dErr) {
      console.error(dErr);
      continue;
    }

    if (drs && drs.length > 0) {
      const dr = drs[0];
      console.log(`-> Linking to DR: ${dr.id} (Qty: ${dr.quantity})`);
      
      const { error: uErr } = await supabase
        .from('payments')
        .update({ dispatch_request_id: dr.id })
        .eq('id', payment.id);

      if (uErr) {
        console.error("Failed to update:", uErr);
      } else {
        console.log("-> Successfully linked!");
      }
    } else {
      console.log("-> No dispatch request found for this org.");
    }
  }
}

run();
