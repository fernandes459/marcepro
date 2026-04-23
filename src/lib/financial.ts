export interface FinancialCategoryOption {
  value: string;
  label: string;
  type: 'income' | 'expense';
  isSystem?: boolean;
  color?: string | null;
  sortOrder?: number;
}

export const DEFAULT_EXPENSE_CATEGORIES: FinancialCategoryOption[] = [
  { value: 'material', label: 'Material / Insumos', type: 'expense', isSystem: true, color: 'hsl(var(--warning))', sortOrder: 1 },
  { value: 'labor', label: 'Mão de Obra', type: 'expense', isSystem: true, color: 'hsl(var(--info))', sortOrder: 2 },
  { value: 'commission', label: 'Comissão', type: 'expense', isSystem: true, color: 'hsl(var(--accent-foreground))', sortOrder: 3 },
  { value: 'rent', label: 'Aluguel', type: 'expense', isSystem: true, color: 'hsl(var(--muted-foreground))', sortOrder: 4 },
  { value: 'salary', label: 'Salários / Funcionários', type: 'expense', isSystem: true, color: 'hsl(var(--primary))', sortOrder: 5 },
  { value: 'fuel', label: 'Combustível', type: 'expense', isSystem: true, color: 'hsl(var(--destructive))', sortOrder: 6 },
  { value: 'food', label: 'Alimentação', type: 'expense', isSystem: true, color: 'hsl(var(--secondary-foreground))', sortOrder: 7 },
  { value: 'tools', label: 'Ferramentas / Equipamentos', type: 'expense', isSystem: true, color: 'hsl(var(--primary))', sortOrder: 8 },
  { value: 'maintenance', label: 'Manutenção', type: 'expense', isSystem: true, color: 'hsl(var(--warning))', sortOrder: 9 },
  { value: 'taxes', label: 'Impostos / Taxas', type: 'expense', isSystem: true, color: 'hsl(var(--destructive))', sortOrder: 10 },
  { value: 'utilities', label: 'Água / Luz / Internet', type: 'expense', isSystem: true, color: 'hsl(var(--info))', sortOrder: 11 },
  { value: 'transport', label: 'Transporte / Frete', type: 'expense', isSystem: true, color: 'hsl(var(--warning))', sortOrder: 12 },
  { value: 'marketing', label: 'Marketing', type: 'expense', isSystem: true, color: 'hsl(var(--accent-foreground))', sortOrder: 13 },
  { value: 'other_expense', label: 'Outras Despesas', type: 'expense', isSystem: true, color: 'hsl(var(--muted-foreground))', sortOrder: 14 },
];

export const DEFAULT_INCOME_CATEGORIES: FinancialCategoryOption[] = [
  { value: 'project', label: 'Projeto / Orçamento', type: 'income', isSystem: true, color: 'hsl(var(--success))', sortOrder: 1 },
  { value: 'installment', label: 'Parcela de Projeto', type: 'income', isSystem: true, color: 'hsl(var(--primary))', sortOrder: 2 },
  { value: 'service', label: 'Serviço Avulso', type: 'income', isSystem: true, color: 'hsl(var(--info))', sortOrder: 3 },
  { value: 'other_income', label: 'Outras Receitas', type: 'income', isSystem: true, color: 'hsl(var(--accent-foreground))', sortOrder: 4 },
];

export const DEFAULT_FINANCIAL_CATEGORIES = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
];

export function slugifyCategory(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function mergeFinancialCategories(custom: FinancialCategoryOption[] = []) {
  const map = new Map<string, FinancialCategoryOption>();

  for (const category of DEFAULT_FINANCIAL_CATEGORIES) {
    map.set(`${category.type}:${category.value}`, category);
  }

  for (const category of custom) {
    map.set(`${category.type}:${category.value}`, {
      ...map.get(`${category.type}:${category.value}`),
      ...category,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return a.label.localeCompare(b.label, 'pt-BR');
  });
}

export function getCategoryLabel(categories: FinancialCategoryOption[], value: string) {
  return categories.find((category) => category.value === value)?.label || value;
}