
-- Fix function search path
CREATE OR REPLACE FUNCTION public.generate_budget_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code := 'ORC-' || LPAD(nextval('public.budget_code_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
