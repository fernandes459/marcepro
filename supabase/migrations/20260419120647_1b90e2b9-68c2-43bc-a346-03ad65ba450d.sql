ALTER TABLE public.production_tasks
DROP CONSTRAINT IF EXISTS production_tasks_stage_check;

ALTER TABLE public.production_tasks
ADD CONSTRAINT production_tasks_stage_check
CHECK (stage IN ('corte', 'borda', 'usinagem', 'montagem', 'entregue', 'assistencia'));