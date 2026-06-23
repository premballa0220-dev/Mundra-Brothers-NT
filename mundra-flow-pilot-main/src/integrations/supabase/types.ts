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
          created_at: string
          due_date: string
          id: string
          organization_id: string
          quarter_end_date: string
          reviewed_at: string | null
          reviewed_by: string | null
          signed_pdf_url: string | null
          source_pdf_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          block_date: string
          created_at?: string
          due_date: string
          id?: string
          organization_id: string
          quarter_end_date: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signed_pdf_url?: string | null
          source_pdf_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          block_date?: string
          created_at?: string
          due_date?: string
          id?: string
          organization_id?: string
          quarter_end_date?: string
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
        }
        Insert: {
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
        }
        Update: {
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
          created_at: string
          id: string
          is_default: boolean
          label: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string
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
      dispatch_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          delivery_contact: string | null
          eligibility_result: Json | null
          id: string
          organization_id: string
          purchase_order_id: string
          quantity: number
          requested_date: string
          site_address: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          delivery_contact?: string | null
          eligibility_result?: Json | null
          id?: string
          organization_id: string
          purchase_order_id: string
          quantity: number
          requested_date: string
          site_address: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          delivery_contact?: string | null
          eligibility_result?: Json | null
          id?: string
          organization_id?: string
          purchase_order_id?: string
          quantity?: number
          requested_date?: string
          site_address?: string
          status?: string
          updated_at?: string
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
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          short_name: string | null
          status: Database["public"]["Enums"]["org_status"]
          status_reason: string | null
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
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          status_reason?: string | null
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
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          short_name?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          status_reason?: string | null
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
          id: string
          organization_id: string
          payment_date: string
          payment_mode: string
          proof_url: string | null
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
          id?: string
          organization_id: string
          payment_date: string
          payment_mode: string
          proof_url?: string | null
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
          id?: string
          organization_id?: string
          payment_date?: string
          payment_mode?: string
          proof_url?: string | null
          reference_number?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          grade: string | null
          id: string
          is_active: boolean
          name: string
          packaging: string | null
          unit: string
          hsn_code: string | null
          gst_rate: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade?: string | null
          id?: string
          is_active?: boolean
          name: string
          packaging?: string | null
          unit?: string
          hsn_code?: string | null
          gst_rate?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: string | null
          id?: string
          is_active?: boolean
          name?: string
          packaging?: string | null
          unit?: string
          hsn_code?: string | null
          gst_rate?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
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
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_mundra_user: { Args: never; Returns: boolean }
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
    },
  },
} as const
