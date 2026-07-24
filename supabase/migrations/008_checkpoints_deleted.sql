-- Soft-delete tombstone for checkpoints so deletions propagate across
-- devices without being resurrected by a bidirectional re-push.
-- Run once in Supabase SQL Editor (after 007_checkpoints.sql).

ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
