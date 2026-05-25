-- Points & Rewards system: per-user balance table.
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.user_points (
  user_id     TEXT PRIMARY KEY,         -- Firebase UID (matches days.user_id format)
  balance     INTEGER NOT NULL DEFAULT 0,
  updated_at  BIGINT  NOT NULL
);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_points_select_own" ON public.user_points;
DROP POLICY IF EXISTS "user_points_insert_own" ON public.user_points;
DROP POLICY IF EXISTS "user_points_update_own" ON public.user_points;

CREATE POLICY "user_points_select_own" ON public.user_points
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "user_points_insert_own" ON public.user_points
  FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "user_points_update_own" ON public.user_points
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub')
              WITH CHECK (user_id = auth.jwt() ->> 'sub');
