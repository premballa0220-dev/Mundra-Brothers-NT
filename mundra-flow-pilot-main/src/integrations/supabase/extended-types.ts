// Thin re-export over the generated Supabase types.
// Do NOT hand-write table shapes here — regenerate instead:
//   npx supabase gen types typescript --project-id ftzrdcydcbkiyzsmppye > src/integrations/supabase/types.ts
import type { Database as GeneratedDatabase, Json as GeneratedJson } from "./types";

export type Database = GeneratedDatabase;
export type Json = GeneratedJson;

type Tables = GeneratedDatabase["public"]["Tables"];
type Enums = GeneratedDatabase["public"]["Enums"];

export type ProductRow = Tables["products"]["Row"];
export type RateRow = Tables["rates"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];
export type ClientWorkflowSettingRow = Tables["client_workflow_settings"]["Row"];
export type ClientCommercialProfileRow = Tables["client_commercial_profiles"]["Row"];
export type ClientSealSignatoryRow = Tables["client_seals_signatories"]["Row"];
export type PurchaseOrderRow = Tables["purchase_orders"]["Row"];
export type DispatchRequestRow = Tables["dispatch_requests"]["Row"];
export type InvoiceRow = Tables["invoices"]["Row"];
export type PaymentRow = Tables["payments"]["Row"];
export type InvoiceAllocationRow = Tables["invoice_allocations"]["Row"];
export type RefundLetterRow = Tables["refund_letters"]["Row"];
export type UtclRefundLetterRow = Tables["utcl_refund_letters"]["Row"];
export type BalanceConfirmationRow = Tables["balance_confirmations"]["Row"];
export type SpecialApprovalRow = Tables["special_approvals"]["Row"];
export type IssueRow = Tables["issues"]["Row"];
export type NotificationRow = Tables["notifications"]["Row"];
export type AuditLogRow = Tables["audit_logs"]["Row"];
export type CreditNoteRow = Tables["credit_notes"]["Row"];
export type DebitNoteRow = Tables["debit_notes"]["Row"];
export type ClientDeliveryLocationRow = Tables["client_delivery_locations"]["Row"];
export type ClientApprovedProductRow = Tables["client_approved_products"]["Row"];
export type ClientCreditHistoryRow = Tables["client_credit_history"]["Row"];
export type OrganizationRow = Tables["organizations"]["Row"];

export type UserApprovalStatus = Enums["user_approval_status"];
export type WorkflowType = Enums["workflow_type"];

export type CreditNoteStatus = "draft" | "issued" | "applied" | "cancelled";
export type CreditNoteReason =
  | "Rate Correction"
  | "Shortage"
  | "Quality Claim"
  | "Discount"
  | "Goods Return"
  | "Other";
export type NoteOriginType = "PO" | "Dispatch" | "Payment";

export type DebitNoteStatus = "draft" | "issued" | "applied" | "cancelled";
export type DebitNoteReason =
  | "Rate Escalation"
  | "Excess Dispatch"
  | "Interest-Penalty"
  | "Under-billing Correction"
  | "Other";
