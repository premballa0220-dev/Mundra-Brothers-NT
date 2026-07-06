import type { Database as GeneratedDatabase } from "./types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProductRow = {
  id: string;
  name: string;
  grade: string | null;
  packaging: string | null;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RateRow = {
  id: string;
  product_id: string;
  organization_id: string | null;
  amount: number;
  effective_from: string;
  effective_to?: string | null;
  status: "pending_approval" | "active" | "inactive" | "rejected";
  created_by?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type UserApprovalStatus = "pending" | "approved" | "rejected";

export type ProfileRow = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  approval_status: UserApprovalStatus;
  status_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowType = "maker_only" | "maker_approver";

export type ClientWorkflowSettingRow = {
  organization_id: string;
  po_workflow: WorkflowType;
  payment_workflow: WorkflowType;
  updated_by: string | null;
  updated_at: string;
};

export type ClientCommercialProfileRow = {
  id: string;
  organization_id: string;
  credit_limit: number;
  payment_terms_days: number;
  grace_period_days: number;
  include_undispatched_pos: boolean;
  include_dispatched_unbilled: boolean;
  include_unpaid_invoices: boolean;
  restrictions: string | null;
  commission_percentage: number | null;
  created_at: string;
  updated_at: string;
};

export type ClientSealSignatoryRow = {
  id: string;
  organization_id: string;
  signatory_name: string;
  designation: string | null;
  signature_url: string | null;
  seal_url: string | null;
  effective_from: string;
  effective_to: string | null;
  is_authorized: boolean;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrderRow = {
  id: string;
  organization_id: string;
  po_number: string;
  product_id: string;
  original_quantity: number;
  locked_rate: number;
  total_value: number;
  site_address: string;
  delivery_contact: string | null;
  document_method: "upload" | "generate";
  document_url: string | null;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DispatchRequestRow = {
  id: string;
  purchase_order_id: string;
  organization_id: string;
  quantity: number;
  requested_date: string;
  site_address: string;
  delivery_contact: string | null;
  status: string;
  eligibility_result: Json;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  utcl_payment_id?: string | null;
};

export type InvoiceRow = {
  id: string;
  organization_id: string;
  dispatch_request_id: string | null;
  invoice_number: string;
  invoice_date: string;
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: string;
  organization_id: string;
  purchase_order_id: string | null;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number: string;
  bank_name: string | null;
  proof_url: string | null;
  status: string;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceAllocationRow = {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  tds_amount: number;
  created_at: string;
  updated_at: string;
};

export type RefundLetterRow = {
  id: string;
  payment_id: string;
  organization_id: string;
  document_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BalanceConfirmationRow = {
  id: string;
  organization_id: string;
  quarter_end_date: string;
  source_pdf_url: string | null;
  signed_pdf_url: string | null;
  due_date: string;
  block_date: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SpecialApprovalRow = {
  id: string;
  organization_id: string;
  exception_type: string;
  dispatch_request_id: string | null;
  purchase_order_id: string | null;
  max_amount_allowance: number | null;
  start_date: string;
  expiry_date: string;
  reason: string;
  approved_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type IssueRow = {
  id: string;
  organization_id: string;
  dispatch_request_id: string | null;
  issue_type: string;
  comments: string | null;
  attachment_url: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  organization_id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  previous_values: Json;
  new_values: Json;
  created_at: string;
};

export type CreditNoteStatus = "draft" | "issued" | "applied" | "cancelled";
export type CreditNoteReason = "Rate Correction" | "Shortage" | "Quality Claim" | "Discount" | "Goods Return" | "Other";
export type NoteOriginType = "PO" | "Dispatch" | "Payment";

export type CreditNoteRow = {
  id: string;
  credit_note_number: string;
  issue_date: string;
  amount: number;
  reason: CreditNoteReason;
  remarks: string | null;
  issued_by_org_id: string;
  issued_to_org_id: string;
  origin_type: NoteOriginType;
  origin_reference: string;
  status: CreditNoteStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DebitNoteStatus = "draft" | "issued" | "applied" | "cancelled";
export type DebitNoteReason = "Rate Escalation" | "Excess Dispatch" | "Interest-Penalty" | "Under-billing Correction" | "Other";

export type DebitNoteRow = {
  id: string;
  debit_note_number: string;
  issue_date: string;
  amount: number;
  reason: DebitNoteReason;
  remarks: string | null;
  issued_by_org_id: string;
  issued_to_org_id: string;
  origin_type: NoteOriginType;
  origin_reference: string;
  status: DebitNoteStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientDeliveryLocationRow = {
  id: string;
  organization_id: string;
  label: string;
  address: string;
  is_default: boolean;
  contact_person: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientApprovedProductRow = {
  organization_id: string;
  product_id: string;
  created_at: string;
};

export type ClientCreditHistoryRow = {
  id: string;
  organization_id: string;
  credit_limit: number;
  effective_from: string;
  created_by: string | null;
  created_at: string;
};

export type OrganizationRow = {
  id: string;
  legal_name: string;
  short_name: string | null;
  trade_name: string | null;
  billing_address: string | null;
  org_type: "mundra" | "client";
  gst_number: string | null;
  pan_number: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  status: "active" | "suspended" | "pending";
  status_reason: string | null;
  created_at: string;
  updated_at: string;
};

export interface Database extends Omit<GeneratedDatabase, "public"> {
  public: Omit<GeneratedDatabase["public"], "Tables"> & {
    Tables: GeneratedDatabase["public"]["Tables"] & {
      organizations: {
        Row: OrganizationRow;
        Insert: Omit<OrganizationRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<OrganizationRow>;
        Relationships: [];
      };
      client_delivery_locations: {
        Row: ClientDeliveryLocationRow;
        Insert: Omit<ClientDeliveryLocationRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ClientDeliveryLocationRow>;
        Relationships: [];
      };
      client_approved_products: {
        Row: ClientApprovedProductRow;
        Insert: Omit<ClientApprovedProductRow, "created_at"> & {
          created_at?: string;
        };
        Update: Partial<ClientApprovedProductRow>;
        Relationships: [];
      };
      client_credit_history: {
        Row: ClientCreditHistoryRow;
        Insert: Omit<ClientCreditHistoryRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ClientCreditHistoryRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Omit<ProductRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProductRow>;
        Relationships: [];
      };
      rates: {
        Row: RateRow;
        Insert: Omit<RateRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RateRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "id" | "created_at" | "updated_at" | "approval_status" | "status_reason"> & {
          id?: string;
          approval_status?: UserApprovalStatus;
          status_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProfileRow>;
        Relationships: GeneratedDatabase["public"]["Tables"]["profiles"]["Relationships"];
      };
      client_workflow_settings: {
        Row: ClientWorkflowSettingRow;
        Insert: Omit<ClientWorkflowSettingRow, "updated_at"> & {
          updated_at?: string;
        };
        Update: Partial<ClientWorkflowSettingRow>;
        Relationships: [];
      };
      client_commercial_profiles: {
        Row: ClientCommercialProfileRow;
        Insert: Omit<ClientCommercialProfileRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ClientCommercialProfileRow>;
        Relationships: [];
      };
      client_seals_signatories: {
        Row: ClientSealSignatoryRow;
        Insert: Omit<ClientSealSignatoryRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ClientSealSignatoryRow>;
        Relationships: [];
      };
      purchase_orders: {
        Row: PurchaseOrderRow;
        Insert: Omit<PurchaseOrderRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<PurchaseOrderRow>;
        Relationships: [];
      };
      dispatch_requests: {
        Row: DispatchRequestRow;
        Insert: Omit<DispatchRequestRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<DispatchRequestRow>;
        Relationships: [];
      };
      invoices: {
        Row: InvoiceRow;
        Insert: Omit<InvoiceRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InvoiceRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: Omit<PaymentRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<PaymentRow>;
        Relationships: [];
      };
      invoice_allocations: {
        Row: InvoiceAllocationRow;
        Insert: Omit<InvoiceAllocationRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<InvoiceAllocationRow>;
        Relationships: [];
      };
      refund_letters: {
        Row: RefundLetterRow;
        Insert: Omit<RefundLetterRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RefundLetterRow>;
        Relationships: [];
      };
      balance_confirmations: {
        Row: BalanceConfirmationRow;
        Insert: Omit<BalanceConfirmationRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<BalanceConfirmationRow>;
        Relationships: [];
      };
      special_approvals: {
        Row: SpecialApprovalRow;
        Insert: Omit<SpecialApprovalRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<SpecialApprovalRow>;
        Relationships: [];
      };
      issues: {
        Row: IssueRow;
        Insert: Omit<IssueRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<IssueRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Omit<NotificationRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Omit<AuditLogRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AuditLogRow>;
        Relationships: [];
      };
      credit_notes: {
        Row: CreditNoteRow;
        Insert: Omit<CreditNoteRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CreditNoteRow>;
        Relationships: [];
      };
      debit_notes: {
        Row: DebitNoteRow;
        Insert: Omit<DebitNoteRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<DebitNoteRow>;
        Relationships: [];
      };
    };
  };
}
