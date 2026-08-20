-- Notifications were a global, ownerless table: every user saw every row and
-- "clear all" deleted everything. Add an owner column so the client can scope
-- reads/updates/deletes per user (NotificationDropdown, SuperAdminBroadcast).
--
-- user_id is nullable for now so existing rows (if any) are not rejected and
-- so a system-wide row can still exist; the client only ever reads rows where
-- user_id = current user. The RLS policy for this column lands with the auth
-- step (see supabase/migrations_pending/README.md).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_id_unread_idx
  ON public.notifications (user_id)
  WHERE read = false;
