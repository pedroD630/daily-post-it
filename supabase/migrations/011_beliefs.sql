-- Belief Breaker: negative beliefs the user is dismantling with evidence.
-- Only the belief definition lives here. The evidence count is derived on
-- each device from the already-synced days table, so it needs no storage.
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.beliefs (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  negative_statement  TEXT NOT NULL,
  healthy_statement   TEXT NOT NULL,
  keywords            JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at          BIGINT NOT NULL,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          BIGINT,
  deleted             BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_beliefs_user_id ON public.beliefs (user_id);

ALTER TABLE public.beliefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beliefs_select_own" ON public.beliefs;
DROP POLICY IF EXISTS "beliefs_insert_own" ON public.beliefs;
DROP POLICY IF EXISTS "beliefs_update_own" ON public.beliefs;
DROP POLICY IF EXISTS "beliefs_delete_own" ON public.beliefs;

CREATE POLICY "beliefs_select_own" ON public.beliefs
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "beliefs_insert_own" ON public.beliefs
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "beliefs_update_own" ON public.beliefs
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub')
              WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "beliefs_delete_own" ON public.beliefs
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');
