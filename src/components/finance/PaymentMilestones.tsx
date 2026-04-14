import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, CheckCircle2, Clock, Milestone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/format';
import { CurrencyInput } from '@/components/CurrencyInput';

interface PaymentMilestone {
  id: string;
  budget_id: string;
  title: string;
  percentage: number;
  amount: number;
  production_stage: string | null;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  sort_order: number;
}

interface Props {
  budgetId: string;
  finalPrice: number;
  onMilestonesChange?: () => void;
}

const PRODUCTION_STAGES = [
  { value: 'corte', label: 'Corte' },
  { value: 'usinagem', label: 'Usinagem' },
  { value: 'colagem', label: 'Colagem de Borda' },
  { value: 'furacao', label: 'Furação' },
  { value: 'pintura', label: 'Pintura/Acabamento' },
  { value: 'montagem_interna', label: 'Montagem Interna' },
  { value: 'embalagem', label: 'Embalagem' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'montagem', label: 'Montagem Final' },
];

const PRESETS = [
  { label: '50/50', milestones: [{ title: 'Entrada', pct: 50 }, { title: 'Entrega', pct: 50 }] },
  { label: '40/30/30', milestones: [{ title: 'Entrada', pct: 40 }, { title: 'Início Montagem', pct: 30 }, { title: 'Entrega Final', pct: 30 }] },
  { label: '30/30/20/20', milestones: [{ title: 'Entrada', pct: 30 }, { title: 'Corte Pronto', pct: 30 }, { title: 'Montagem', pct: 20 }, { title: 'Entrega', pct: 20 }] },
];

export default function PaymentMilestones({ budgetId, finalPrice, onMilestonesChange }: Props) {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchMilestones() {
    const { data } = await supabase
      .from('payment_milestones')
      .select('*')
      .eq('budget_id', budgetId)
      .order('sort_order');
    if (data) setMilestones(data as PaymentMilestone[]);
    setLoading(false);
  }

  useEffect(() => { fetchMilestones(); }, [budgetId]);

  async function applyPreset(preset: typeof PRESETS[0]) {
    if (!user) return;
    // Delete existing
    await supabase.from('payment_milestones').delete().eq('budget_id', budgetId);
    // Insert new
    const inserts = preset.milestones.map((m, i) => ({
      budget_id: budgetId,
      user_id: user.id,
      title: m.title,
      percentage: m.pct,
      amount: Math.round((finalPrice * m.pct / 100) * 100) / 100,
      sort_order: i,
      status: 'pending',
    }));
    const { error } = await supabase.from('payment_milestones').insert(inserts as any);
    if (error) { toast.error('Erro ao criar marcos'); return; }
    toast.success(`Marcos ${preset.label} aplicados`);
    fetchMilestones();
    onMilestonesChange?.();
  }

  async function addCustomMilestone() {
    if (!user) return;
    const { error } = await supabase.from('payment_milestones').insert({
      budget_id: budgetId,
      user_id: user.id,
      title: `Marco ${milestones.length + 1}`,
      percentage: 0,
      amount: 0,
      sort_order: milestones.length,
      status: 'pending',
    } as any);
    if (error) { toast.error('Erro ao adicionar'); return; }
    fetchMilestones();
  }

  async function updateMilestone(id: string, updates: Partial<PaymentMilestone>) {
    await supabase.from('payment_milestones').update(updates as any).eq('id', id);
    fetchMilestones();
    onMilestonesChange?.();
  }

  async function deleteMilestone(id: string) {
    await supabase.from('payment_milestones').delete().eq('id', id);
    fetchMilestones();
    onMilestonesChange?.();
  }

  async function markPaid(id: string) {
    await supabase.from('payment_milestones').update({
      status: 'paid',
      paid_date: new Date().toISOString().slice(0, 10),
    } as any).eq('id', id);
    toast.success('Marco marcado como pago');
    fetchMilestones();
    onMilestonesChange?.();
  }

  const paidCount = milestones.filter(m => m.status === 'paid').length;
  const paidAmount = milestones.filter(m => m.status === 'paid').reduce((s, m) => s + Number(m.amount), 0);
  const totalPct = milestones.reduce((s, m) => s + Number(m.percentage), 0);
  const progressPct = milestones.length > 0 ? (paidCount / milestones.length) * 100 : 0;

  if (loading) return <div className="text-sm text-muted-foreground py-4">Carregando marcos...</div>;

  return (
    <div className="space-y-4">
      {/* Progress */}
      {milestones.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Progresso de Pagamento</span>
              <span className="text-xs font-bold">{paidCount}/{milestones.length} marcos</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-success font-medium">Recebido: {formatBRL(paidAmount)}</span>
              <span className="text-xs text-muted-foreground">Total: {formatBRL(finalPrice)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Presets */}
      {milestones.length === 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Cronograma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Escolha um modelo ou crie marcos personalizados:</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <Button key={p.label} variant="outline" size="sm" className="text-xs" onClick={() => applyPreset(p)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestones list */}
      {milestones.map((ms, idx) => (
        <Card key={ms.id} className={`border-l-4 ${ms.status === 'paid' ? 'border-l-success/50 bg-success/5' : 'border-l-warning/50'}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {ms.status === 'paid' ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Clock className="h-4 w-4 text-warning" />
                )}
                <Badge variant="outline" className="text-[10px]">
                  Marco {idx + 1}
                </Badge>
                {ms.status === 'paid' && (
                  <Badge className="bg-success/10 text-success text-[10px]">Pago</Badge>
                )}
              </div>
              <div className="flex gap-1">
                {ms.status !== 'paid' && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => markPaid(ms.id)}>
                    Confirmar Pgto
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMilestone(ms.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Título</Label>
                <Input
                  value={ms.title}
                  onChange={e => updateMilestone(ms.id, { title: e.target.value })}
                  className="h-8 text-xs"
                  disabled={ms.status === 'paid'}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">% do Total</Label>
                <Input
                  type="number"
                  value={ms.percentage}
                  onChange={e => {
                    const pct = Number(e.target.value);
                    updateMilestone(ms.id, {
                      percentage: pct,
                      amount: Math.round((finalPrice * pct / 100) * 100) / 100,
                    });
                  }}
                  className="h-8 text-xs"
                  disabled={ms.status === 'paid'}
                  min={0} max={100}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Valor</Label>
                <p className="text-sm font-bold font-display">{formatBRL(ms.amount)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Fase Produção</Label>
                <Select
                  value={ms.production_stage || ''}
                  onValueChange={v => updateMilestone(ms.id, { production_stage: v })}
                  disabled={ms.status === 'paid'}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vincular" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_STAGES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {ms.paid_date && (
              <p className="text-[10px] text-muted-foreground">
                Pago em {new Date(ms.paid_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add button */}
      {milestones.length > 0 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="text-xs" onClick={addCustomMilestone}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Marco
          </Button>
          {totalPct !== 100 && (
            <span className="text-xs text-warning font-medium">⚠ Total: {totalPct.toFixed(0)}% (deve ser 100%)</span>
          )}
        </div>
      )}
    </div>
  );
}
