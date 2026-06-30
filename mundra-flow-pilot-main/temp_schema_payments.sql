


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'mundra_super_admin',
    'mundra_accounts',
    'mundra_po_dispatch',
    'mundra_approver',
    'mundra_readonly',
    'client_admin',
    'client_po_maker',
    'client_po_approver',
    'client_payment_maker',
    'client_payment_approver',
    'client_accounts',
    'client_readonly'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."org_status" AS ENUM (
    'active',
    'suspended',
    'pending'
);


ALTER TYPE "public"."org_status" OWNER TO "postgres";


CREATE TYPE "public"."org_type" AS ENUM (
    'mundra',
    'client'
);


ALTER TYPE "public"."org_type" OWNER TO "postgres";


CREATE TYPE "public"."user_approval_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."user_approval_status" OWNER TO "postgres";


CREATE TYPE "public"."workflow_type" AS ENUM (
    'maker_only',
    'maker_approver'
);


ALTER TYPE "public"."workflow_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."current_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org_id UUID;
  v_is_first BOOLEAN;
  v_role TEXT;
  v_approval_status public.user_approval_status;
BEGIN
  -- Default to Mundra operator org if not provided via metadata
  v_org_id := COALESCE((NEW.raw_user_meta_data->>'organization_id')::UUID, '00000000-0000-0000-0000-000000000001');

  -- First-ever user gets super admin and bypasses approval
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO v_is_first;

  IF v_is_first THEN
    v_approval_status := 'approved';
  ELSE
    v_approval_status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, email, phone, approval_status)
  VALUES (
    NEW.id,
    v_org_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    v_approval_status
  );

  IF v_is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mundra_super_admin');
  ELSE
    -- If role is provided in metadata, use it, otherwise default to mundra_readonly
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'mundra_readonly');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role::public.app_role);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_mundra_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = auth.uid() AND o.org_type = 'mundra'
  );
$$;


ALTER FUNCTION "public"."is_mundra_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "previous_values" "jsonb",
    "new_values" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."balance_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "quarter_end_date" "date" NOT NULL,
    "source_pdf_url" "text",
    "signed_pdf_url" "text",
    "due_date" "date" NOT NULL,
    "block_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending_upload'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "outstanding_amount" numeric,
    "period_from" "date",
    "period_to" "date",
    "ref_no" "text",
    "client_name" "text",
    "client_address" "text"
);


ALTER TABLE "public"."balance_confirmations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_approved_products" (
    "organization_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_approved_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_commercial_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "credit_limit" numeric(15,2) DEFAULT 0 NOT NULL,
    "payment_terms_days" integer DEFAULT 30 NOT NULL,
    "grace_period_days" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "include_undispatched_pos" boolean DEFAULT false NOT NULL,
    "include_dispatched_unbilled" boolean DEFAULT true NOT NULL,
    "include_unpaid_invoices" boolean DEFAULT true NOT NULL,
    "restrictions" "text",
    "commission_percentage" numeric(5,2),
    "wallet_balance" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "client_commercial_profiles_credit_limit_check" CHECK (("credit_limit" >= (0)::numeric)),
    CONSTRAINT "client_commercial_profiles_grace_period_days_check" CHECK (("grace_period_days" >= 0)),
    CONSTRAINT "client_commercial_profiles_payment_terms_days_check" CHECK (("payment_terms_days" >= 0))
);


ALTER TABLE "public"."client_commercial_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_credit_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "credit_limit" numeric(15,2) NOT NULL,
    "effective_from" "date" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_credit_history_credit_limit_check" CHECK (("credit_limit" >= (0)::numeric))
);


ALTER TABLE "public"."client_credit_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_delivery_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "address" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "contact_person" character varying,
    "contact_phone" character varying
);


