import { config } from 'dotenv';
config();
import { createSupabaseAdminClient } from '../lib/auth.server';

async function runTests() {
  const supabase = createSupabaseAdminClient();
  let testOrgId: string;
  let obInvoiceId: string;
  let regularInvoiceId: string;
  let paymentId: string;

  console.log('--- Starting Opening Balance Tests ---');

  // Check if test org exists
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('legal_name', 'Test Organization OB')
    .single();

  if (org) {
    testOrgId = org.id;
  } else {
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        id: crypto.randomUUID(),
        legal_name: 'Test Organization OB',
        org_type: 'client',
        status: 'active'
      })
      .select()
      .single();
    if (orgError) throw orgError;
    testOrgId = newOrg.id;

    await supabase.from('client_commercial_profiles').insert({
      id: crypto.randomUUID(),
      organization_id: testOrgId,
      credit_limit: 100000,
      wallet_balance: 0
    });
  }

  // Clear existing unpaid invoices for the test org so FIFO doesn't allocate to previous test runs
  await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('organization_id', testOrgId);

  console.log('✅ Setup Complete. Org ID:', testOrgId);

  // Scenario 1: Opening balance creation decreases wallet balance
  const obAmount = 50000;
  const { data: obInvoice, error: obError } = await supabase
    .from('invoices')
    .insert({
      id: crypto.randomUUID(),
      organization_id: testOrgId,
      invoice_number: `OB-TEST-${Date.now()}`,
      amount: obAmount,
      invoice_date: new Date().toISOString(),
      due_date: new Date().toISOString(),
      status: 'unpaid',
      is_opening_balance: true
    })
    .select()
    .single();

  if (obError) throw obError;
  obInvoiceId = obInvoice.id;
  console.log('✅ Scenario 1: OB Created. ID:', obInvoiceId);

  // Scenario 2: FIFO allocates to Opening Balance before regular invoice
  const { data: regInvoice, error: regError } = await supabase
    .from('invoices')
    .insert({
      id: crypto.randomUUID(),
      organization_id: testOrgId,
      invoice_number: `REG-TEST-${Date.now()}`,
      amount: 25000,
      invoice_date: new Date().toISOString(),
      due_date: new Date().toISOString(),
      status: 'unpaid',
      is_opening_balance: false
    })
    .select()
    .single();
  
  if (regError) throw regError;
  regularInvoiceId = regInvoice.id;
  console.log('✅ Scenario 2a: Regular Invoice Created. ID:', regularInvoiceId);

  const { data: paymentResult, error: paymentError } = await supabase.rpc('record_payment_with_allocations', {
    p_org_id: testOrgId,
    p_po_id: null,
    p_dispatch_ids: [],
    p_amount: 30000,
    p_payment_date: new Date().toISOString().split('T')[0],
    p_payment_mode: 'NEFT',
    p_ref_no: `PAY-${Date.now()}`,
    p_is_utcl: false,
    p_is_client_to_utcl: true,
    p_is_advance: false,
    p_user_id: null,
    p_manual_allocations: [],
    p_status: 'approved',
    p_verified_by: null
  });

  if (paymentError) throw paymentError;
  paymentId = paymentResult.payment_id;
  console.log('✅ Scenario 2b: Payment Recorded via FIFO. ID:', paymentId);

  const { data: allocations } = await supabase
    .from('invoice_allocations')
    .select('*')
    .eq('payment_id', paymentId);
  
  console.log('Allocations created:', allocations);
  
  const obAllocation = allocations.find((a: any) => a.invoice_id === obInvoiceId);
  if (!obAllocation) throw new Error('OB was not allocated first in FIFO!');
  if (obAllocation.allocated_amount !== 30000) throw new Error('Incorrect amount allocated to OB!');
  console.log('✅ Scenario 2c: FIFO correctly prioritized OB allocation.');

  // Scenario 3: Cancellation restores balances
  const { data: obToCancel, error: obCancelError } = await supabase
    .from('invoices')
    .insert({
      id: crypto.randomUUID(),
      organization_id: testOrgId,
      invoice_number: `OB-CANCEL-${Date.now()}`,
      amount: 10000,
      invoice_date: new Date().toISOString(),
      due_date: new Date().toISOString(),
      status: 'unpaid',
      is_opening_balance: true
    })
    .select()
    .single();

  const { data: cancelResult, error: cancelError } = await supabase.rpc('cancel_opening_balance', {
    p_invoice_id: obToCancel.id,
    p_user_id: null
  });

  if (cancelError) throw cancelError;

  const { data: obInvoiceAfter } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', obToCancel.id)
    .single();

  if (obInvoiceAfter.status !== 'cancelled') throw new Error('OB not cancelled successfully!');
  console.log('✅ Scenario 3: OB Cancellation successful.');

  console.log('--- All tests passed! ---');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Test Failed!', e);
  process.exit(1);
});
