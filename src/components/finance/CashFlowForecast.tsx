import { useMemo, useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBRL } from '@/lib/format';
import { projectCashFlow, type CashFlowTx } from '@/engines/CashFlowEngine';

interface Props {
  transactions: CashFlowTx[];
  startingBalance: number;
}

export default function CashFlowForecast({ transactions, startingBalance }: Props) {
  const [months, setMonths] = useState(6);
  const rows = useMemo(() => projectCashFlow(transactions, startingBalance, months), [transactions, startingBalance, months]);
  const totalIn = rows.reduce((s, r) => s + r.entradas, 0);
  const totalOut = rows.reduce((s, r) => s + r.saidas, 0);
  const lowest = rows.reduce((m, r) => (r.saldoFinal < m.saldoFinal ? r : m), rows[0]);
  const negative = rows.find((r) => r.saldoFinal < 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Como o seu saldo vai ficar, somando o que vai entrar e sair nos próximos meses.</p>
        <div className="flex gap-1">
          {[3, 6, 12].map((m) => (
            <Button key={m} size="sm" variant={months === m ? 'default' : 'outline'} onClick={() => setMonths(m)}>{m} meses</Button>
          ))}
        </div>
      </div>

      {negative && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm"><span className="font-semibold text-destructive">Atenção:</span> o caixa fica negativo em <b>{negative.label}</b> ({formatBRL(negative.saldoFinal)}). Antecipe recebimentos ou adie pagamentos.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Saldo hoje', v: startingBalance, i: Wallet, c: 'text-primary' },
          { l: 'Vai entrar', v: totalIn, i: TrendingUp, c: 'text-success' },
          { l: 'Vai sair', v: totalOut, i: TrendingDown, c: 'text-destructive' },
          { l: `Saldo em ${rows[rows.length - 1]?.label ?? ''}`, v: rows[rows.length - 1]?.saldoFinal ?? 0, i: Wallet, c: (rows[rows.length - 1]?.saldoFinal ?? 0) >= 0 ? 'text-success' : 'text-destructive' },
        ].map((k) => (
          <Card key={k.l}><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><k.i className="h-4 w-4" />{k.l}</div>
            <p className={`text-lg sm:text-xl font-bold mt-1 ${k.c}`}>{formatBRL(k.v)}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Entradas, saídas e saldo previsto</CardTitle></CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Line dataKey="saldoFinal" name="Saldo previsto" stroke="hsl(var(--primary))" strokeWidth={2.5} dot />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr><th className="text-left p-3">Mês</th><th className="text-right p-3">Saldo inicial</th><th className="text-right p-3">Entradas</th><th className="text-right p-3">Saídas</th><th className="text-right p-3">Saldo final</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={`border-t border-border/50 ${r.key === lowest?.key ? 'bg-warning/5' : ''}`}>
                  <td className="p-3 font-medium capitalize">{r.label}</td>
                  <td className="p-3 text-right">{formatBRL(r.saldoInicial)}</td>
                  <td className="p-3 text-right text-success">{formatBRL(r.entradas)}</td>
                  <td className="p-3 text-right text-destructive">{formatBRL(r.saidas)}</td>
                  <td className={`p-3 text-right font-semibold ${r.saldoFinal >= 0 ? '' : 'text-destructive'}`}>{formatBRL(r.saldoFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Contas vencidas e não pagas aparecem no mês atual. Recebimentos parciais contam apenas o valor que falta.</p>
    </div>
  );
}
