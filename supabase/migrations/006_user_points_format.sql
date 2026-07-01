-- v2 points model: balance is derived from completed tasks across all days,
-- and the user_points ledger only carries non-task adjustments (penalties,
-- redemptions). format_version = 1 marks rows written by the new code so
-- other devices don't re-migrate and clobber accumulated adjustments.
--
-- Run once in Supabase SQL Editor.

ALTER TABLE public.user_points
  ADD COLUMN IF NOT EXISTS format_version INTEGER NOT NULL DEFAULT 0;
