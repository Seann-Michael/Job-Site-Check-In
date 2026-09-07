-- Applied to the live database on 2026-09-07 (version 20260907125234).
-- Back-ported into the repo on 2026-09-07: it was applied out-of-band, so
-- `supabase/migrations/` no longer reproduced the live schema.
--
-- businesses.owner_id was accepted from the client on INSERT. The RLS WITH
-- CHECK only required `owner_id = auth.uid()`, so it could not be forged, but
-- nothing forced it to be set at all and an INSERT that omitted it produced an
-- orphan row that no policy could ever match again (owner_id is nullable).
-- This pins owner_id to the caller for everyone except super admins, who
-- legitimately create businesses on behalf of a tenant.

CREATE OR REPLACE FUNCTION public.enforce_business_owner_id()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT is_super_admin() THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_business_owner_id ON public.businesses;
CREATE TRIGGER trg_enforce_business_owner_id
  BEFORE INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_owner_id();
