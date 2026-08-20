-- Force-logout helper: when a user is removed from their last workspace, the
-- server ends their live sessions so a still-valid access token can't keep a
-- stale UI open. Data access is already cut immediately by RLS; this closes the
-- session window too. Service-role only.
CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
  DELETE FROM auth.sessions       WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
-- Only the service role (server) may call it.
