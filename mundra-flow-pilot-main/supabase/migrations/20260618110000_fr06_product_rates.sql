-- Migration: 20260618110000_fr06_product_rates.sql
-- Description: FR-06 Product and Rate Management
-- Extends rates table to support approval workflows

ALTER TABLE public.rates
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending_approval', 'active', 'inactive', 'rejected')),
ADD COLUMN created_by UUID REFERENCES auth.users(id),
ADD COLUMN approved_by UUID REFERENCES auth.users(id);

-- Backfill created_by for existing rates (if any exist without it)
-- though in a new system it's fine.
