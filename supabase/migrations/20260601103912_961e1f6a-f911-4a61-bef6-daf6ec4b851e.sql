-- Onda 2: Recebíveis profissionais (pagamento parcial sem duplicar)

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS valor_original numeric,
  ADD COLUMN IF NOT EXISTS valor_recebido numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_aberto numeric;

-- Backfill: para registros existentes
UPDATE public.financial_transactions
SET valor_original = COALESCE(valor_original, amount),
    valor_recebido = CASE WHEN status = 'paid' THEN amount ELSE COALESCE(valor_recebido, 0) END,
    saldo_aberto   = CASE WHEN status = 'paid' THEN 0 ELSE COALESCE(saldo_aberto, amount) END
WHERE valor_original IS NULL OR saldo_aberto IS NULL;

-- Histórico de pagamentos parciais
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  company_id uuid,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text,
  bank_account_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_history TO authenticated;
GRANT ALL ON public.payment_history TO service_role;

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view payment_history"
  ON public.payment_history FOR SELECT TO authenticated
  USING (can_access_data(auth.uid(), user_id));

CREATE POLICY "Members insert payment_history"
  ON public.payment_history FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR (user_id = get_data_owner_id(auth.uid())));

CREATE POLICY "Members update payment_history"
  ON public.payment_history FOR UPDATE TO authenticated
  USING (can_access_data(auth.uid(), user_id));

CREATE POLICY "Members delete payment_history"
  ON public.payment_history FOR DELETE TO authenticated
  USING (can_access_data(auth.uid(), user_id));

CREATE INDEX IF NOT EXISTS idx_payment_history_tx ON public.payment_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON public.payment_history(user_id);

-- Função: registra pagamento parcial atualizando o título original (NUNCA duplica)
CREATE OR REPLACE FUNCTION public.registrar_pagamento_parcial(
  _transaction_id uuid,
  _valor numeric,
  _data date DEFAULT CURRENT_DATE,
  _forma_pagamento text DEFAULT NULL,
  _bank_account_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.financial_transactions%ROWTYPE;
  v_total_recebido numeric;
  v_saldo numeric;
  v_status text;
  v_history_id uuid;
BEGIN
  SELECT * INTO v_tx FROM public.financial_transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;

  IF NOT can_access_data(auth.uid(), v_tx.user_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF _valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  -- Histórico
  INSERT INTO public.payment_history (
    transaction_id, user_id, company_id, valor, data, forma_pagamento, bank_account_id, notes
  ) VALUES (
    _transaction_id, v_tx.user_id, v_tx.company_id, _valor, _data, _forma_pagamento, _bank_account_id, _notes
  ) RETURNING id INTO v_history_id;

  v_total_recebido := COALESCE(v_tx.valor_recebido, 0) + _valor;
  v_saldo := GREATEST(0, COALESCE(v_tx.valor_original, v_tx.amount) - v_total_recebido);

  IF v_saldo = 0 THEN
    v_status := 'paid';
  ELSIF v_total_recebido > 0 THEN
    v_status := 'parcial';
  ELSE
    v_status := v_tx.status;
  END IF;

  UPDATE public.financial_transactions
  SET valor_recebido = v_total_recebido,
      saldo_aberto = v_saldo,
      status = v_status,
      paid_date = CASE WHEN v_status = 'paid' THEN _data ELSE paid_date END,
      payment_method = COALESCE(_forma_pagamento, payment_method),
      bank_account_id = COALESCE(_bank_account_id, bank_account_id),
      updated_at = now()
  WHERE id = _transaction_id;

  RETURN jsonb_build_object(
    'history_id', v_history_id,
    'status', v_status,
    'valor_recebido', v_total_recebido,
    'saldo_aberto', v_saldo
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_pagamento_parcial(uuid, numeric, date, text, uuid, text) TO authenticated;

-- Trigger: marca como overdue automaticamente em SELECT? Não. Deixamos UI ler due_date + status.
-- Mas garantimos que ao mudar status para 'pending' com saldo, mantenha saldo_aberto coerente.
CREATE OR REPLACE FUNCTION public.sync_transaction_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.valor_original IS NULL THEN
    NEW.valor_original := NEW.amount;
  END IF;
  IF NEW.saldo_aberto IS NULL THEN
    NEW.saldo_aberto := CASE WHEN NEW.status = 'paid' THEN 0 ELSE NEW.amount END;
  END IF;
  IF NEW.status = 'paid' AND (NEW.valor_recebido IS NULL OR NEW.valor_recebido = 0) THEN
    NEW.valor_recebido := NEW.amount;
    NEW.saldo_aberto := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_transaction_balance ON public.financial_transactions;
CREATE TRIGGER trg_sync_transaction_balance
  BEFORE INSERT OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_balance();
