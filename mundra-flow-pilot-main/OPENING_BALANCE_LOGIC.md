# Opening Balance Addition to Existing Ledger

## Purpose

The project already has customer ledger, invoice, payment and balance logic.

This feature must add support for customer opening balances without replacing, redesigning or duplicating the existing ledger system.

Before implementing this feature, inspect the current:

* Ledger-entry model
* Customer balance calculation
* Invoice posting logic
* Payment receipt logic
* Payment allocation logic
* FIFO logic
* Outstanding-reference structure
* Reversal and cancellation logic
* Customer statement
* Ageing report

Reuse the existing architecture wherever possible.

## Definition

An opening balance represents the amount a customer already owed the company on a specific historical date, usually:

* the financial-year start date,
* the date the customer was migrated into the system, or
* the date the ledger was first created in the application.

For a customer who owes the company, the opening balance is a debit entry.

Example:

Opening balance on 1 April 2026: ₹2,00,000 Debit

The opening balance must become part of the existing customer ledger calculation.

## Main Accounting Rule

The existing ledger calculation should continue to be used.

For a receivable customer:

Closing balance =
Opening balance

* Sales invoices
* Debit notes

- Payments received
- Credit notes

An opening balance is therefore another debit ledger entry.

Recommended entry type:

OPENING_BALANCE

Do not create a separate customer-balance calculation exclusively for opening balances.

## Historical Record Rule

The original opening-balance amount is a historical value.

It must not be reduced or overwritten when a customer pays.

Every opening-balance outstanding reference must distinguish between:

* original_amount
* allocated_amount
* outstanding_amount

Use:

outstanding_amount = original_amount - allocated_amount

Example:

Opening-balance original amount: ₹2,00,000
Payment allocated against it: ₹1,00,000
Opening-balance outstanding amount: ₹1,00,000

The original amount must continue to show ₹2,00,000.

## Example

Transactions:

* Opening balance: ₹2,00,000 Debit
* New invoice: ₹1,00,000 Debit
* Payment received: ₹1,00,000 Credit

Ledger balance:

₹2,00,000 + ₹1,00,000 - ₹1,00,000 = ₹2,00,000 Debit

The customer therefore still owes ₹2,00,000.

Under FIFO allocation, the payment should first be allocated to the opening balance because it is the oldest outstanding item.

Result:

Opening Balance:

* Original: ₹2,00,000
* Allocated: ₹1,00,000
* Outstanding: ₹1,00,000

Invoice:

* Original: ₹1,00,000
* Allocated: ₹0
* Outstanding: ₹1,00,000

Total outstanding: ₹2,00,000

## FIFO Integration

The opening balance must participate in the existing FIFO payment-allocation process.

When no manual allocation has been selected, eligible outstanding references should be sorted by:

1. effective date ascending
2. creation timestamp ascending
3. stable reference ID ascending

An opening balance will normally have the oldest effective date and therefore be adjusted before later invoices.

Do not write a second FIFO engine only for opening balances.

Extend the existing FIFO engine so that OPENING_BALANCE references are eligible.

## Avoid Double Counting

A payment has two effects:

1. The payment credit reduces the overall ledger balance.
2. The payment allocation explains which debit reference has been settled.

Payment allocation must not create an additional ledger credit.

Likewise, allocation must not modify the original debit value of the opening-balance ledger entry.

The allocation layer should update only:

* allocated amount
* outstanding amount
* payment-allocation records
* reference status

## Recommended Data Representation

Reuse the existing models wherever possible.

The opening balance should ideally create:

### Ledger entry

* entry_type: OPENING_BALANCE
* debit_amount: opening-balance amount
* credit_amount: zero
* effective_date: opening-balance date
* customer_id
* company_id
* reference number
* description

### Outstanding reference

Where the existing system supports bill-wise outstanding:

* reference_type: OPENING_BALANCE
* original_amount
* allocated_amount
* outstanding_amount
* effective_date
* status

Possible statuses:

* OPEN
* PARTIALLY_PAID
* PAID
* CANCELLED
* REVERSED

Do not create new tables if the existing ledger-entry, invoice-reference or allocation structures can support these requirements safely.

## Opening Balance Creation

When an opening balance is created:

1. Validate that the amount is greater than zero.
2. Validate the opening-balance date.
3. Create a debit ledger entry.
4. Create an outstanding reference where bill-wise tracking is enabled.
5. Include it in the customer balance.
6. Include it in customer statements and ageing.
7. Record the user and creation timestamp.
8. Prevent duplicate creation for the same customer and migration context.

The exact duplicate rule should match the project’s existing data model.

For example, one opening balance per:

* company,
* customer,
* financial year,

unless the system intentionally supports bill-wise opening references.

## Multiple Opening References

If details of previous invoices are available, opening balances may be imported as multiple references.

Example:

* OLD-INV-501: ₹70,000
* OLD-INV-525: ₹50,000
* OLD-INV-581: ₹80,000

Total opening balance: ₹2,00,000

This is preferable for accurate FIFO and ageing.

If old invoice details are unavailable, create one consolidated synthetic reference.

Example:

OB-CUSTOMER-2026-001

## Editing Rules

Before any payment has been allocated:

