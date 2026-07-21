export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          previous_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          previous_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      balance_confirmations: {
        Row: {
          block_date: string
          client_address: string | null
          client_name: string | null
          created_at: string
          due_date: string
          id: string
          organization_id: string
          outstanding_amount: number | null
          period_from: string | null
          period_to: string | null
          quarter_end_date: string
          ref_no: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signed_pdf_url: string | null
          source_pdf_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          block_date: string
          client_address?: string | null
          client_name?: string | null
          created_at?: string
          due_date: string
          id?: string
          organization_id: string
          outstanding_amount?: number | null
          period_from?: string | null
          period_to?: string | null
          quarter_end_date: string
          ref_no?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signed_pdf_url?: string | null
          source_pdf_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          block_date?: string
          client_address?: string | null
          client_name?: string | null
          created_at?: string
          due_date?: string
          id?: string
          organization_id?: string
          outstanding_amount?: number | null
          period_from?: string | null
          period_to?: string | null
          quarter_end_date?: string
          ref_no?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signed_pdf_url?: string | null
          source_pdf_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_confirmations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_approved_products: {
        Row: {
          created_at: string
          organization_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_approved_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_approved_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_commercial_profiles: {
        Row: {
          commission_percentage: number | null
          created_at: string
          credit_limit: number
          grace_period_days: number
          id: string
          include_dispatched_unbilled: boolean
          include_undispatched_pos: boolean
          include_unpaid_invoices: boolean
          organization_id: string
          payment_terms_days: number
          restrictions: string | null
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          commission_percentage?: number | null
          created_at?: string
          credit_limit?: number
          grace_period_days?: number
          id?: string
          include_dispatched_unbilled?: boolean
          include_undispatched_pos?: boolean
          include_unpaid_invoices?: boolean
          organization_id: string
          payment_terms_days?: number
          restrictions?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          commission_percentage?: number | null
          created_at?: string
          credit_limit?: number
          grace_period_days?: number
          id?: string
          include_dispatched_unbilled?: boolean
          include_undispatched_pos?: boolean
          include_unpaid_invoices?: boolean
          organization_id?: string
          payment_terms_days?: number
          restrictions?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_commercial_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credit_history: {
        Row: {
          created_at: string
          created_by: string | null
          credit_limit: number
          effective_from: string
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_limit: number
          effective_from: string
          id?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_limit?: number
          effective_from?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_credit_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_delivery_locations: {
        Row: {
          address: string
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_delivery_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_seals_signatories: {
        Row: {
          created_at: string
          designation: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_authorized: boolean
          organization_id: string
          seal_url: string | null
          signatory_name: string
          signature_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_authorized?: boolean
          organization_id: string
          seal_url?: string | null
          signatory_name: string
          signature_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_authorized?: boolean
          organization_id?: string
          seal_url?: string | null
          signatory_name?: string
          signature_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_seals_signatories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_workflow_settings: {
        Row: {
          organization_id: string
          payment_workflow: Database["public"]["Enums"]["workflow_type"]
          po_workflow: Database["public"]["Enums"]["workflow_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          organization_id: string
          payment_workflow?: Database["public"]["Enums"]["workflow_type"]
          po_workflow?: Database["public"]["Enums"]["workflow_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          organization_id?: string
          payment_workflow?: Database["public"]["Enums"]["workflow_type"]
          po_workflow?: Database["public"]["Enums"]["workflow_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_workflow_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          credit_note_number: string
          id: string
          issue_date: string
          issued_by_org_id: string
          issued_to_org_id: string
          origin_reference: string
          origin_type: string
          reason: string
          remarks: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          credit_note_number: string
          id?: string
          issue_date: string
          issued_by_org_id: string
          issued_to_org_id: string
          origin_reference: string
          origin_type: string
          reason: string
          remarks?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          credit_note_number?: string
          id?: string
          issue_date?: string
          issued_by_org_id?: string
          issued_to_org_id?: string
          origin_reference?: string
          origin_type?: string
          reason?: string
          remarks?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_issued_by_org_id_fkey"
            columns: ["issued_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_issued_to_org_id_fkey"
            columns: ["issued_to_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      debit_notes: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          debit_note_number: string
          id: string
          issue_date: string
          issued_by_org_id: string
          issued_to_org_id: string
          origin_reference: string
          origin_type: string
          reason: string
          remarks: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          debit_note_number: string
          id?: string
          issue_date: string
          issued_by_org_id: string
          issued_to_org_id: string
          origin_reference: string
          origin_type: string
          reason: string
          remarks?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          debit_note_number?: string
          id?: string
          issue_date?: string
          issued_by_org_id?: string
          issued_to_org_id?: string
          origin_reference?: string
          origin_type?: string
          reason?: string
          remarks?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debit_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_issued_by_org_id_fkey"
            columns: ["issued_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debit_notes_issued_to_org_id_fkey"
            columns: ["issued_to_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          delivery_contact: string | null
          eligibility_result: Json | null
          id: string
          invoice_number: string | null
          organization_id: string
          purchase_order_id: string
          quantity: number
          requested_date: string
          site_address: string
          status: string
          updated_at: string
          utcl_payment_id: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          delivery_contact?: string | null
          eligibility_result?: Json | null
          id?: string
          invoice_number?: string | null
          organization_id: string
          purchase_order_id: string
          quantity: number
          requested_date: string
          site_address: string
          status?: string
          updated_at?: string
          utcl_payment_id?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          delivery_contact?: string | null
          eligibility_result?: Json | null
          id?: string
          invoice_number?: string | null
          organization_id?: string
          purchase_order_id?: string
          quantity?: number
          requested_date?: string
          site_address?: string
          status?: string
          updated_at?: string
          utcl_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_requests_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_requests_utcl_payment_id_fkey"
            columns: ["utcl_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
          tds_amount: number
          updated_at: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
          tds_amount?: number
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
          tds_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          dispatch_request_id: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          is_opening_balance: boolean
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          dispatch_request_id?: string | null
          due_date: string
          id?: string
          invoice_date: string
          invoice_number: string
          is_opening_balance?: boolean
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          dispatch_request_id?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_opening_balance?: boolean
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_dispatch_request_id_fkey"
            columns: ["dispatch_request_id"]
            isOneToOne: false
            referencedRelation: "dispatch_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assigned_to: string | null
          attachment_url: string | null
          comments: string | null
          created_at: string
          dispatch_request_id: string | null
          id: string
          issue_type: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachment_url?: string | null
          comments?: string | null
          created_at?: string
          dispatch_request_id?: string | null
          id?: string
          issue_type: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachment_url?: string | null
          comments?: string | null
          created_at?: string
          dispatch_request_id?: string | null
          id?: string
          issue_type?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_dispatch_request_id_fkey"
            columns: ["dispatch_request_id"]
            isOneToOne: false
            referencedRelation: "dispatch_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          organization_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          organization_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          organization_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_address: string | null
          created_at: string
          gst_number: string | null
          id: string
          legal_name: string
          org_type: Database["public"]["Enums"]["org_type"]
          pan_number: string | null
          party_code: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          short_name: string | null
          status: Database["public"]["Enums"]["org_status"]
          status_reason: string | null
          tp_code: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          created_at?: string
          gst_number?: string | null
          id?: string
          legal_name: string
          org_type: Database["public"]["Enums"]["org_type"]
          pan_number?: string | null
          party_code?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          status_reason?: string | null
          tp_code?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          created_at?: string
          gst_number?: string | null
          id?: string
          legal_name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          pan_number?: string | null
          party_code?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          status_reason?: string | null
          tp_code?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string
          dispatch_request_id: string | null
          id: string
          is_advance: boolean
          is_client_to_utcl: boolean
          is_utcl_payment: boolean
          organization_id: string
          payment_date: string
          payment_mode: string
          proof_url: string | null
          purchase_order_id: string | null
          reference_number: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string
          dispatch_request_id?: string | null
          id?: string
          is_advance?: boolean
          is_client_to_utcl?: boolean
          is_utcl_payment?: boolean
          organization_id: string
          payment_date: string
          payment_mode: string
          proof_url?: string | null
          purchase_order_id?: string | null
          reference_number: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string
          dispatch_request_id?: string | null
          id?: string
          is_advance?: boolean
          is_client_to_utcl?: boolean
          is_utcl_payment?: boolean
          organization_id?: string
          payment_date?: string
          payment_mode?: string
          proof_url?: string | null
          purchase_order_id?: string | null
          reference_number?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_dispatch_request_id_fkey"
            columns: ["dispatch_request_id"]
            isOneToOne: false
            referencedRelation: "dispatch_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          grade: string | null
          gst_rate: number | null
          hsn_code: string | null
          id: string
          is_active: boolean
          name: string
          packaging: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          packaging?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: string | null
          gst_rate?: number | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          packaging?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["user_approval_status"]
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["user_approval_status"]
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["user_approval_status"]
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          delivery_contact: string | null
          document_method: string
          document_url: string | null
          id: string
          locked_rate: number
          organization_id: string
          original_quantity: number
          po_number: string
          product_id: string
          site_address: string
          status: string
          total_value: number
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          delivery_contact?: string | null
          document_method: string
          document_url?: string | null
          id?: string
          locked_rate: number
          organization_id: string
          original_quantity: number
          po_number: string
          product_id: string
          site_address: string
          status?: string
          total_value: number
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          delivery_contact?: string | null
          document_method?: string
          document_url?: string | null
          id?: string
          locked_rate?: number
          organization_id?: string
          original_quantity?: number
          po_number?: string
          product_id?: string
          site_address?: string
          status?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rates: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          organization_id: string | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          organization_id?: string | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id?: string | null
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_letters: {
        Row: {
          created_at: string
          document_url: string | null
          id: string
          organization_id: string
          payment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          id?: string
          organization_id: string
          payment_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          id?: string
          organization_id?: string
          payment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_letters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_letters_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      special_approvals: {
        Row: {
          approved_by: string | null
          created_at: string
          dispatch_request_id: string | null
          exception_type: string
          expiry_date: string
          id: string
          max_amount_allowance: number | null
          organization_id: string
          purchase_order_id: string | null
          reason: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          dispatch_request_id?: string | null
          exception_type: string
          expiry_date: string
          id?: string
          max_amount_allowance?: number | null
          organization_id: string
          purchase_order_id?: string | null
          reason: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          dispatch_request_id?: string | null
          exception_type?: string
          expiry_date?: string
          id?: string
          max_amount_allowance?: number | null
          organization_id?: string
          purchase_order_id?: string | null
          reason?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_approvals_dispatch_request_id_fkey"
            columns: ["dispatch_request_id"]
            isOneToOne: false
            referencedRelation: "dispatch_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_approvals_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_opening_balance: {
        Args: { p_invoice_id: string; p_user_id: string }
        Returns: Json
      }
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_mundra_user: { Args: never; Returns: boolean }
      recalculate_wallet_balance: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      record_payment_admin: {
        Args: {
          p_amount: number
          p_is_client_to_utcl: boolean
          p_is_utcl: boolean
          p_org_id: string
          p_payment_date: string
          p_payment_mode: string
          p_ref_no: string
          p_user_id: string
        }
        Returns: string
      }
      record_payment_with_allocations:
        | {
            Args: {
              p_amount: number
              p_dispatch_ids: string[]
              p_is_advance: boolean
              p_is_client_to_utcl: boolean
              p_is_utcl: boolean
              p_manual_allocations: Json
              p_org_id: string
              p_payment_date: string
              p_payment_mode: string
              p_po_id: string
              p_ref_no: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_dispatch_ids: string[]
              p_is_advance: boolean
              p_is_client_to_utcl: boolean
              p_is_utcl: boolean
              p_manual_allocations: Json
              p_org_id: string
              p_payment_date: string
              p_payment_mode: string
              p_po_id: string
              p_ref_no: string
              p_status: string
              p_user_id: string
              p_verified_by: string
            }
            Returns: Json
          }
      update_invoice_status: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "mundra_super_admin"
        | "mundra_accounts"
        | "mundra_po_dispatch"
        | "mundra_approver"
        | "mundra_readonly"
        | "client_admin"
        | "client_po_maker"
        | "client_po_approver"
        | "client_payment_maker"
        | "client_payment_approver"
        | "client_accounts"
        | "client_readonly"
      org_status: "active" | "suspended" | "pending"
      org_type: "mundra" | "client"
      user_approval_status: "pending" | "approved" | "rejected"
      workflow_type: "maker_only" | "maker_approver"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "mundra_super_admin",
        "mundra_accounts",
        "mundra_po_dispatch",
        "mundra_approver",
        "mundra_readonly",
        "client_admin",
        "client_po_maker",
        "client_po_approver",
        "client_payment_maker",
        "client_payment_approver",
        "client_accounts",
        "client_readonly",
      ],
      org_status: ["active", "suspended", "pending"],
      org_type: ["mundra", "client"],
      user_approval_status: ["pending", "approved", "rejected"],
      workflow_type: ["maker_only", "maker_approver"],
    },
  },
} as const
