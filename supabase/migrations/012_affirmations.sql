-- Daily affirmations: one ordered list per user.
-- The per-session "done" marks are intentionally NOT stored here — they stay
-- device-local so confirming on the phone doesn't tick the box on the laptop.
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.affirmations (
  user_id     TEXT PRIMARY KEY,
  items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  BIGINT
);

ALTER TABLE public.affirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affirmations_select_own" ON public.affirmations;
DROP POLICY IF EXISTS "affirmations_insert_own" ON public.affirmations;
DROP POLICY IF EXISTS "affirmations_update_own" ON public.affirmations;
DROP POLICY IF EXISTS "affirmations_delete_own" ON public.affirmations;

CREATE POLICY "affirmations_select_own" ON public.affirmations
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "affirmations_insert_own" ON public.affirmations
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "affirmations_update_own" ON public.affirmations
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub')
              WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "affirmations_delete_own" ON public.affirmations
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');
