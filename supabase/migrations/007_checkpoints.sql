-- AI-proposed milestones toward goals.
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.checkpoints (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  goal_id      TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  achieved     BOOLEAN NOT NULL DEFAULT FALSE,
  achieved_at  BIGINT,
  created_at   BIGINT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  source       TEXT NOT NULL DEFAULT 'ai',   -- 'ai' | 'user'
  updated_at   BIGINT
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_user_id ON public.checkpoints (user_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_goal_id ON public.checkpoints (goal_id);

ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checkpoints_select_own" ON public.checkpoints;
DROP POLICY IF EXISTS "checkpoints_insert_own" ON public.checkpoints;
DROP POLICY IF EXISTS "checkpoints_update_own" ON public.checkpoints;
DROP POLICY IF EXISTS "checkpoints_delete_own" ON public.checkpoints;

CREATE POLICY "checkpoints_select_own" ON public.checkpoints
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "checkpoints_insert_own" ON public.checkpoints
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "checkpoints_update_own" ON public.checkpoints
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub')
              WITH CHECK (user_id = auth.jwt() ->> 'sub');
CREATE POLICY "checkpoints_delete_own" ON public.checkpoints
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');
