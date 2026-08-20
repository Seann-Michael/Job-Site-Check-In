-- Removing someone from a business must only remove their ACCESS
-- (business_members row). The users row — and every job, photo, document and
-- note attributed to them — stays. Block user-row deletion from every API
-- role so no UI path can ever do it; only the service role could, deliberately.
DROP POLICY IF EXISTS "users_admin_del" ON public.users;
REVOKE DELETE ON public.users FROM authenticated, anon;
