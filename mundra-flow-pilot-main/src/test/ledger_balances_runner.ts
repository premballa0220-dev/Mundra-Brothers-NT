import { calculateLedgerBalances, LedgerEntry } from '../lib/ledger';

const assert = (condition: boolean, msg: string) => {
  if (!condition) throw new Error(msg);
};

const run = () => {
  // Test 1: basic chronological
  const t1: LedgerEntry[] = [
    { id: 'ob_1', type: 'opening_balance', timestamp: '2026-01-01', created_at: '2026-01-01T10:00:00Z', title: 'OB', meta: { amount: 50000, client_name: 'Client A' } },
    { id: 'pay_1', type: 'client_to_utcl', timestamp: '2026-01-02', created_at: '2026-01-02T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'Client A' } },
    { id: 'pay_2', type: 'client_to_utcl', timestamp: '2026-01-04', created_at: '2026-01-04T10:00:00Z', title: 'Pay2', meta: { amount: 30000, client_name: 'Client A' } },
  ];
  const r1 = calculateLedgerBalances(t1);
  assert(r1[0].runningBalance === 50000, "T1.0 failed");
  assert(r1[1].runningBalance === 20000, "T1.1 failed");
  assert(r1[2].runningBalance === -10000, "T1.2 failed");

  // Test 2: same date
  const t2: LedgerEntry[] = [
    { id: 'pay_1', type: 'client_to_utcl', timestamp: '2026-01-01', created_at: '2026-01-01T12:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'Client A' } },
    { id: 'ob_1', type: 'opening_balance', timestamp: '2026-01-01', created_at: '2026-01-01T14:00:00Z', title: 'OB', meta: { amount: 50000, client_name: 'Client A' } },
  ];
  const r2 = calculateLedgerBalances(t2);
  assert(r2[0].type === 'opening_balance', "T2.0 type failed");
  assert(r2[0].runningBalance === 50000, "T2.0 val failed");
  assert(r2[1].type === 'client_to_utcl', "T2.1 type failed");
  assert(r2[1].runningBalance === 20000, "T2.1 val failed");

  // Test 3: user scenario
  const t3: LedgerEntry[] = [
    { id: 'ob', type: 'opening_balance', timestamp: '2026-01-01', created_at: '2026-01-01T10:00:00Z', title: 'OB', meta: { amount: 50000, client_name: 'X' } },
    { id: 'p1', type: 'client_to_utcl', timestamp: '2026-01-02', created_at: '2026-01-02T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
    { id: 'p2', type: 'client_to_utcl', timestamp: '2026-01-03', created_at: '2026-01-03T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
    { id: 'p3', type: 'client_to_utcl', timestamp: '2026-01-04', created_at: '2026-01-04T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
    { id: 'p4', type: 'client_to_utcl', timestamp: '2026-01-05', created_at: '2026-01-05T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
    { id: 'p5', type: 'client_to_utcl', timestamp: '2026-01-06', created_at: '2026-01-06T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
  ];
  const r3 = calculateLedgerBalances(t3);
  assert(r3[0].runningBalance === 50000, "T3.0");
  assert(r3[1].runningBalance === 20000, "T3.1");
  assert(r3[2].runningBalance === -10000, "T3.2");
  assert(r3[3].runningBalance === -40000, "T3.3");
  assert(r3[4].runningBalance === -70000, "T3.4");
  assert(r3[5].runningBalance === -100000, "T3.5");

  console.log('All tests passed successfully!');
};

run();