* authorised users may be allowed to edit the opening balance,
* changes must update both the ledger entry and outstanding reference atomically,
* changes must be logged.

After any allocation exists:

* do not permit unrestricted direct editing,
* require reversal, adjustment or an authorised correction flow,
* preserve the audit trail.

Never silently overwrite a partially settled opening balance.

## Reversal Rules

If a payment allocated against an opening balance is reversed:

1. Reverse its allocation records.
2. Reduce the opening balance’s allocated amount.
3. Restore its outstanding amount.
4. Mark the payment as reversed according to existing payment logic.
5. Preserve the original opening-balance amount.
6. Record the reversal in the audit trail.

Example:

Opening original: ₹2,00,000
Allocated payment: ₹1,00,000
Outstanding before reversal: ₹1,00,000

After payment reversal:

Opening original: ₹2,00,000
Allocated: ₹0
Outstanding: ₹2,00,000

## Customer Statement

The opening balance should appear as the first applicable debit entry.

Example:

| Date        | Particulars      | Reference |     Debit |    Credit | Running Balance |
| ----------- | ---------------- | --------- | --------: | --------: | --------------: |
| 1 Apr 2026  | Opening Balance  | OB-001    | ₹2,00,000 |         — |    ₹2,00,000 Dr |
| 10 Apr 2026 | Sales Invoice    | INV-101   | ₹1,00,000 |         — |    ₹3,00,000 Dr |
| 20 Apr 2026 | Payment Received | RCPT-025  |         — | ₹1,00,000 |    ₹2,00,000 Dr |

Payment details should separately show:

RCPT-025: ₹1,00,000
Allocated against OB-001: ₹1,00,000

## Ageing

Only the remaining outstanding amount should appear in ageing.

Example:

Original opening balance: ₹2,00,000
Allocated: ₹1,50,000
Outstanding: ₹50,000

Only ₹50,000 should appear in the appropriate ageing bucket.

The ageing date should use the opening-balance effective date or the relevant old invoice date when bill-wise opening details are available.

## Manual Allocation

If the existing system supports manual payment allocation, users must be allowed to allocate a payment to a specific invoice instead of the opening balance.

Example:

* Opening balance: ₹2,00,000
* Invoice: ₹1,00,000
* Payment: ₹50,000
* User manually selects the invoice

Expected:

* Opening outstanding: ₹2,00,000
* Invoice outstanding: ₹50,000

Manual allocation overrides FIFO.

## Excess Payment

If a payment exceeds all opening balances and invoices, the remaining amount must follow the existing customer-advance or on-account payment logic.

Do not allow an opening-balance reference to become negative.

## Required Validations

* Opening-balance amount must be greater than zero.
* Opening-balance debit must be included only once.
* Original amount must not change because of payment allocation.
* Allocated amount cannot exceed original amount.
* Outstanding amount cannot become negative.
* Paid, cancelled or reversed references cannot receive new allocation.
* Allocation must belong to the same company and customer.
* All posting and allocation changes must be atomic.
* Duplicate API or sync requests must not create duplicate opening balances.
* Existing invoice and payment behaviour must remain unchanged.

## Mandatory Test Cases

### Test 1: Partial Opening-Balance Settlement

Opening balance: ₹2,00,000
Invoice: ₹1,00,000
Payment: ₹1,00,000

Expected:

* Opening original: ₹2,00,000
* Opening allocated: ₹1,00,000
* Opening outstanding: ₹1,00,000
* Invoice outstanding: ₹1,00,000
* Total customer outstanding: ₹2,00,000

### Test 2: Opening Balance Fully Settled

Opening balance: ₹2,00,000
Invoice: ₹1,00,000
Payment: ₹2,50,000

Expected:

* Opening outstanding: ₹0
* Invoice outstanding: ₹50,000
* Total outstanding: ₹50,000

### Test 3: Manual Allocation

Opening balance: ₹2,00,000
Invoice: ₹1,00,000
Payment manually allocated to invoice: ₹50,000

Expected:

* Opening outstanding: ₹2,00,000
* Invoice outstanding: ₹50,000

### Test 4: Payment Reversal

Opening balance: ₹2,00,000
Payment allocated: ₹1,00,000
Reverse payment

Expected:

* Opening original remains ₹2,00,000
* Opening allocated returns to ₹0
* Opening outstanding returns to ₹2,00,000

### Test 5: Excess Payment

Opening outstanding: ₹80,000
Payment: ₹1,00,000

Expected:

* Opening outstanding: ₹0
* Remaining ₹20,000 follows existing customer-advance logic

### Test 6: Duplicate Request

Send the same opening-balance request twice using the same idempotency or external reference.

Expected:

* Only one opening-balance debit entry
* Only one outstanding reference
* Customer balance changes once

## Implementation Constraint

This is an extension of the existing ledger system.

Do not:

* rebuild the ledger system,
* replace existing ledger calculations,
* create duplicate invoice or payment modules,
* move FIFO logic to the frontend,
* alter working invoice or receipt behaviour unless necessary,
* create new schemas before checking whether current schemas can be extended.

The backend must remain the source of truth for posting, FIFO allocation, reversals and outstanding calculations.
