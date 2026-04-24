/**
 * Local (deterministic) pricing tier calculator.
 * - Minimum  = cost + minMargin%
 * - Ideal    = cost + defaultMargin%
 * - Premium  = cost + (defaultMargin + 20)%
 */
export interface PricingTiers {
  minimum: number;
  ideal: number;
  premium: number;
}

export function calculateLocalTiers(
  totalCost: number,
  defaultMargin: number,
  minMargin: number,
): PricingTiers {
  const cost = Math.max(0, totalCost);
  const minPct = Math.max(0, minMargin) / 100;
  const idealPct = Math.max(minPct, defaultMargin / 100);
  const premiumPct = idealPct + 0.2;
  return {
    minimum: cost * (1 + minPct),
    ideal: cost * (1 + idealPct),
    premium: cost * (1 + premiumPct),
  };
}

export function marginPct(price: number, cost: number) {
  if (cost <= 0) return 0;
  return ((price - cost) / cost) * 100;
}
