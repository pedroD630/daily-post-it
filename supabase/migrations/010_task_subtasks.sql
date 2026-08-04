-- Composite tasks: a checklist of micro-steps stored on each task.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS subtasks JSONB;
