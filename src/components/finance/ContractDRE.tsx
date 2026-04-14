import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Percent } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';

interface ContractDREProps {
  budgetId: string;
  finalPrice: number;
  totalCost: number;
  profitMargin: number;
}

interface Milestone {
  id: string;
  title: string;
  percentage: number;
  amount: number;
  status: string;
  paid_date: string | null;
}

interface LinkedTransaction {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  status: string;
}

export default function ContractDRE({ budgetId, finalPrice, totalCost, profitMargin }: ContractDREProps) {
  const [transactions, setTransactions] = useState<LinkedTransaction[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    async function fetch() {
      const [txRes, msRes] = await Promise.all([
        supabase.from('financial_transactions').select('id, type, category, amount, description, status').eq('budget_id', budgetId),
        supabase.from('payment_milestones').select('id, title, percentage, amount, status, paid_date').eq('budget_id', budgetId),
      ]);
      if (txRes.data) setTransactions(txRes.data as LinkedTransaction[]);
      if (msRes.data) setMilestones(msRes.data as Milestone[]);
    }
    fetch();
  }, [budgetId]);

  const dre = useMemo(() => {
    const receivedIncome = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
    const pendingIncome = transactions.filter(t => t.type === 'income' && t.status !== 'paid').reduce((s, t) => s + Number(t.amount), 0);
    const materialCosts = transactions.filter(t => t.type === 'expense' && t.category === 'material').reduce((s, t) => s + Number(t.amount), 0);
    const laborCosts = transactions.filter(t => t.type === 'expense' && t.category === 'labor').reduce((s, t) => s + Number(t.amount), 0);
    const taxCosts = transactions.filter(t => t.type === 'expense' && t.category === 'taxes').reduce((s, t) => s + Number(t.amount), 0);
    const otherCosts = transactions.filter(t => t.type === 'expense' && !['material', 'labor', 'taxes'].includes(t.category)).reduce((s, t) => s + Number(t.amount), 0);
    const totalRealCosts = materialCosts + laborCosts + taxCosts + otherCosts;
    const realProfit = receivedIncome - totalRealCosts;
    const projectedProfit = finalPrice - totalRealCosts;

    // VPL simples — desconta fluxos futuros a 1.5% a.m.
    const monthlyRate = 0.015;
    const paidMilestones = milestones.filter(m => m.status === 'paid');
    const pendingMilestones = milestones.filter(m => m.status !== 'paid');
    let vpl = paidMilestones.reduce((s, m) => s + Number(m.amount), 0); // já recebido = valor presente
    pendingMilestones.forEach((m, i) => {
      vpl += Number(m.amount) / Math.pow(1 + monthlyRate, i + 1);
    });
    // If no milestones, use simple VPL based on final price
    if (milestones.length === 0) {
      vpl = finalPrice / Math.pow(1 + monthlyRate, 3); // assume 3 months average
    }
    vpl -= totalRealCosts;

    const realMargin = receivedIncome > 0 ? (realProfit / receivedIncome) * 100 : 0;

    return {
      receivedIncome, pendingIncome, materialCosts, laborCosts, taxCosts, otherCosts,
      totalRealCosts, realProfit, projectedProfit, vpl, realMargin,
    };
  }, [transactions, milestones, finalPrice]);

  const healthColor = dre.vpl >= 0 ? 'text-success' : 'text-destructive';
  const healthLabel = dre.vpl >= 0 ? 'Saudável' : 'Atenção';

  return (
    <div className="space-y-4">
      {/* Health indicator */}
      <div className="flex items-center gap-3">
        <Badge className={`${dre.vpl >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'} text-xs`}>
          {healthLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">VPL a 1,5% a.m.</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Valor Contrato', value: formatBRL(finalPrice), icon: DollarSign, color: 'text-primary' },
          { label: 'Recebido', value: formatBRL(dre.receivedIncome), icon: TrendingUp, color: 'text-success' },
          { label: 'Custos Reais', value: formatBRL(dre.totalRealCosts), icon: TrendingDown, color: 'text-destructive' },
          { label: 'VPL', value: formatBRL(dre.vpl), icon: BarChart3, color: healthColor },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-3 text-center">
              <kpi.icon className={`h-4 w-4 mx-auto mb-1 ${kpi.color}`} />
              <p className="text-[10px] text-muted-foreground uppercase">{kpi.label}</p>
              <p className={`text-sm font-bold font-display ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DRE breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display">DRE do Contrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label="Receita Bruta (contrato)" value={formatBRL(finalPrice)} bold color="text-foreground" />
          <Row label="  (+) Recebido" value={formatBRL(dre.receivedIncome)} color="text-success" />
          <Row label="  (+) A Receber" value={formatBRL(dre.pendingIncome)} color="text-warning" />
          <div className="border-t border-border my-2" />
          <Row label="(-) Materiais" value={formatBRL(dre.materialCosts)} color="text-destructive" />
          <Row label="(-) Mão de Obra" value={formatBRL(dre.laborCosts)} color="text-destructive" />
          <Row label="(-) Impostos/Taxas" value={formatBRL(dre.taxCosts)} color="text-destructive" />
          <Row label="(-) Outros Custos" value={formatBRL(dre.otherCosts)} color="text-destructive" />
          <div className="border-t border-border my-2" />
          <Row label="Total Custos Reais" value={formatBRL(dre.totalRealCosts)} bold color="text-destructive" />
          <div className="bg-accent/50 rounded-lg p-3 -mx-1 mt-2">
            <Row label="Lucro Líquido Real" value={formatBRL(dre.realProfit)} bold color={dre.realProfit >= 0 ? 'text-success' : 'text-destructive'} />
            {dre.receivedIncome > 0 && (
              <p className="text-[10px] text-muted-foreground text-right mt-1">Margem real: {dre.realMargin.toFixed(1)}%</p>
            )}
          </div>
          <div className="bg-primary/5 rounded-lg p-3 -mx-1 mt-2">
            <Row label="Lucro Projetado" value={formatBRL(dre.projectedProfit)} bold color={dre.projectedProfit >= 0 ? 'text-success' : 'text-destructive'} />
            <Row label="VPL (Valor Presente Líquido)" value={formatBRL(dre.vpl)} bold color={healthColor} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className={`text-xs ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-xs ${bold ? 'font-bold' : 'font-medium'} ${color || ''}`}>{value}</span>
    </div>
  );
}