ALTER TABLE "public"."client_delivery_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_seals_signatories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "signatory_name" "text" NOT NULL,
    "designation" "text",
    "signature_url" "text",
    "seal_url" "text",
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone,
    "is_authorized" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_seals_signatories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_workflow_settings" (
    "organization_id" "uuid" NOT NULL,
    "po_workflow" "public"."workflow_type" DEFAULT 'maker_approver'::"public"."workflow_type" NOT NULL,
    "payment_workflow" "public"."workflow_type" DEFAULT 'maker_approver'::"public"."workflow_type" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_workflow_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dispatch_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "requested_date" "date" NOT NULL,
    "site_address" "text" NOT NULL,
    "delivery_contact" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "eligibility_result" "jsonb",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dispatch_requests_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."dispatch_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "allocated_amount" numeric(15,2) NOT NULL,
    "tds_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_allocations_allocated_amount_check" CHECK (("allocated_amount" >= (0)::numeric)),
    CONSTRAINT "invoice_allocations_tds_amount_check" CHECK (("tds_amount" >= (0)::numeric))
);


ALTER TABLE "public"."invoice_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "dispatch_request_id" "uuid",
    "invoice_number" "text" NOT NULL,
    "invoice_date" "date" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoices_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "dispatch_request_id" "uuid",
    "issue_type" "text" NOT NULL,
    "comments" "text",
    "attachment_url" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "legal_name" "text" NOT NULL,
    "short_name" "text",
    "org_type" "public"."org_type" NOT NULL,
    "gst_number" "text",
    "pan_number" "text",
    "primary_contact_email" "text",
    "primary_contact_phone" "text",
    "status" "public"."org_status" DEFAULT 'active'::"public"."org_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trade_name" "text",
    "billing_address" "text",
    "primary_contact_name" "text",
    "status_reason" "text"
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "payment_date" "date" NOT NULL,
    "payment_mode" "text" NOT NULL,
    "reference_number" "text" NOT NULL,
    "bank_name" "text",
    "proof_url" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "purchase_order_id" "uuid",
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "grade" "text",
    "packaging" "text",
    "unit" "text" DEFAULT 'MT'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hsn_code" "text",
    "gst_rate" numeric(5,2)
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text" NOT NULL,
    "phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approval_status" "public"."user_approval_status" DEFAULT 'pending'::"public"."user_approval_status" NOT NULL,
    "status_reason" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "po_number" "text" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "original_quantity" numeric(12,3) NOT NULL,
    "locked_rate" numeric(12,2) NOT NULL,
    "total_value" numeric(15,2) NOT NULL,
    "site_address" "text" NOT NULL,
    "delivery_contact" "text",
    "document_method" "text" NOT NULL,
    "document_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "purchase_orders_document_method_check" CHECK (("document_method" = ANY (ARRAY['upload'::"text", 'generate'::"text"]))),
    CONSTRAINT "purchase_orders_locked_rate_check" CHECK (("locked_rate" >= (0)::numeric)),
    CONSTRAINT "purchase_orders_original_quantity_check" CHECK (("original_quantity" > (0)::numeric)),
    CONSTRAINT "purchase_orders_total_value_check" CHECK (("total_value" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "effective_from" timestamp with time zone NOT NULL,
    "effective_to" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "approved_by" "uuid",
    CONSTRAINT "chk_effective_dates" CHECK ((("effective_to" IS NULL) OR ("effective_from" <= "effective_to"))),
    CONSTRAINT "rates_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "rates_status_check" CHECK (("status" = ANY (ARRAY['pending_approval'::"text", 'active'::"text", 'inactive'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_letters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "document_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."refund_letters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."special_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "exception_type" "text" NOT NULL,
    "dispatch_request_id" "uuid",
    "purchase_order_id" "uuid",
    "max_amount_allowance" numeric(15,2),
    "start_date" "date" NOT NULL,
    "expiry_date" "date" NOT NULL,
    "reason" "text" NOT NULL,
    "approved_by" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."special_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."balance_confirmations"
    ADD CONSTRAINT "balance_confirmations_organization_id_quarter_end_date_key" UNIQUE ("organization_id", "quarter_end_date");



ALTER TABLE ONLY "public"."balance_confirmations"
    ADD CONSTRAINT "balance_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_approved_products"
    ADD CONSTRAINT "client_approved_products_pkey" PRIMARY KEY ("organization_id", "product_id");



ALTER TABLE ONLY "public"."client_commercial_profiles"
    ADD CONSTRAINT "client_commercial_profiles_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."client_commercial_profiles"
    ADD CONSTRAINT "client_commercial_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_credit_history"
    ADD CONSTRAINT "client_credit_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_delivery_locations"
    ADD CONSTRAINT "client_delivery_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_seals_signatories"
    ADD CONSTRAINT "client_seals_signatories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_workflow_settings"
    ADD CONSTRAINT "client_workflow_settings_pkey" PRIMARY KEY ("organization_id");



ALTER TABLE ONLY "public"."dispatch_requests"
    ADD CONSTRAINT "dispatch_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_allocations"
    ADD CONSTRAINT "invoice_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refund_letters"
    ADD CONSTRAINT "refund_letters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."special_approvals"
    ADD CONSTRAINT "special_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_client_credit_history_org" ON "public"."client_credit_history" USING "btree" ("organization_id");



CREATE INDEX "idx_client_delivery_locations_org" ON "public"."client_delivery_locations" USING "btree" ("organization_id");



CREATE INDEX "idx_dispatch_requests_org" ON "public"."dispatch_requests" USING "btree" ("organization_id");



CREATE INDEX "idx_dispatch_requests_po" ON "public"."dispatch_requests" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_invoices_org" ON "public"."invoices" USING "btree" ("organization_id");



CREATE INDEX "idx_payments_org" ON "public"."payments" USING "btree" ("organization_id");



CREATE INDEX "idx_profiles_org" ON "public"."profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_purchase_orders_org" ON "public"."purchase_orders" USING "btree" ("organization_id");



CREATE INDEX "idx_rates_product_org" ON "public"."rates" USING "btree" ("product_id", "organization_id");



CREATE OR REPLACE TRIGGER "trg_balance_confirmations_updated" BEFORE UPDATE ON "public"."balance_confirmations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_client_commercial_profiles_updated" BEFORE UPDATE ON "public"."client_commercial_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_client_delivery_locations_updated" BEFORE UPDATE ON "public"."client_delivery_locations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_client_seals_signatories_updated" BEFORE UPDATE ON "public"."client_seals_signatories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_client_workflow_settings_updated" BEFORE UPDATE ON "public"."client_workflow_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_dispatch_requests_updated" BEFORE UPDATE ON "public"."dispatch_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoice_allocations_updated" BEFORE UPDATE ON "public"."invoice_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoices_updated" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_issues_updated" BEFORE UPDATE ON "public"."issues" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orgs_updated" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payments_updated" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_products_updated" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_purchase_orders_updated" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rates_updated" BEFORE UPDATE ON "public"."rates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_refund_letters_updated" BEFORE UPDATE ON "public"."refund_letters" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_special_approvals_updated" BEFORE UPDATE ON "public"."special_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."balance_confirmations"
    ADD CONSTRAINT "balance_confirmations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."balance_confirmations"
    ADD CONSTRAINT "balance_confirmations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_approved_products"
    ADD CONSTRAINT "client_approved_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_approved_products"
    ADD CONSTRAINT "client_approved_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_commercial_profiles"
    ADD CONSTRAINT "client_commercial_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_credit_history"
    ADD CONSTRAINT "client_credit_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_credit_history"
    ADD CONSTRAINT "client_credit_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_delivery_locations"
    ADD CONSTRAINT "client_delivery_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_seals_signatories"
    ADD CONSTRAINT "client_seals_signatories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_workflow_settings"
    ADD CONSTRAINT "client_workflow_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_workflow_settings"
    ADD CONSTRAINT "client_workflow_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."dispatch_requests"
    ADD CONSTRAINT "dispatch_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dispatch_requests"
    ADD CONSTRAINT "dispatch_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."dispatch_requests"
    ADD CONSTRAINT "dispatch_requests_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_allocations"
    ADD CONSTRAINT "invoice_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoice_allocations"
    ADD CONSTRAINT "invoice_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_dispatch_request_id_fkey" FOREIGN KEY ("dispatch_request_id") REFERENCES "public"."dispatch_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_dispatch_request_id_fkey" FOREIGN KEY ("dispatch_request_id") REFERENCES "public"."dispatch_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rates"
    ADD CONSTRAINT "rates_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_letters"
    ADD CONSTRAINT "refund_letters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refund_letters"
    ADD CONSTRAINT "refund_letters_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."special_approvals"
    ADD CONSTRAINT "special_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."special_approvals"
    ADD CONSTRAINT "special_approvals_dispatch_request_id_fkey" FOREIGN KEY ("dispatch_request_id") REFERENCES "public"."dispatch_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."special_approvals"
    ADD CONSTRAINT "special_approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."special_approvals"
    ADD CONSTRAINT "special_approvals_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "allocations_modify" ON "public"."invoice_allocations" TO "authenticated" USING (("public"."is_mundra_user"() OR (EXISTS ( SELECT 1
   FROM "public"."payments" "p"
  WHERE (("p"."id" = "invoice_allocations"."payment_id") AND ("p"."organization_id" = "public"."current_org_id"()) AND ("p"."status" = 'submitted'::"text")))))) WITH CHECK (("public"."is_mundra_user"() OR (EXISTS ( SELECT 1
   FROM "public"."payments" "p"
  WHERE (("p"."id" = "invoice_allocations"."payment_id") AND ("p"."organization_id" = "public"."current_org_id"()) AND ("p"."status" = 'submitted'::"text"))))));



