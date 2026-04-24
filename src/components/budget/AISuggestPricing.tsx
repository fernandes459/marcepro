import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calculateLocalTiers, type PricingTiers } from '@/lib/pricing';
import { formatBRL } from '@/lib/format';

interface AISuggestProps {
  totalCost: number;
  defaultMargin: number;
  minMargin: number;
  projectName?: string;
  finishType?: string;
  complexity?: string;
  rooms?: string[];
  onApply: (price: number) => void;
}

export function AISuggestPricing(props: AISuggestProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tiers, setTiers] = useState<PricingTiers | null>(null);
  const [rationale, setRationale] = useState<string>('');
  const [usedAI, setUsedAI] = useState(false);

  const localTiers = calculateLocalTiers(props.totalCost, props.defaultMargin, props.minMargin);

  const openWithLocal = () => {
    setTiers(localTiers);
    setRationale(
      `Sugestão local baseada nas margens configuradas (mínimo ${props.minMargin}% / padrão ${props.defaultMargin}%). Use o botão "Sugerir com IA" para uma análise mais profunda.`,
    );
    setUsedAI(false);
    setOpen(true);
  };

  const fetchAI = async () => {
    if (props.totalCost <= 0) {
      toast.error('Adicione itens ao orçamento antes de usar a IA.');
      return;
    }
    setLoading(true);
    try {
      const { data: history } = await supabase
        .from('budgets')
        .select('final_price, total_cost, status')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data, error } = await supabase.functions.invoke('suggest-pricing', {
        body: {
          totalCost: props.totalCost,
          defaultMargin: props.defaultMargin,
          minMargin: props.minMargin,
          projectName: props.projectName,
          finishType: props.finishType,
          complexity: props.complexity,
          rooms: props.rooms,
          history: history || [],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTiers({
        minimum: Number(data.minimum) || localTiers.minimum,
        ideal: Number(data.ideal) || localTiers.ideal,
        premium: Number(data.premium) || localTiers.premium,
      });
      setRationale(data.rationale || '');
      setUsedAI(true);
      toast.success('Sugestão da IA pronta');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Falha ao consultar IA');
    } finally {
      setLoading(false);
    }
  };

  const apply = (price: number) => {
    props.onApply(price);
    setOpen(false);
    toast.success(`Preço atualizado: ${formatBRL(price)}`);
  };

  const tierCard = (label: string, value: number, tone: 'min' | 'ideal' | 'premium') => {
    const cost = props.totalCost;
    const profit = value - cost;
    const margin = cost > 0 ? (profit / cost) * 100 : 0;
    const styles = {
      min: 'border-warning/40',
      ideal: 'border-primary/60 ring-2 ring-primary/20',
      premium: 'border-success/40',
    }[tone];
    return (
      <Card className={`border-2 ${styles}`}>
        <CardContent className="p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold">{formatBRL(value)}</p>
          <p className="text-xs text-muted-foreground">
            Lucro <span className="font-semibold text-foreground">{formatBRL(profit)}</span> · Margem{' '}
            <span className="font-semibold text-foreground">{margin.toFixed(1)}%</span>
          </p>
          <Button size="sm" className="w-full" variant={tone === 'ideal' ? 'default' : 'outline'} onClick={() => apply(value)}>
            Aplicar este preço
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openWithLocal} className="gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Sugerir preço
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-4 w-4 text-primary" /> Sugestão de Preço
              {usedAI && <span className="text-[10px] uppercase rounded-full bg-primary/10 text-primary px-2 py-0.5">IA</span>}
            </DialogTitle>
          </DialogHeader>

          {tiers && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {tierCard('Mínimo', tiers.minimum, 'min')}
                {tierCard('Ideal', tiers.ideal, 'ideal')}
                {tierCard('Premium', tiers.premium, 'premium')}
              </div>

              {rationale && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {rationale}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Custo base: <span className="font-semibold text-foreground">{formatBRL(props.totalCost)}</span>
                </p>
                <Button onClick={fetchAI} disabled={loading} className="gap-1.5">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Sugerir com IA
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
