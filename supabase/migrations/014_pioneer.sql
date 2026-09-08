-- Módulo Pioneiro: saídas de campo, relatórios emitidos, estudos bíblicos
-- e o nome do relator. O cronômetro em andamento NÃO fica aqui — ele é
-- local ao aparelho que o iniciou, de propósito.
--
-- Deletion is expressed by the `deleted` tombstone, never by absence, so a
-- device that simply hasn't heard about a record can't erase it.
--
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.field_entries (
  id          TEXT PRIMARY KEY,          -- crypto.randomUUID(), globally unique
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,             -- "YYYY-MM-DD"
  minutes     INTEGER NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual',
  updated_at  BIGINT,
  deleted     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_field_entries_user ON public.field_entries (user_id);

-- id is "YYYY-MM", which repeats across users, so the key is (user_id, id).
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  user_id       TEXT NOT NULL,
  id            TEXT NOT NULL,
  service_year  TEXT NOT NULL DEFAULT '',
  total_minutes INTEGER NOT NULL DEFAULT 0,
  bible_studies INTEGER NOT NULL DEFAULT 0,
  participated  BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT NOT NULL DEFAULT '',
  generated_at  BIGINT NOT NULL,
  updated_at    BIGINT,
  deleted       BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.bible_studies (
  user_id    TEXT NOT NULL,
  id         TEXT NOT NULL,              -- "YYYY-MM"
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at BIGINT,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.pioneer_profile (
  user_id       TEXT PRIMARY KEY,
  reporter_name TEXT NOT NULL DEFAULT '',
  updated_at    BIGINT
);

ALTER TABLE public.field_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_studies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pioneer_profile ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['field_entries','monthly_reports','bible_studies','pioneer_profile']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_own', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (user_id = auth.jwt() ->> ''sub'')',
      t || '_select_own', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = auth.jwt() ->> ''sub'')',
      t || '_insert_own', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (user_id = auth.jwt() ->> ''sub'') WITH CHECK (user_id = auth.jwt() ->> ''sub'')',
      t || '_update_own', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (user_id = auth.jwt() ->> ''sub'')',
      t || '_delete_own', t);
  END LOOP;
END $$;