CREATE POLICY "allocations_select" ON "public"."invoice_allocations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."payments" "p"
  WHERE (("p"."id" = "invoice_allocations"."payment_id") AND (("p"."organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"())))));



CREATE POLICY "approved_products_modify" ON "public"."client_approved_products" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "approved_products_select" ON "public"."client_approved_products" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "audit_insert" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_select" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'mundra_super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'mundra_readonly'::"public"."app_role")));



ALTER TABLE "public"."balance_confirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_approved_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_commercial_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_credit_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_delivery_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_seals_signatories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_workflow_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commercial_profile_modify_mundra" ON "public"."client_commercial_profiles" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "commercial_profile_select" ON "public"."client_commercial_profiles" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "confirmations_insert" ON "public"."balance_confirmations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "confirmations_select" ON "public"."balance_confirmations" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "confirmations_update" ON "public"."balance_confirmations" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"())) WITH CHECK ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "credit_history_insert" ON "public"."client_credit_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "credit_history_select" ON "public"."client_credit_history" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "delivery_locations_modify" ON "public"."client_delivery_locations" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "delivery_locations_select" ON "public"."client_delivery_locations" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



ALTER TABLE "public"."dispatch_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dispatches_insert_client" ON "public"."dispatch_requests" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "dispatches_modify_mundra" ON "public"."dispatch_requests" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "dispatches_select" ON "public"."dispatch_requests" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "dispatches_update_client" ON "public"."dispatch_requests" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND ("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text"])))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND ("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text"]))));



