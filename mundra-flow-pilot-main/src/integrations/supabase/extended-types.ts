import type { Database as GeneratedDatabase } from "./types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ProductRow {
  id: string;
  name: string;
  grade: string | null;
  packaging: string | null;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RateRow {
  id: string;
  product_id: string;
  organization_id: string | null;
  amount: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientCommercialProfileRow {
  id: string;
  organization_id: string;
  credit_limit: number;
  payment_terms_days: number;
  grace_period_days: number;
  created_at: string;
  updated_at: string;
}

export interface ClientSealSignatoryRow {
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
}

export interface PurchaseOrderRow {
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
}

export interface DispatchRequestRow {
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
}

export interface InvoiceRow {
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
}

export interface PaymentRow {
  id: string;
  organization_id: string;
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
}

export interface InvoiceAllocationRow {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  tds_amount: number;
  created_at: string;
  updated_at: string;
}

export interface RefundLetterRow {
  id: string;
  payment_id: string;
  organization_id: string;
  document_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BalanceConfirmationRow {
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
}

export interface SpecialApprovalRow {
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
}

export interface IssueRow {
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
}

export interface NotificationRow {
  id: string;
  user_id: string;
  organization_id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  previous_values: Json;
  new_values: Json;
  created_at: string;
}

export interface Database extends Omit<GeneratedDatabase, "public"> {
  public: Omit<GeneratedDatabase["public"], "Tables"> & {
    Tables: GeneratedDatabase["public"]["Tables"] & {
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
    };
  };
}
