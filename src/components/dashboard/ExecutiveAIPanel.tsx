import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Lightbulb, Target, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCompany } from '@/hooks/useCurrentCompany';
import { toast } from 'sonner';

export interface ExecutiveMetrics {
  period_label: string;
  revenue: number;
  fixed_expenses: number;
  variable_expenses: number;
  total_expenses: number;
  profit: number;
  margin_percent: number;
  cash_balance: number;
  overdue_receivables: number;
  overdue_count: number;
  active_projects: number;
  delivered_projects: number;
  pending_assistance: number;
  break_even: number;
  monthly_goal: number;
  top_clients: Array<{ name: string; revenue: number }>;
  top_expense_categories: Array<{ category: string; amount: number }>;
}

interface AIResult {
  score: number;
  health_label: string;
  summary: string;
  insights: Array<{ title: string; message: string; severity: 'danger' | 'warning' | 'info' | 'success' }>;
  recommendations: Array<{ title: string; action: string; priority: 'alta' | 'média' | 'baixa' }>;
  alerts: Array<{ title: string; detail: string }>;
  model?: string;
}

const severityColor: Record<string, string> = {
  danger: 'border-l-destructive bg-destructive/5 text-destructive',
  warning: 'border-l-warning bg-warning/5 text-warning',
  info: 'border-l-info bg-info/5 text-info',
  success: 'border-l-success bg-success/5 text-success',
};

const priorityColor: Record<string, string> = {
  alta: 'bg-destructive/15 text-destructive border-destructive/30',
  'média': 'bg-warning/15 text-warning border-warning/30',
  baixa: 'bg-info/15 text-info border-info/30',
};

function scoreColor(score: number) {
  if (score >= 75) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-destructive';
}

function scoreRing(score: number) {
  if (score >= 75) return 'stroke-success';
  if (score >= 50) return 'stroke-warning';
  return 'stroke-destructive';
}

interface Props {
  metrics: ExecutiveMetrics;
}

export default function ExecutiveAIPanel({ metrics }: Props) {
  const { user } = useAuth();
  const { company } = useCurrentCompany();
  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(null);

  const metricsKey = useMemo(
    () => `${metrics.period_label}|${metrics.revenue}|${metrics.profit}|${metrics.cash_balance}`,
    [metrics.period_label, metrics.revenue, metrics.profit, metrics.cash_balance]
  );

  // Carrega última análise salva ao montar
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('ai_insights' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const d: any = data;
        setResult({
          score: d.score,
          health_label: d.health_label ?? '',
          summary: d.summary ?? '',
          insights: d.insights ?? [],
          recommendations: d.recommendations ?? [],
          alerts: d.alerts ?? [],
          model: d.model,
        });
        setLastAt(d.created_at);
      }
    })();
  }, [user?.id]);

  const runAnalysis = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const payload = { metrics: { ...metrics, company_name: company?.name } };
      const { data, error } = await supabase.functions.invoke('ai-executive-advisor', { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const ai = data as AIResult;
      setResult(ai);
      setLastAt(new Date().toISOString());

      // Persiste no histórico
      await supabase.from('ai_insights' as any).insert({
        user_id: user.id,
        scope: 'monthly',
        score: ai.score,
        health_label: ai.health_label,
        summary: ai.summary,
        insights: ai.insights,
        recommendations: ai.recommendations,
        alerts: ai.alerts,
        model: ai.model,
        metrics_snapshot: metrics,
      });

      toast.success('Análise executiva atualizada');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? 'Falha ao gerar análise da IA');
    } finally {
      setLoading(false);
    }
  };

  const score = result?.score ?? 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="card-premium overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Consultor Executivo (IA)
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            {lastAt
              ? `Última análise: ${new Date(lastAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
              : 'Gere sua primeira análise estratégica do período'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={runAnalysis} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          {result ? 'Reanalisar' : 'Analisar agora'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {!result && !loading && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Clique em <span className="font-semibold">"Analisar agora"</span> para gerar um diagnóstico estratégico baseado em IA.
          </div>
        )}

        {result && (
          <>
            {/* Score + Resumo */}
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" className="fill-none stroke-muted" strokeWidth="8" />
                  <motion.circle
                    cx="50" cy="50" r="42"
                    className={`fill-none ${scoreRing(score)}`}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold font-display tabular-nums ${scoreColor(score)}`}>{score}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">de 100</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <Badge variant="outline" className={`${scoreColor(score)} border-current`}>
                  {result.health_label}
                </Badge>
                <p className="text-sm font-medium leading-relaxed text-foreground">{result.summary}</p>
              </div>
            </div>

            {/* Insights */}
            {result.insights.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Diagnóstico
                </p>
                <div className="space-y-2">
                  {result.insights.map((ins, i) => (
                    <div key={i} className={`rounded-lg border-l-4 p-3 ${severityColor[ins.severity] ?? severityColor.info}`}>
                      <p className="text-sm font-semibold">{ins.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ins.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendações */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Recomendações estratégicas
                </p>
                <div className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="rounded-lg border bg-accent/30 p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{r.title}</p>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${priorityColor[r.priority] ?? ''}`}>
                          {r.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alertas */}
            {result.alerts.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-destructive mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alertas críticos
                </p>
                <div className="space-y-2">
                  {result.alerts.map((a, i) => (
                    <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-sm font-semibold text-destructive">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {loading && !result && (
          <div className="flex items-center justify-center py-8 gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando indicadores da empresa...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
