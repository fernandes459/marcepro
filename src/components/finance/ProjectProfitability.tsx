import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/SearchInput';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeData } from '@/hooks/useRealtimeQuery';
import { formatBRL } from '@/lib/format';
import { isClosed, toCanonicalStatus, STATUS_LABEL } from '@/core/status';

interface Row {
  id: string; code: string; name: string; client: string; status: string;
  contrato: number; custoPrevisto: number; recebido: number; aReceber: number;
  custoReal: number; lucroReal: number; margemReal: number;
}

export default function ProjectProfitability() {
  const [search, setSearch] = useState('');
  const { data, loading } = useRealtimeData<Row[]>(
    ['budgets', 'financial_transactions', 'collaborator_work_logs'],
    async () => {
      const [b, t, w, c] = await Promise.all([
        supabase.from('budgets').select('id, code, project_name, status, final_price, total_cost, client_id'),
        supabase.from('financial_transactions').select('budget_id, type, amount, status, valor_recebido, saldo_aberto').not('budget_id', 'is', null),
        supabase.from('collaborator_work_logs').select('budget_id, total_amount').not('budget_id', 'is', null),
        supabase.from('clients').select('id, name'),
      ]);
      const clients = new Map((c.data ?? []).map((x) => [x.id, x.name]));
      const tx = t.data ?? [];
      const wl = (w.data ?? []) as { budget_id: string; total_amount: number }[];
      return (b.data ?? []).filter((x) => isClosed(x.status)).map((x) => {
        let rec = new Decimal(0), arec = new Decimal(0), cost = new Decimal(0);
        tx.filter((y) => y.budget_id === x.id && y.status !== 'cancelled').forEach((y) => {
          const amt = new Decimal(y.amount || 0);
          if (y.type === 'income') {
            if (y.status === 'paid') rec = rec.plus(amt);
            else {
              rec = rec.plus(y.valor_recebido || 0);
              arec = arec.plus(y.saldo_aberto ?? amt);
            }
          } else if (y.type === 'expense') cost = cost.plus(amt);
        });
        wl.filter((y) => y.budget_id === x.id).forEach((y) => { cost = cost.plus(y.total_amount || 0); });
        const contrato = Number(x.final_price) || 0;
        const lucro = new Decimal(contrato).minus(cost);
        return {
          id: x.id, code: x.code, name: x.project_name || 'Sem nome', client: clients.get(x.client_id ?? '') || '—',
          status: x.status, contrato, custoPrevisto: Number(x.total_cost) || 0,
          recebido: rec.toNumber(), aReceber: arec.toNumber(), custoReal: cost.toNumber(),
          lucroReal: lucro.toNumber(), margemReal: contrato > 0 ? lucro.div(contrato).times(100).toNumber() : 0,
        };
      }).sort((a, b) => b.contrato - a.contrato);
    },
  );

  const rows = useMemo(() => (data ?? []).filter((r) =>
    `${r.code} ${r.name} ${r.client}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const tot = rows.reduce((s, r) => ({ c: s.c + r.contrato, r: s.r + r.recebido, a: s.a + r.aReceber, k: s.k + r.custoReal }), { c: 0, r: 0, a: 0, k: 0 });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Quanto cada obra fechada rendeu: valor do contrato, quanto já entrou, quanto falta e quanto custou de verdade (despesas e mão de obra lançadas na obra).</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Contratos', v: tot.c, cl: 'text-primary' },
          { l: 'Recebido', v: tot.r, cl: 'text-success' },
          { l: 'A receber', v: tot.a, cl: 'text-warning' },
          { l: 'Lucro real', v: tot.c - tot.k, cl: tot.c - tot.k >= 0 ? 'text-success' : 'text-destructive' },
        ].map((k) => (
          <Card key={k.l}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.l}</p>
            <p className={`text-lg sm:text-xl font-bold mt-1 ${k.cl}`}>{formatBRL(k.v)}</p>
          </CardContent></Card>
        ))}
      </div>
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar obra, código ou cliente..." className="max-w-sm" />
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : rows.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma obra fechada ainda.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const pct = r.contrato > 0 ? Math.min(100, (r.recebido / r.contrato) * 100) : 0;
            return (
              <Card key={r.id}><CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{r.code} · {r.client}</p>
                    <p className="font-semibold truncate">{r.name}</p>
                  </div>
                  <Badge variant="outline">{STATUS_LABEL[toCanonicalStatus(r.status)] ?? r.status}</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
                <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% recebido</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Contrato</span><span className="text-right font-medium">{formatBRL(r.contrato)}</span>
                  <span className="text-muted-foreground">Recebido</span><span className="text-right text-success">{formatBRL(r.recebido)}</span>
                  <span className="text-muted-foreground">A receber</span><span className="text-right text-warning">{formatBRL(r.aReceber)}</span>
                  <span className="text-muted-foreground">Custo previsto</span><span className="text-right">{formatBRL(r.custoPrevisto)}</span>
                  <span className="text-muted-foreground">Custo real</span><span className="text-right text-destructive">{formatBRL(r.custoReal)}</span>
                  <span className="text-muted-foreground font-semibold">Lucro real</span>
                  <span className={`text-right font-bold ${r.lucroReal >= 0 ? 'text-success' : 'text-destructive'}`}>{formatBRL(r.lucroReal)} ({r.margemReal.toFixed(1)}%)</span>
                </div>
                {r.custoReal > r.custoPrevisto && r.custoPrevisto > 0 && (
                  <p className="text-xs text-destructive">Custo real passou do previsto em {formatBRL(r.custoReal - r.custoPrevisto)}.</p>
                )}
              </CardContent></Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
