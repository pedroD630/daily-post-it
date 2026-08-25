-- Per-task sync metadata. Fixes the data-loss bug where syncing deleted
-- tasks that simply weren't present on the pushing device.
--
-- `updated_at` lets two devices editing different tasks on the same day
-- merge instead of one overwriting the other's whole task list.
-- `deleted` is the tombstone: a task is now only ever removed because it
-- carries this flag, never because a device didn't have it.
--
-- Run once in Supabase SQL Editor.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at BIGINT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing rows: seed updated_at from the parent day so they aren't treated
-- as infinitely stale on the first merge after deploy.
UPDATE public.tasks t
SET updated_at = COALESCE(d.updated_at, t.created_at, 0)
FROM public.days d
WHERE t.day_id = d.id
  AND t.user_id = d.user_id
  AND t.updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_day_user ON public.tasks (day_id, user_id);
