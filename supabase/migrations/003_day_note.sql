-- Free-form scratchpad note per day.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.days ADD COLUMN IF NOT EXISTS note TEXT;
