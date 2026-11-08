import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { registrarPagamento, getSaldoAberto } from './ReceivablesEngine';

describe('Recebimentos seguros', () => {
  beforeEach(() => rpc.mockReset());
  it('Repetir uma tentativa mantém a mesma identificação, sem novo lançamento', async () => {
    rpc.mockResolvedValue({ data: { history_id: 'receipt', saldo_aberto: 4503.88, valor_recebido: 4300, status: 'parcial' }, error: null });
    const input = { transactionId: 'tx', valor: 4300, data: '2026-09-21', requestId: 'same-request' };
    await registrarPagamento(input);
    await registrarPagamento(input);
    expect(rpc).toHaveBeenNthCalledWith(1, 'registrar_pagamento_seguro', expect.objectContaining({ _request_id: 'same-request', _valor: 4300 }));
    expect(rpc.mock.calls[1][1]._request_id).toBe(rpc.mock.calls[0][1]._request_id);
  });
  it('Erro do servidor nunca retorna sucesso', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('Valor excede o saldo em aberto') });
    await expect(registrarPagamento({ transactionId: 'tx', valor: 9000 })).rejects.toThrow('Valor excede');
  });
  it('Saldo parcial usa saldo restante, e quitado usa zero', () => {
    expect(getSaldoAberto({ amount: 8803.88, saldo_aberto: 4503.88, status: 'parcial' })).toBe(4503.88);
    expect(getSaldoAberto({ amount: 8803.88, status: 'paid' })).toBe(0);
  });
});