export interface LedgerEntry {
  id: string;
  type: string;
  timestamp: string; // logical date of transaction
  created_at: string; // actual system creation time
  title: string;
  meta: any;
}

export interface CalculatedLedgerRow extends LedgerEntry {
  debit: number;
  credit: number;
  runningBalance: number;
  isPosting: boolean;
}

function getTransactionPriority(type: string): number {
  switch (type) {
    case 'opening_balance':
      return 0; // Highest priority
    case 'utcl_to_client':
      return 1;
    case 'debit_note':
      return 2;
    case 'client_to_utcl':
      return 3;
    case 'credit_note':
      return 4;
    default:
      return 99;
  }
}

/**
 * Calculates running balances independently per client for a given set of ledger entries.
 * Positive balance = Dr (Owed to Mundra)
 * Negative balance = Cr (Credit/Advance with Mundra)
 */
export function calculateLedgerBalances(entries: LedgerEntry[]): CalculatedLedgerRow[] {
  // Sort entries chronologically
  const sorted = [...entries].sort((a, b) => {
    // 1. transaction_date ASC (compare YYYY-MM-DD to avoid time issues if provided)
    const dateA = a.timestamp.substring(0, 10);
    const dateB = b.timestamp.substring(0, 10);
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    // 2. transaction_type_priority ASC
    const priorityA = getTransactionPriority(a.type);
    const priorityB = getTransactionPriority(b.type);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 3. created_at ASC
    const createdA = new Date(a.created_at || a.timestamp).getTime();
    const createdB = new Date(b.created_at || b.timestamp).getTime();
    if (createdA !== createdB) {
      return createdA - createdB;
    }

    // 4. id ASC
    return (a.id || '').localeCompare(b.id || '');
  });

  const balancesByClient = new Map<string, number>();
  const rows: CalculatedLedgerRow[] = [];

  for (const e of sorted) {
    let debit = 0;
    let credit = 0;
    let isPosting = false;
    const clientName = e.meta?.client_name || 'Unknown';

    if (e.type === 'mundra_to_utcl_payment') {
      debit = e.meta.amount || 0;
      isPosting = true;
    } else if (e.type === 'utcl_to_mundra_refund') {
      credit = e.meta.amount || 0;
      isPosting = true;
    } else if (e.type === 'utcl_to_client') {
      debit = (e.meta.quantity || 0) * (e.meta.locked_rate || 0);
      isPosting = true;
    } else if (e.type === 'client_to_utcl') {
      credit = e.meta.amount || 0;
      isPosting = true;
    } else if (e.type === 'credit_note' && (e.meta.status === 'issued' || e.meta.status === 'applied')) {
      credit = e.meta.amount || 0;
      isPosting = true;
    } else if (e.type === 'debit_note' && (e.meta.status === 'issued' || e.meta.status === 'applied')) {
      debit = e.meta.amount || 0;
      isPosting = true;
    } else if (e.type === 'opening_balance') {
      debit = e.meta.amount || 0;
      isPosting = true;
    }

    if (isPosting) {
      const previousBalance = balancesByClient.get(clientName) || 0;
      // Store running balance as a signed numeric value: positive = Dr, negative = Cr
      const newBalance = previousBalance + debit - credit;
      balancesByClient.set(clientName, newBalance);
    }

    rows.push({
      ...e,
      debit,
      credit,
      runningBalance: balancesByClient.get(clientName) || 0,
      isPosting,
    });
  }

  return rows;
}
