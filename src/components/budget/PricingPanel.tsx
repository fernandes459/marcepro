import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, AlertTriangle, AlertOctagon, TrendingUp } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PricingPanelProps {
  totalCost: number;
  finalPrice: number;
  margin: number;
  minMargin: number;
  className?: string;
}

/**
 * Premium pricing visualization: shows cost vs profit bar, profit value/% and
 * deal safety status. Used inside the budget form for real-time feedback.
 */
export function PricingPanel({ totalCost, finalPrice, margin, minMargin, className }: PricingPanelProps) {
  const profit = finalPrice - totalCost;
  const realMarginPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const costPct = finalPrice > 0 ? (totalCost / finalPrice) * 100 : 0;
  const profitPct = 100 - costPct;

  // Deal safety status
  let status: 'safe' | 'warning' | 'risk';
  if (realMarginPct >= minMargin + 10) status = 'safe';
  else if (realMarginPct >= minMargin) status = 'warning';
  else status = 'risk';

  const statusMeta = {
    safe: {
      label: 'Negócio Seguro',
      icon: ShieldCheck,
      className: 'bg-success/10 text-success border-success/30',
    },
    warning: {
      label: 'Atenção — Margem no limite',
      icon: AlertTriangle,
      className: 'bg-warning/10 text-warning border-warning/30',
    },
    risk: {
      label: `Risco — Abaixo da margem mínima (${minMargin}%)`,
      icon: AlertOctagon,
      className: 'bg-destructive/10 text-destructive border-destructive/30',
    },
  }[status];

  const StatusIcon = statusMeta.icon;

  return (
    <Card className={cn('border-2 shadow-premium overflow-hidden', className)}>
      <CardContent className="p-5 space-y-4">
        {/* Header — final price */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preço Final ao Cliente
          </p>
          <p className="font-display text-3xl sm:text-4xl font-bold leading-tight text-foreground">
            {formatBRL(finalPrice)}
          </p>
        </div>

        {/* Cost vs Profit bar */}
        <div className="space-y-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="bg-muted-foreground/70 transition-all"
              style={{ width: `${costPct}%` }}
              title={`Custo: ${costPct.toFixed(1)}%`}
            />
            <div
              className={cn(
                'transition-all',
                status === 'risk'
                  ? 'bg-destructive'
                  : status === 'warning'
                    ? 'bg-warning'
                    : 'bg-success',
              )}
              style={{ width: `${profitPct}%` }}
              title={`Lucro: ${profitPct.toFixed(1)}%`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Custo total</p>
              <p className="font-semibold text-foreground">{formatBRL(totalCost)}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground flex items-center justify-end gap-1">
                <TrendingUp className="h-3 w-3" /> Lucro
              </p>
              <p
                className={cn(
                  'font-semibold',
                  status === 'risk' ? 'text-destructive' : 'text-success',
                )}
              >
                {formatBRL(profit)}{' '}
                <span className="text-[10px] font-normal opacity-70">
                  ({realMarginPct.toFixed(1)}%)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Status badge — div instead of Badge to avoid forwardRef warning when wrapped by motion parents */}
        <div
          className={cn(
            'inline-flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold',
            statusMeta.className,
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusMeta.label}
        </div>
      </CardContent>
    </Card>
  );
}
