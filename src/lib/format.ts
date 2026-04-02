/**
 * Format a number as Brazilian Real currency (R$ 50.000,00)
 */
export function formatBRL(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Parse a BRL formatted string back to number
 */
export function parseBRL(value: string): number {
  const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Format a number input as currency while typing
 */
export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  const num = parseInt(digits || '0', 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
