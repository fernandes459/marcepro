-- Adicionar coluna client_description à tabela budgets
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS client_description TEXT;

-- Atualizar os tipos do Supabase (não editar types.ts manualmente - será atualizado automaticamente)