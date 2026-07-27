-- ==============================================================================
-- CLEAN SLATE SCRIPT
-- ==============================================================================
-- WARNING: This script will irrevocably delete ALL transactional data and ALL 
-- client data from your database.
-- It will RETAIN the Mundra Brothers operator tenant, internal users, and 
-- master products.
-- 
-- USAGE: Run this script directly in your Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- 1. Truncate all transactional tables
-- TRUNCATE with CASCADE ensures that any dependent records in child tables are also deleted.
TRUNCATE TABLE 
  public.audit_logs,
  public.notifications,
  public.issues,
  public.special_approvals,
  public.balance_confirmations,
  public.refund_letters,
  public.invoice_allocations,
  public.payments,
  public.invoices,
  public.credit_notes,
  public.debit_notes,
  public.dispatch_requests,
  public.purchase_orders
CASCADE;

-- 2. Delete all Users associated with Client organizations
-- This deletes the authentication records, which cascades to delete 
-- public.profiles and public.user_roles for these client users.
DELETE FROM auth.users 
WHERE id IN (
  SELECT id FROM public.profiles 
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE org_type = 'client'
  )
);
--2. Delete remaining crons and pushes
-- 3. Delete all Client Organizations
-- This deletes the organizations, which cascades to delete their 
-- commercial profiles, workflow settings, seals, and client-specific rates.
DELETE FROM public.organizations WHERE org_type = 'client';

COMMIT;

-- Note: The Mundra Brothers tenant (org_type = 'mundra'), its profiles, 
-- and the public.products table are explicitly left untouched.
