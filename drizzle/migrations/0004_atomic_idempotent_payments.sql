CREATE OR REPLACE FUNCTION public.registrar_pagamento_seguro(_transaction_id uuid,_valor numeric,_data date DEFAULT CURRENT_DATE,_forma_pagamento text DEFAULT NULL,_bank_account_id uuid DEFAULT NULL,_notes text DEFAULT NULL,_request_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tx public.financial_transactions%ROWTYPE; h public.payment_history%ROWTYPE; v_total numeric; v_saldo numeric; v_status text; v_id uuid; v_bank uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_write_finance() THEN RAISE EXCEPTION 'Sem permissão para registrar pagamentos'; END IF;
 SELECT * INTO v_tx FROM public.financial_transactions WHERE id=_transaction_id FOR UPDATE;
 IF NOT FOUND OR NOT public.can_access_data(auth.uid(),v_tx.user_id) THEN RAISE EXCEPTION 'Transação não encontrada ou sem permissão'; END IF;
 IF _request_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(_request_id::text,0));
  SELECT * INTO h FROM public.payment_history WHERE request_id=_request_id;
  IF FOUND THEN
   IF h.transaction_id IS DISTINCT FROM _transaction_id OR h.recorded_by IS DISTINCT FROM auth.uid() OR h.valor IS DISTINCT FROM _valor OR h.data IS DISTINCT FROM _data OR h.forma_pagamento IS DISTINCT FROM _forma_pagamento OR h.notes IS DISTINCT FROM _notes OR h.bank_account_id IS DISTINCT FROM COALESCE(_bank_account_id,v_tx.bank_account_id) THEN RAISE EXCEPTION 'Identificador de pagamento já utilizado com outros dados'; END IF;
   RETURN jsonb_build_object('history_id',h.id,'status',v_tx.status,'valor_recebido',v_tx.valor_recebido,'saldo_aberto',v_tx.saldo_aberto);
  END IF;
 END IF;
 IF _valor IS NULL OR _valor::text IN ('NaN','Infinity','-Infinity') OR _valor<=0 OR _valor<>round(_valor,2) THEN RAISE EXCEPTION 'Informe um valor positivo com até duas casas decimais'; END IF;
 IF _data IS NULL THEN RAISE EXCEPTION 'Data obrigatória'; END IF;
 IF length(COALESCE(_forma_pagamento,''))>100 OR length(COALESCE(_notes,''))>2000 THEN RAISE EXCEPTION 'Dados do pagamento muito longos'; END IF;
 IF v_tx.status IN ('cancelled','paid') THEN RAISE EXCEPTION 'Lançamento cancelado ou já quitado'; END IF;
 v_saldo:=COALESCE(v_tx.valor_original,v_tx.amount)-COALESCE(v_tx.valor_recebido,0);
 IF _valor>v_saldo THEN RAISE EXCEPTION 'Valor excede o saldo em aberto'; END IF;
 v_bank:=COALESCE(_bank_account_id,v_tx.bank_account_id);
 IF v_bank IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bank_accounts WHERE id=v_bank AND public.can_access_data(auth.uid(),user_id) AND user_id=v_tx.user_id AND company_id IS NOT DISTINCT FROM v_tx.company_id) THEN RAISE EXCEPTION 'Conta bancária não pertence à empresa do lançamento'; END IF;
 INSERT INTO public.payment_history(transaction_id,user_id,company_id,valor,data,forma_pagamento,bank_account_id,notes,recorded_by,request_id) VALUES(_transaction_id,v_tx.user_id,v_tx.company_id,_valor,_data,_forma_pagamento,v_bank,_notes,auth.uid(),_request_id) RETURNING id INTO v_id;
 v_total:=COALESCE(v_tx.valor_recebido,0)+_valor; v_saldo:=COALESCE(v_tx.valor_original,v_tx.amount)-v_total;
 v_status:=CASE WHEN v_saldo=0 THEN 'paid' ELSE 'parcial' END;
 UPDATE public.financial_transactions SET valor_recebido=v_total,saldo_aberto=v_saldo,status=v_status,paid_date=CASE WHEN v_status='paid' THEN _data ELSE paid_date END,payment_method=COALESCE(_forma_pagamento,payment_method),bank_account_id=v_bank,updated_at=now() WHERE id=_transaction_id;
 RETURN jsonb_build_object('history_id',v_id,'status',v_status,'valor_recebido',v_total,'saldo_aberto',v_saldo);
END $$;
REVOKE ALL ON FUNCTION public.registrar_pagamento_seguro(uuid,numeric,date,text,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_seguro(uuid,numeric,date,text,uuid,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.registrar_pagamento_parcial(_transaction_id uuid,_valor numeric,_data date DEFAULT CURRENT_DATE,_forma_pagamento text DEFAULT NULL,_bank_account_id uuid DEFAULT NULL,_notes text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.registrar_pagamento_seguro(_transaction_id,_valor,_data,_forma_pagamento,_bank_account_id,_notes,NULL) $$;
REVOKE ALL ON FUNCTION public.registrar_pagamento_parcial(uuid,numeric,date,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_parcial(uuid,numeric,date,text,uuid,text) TO authenticated;