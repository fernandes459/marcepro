CREATE OR REPLACE FUNCTION public.can_write_finance() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','gerente','financeiro')) $$;
REVOKE ALL ON FUNCTION public.can_write_finance() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_write_finance() TO authenticated;
ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS recorded_by uuid;
ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS request_id uuid;
COMMENT ON COLUMN public.payment_history.recorded_by IS 'Authenticated operator for new payments; historical records remain unknown.';
CREATE UNIQUE INDEX IF NOT EXISTS payment_history_request_id_unique ON public.payment_history(request_id) WHERE request_id IS NOT NULL;
REVOKE INSERT,UPDATE,DELETE ON public.payment_history FROM authenticated,anon;
CREATE OR REPLACE FUNCTION public.preserve_payment_history() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Histórico de pagamentos é imutável'; END $$;
CREATE TRIGGER preserve_payment_history BEFORE UPDATE OR DELETE ON public.payment_history FOR EACH ROW EXECUTE FUNCTION public.preserve_payment_history();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['financial_transactions','bank_accounts','bank_transfers','payment_milestones','collaborator_work_logs','operational_costs','financial_categories'] LOOP
EXECUTE format('CREATE POLICY finance_write_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_write_finance())',t);
EXECUTE format('CREATE POLICY finance_write_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_write_finance()) WITH CHECK (public.can_write_finance())',t);
EXECUTE format('CREATE POLICY finance_write_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_write_finance())',t);
END LOOP; END $$;