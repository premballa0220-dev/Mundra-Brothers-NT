-- Enable moddatetime extension
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Create Credit Notes Table
CREATE TABLE credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_number TEXT NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL CHECK (reason IN ('Rate Correction', 'Shortage', 'Quality Claim', 'Discount', 'Goods Return', 'Other')),
    remarks TEXT,
    issued_by_org_id UUID NOT NULL REFERENCES organizations(id),
    issued_to_org_id UUID NOT NULL REFERENCES organizations(id),
    origin_type TEXT NOT NULL CHECK (origin_type IN ('PO', 'Dispatch', 'Payment')),
    origin_reference TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'issued', 'applied', 'cancelled')) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    CONSTRAINT credit_notes_issued_by_to_different CHECK (issued_by_org_id != issued_to_org_id)
);

-- Create Debit Notes Table
CREATE TABLE debit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debit_note_number TEXT NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL CHECK (reason IN ('Rate Escalation', 'Excess Dispatch', 'Interest-Penalty', 'Under-billing Correction', 'Other')),
    remarks TEXT,
    issued_by_org_id UUID NOT NULL REFERENCES organizations(id),
    issued_to_org_id UUID NOT NULL REFERENCES organizations(id),
    origin_type TEXT NOT NULL CHECK (origin_type IN ('PO', 'Dispatch', 'Payment')),
    origin_reference TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'issued', 'applied', 'cancelled')) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    CONSTRAINT debit_notes_issued_by_to_different CHECK (issued_by_org_id != issued_to_org_id)
);

-- Enable RLS
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE debit_notes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert for now (Admin guard at UI level)
CREATE POLICY "Enable all access for authenticated users on credit_notes" ON credit_notes FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users on debit_notes" ON debit_notes FOR ALL TO authenticated USING (true);

-- Create triggers for updated_at
CREATE TRIGGER handle_updated_at_credit_notes BEFORE UPDATE ON credit_notes
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

CREATE TRIGGER handle_updated_at_debit_notes BEFORE UPDATE ON debit_notes
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
