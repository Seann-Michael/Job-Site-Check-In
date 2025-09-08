-- Supabase SQL to create payments tables

-- Table to track checkout sessions
CREATE TABLE IF NOT EXISTS payments_sessions (
  id text PRIMARY KEY,
  provider text NOT NULL,
  mode text,
  amount numeric,
  currency text,
  metadata jsonb,
  status text,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);

-- Table to record completed payments / invoices
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event text,
  external_id text,
  amount numeric,
  currency text,
  status text,
  metadata jsonb,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);
