-- Cross-device sync needs a per-row last-write-wins timestamp so a refresh
-- pull doesn't clobber edits that are still local-only (mid-typing).
-- Run once in Supabase SQL Editor.

ALTER TABLE public.days ADD COLUMN IF NOT EXISTS updated_at BIGINT;

-- Seed legacy rows so their cloud copy is treated as "fresh" against the
-- equally-zero local copy on the next pull (tie-breaker: cloud wins).
UPDATE public.days
   SET updated_at = COALESCE(updated_at, created_at, 0)
 WHERE updated_at IS NULL;
