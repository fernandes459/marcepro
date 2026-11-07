import { describe, it, expect } from 'vitest';
import { hasPermission, canAccessRoute } from './rbac';

describe('Permissões por perfil', () => {
  it('Sócio pode consultar financeiro, mas não criar, alterar ou excluir', () => {
    expect(hasPermission(['partner'], 'finance.view')).toBe(true);
    for (const p of ['finance.create', 'finance.edit', 'finance.delete'] as const) expect(hasPermission(['partner'], p)).toBe(false);
  });
  it('Produção não acessa financeiro nem configurações', () => {
    expect(canAccessRoute(['production'], '/financeiro')).toBe(false);
    expect(canAccessRoute(['production'], '/configuracoes')).toBe(false);
    expect(canAccessRoute(['production'], '/producao')).toBe(true);
  });
  it('Instalador acessa produção, mas não dashboard comercial', () => {
    expect(canAccessRoute(['instalador'], '/')).toBe(false);
    expect(canAccessRoute(['instalador'], '/producao')).toBe(true);
  });
  it('Administrador mantém acesso e operação financeira', () => {
    expect(canAccessRoute(['admin'], '/crm')).toBe(true);
    expect(hasPermission(['admin'], 'finance.edit')).toBe(true);
  });
  it('Sem perfil não recebe acesso a áreas protegidas', () => {
    expect(canAccessRoute([], '/financeiro')).toBe(false);
  });
});