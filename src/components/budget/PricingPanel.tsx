import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, AlertTriangle, AlertOctagon, TrendingUp } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PricingPanelProps {
  totalCost: number;
  finalPrice: number;
  margin: number;
  minMargin: number;
  className?: string;
  /** Compact = um card slim, ideal para sticky sidebar / barra mobile */
  compact?: boolean;
}

/**
 * Painel de precificação. Em modo `compact`, vira uma barra fina (uma linha)
 * que cabe na sidebar do orçamento (desktop) ou na barra fixa inferior (mobile).
 */
export function PricingPanel({
  totalCost,
  finalPrice,
  margin,
  minMargin,
  className,
  compact = false,
}: PricingPanelProps) {
  const profit = finalPrice - totalCost;
  const realMarginPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const costPct = finalPrice > 0 ? (totalCost / finalPrice) * 100 : 0;
  const profitPct = 100 - costPct;

  let status: 'safe' | 'warning' | 'risk';
  if (realMarginPct >= minMargin + 10) status = 'safe';
  else if (realMarginPct >= minMargin) status = 'warning';
  else status = 'risk';

  const statusMeta = {
    safe: { label: 'Negócio seguro', icon: ShieldCheck, className: 'bg-success/10 text-success border-success/30' },
    warning: { label: `Margem no limite (${minMargin}%)`, icon: AlertTriangle, className: 'bg-warning/10 text-warning border-warning/30' },
    risk: { label: `Abaixo da margem mínima (${minMargin}%)`, icon: AlertOctagon, className: 'bg-destructive/10 text-destructive border-destructive/30' },
  }[status];

  const StatusIcon = statusMeta.icon;
  const profitColor = status === 'risk' ? 'text-destructive' : 'text-success';

  if (compact) {
    return (
      <div
        className={cn(
          'rounded-xl border bg-card/95 backdrop-blur shadow-md px-3 py-2.5 flex items-center gap-3',
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">Preço final</p>
          <p className="font-display text-lg font-bold leading-tight">{formatBRL(finalPrice)}</p>
        </div>
        <div className="text-right min-w-0">
          <p className="text-[10px] text-muted-foreground leading-none">Custo</p>
          <p className="text-xs font-medium">{formatBRL(totalCost)}</p>
        </div>
        <div className="text-right min-w-0">
          <p className="text-[10px] text-muted-foreground leading-none flex items-center justify-end gap-1">
            <TrendingUp className="h-2.5 w-2.5" /> Lucro
          </p>
          <p className={cn('text-xs font-semibold', profitColor)}>
            {formatBRL(profit)} <span className="opacity-70 font-normal">({realMarginPct.toFixed(0)}%)</span>
          </p>
        </div>
        <div
          className={cn(
            'shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold',
            statusMeta.className,
          )}
          title={statusMeta.label}
        >
          <StatusIcon className="h-3 w-3" />
          <span className="hidden sm:inline">{statusMeta.label}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('border-2 shadow-premium overflow-hidden', className)}>
      <CardContent className="p-5 space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preço Final ao Cliente</p>
          <p className="font-display text-3xl sm:text-4xl font-bold leading-tight text-foreground">{formatBRL(finalPrice)}</p>
        </div>
        <div className="space-y-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-muted-foreground/70 transition-all" style={{ width: `${costPct}%` }} />
            <div
              className={cn('transition-all', status === 'risk' ? 'bg-destructive' : status === 'warning' ? 'bg-warning' : 'bg-success')}
              style={{ width: `${profitPct}%` }}
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
              <p className={cn('font-semibold', profitColor)}>
                {formatBRL(profit)} <span className="text-[10px] font-normal opacity-70">({realMarginPct.toFixed(1)}%)</span>
              </p>
            </div>
          </div>
        </div>
        <div className={cn('inline-flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold', statusMeta.className)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusMeta.label}
        </div>
      </CardContent>
    </Card>
  );
}
