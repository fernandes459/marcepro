import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, Lightbulb, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { FinancialInsight, InsightSeverity } from '@/hooks/useFinancialInsights';

interface Props {
  insights: FinancialInsight[];
  onAction?: (insight: FinancialInsight) => void;
}

const severityConfig: Record<InsightSeverity, { icon: typeof AlertTriangle; bg: string; border: string; text: string; iconBg: string }> = {
  danger: { icon: AlertTriangle, bg: 'bg-destructive/5', border: 'border-l-destructive', text: 'text-destructive', iconBg: 'bg-destructive/15 text-destructive' },
  warning: { icon: AlertCircle, bg: 'bg-warning/5', border: 'border-l-warning', text: 'text-warning', iconBg: 'bg-warning/15 text-warning' },
  info: { icon: Info, bg: 'bg-info/5', border: 'border-l-info', text: 'text-info', iconBg: 'bg-info/15 text-info' },
  success: { icon: CheckCircle2, bg: 'bg-success/5', border: 'border-l-success', text: 'text-success', iconBg: 'bg-success/15 text-success' },
};

export default function FinancialAdvisor({ insights, onAction }: Props) {
  const sorted = [...insights].sort((a, b) => {
    const order: Record<InsightSeverity, number> = { danger: 0, warning: 1, info: 2, success: 3 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <Card className="card-premium">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Sugestões e críticas financeiras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma análise disponível ainda. Lance algumas movimentações.</p>
        ) : (
          sorted.map((ins, idx) => {
            const cfg = severityConfig[ins.severity];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`flex items-start gap-3 rounded-xl border-l-4 ${cfg.border} ${cfg.bg} p-3`}
              >
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${cfg.text}`}>{ins.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ins.message}</p>
                </div>
                {ins.action && onAction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => onAction(ins)}
                  >
                    {ins.action}
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                )}
              </motion.div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
