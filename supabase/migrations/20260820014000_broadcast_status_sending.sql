-- The background worker claims a scheduled broadcast by setting status='sending'
-- before delivering, and marks 'failed' on a hard error. The original
-- broadcast_messages_status_check only allowed draft|scheduled|sent|cancelled,
-- so the claim update was rejected and scheduled broadcasts never delivered.
-- Widen the constraint to the full worker lifecycle.
ALTER TABLE public.broadcast_messages DROP CONSTRAINT IF EXISTS broadcast_messages_status_check;
ALTER TABLE public.broadcast_messages ADD CONSTRAINT broadcast_messages_status_check
  CHECK (status IN ('draft','scheduled','sending','sent','failed','cancelled'));
