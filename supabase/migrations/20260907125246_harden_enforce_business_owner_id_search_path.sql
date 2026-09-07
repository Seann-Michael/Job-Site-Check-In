-- Applied to the live database on 2026-09-07 (version 20260907125246).
-- Back-ported into the repo on 2026-09-07.
--
-- Pin the trigger function's search_path. Without it, a role able to create
-- objects in a schema earlier on the search_path could shadow is_super_admin()
-- or auth.uid() and change what the trigger does.

CREATE OR REPLACE FUNCTION public.enforce_business_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT is_super_admin() THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;
