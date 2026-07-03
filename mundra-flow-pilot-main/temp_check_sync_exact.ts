import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSync() {
  const { data: clients } = await supabase.from('organizations').select('id, legal_name').eq('org_type', 'client').eq('status', 'active');
  const { data: profiles } = await supabase.from('client_commercial_profiles').select('organization_id, credit_limit, wallet_balance');
  
  let outOfSyncCount = 0;

  for (const client of clients || []) {
    const profile = profiles?.find(p => p.organization_id === client.id);
    const limit = profile ? profile.credit_limit : 0;
    const walletBalance = profile ? profile.wallet_balance : 0;
    
    const { data: dispatches } = await supabase.from('dispatch_requests')
      .select('quantity, purchase_orders(locked_rate)')
      .eq('organization_id', client.id)
      .in('status', ['approved', 'auto_approved', 'pending_mundra', 'submitted']);
      
    const totalDebits = (dispatches || []).reduce((sum, dr: any) => sum + Number(dr.quantity || 0) * Number(dr.purchase_orders?.locked_rate || 0), 0);
    
    const { data: payments } = await supabase.from('payments')
      .select('amount')
      .eq('organization_id', client.id)
      .eq('is_client_to_utcl', true);
      
    const totalCredits = (payments || []).reduce((sum, p: any) => sum + Number(p.amount || 0), 0);
    
    const expectedWalletBalance = Math.max(0, totalCredits - totalDebits);
    const currentExposure = Math.max(0, totalDebits - totalCredits);

    if (walletBalance !== expectedWalletBalance) {
      console.log(`Client ${client.legal_name} is OUT OF SYNC:`);
      console.log(`  - Wallet Balance: ${walletBalance}`);
      console.log(`  - Expected Wallet Balance: ${expectedWalletBalance}`);
      console.log(`  - Total Debits (Dispatches): ${totalDebits}`);
      console.log(`  - Total Credits (Payments): ${totalCredits}`);
      console.log(`  - Current Exposure: ${currentExposure}`);
      outOfSyncCount++;
    }
  }

  if (outOfSyncCount === 0) {
    console.log("All clients are in sync.");
  } else {
    console.log(`${outOfSyncCount} clients are out of sync.`);
  }
}

checkSync();
