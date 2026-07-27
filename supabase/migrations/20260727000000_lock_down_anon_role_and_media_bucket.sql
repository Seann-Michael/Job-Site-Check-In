-- Security lockdown — step 1 of the W0 foundation work.
--
-- WHY: row-level security is disabled on 31 of 57 public tables, and the anon
-- key that ships inside the mobile app bundle holds SELECT/INSERT/UPDATE/
-- DELETE/TRUNCATE on all 61 grantable tables. Anyone who extracts that key can
-- wipe the jobs table. The `media` storage bucket additionally allows
-- unauthenticated upload, overwrite and delete.
--
-- VERIFIED AGAINST THE LIVE DATABASE BEFORE WRITING (project qfhbusqupidiwlrzkgqc):
--   public tables ............ 57
--   RLS disabled on .......... 31
--   anon write-grant tables .. 61
--   authenticated grants ..... identical (61 select / 61 write)
--   real auth.users .......... 0
--   public buckets ........... 1 (media, 19 objects)
--
-- SAFETY: `authenticated` keeps identical grants, so signed-in access is
-- unaffected. Nobody has ever logged in, so no live session writes as anon.
--
-- DELIBERATELY NOT DONE HERE: enabling RLS. With zero real users and no
-- policies, enabling RLS now would black out authenticated access as well.
-- Identity first, then policies, then RLS.

-- 1. Remove every write privilege from anon on all public tables.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from anon',
      t.tablename);
  end loop;
end $$;

-- 2. Remove anon read access, then re-grant only to the tables that back
--    genuinely public pages:
--      PublicProject  -> jobs
--      ReviewGate     -> review_requests, businesses
--      share/galleries-> job_media, job_photos
--    plus public marketing/onboarding content.
do $$
declare
  t record;
  allowed text[] := array[
    'jobs','businesses','review_requests','job_media','job_photos','reviews',
    'help_articles','changelog_entries','login_slides','signup_slides',
    'plans','gmb_categories'
  ];
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    if t.tablename = any(allowed) then
      execute format('grant select on public.%I to anon', t.tablename);
    else
      execute format('revoke select on public.%I from anon', t.tablename);
    end if;
  end loop;
end $$;

-- 3. Stop newly created tables from silently granting anon everything again.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;

-- 4. Media bucket: keep public READ (published job photos and share pages rely
--    on it today) but restrict writes to signed-in users.
--
--    Making the bucket fully private + signed URLs is a follow-up, because the
--    public share pages and published GMB/Facebook photos need durable URLs.
--    That work belongs with the thumbnail pipeline.
drop policy if exists "Allow anon upload to media bucket"   on storage.objects;
drop policy if exists "Allow anon update in media bucket"   on storage.objects;
drop policy if exists "Allow anon delete from media bucket" on storage.objects;

create policy "Authenticated upload to media bucket"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media');

create policy "Authenticated update in media bucket"
  on storage.objects for update to authenticated
  using (bucket_id = 'media') with check (bucket_id = 'media');

create policy "Authenticated delete from media bucket"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media');