ALTER TABLE "public"."invoice_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_modify" ON "public"."invoices" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "invoices_select" ON "public"."invoices" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



ALTER TABLE "public"."issues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "issues_insert" ON "public"."issues" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "issues_select" ON "public"."issues" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "issues_update" ON "public"."issues" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"())) WITH CHECK ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_mundra_user"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orgs_modify_mundra_admin" ON "public"."organizations" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'mundra_super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'mundra_super_admin'::"public"."app_role"));



CREATE POLICY "orgs_select" ON "public"."organizations" FOR SELECT TO "authenticated" USING ((("id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_insert" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "payments_modify" ON "public"."payments" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "payments_select" ON "public"."payments" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "pos_insert_client" ON "public"."purchase_orders" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."current_org_id"()));



CREATE POLICY "pos_modify_mundra" ON "public"."purchase_orders" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "pos_select" ON "public"."purchase_orders" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "pos_update_client" ON "public"."purchase_orders" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) AND ("status" = ANY (ARRAY['draft'::"text", 'pending_approval'::"text"])))) WITH CHECK ((("organization_id" = "public"."current_org_id"()) AND ("status" = ANY (ARRAY['draft'::"text", 'pending_approval'::"text"]))));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_modify_mundra_admin" ON "public"."products" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "products_select_all" ON "public"."products" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_mundra_user"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rates_modify_mundra_admin" ON "public"."rates" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "rates_select_policy" ON "public"."rates" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR ("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



