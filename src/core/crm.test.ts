import { describe, it, expect } from 'vitest';
import { normalizeBrPhone, formatBrPhone, samePhone, findMatchingClient, isOpenStage, LEAD_STAGES } from './crm';

describe('normalizeBrPhone', () => {
  it('remove máscara e DDI 55', () => {
    expect(normalizeBrPhone('+55 (11) 98765-4321')).toBe('11987654321');
    expect(normalizeBrPhone('5511987654321')).toBe('11987654321');
  });
  it('aceita fixo com 10 dígitos', () => {
    expect(normalizeBrPhone('(11) 3333-4444')).toBe('1133334444');
  });
  it('remove zero do DDD', () => {
    expect(normalizeBrPhone('011 3333-4444')).toBe('1133334444');
  });
  it('rejeita números curtos ou vazios', () => {
    expect(normalizeBrPhone('98765')).toBeNull();
    expect(normalizeBrPhone('')).toBeNull();
    expect(normalizeBrPhone(null)).toBeNull();
  });
});

describe('formatBrPhone', () => {
  it('formata celular e fixo', () => {
    expect(formatBrPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatBrPhone('1133334444')).toBe('(11) 3333-4444');
  });
});

describe('duplicidade de cliente', () => {
  const clients = [
    { id: 'a', name: 'Ana', phone: '(11) 98765-4321', email: null },
    { id: 'b', name: 'Bruno', phone: null, email: 'Bruno@Mail.com' },
    { id: 'c', name: 'Ana', phone: '(21) 91111-2222', email: null },
  ];
  it('telefones com formatos diferentes são o mesmo contato', () => {
    expect(samePhone('+55 11 98765-4321', '11987654321')).toBe(true);
  });
  it('encontra cliente pelo telefone', () => {
    expect(findMatchingClient(clients, { phone: '5511987654321', email: null })?.id).toBe('a');
  });
  it('encontra cliente pelo e-mail sem diferenciar maiúsculas', () => {
    expect(findMatchingClient(clients, { phone: null, email: 'bruno@mail.com ' })?.id).toBe('b');
  });
  it('não junta clientes só pelo nome', () => {
    expect(findMatchingClient(clients, { phone: '(31) 90000-0000', email: null })).toBeNull();
  });
});

describe('etapas do funil', () => {
  it('tem as 10 etapas comerciais na ordem pedida', () => {
    expect(LEAD_STAGES.map((s) => s.title)).toEqual([
      'Novo lead', 'Primeiro contato', 'Em qualificação', 'Qualificado', 'Visita técnica',
      'Projeto em desenvolvimento', 'Orçamento enviado', 'Negociação', 'Aprovado', 'Perdido',
    ]);
  });
  it('aprovado e perdido encerram a oportunidade', () => {
    expect(isOpenStage('ganho')).toBe(false);
    expect(isOpenStage('perdido')).toBe(false);
    expect(isOpenStage('visita_tecnica')).toBe(true);
  });
});
