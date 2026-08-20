-- OAuth `state` nonces, persisted so the Google OAuth flow survives server
-- restarts and works across multiple instances. Service-role only: the API
-- server creates a row when it builds the authorize URL and deletes it
-- (single-use, atomic) when Google redirects back.

create table if not exists public.oauth_states (
  state      text primary key,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists oauth_states_expires_at_idx on public.oauth_states (expires_at);

alter table public.oauth_states enable row level security;

-- No policies on purpose: only the service role (which bypasses RLS) may read
-- or write this table.
revoke all on public.oauth_states from anon, authenticated;