ALTER TABLE "public"."refund_letters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refunds_modify" ON "public"."refund_letters" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "refunds_select" ON "public"."refund_letters" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "seals_modify" ON "public"."client_seals_signatories" TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"())) WITH CHECK ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "seals_select" ON "public"."client_seals_signatories" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



ALTER TABLE "public"."special_approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "specials_modify" ON "public"."special_approvals" TO "authenticated" USING ("public"."is_mundra_user"()) WITH CHECK ("public"."is_mundra_user"());



CREATE POLICY "specials_select" ON "public"."special_approvals" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_select_own" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'mundra_super_admin'::"public"."app_role")));



CREATE POLICY "workflow_modify" ON "public"."client_workflow_settings" TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"())) WITH CHECK ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));



CREATE POLICY "workflow_select" ON "public"."client_workflow_settings" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."current_org_id"()) OR "public"."is_mundra_user"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."current_org_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_mundra_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_mundra_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_mundra_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."balance_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."balance_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."balance_confirmations" TO "service_role";



GRANT ALL ON TABLE "public"."client_approved_products" TO "anon";
GRANT ALL ON TABLE "public"."client_approved_products" TO "authenticated";
GRANT ALL ON TABLE "public"."client_approved_products" TO "service_role";



GRANT ALL ON TABLE "public"."client_commercial_profiles" TO "anon";
GRANT ALL ON TABLE "public"."client_commercial_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."client_commercial_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."client_credit_history" TO "anon";
GRANT ALL ON TABLE "public"."client_credit_history" TO "authenticated";
GRANT ALL ON TABLE "public"."client_credit_history" TO "service_role";



GRANT ALL ON TABLE "public"."client_delivery_locations" TO "anon";
GRANT ALL ON TABLE "public"."client_delivery_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_delivery_locations" TO "service_role";



GRANT ALL ON TABLE "public"."client_seals_signatories" TO "anon";
GRANT ALL ON TABLE "public"."client_seals_signatories" TO "authenticated";
GRANT ALL ON TABLE "public"."client_seals_signatories" TO "service_role";



GRANT ALL ON TABLE "public"."client_workflow_settings" TO "anon";
GRANT ALL ON TABLE "public"."client_workflow_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."client_workflow_settings" TO "service_role";



GRANT ALL ON TABLE "public"."dispatch_requests" TO "anon";
GRANT ALL ON TABLE "public"."dispatch_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."dispatch_requests" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_allocations" TO "anon";
GRANT ALL ON TABLE "public"."invoice_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."issues" TO "anon";
GRANT ALL ON TABLE "public"."issues" TO "authenticated";
GRANT ALL ON TABLE "public"."issues" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."rates" TO "anon";
GRANT ALL ON TABLE "public"."rates" TO "authenticated";
GRANT ALL ON TABLE "public"."rates" TO "service_role";



GRANT ALL ON TABLE "public"."refund_letters" TO "anon";
GRANT ALL ON TABLE "public"."refund_letters" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_letters" TO "service_role";



GRANT ALL ON TABLE "public"."special_approvals" TO "anon";
GRANT ALL ON TABLE "public"."special_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."special_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































