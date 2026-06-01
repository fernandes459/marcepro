import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, History, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencyInput } from '@/components/CurrencyInput';
import { formatBRL } from '@/lib/format';
import { registrarPagamento, fetchPaymentHistory, getSaldoAberto, PaymentHistoryRow } from '@/engines/ReceivablesEngine';

interface TxLite {
  id: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  valor_recebido?: number | null;
  saldo_aberto?: number | null;
  payment_method?: string | null;
}

interface BankAccount { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction: TxLite | null;
  bankAccounts?: BankAccount[];
  onSaved?: () => void;
}

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Transferência', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Cheque'];

export default function PartialPaymentDialog({ open, onOpenChange, transaction, bankAccounts = [], onSaved }: Props) {
  const isIncome = transaction?.type === 'income';
  const saldoAtual = useMemo(() => transaction ? getSaldoAberto(transaction) : 0, [transaction]);
  const totalOriginal = Number(transaction?.amount || 0);
  const jaRecebido = Number(transaction?.valor_recebido || 0);

  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState<string>('');
  const [bankId, setBankId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<PaymentHistoryRow[]>([]);
  const [quick, setQuick] = useState<'full' | 'half' | 'custom'>('full');

  useEffect(() => {
    if (open && transaction) {
      setValor(saldoAtual);
      setData(new Date().toISOString().slice(0, 10));
      setForma(transaction.payment_method || '');
      setBankId('');
      setNotes('');
      setQuick('full');
      fetchPaymentHistory(transaction.id).then(setHistory).catch(() => setHistory([]));
    }
  }, [open, transaction, saldoAtual]);

  function applyQuick(q: 'full' | 'half' | 'custom') {
    setQuick(q);
    if (q === 'full') setValor(saldoAtual);
    else if (q === 'half') setValor(Math.round((saldoAtual / 2) * 100) / 100);
  }

  async function handleSubmit() {
    if (!transaction) return;
    if (valor <= 0) { toast.error('Informe um valor maior que zero'); return; }
    if (valor > saldoAtual + 0.009) { toast.error(`Valor excede o saldo em aberto (${formatBRL(saldoAtual)})`); return; }
    setLoading(true);
    try {
      const res = await registrarPagamento({
        transactionId: transaction.id,
        valor,
        data,
        formaPagamento: forma || null,
        bankAccountId: bankId || null,
        notes: notes || null,
      });
      if (res.status === 'paid') toast.success(`Recebimento total registrado — ${formatBRL(valor)}`);
      else toast.success(`Pagamento parcial registrado — saldo: ${formatBRL(res.saldo_aberto)}`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao registrar pagamento');
    } finally {
      setLoading(false);
    }
  }

  if (!transaction) return null;
  const saldoApos = Math.max(0, saldoAtual - valor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            {isIncome ? 'Registrar recebimento' : 'Registrar pagamento'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{transaction.description}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Original</p>
            <p className="text-xs font-bold">{formatBRL(totalOriginal)}</p>
          </div>
          <div className="bg-success/10 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Já recebido</p>
            <p className="text-xs font-bold text-success">{formatBRL(jaRecebido)}</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">Saldo</p>
            <p className="text-xs font-bold text-warning">{formatBRL(saldoAtual)}</p>
          </div>
        </div>

        <div className="flex gap-1.5">
          <Button size="sm" variant={quick === 'full' ? 'default' : 'outline'} className="flex-1 h-8 text-xs" onClick={() => applyQuick('full')}>Total</Button>
          <Button size="sm" variant={quick === 'half' ? 'default' : 'outline'} className="flex-1 h-8 text-xs" onClick={() => applyQuick('half')}>50%</Button>
          <Button size="sm" variant={quick === 'custom' ? 'default' : 'outline'} className="flex-1 h-8 text-xs" onClick={() => applyQuick('custom')}>Outro</Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Valor</Label>
            <CurrencyInput value={valor} onChange={(v) => { setValor(v); setQuick('custom'); }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Forma</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {bankAccounts.length > 0 && (
            <div>
              <Label className="text-xs">Conta</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Conta bancária (opcional)" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Observação</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" className="h-9 text-sm" />
          </div>
        </div>

        <div className="rounded-lg border p-2.5 bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Saldo após este lançamento</span>
          <Badge className={saldoApos === 0 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}>
            {saldoApos === 0 ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Quitado</> : formatBRL(saldoApos)}
          </Badge>
        </div>

        {history.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-semibold flex items-center gap-1 mb-1.5"><History className="h-3 w-3" /> Histórico ({history.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                    <span>{new Date(h.data + 'T12:00:00').toLocaleDateString('pt-BR')} {h.forma_pagamento && `· ${h.forma_pagamento}`}</span>
                    <span className="font-semibold text-success">{formatBRL(h.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || valor <= 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
