-- Long-term goals tracked across devices.
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.goals (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  title         TEXT NOT NULL,
  deadline      TEXT NOT NULL,           -- ISO date YYYY-MM-DD
  keywords      TEXT[] NOT NULL DEFAULT '{}',
  target_amount INTEGER NOT NULL,
  target_unit   TEXT NOT NULL,           -- "day" | "week" | "month"
  base_color    TEXT NOT NULL DEFAULT '#e5e7eb',
  created_at    BIGINT NOT NULL,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    BIGINT
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals (user_id);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals_select_own" ON public.goals;
DROP POLICY IF EXISTS "goals_insert_own" ON public.goals;
DROP POLICY IF EXISTS "goals_update_own" ON public.goals;
DROP POLICY IF EXISTS "goals_delete_own" ON public.goals;

CREATE POLICY "goals_select_own" ON public.goals
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "goals_insert_own" ON public.goals
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "goals_update_own" ON public.goals
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub')
              WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "goals_delete_own" ON public.goals
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');
