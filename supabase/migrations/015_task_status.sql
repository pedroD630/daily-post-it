-- Kanban: a tarefa passa de um booleano para quatro estados.
--
-- A coluna `completed` continua sendo escrita (derivada de status = 'done'),
-- por dois motivos: um aparelho ainda na versão antiga continua lendo dela,
-- e se ESTA migration não for rodada o fallback PGRST204 remove `status` do
-- row e a tarefa ainda sincroniza como feita/não feita, sem perda de dado.
--
-- Run once in Supabase SQL Editor.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status TEXT;

-- Backfill: linhas existentes recebem o estado equivalente ao booleano.
UPDATE public.tasks
SET status = CASE WHEN completed THEN 'done' ELSE 'todo' END
WHERE status IS NULL;
