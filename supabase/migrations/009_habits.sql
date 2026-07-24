-- Quit-habit streak tracker.
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.habits (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  name              TEXT NOT NULL,
  icon              TEXT NOT NULL DEFAULT '🔒',
  last_relapse_date TEXT NOT NULL,          -- ISO date YYYY-MM-DD
  created_at        BIGINT NOT NULL,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        BIGINT,
  deleted           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits (user_id);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habits_select_own" ON public.habits;
DROP POLICY IF EXISTS "habits_insert_own" ON public.habits;
DROP POLICY IF EXISTS "habits_update_own" ON public.habits;
DROP POLICY IF EXISTS "habits_delete_own" ON public.habits;

CREATE POLICY "habits_select_own" ON public.habits
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "habits_insert_own" ON public.habits
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "habits_update_own" ON public.habits
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub')
              WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "habits_delete_own" ON public.habits
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');
