/**
 * RBAC — Role-Based Access Control
 * Sistema de roles fixos com permissões hardcoded por módulo.
 * Cada role herda permissões dos roles abaixo na hierarquia.
 */

export type AppRole =
  | 'admin'
  | 'gerente'
  | 'vendedor'
  | 'producao'
  | 'financeiro'
  | 'instalador'
  // legados (compatibilidade)
  | 'partner'
  | 'sales'
  | 'production'
  | 'viewer';

export type Permission =
  // Dashboard / BI
  | 'dashboard.view'
  | 'dashboard.financial'
  // Clientes
  | 'clients.view' | 'clients.create' | 'clients.edit' | 'clients.delete'
  // Orçamentos
  | 'budgets.view' | 'budgets.create' | 'budgets.edit' | 'budgets.delete' | 'budgets.approve'
  // Produção
  | 'production.view' | 'production.edit' | 'production.assign'
  // Assistência
  | 'assistance.view' | 'assistance.edit'
  // Financeiro
  | 'finance.view' | 'finance.create' | 'finance.edit' | 'finance.delete' | 'finance.reports'
  // Gestão / Colaboradores / Catálogo
  | 'management.view' | 'management.employees' | 'management.catalog'
  // Configurações
  | 'settings.view' | 'settings.edit' | 'settings.users';

const ALL: Permission[] = [
  'dashboard.view','dashboard.financial',
  'clients.view','clients.create','clients.edit','clients.delete',
  'budgets.view','budgets.create','budgets.edit','budgets.delete','budgets.approve',
  'production.view','production.edit','production.assign',
  'assistance.view','assistance.edit',
  'finance.view','finance.create','finance.edit','finance.delete','finance.reports',
  'management.view','management.employees','management.catalog',
  'settings.view','settings.edit','settings.users',
];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: ALL,
  gerente: ALL.filter((p) => p !== 'settings.users'),
  partner: ALL.filter((p) => p !== 'settings.users'),
  vendedor: [
    'dashboard.view',
    'clients.view','clients.create','clients.edit',
    'budgets.view','budgets.create','budgets.edit',
    'production.view',
    'assistance.view',
  ],
  sales: [
    'dashboard.view',
    'clients.view','clients.create','clients.edit',
    'budgets.view','budgets.create','budgets.edit',
    'production.view',
    'assistance.view',
  ],
  producao: [
    'dashboard.view',
    'budgets.view',
    'production.view','production.edit','production.assign',
    'assistance.view','assistance.edit',
    'management.view','management.catalog',
  ],
  production: [
    'dashboard.view',
    'budgets.view',
    'production.view','production.edit',
    'assistance.view','assistance.edit',
  ],
  financeiro: [
    'dashboard.view','dashboard.financial',
    'clients.view','budgets.view',
    'finance.view','finance.create','finance.edit','finance.delete','finance.reports',
    'management.view',
  ],
  instalador: [
    'production.view',
    'assistance.view','assistance.edit',
  ],
  viewer: [
    'dashboard.view',
    'clients.view','budgets.view','production.view','assistance.view','finance.view',
  ],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  producao: 'Produção',
  financeiro: 'Financeiro',
  instalador: 'Instalador',
  partner: 'Sócio',
  sales: 'Vendas (legado)',
  production: 'Produção (legado)',
  viewer: 'Visualizador',
};

export function hasPermission(roles: AppRole[] | undefined, perm: Permission): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(perm));
}

export function hasAnyRole(roles: AppRole[] | undefined, allowed: AppRole[]): boolean {
  if (!roles) return false;
  return roles.some((r) => allowed.includes(r));
}
