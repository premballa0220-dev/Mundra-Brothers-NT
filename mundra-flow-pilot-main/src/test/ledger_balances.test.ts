import { describe, it, expect } from 'vitest';
import { calculateLedgerBalances, LedgerEntry } from '../lib/ledger';

describe('Ledger Balances Calculation', () => {
  it('should correctly calculate basic chronological balances and isolate per client', () => {
    const entries: LedgerEntry[] = [
      {
        id: 'ob_1',
        type: 'opening_balance',
        timestamp: '2026-01-01',
        created_at: '2026-01-01T10:00:00Z',
        title: 'Opening Balance',
        meta: { amount: 50000, client_name: 'Client A' }
      },
      {
        id: 'pay_1',
        type: 'client_to_utcl',
        timestamp: '2026-01-02',
        created_at: '2026-01-02T10:00:00Z',
        title: 'Payment',
        meta: { amount: 30000, client_name: 'Client A' }
      },
      {
        id: 'dr_1',
        type: 'utcl_to_client',
        timestamp: '2026-01-03',
        created_at: '2026-01-03T10:00:00Z',
        title: 'Dispatch',
        meta: { quantity: 10, locked_rate: 5000, client_name: 'Client B' } // Client B isolated
      },
      {
        id: 'pay_2',
        type: 'client_to_utcl',
        timestamp: '2026-01-04',
        created_at: '2026-01-04T10:00:00Z',
        title: 'Payment',
        meta: { amount: 30000, client_name: 'Client A' }
      },
    ];

    const rows = calculateLedgerBalances(entries);

    const clientARows = rows.filter(r => r.meta.client_name === 'Client A');
    const clientBRows = rows.filter(r => r.meta.client_name === 'Client B');

    expect(clientARows[0].runningBalance).toBe(50000); // After OB
    expect(clientARows[1].runningBalance).toBe(20000); // After Pay 1 (50000 - 30000)
    expect(clientARows[2].runningBalance).toBe(-10000); // After Pay 2 (20000 - 30000) Cr

    expect(clientBRows[0].runningBalance).toBe(50000); // Dispatch: 10 * 5000 = 50000
  });

  it('should prioritize Opening Balance when dates are identical', () => {
    const entries: LedgerEntry[] = [
      {
        id: 'pay_1',
        type: 'client_to_utcl',
        timestamp: '2026-01-01',
        created_at: '2026-01-01T12:00:00Z',
        title: 'Payment',
        meta: { amount: 30000, client_name: 'Client A' }
      },
      {
        id: 'ob_1',
        type: 'opening_balance',
        timestamp: '2026-01-01',
        created_at: '2026-01-01T14:00:00Z', // Later created_at but same date
        title: 'Opening Balance',
        meta: { amount: 50000, client_name: 'Client A' }
      },
    ];

    const rows = calculateLedgerBalances(entries);
    // Even though created_at for OB is later, it should come first due to transaction priority (0 vs 3)
    expect(rows[0].type).toBe('opening_balance');
    expect(rows[0].runningBalance).toBe(50000);

    expect(rows[1].type).toBe('client_to_utcl');
    expect(rows[1].runningBalance).toBe(20000);
  });

  it('should handle Debit Notes and Credit Notes correctly', () => {
    const entries: LedgerEntry[] = [
      {
        id: 'dn_1',
        type: 'debit_note',
        timestamp: '2026-01-01',
        created_at: '2026-01-01T10:00:00Z',
        title: 'Debit Note',
        meta: { amount: 5000, status: 'issued', client_name: 'Client A' }
      },
      {
        id: 'cn_1',
        type: 'credit_note',
        timestamp: '2026-01-02',
        created_at: '2026-01-02T10:00:00Z',
        title: 'Credit Note',
        meta: { amount: 2000, status: 'issued', client_name: 'Client A' }
      }
    ];

    const rows = calculateLedgerBalances(entries);
    expect(rows[0].runningBalance).toBe(5000); // Dr
    expect(rows[1].runningBalance).toBe(3000); // 5000 - 2000 = 3000 Dr
  });

  it('should exclude Mundra-to-UTCL payments from client balances', () => {
    const entries: LedgerEntry[] = [
      {
        id: 'ob_1',
        type: 'opening_balance',
        timestamp: '2026-01-01',
        created_at: '2026-01-01T10:00:00Z',
        title: 'Opening Balance',
        meta: { amount: 10000, client_name: 'Client A' }
      },
      {
        id: 'pay_mtu',
        type: 'utcl_to_mundra',
        timestamp: '2026-01-02',
        created_at: '2026-01-02T10:00:00Z',
        title: 'Refund Due',
        meta: { amount: 10000, client_name: 'Client A' }
      }
    ];

    const rows = calculateLedgerBalances(entries);
    expect(rows[0].runningBalance).toBe(10000);
    // Non-posting row for client
    expect(rows[1].isPosting).toBe(false);
    expect(rows[1].runningBalance).toBe(10000); // Balance remains unchanged
  });

  it('should verify the 50k OB with 5 payments of 30k scenario', () => {
    const entries: LedgerEntry[] = [
      { id: 'ob', type: 'opening_balance', timestamp: '2026-01-01', created_at: '2026-01-01T10:00:00Z', title: 'OB', meta: { amount: 50000, client_name: 'X' } },
      { id: 'p1', type: 'client_to_utcl', timestamp: '2026-01-02', created_at: '2026-01-02T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
      { id: 'p2', type: 'client_to_utcl', timestamp: '2026-01-03', created_at: '2026-01-03T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
      { id: 'p3', type: 'client_to_utcl', timestamp: '2026-01-04', created_at: '2026-01-04T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
      { id: 'p4', type: 'client_to_utcl', timestamp: '2026-01-05', created_at: '2026-01-05T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
      { id: 'p5', type: 'client_to_utcl', timestamp: '2026-01-06', created_at: '2026-01-06T10:00:00Z', title: 'Pay', meta: { amount: 30000, client_name: 'X' } },
    ];

    const rows = calculateLedgerBalances(entries);
    
    // Expected running balances:
    // After OB: ₹50,000 Dr
    // After payment 1: ₹20,000 Dr
    // After payment 2: ₹10,000 Cr (-10000)
    // After payment 3: ₹40,000 Cr (-40000)
    // After payment 4: ₹70,000 Cr (-70000)
    // After payment 5: ₹1,00,000 Cr (-100000)
    expect(rows[0].runningBalance).toBe(50000);
    expect(rows[1].runningBalance).toBe(20000);
    expect(rows[2].runningBalance).toBe(-10000);
    expect(rows[3].runningBalance).toBe(-40000);
    expect(rows[4].runningBalance).toBe(-70000);
    expect(rows[5].runningBalance).toBe(-100000);
  });
});
