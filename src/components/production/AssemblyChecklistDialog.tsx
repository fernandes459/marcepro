import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AssemblyChecklist = {
  estrutura: boolean;
  portas: boolean;
  gavetas: boolean;
  acabamento: boolean;
  limpeza: boolean;
};

const ITEMS: { key: keyof AssemblyChecklist; label: string; hint: string }[] = [
  { key: 'estrutura', label: 'Estrutura montada e nivelada', hint: 'Caixas, fixações, prumo' },
  { key: 'portas', label: 'Portas alinhadas e funcionais', hint: 'Folgas, dobradiças, fechamento suave' },
  { key: 'gavetas', label: 'Gavetas operando corretamente', hint: 'Corrediças, frentes, batentes' },
  { key: 'acabamento', label: 'Acabamento revisado', hint: 'Bordas, tampos, retoques, vedação' },
  { key: 'limpeza', label: 'Local limpo e entregue', hint: 'Resíduos removidos, móvel polido' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AssemblyChecklist;
  initialAssignee?: string;
  employees?: { id: string; name: string }[];
  onConfirm: (data: {
    checklist: AssemblyChecklist;
    completedBy: string;
    hasPendingIssues: boolean;
    pendingDescription?: string;
    pendingPriority?: 'low' | 'normal' | 'high' | 'urgent';
  }) => Promise<void> | void;
}

const DEFAULT: AssemblyChecklist = {
  estrutura: false, portas: false, gavetas: false, acabamento: false, limpeza: false,
};

export function AssemblyChecklistDialog({ open, onOpenChange, initial, initialAssignee, employees = [], onConfirm }: Props) {
  const [checklist, setChecklist] = useState<AssemblyChecklist>(initial ?? DEFAULT);
  const [completedBy, setCompletedBy] = useState(initialAssignee ?? '');
  const [hasPending, setHasPending] = useState<'no' | 'yes'>('no');
  const [pendingDescription, setPendingDescription] = useState('');
  const [pendingPriority, setPendingPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setChecklist(initial ?? DEFAULT);
      setCompletedBy(initialAssignee ?? '');
      setHasPending('no');
      setPendingDescription('');
      setPendingPriority('normal');
    }
  }, [open, initial, initialAssignee]);

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const allChecked = completedCount === ITEMS.length;
  const canConfirm = allChecked && completedBy.trim().length > 0 &&
    (hasPending === 'no' || (hasPending === 'yes' && pendingDescription.trim().length > 0));

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm({
        checklist,
        completedBy: completedBy.trim(),
        hasPendingIssues: hasPending === 'yes',
        pendingDescription: hasPending === 'yes' ? pendingDescription.trim() : undefined,
        pendingPriority: hasPending === 'yes' ? pendingPriority : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Checklist de Montagem
          </DialogTitle>
          <DialogDescription>
            Confirme cada etapa antes de finalizar. A entrega só é liberada com o checklist completo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Progress */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-muted-foreground">Progresso</span>
              <span className={cn(allChecked ? 'text-success' : 'text-foreground')}>
                {completedCount} / {ITEMS.length}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div
                className={cn('h-full transition-all', allChecked ? 'bg-success' : 'bg-primary')}
                style={{ width: `${(completedCount / ITEMS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Checklist items */}
          <div className="space-y-2">
            {ITEMS.map(item => {
              const checked = checklist[item.key];
              return (
                <label
                  key={item.key}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                    checked ? 'border-success/40 bg-success/5' : 'border-border hover:bg-muted/40',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => setChecklist(prev => ({ ...prev, [item.key]: !!v }))}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className={cn('text-sm font-semibold', checked && 'text-success')}>{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                  {checked && <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />}
                </label>
              );
            })}
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <Label>Responsável pela conferência *</Label>
            {employees.length > 0 ? (
              <Select value={completedBy} onValueChange={setCompletedBy}>
                <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={completedBy}
                onChange={e => setCompletedBy(e.target.value)}
                placeholder="Nome do montador / supervisor"
              />
            )}
          </div>

          {/* Pendência */}
          <div className="space-y-3 rounded-lg border border-border p-3">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Existe alguma pendência ou ajuste a ser feito?
            </Label>
            <RadioGroup value={hasPending} onValueChange={(v) => setHasPending(v as 'no' | 'yes')} className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="no" id="pend-no" />
                <span className="text-sm">Não, tudo certo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="yes" id="pend-yes" />
                <span className="text-sm">Sim, abrir assistência</span>
              </label>
            </RadioGroup>

            {hasPending === 'yes' && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="space-y-2">
                  <Label>Descrição da pendência *</Label>
                  <Textarea
                    value={pendingDescription}
                    onChange={e => setPendingDescription(e.target.value)}
                    placeholder="Ex: Porta superior direita com folga de 3mm; ajustar dobradiça."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={pendingPriority} onValueChange={(v) => setPendingPriority(v as typeof pendingPriority)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Button
            className="w-full gradient-primary shadow-primary border-0"
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
          >
            {submitting ? 'Salvando…' : allChecked ? 'Confirmar e Finalizar Montagem' : `Faltam ${ITEMS.length - completedCount} item(ns)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
