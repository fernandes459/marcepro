import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Phone, Mail, MessageCircle, Calendar, User, X, TrendingUp, Trophy, XCircle, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  stage: string;
  estimated_value: number;
  probability: number;
  next_contact_at: string | null;
  assignee: string | null;
  notes: string | null;
  created_at: string;
}

const stages = [
  { id: 'novo',        title: 'Novo',         color: 'hsl(210, 80%, 52%)' },
  { id: 'qualificado', title: 'Qualificado',  color: 'hsl(38, 92%, 50%)'  },
  { id: 'proposta',    title: 'Proposta',     color: 'hsl(28, 85%, 56%)'  },
  { id: 'negociacao',  title: 'Negociação',   color: 'hsl(265, 60%, 55%)' },
  { id: 'ganho',       title: 'Ganho',        color: 'hsl(152, 60%, 42%)' },
  { id: 'perdido',     title: 'Perdido',      color: 'hsl(0, 70%, 55%)'   },
];

const sources = [
  { value: 'manual',     label: 'Cadastro Manual' },
  { value: 'indicacao',  label: 'Indicação' },
  { value: 'instagram',  label: 'Instagram' },
  { value: 'site',       label: 'Site' },
  { value: 'anuncio',    label: 'Anúncio' },
  { value: 'outro',      label: 'Outro' },
];

export default function CrmPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStage, setDialogStage] = useState('novo');
  const [editing, setEditing] = useState<Lead | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', source: 'manual',
    estimated_value: '', probability: '50', next_contact_at: '',
    assignee: '', notes: '',
  });

  useEffect(() => { if (user) fetchLeads(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`leads-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function fetchLeads() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads((data ?? []) as Lead[]);
  }

  function openNew(stage: string) {
    setEditing(null);
    setDialogStage(stage);
    setForm({ name: '', phone: '', email: '', source: 'manual', estimated_value: '', probability: '50', next_contact_at: '', assignee: '', notes: '' });
    setDialogOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setDialogStage(lead.stage);
    setForm({
      name: lead.name,
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      source: lead.source,
      estimated_value: String(lead.estimated_value || ''),
      probability: String(lead.probability || 50),
      next_contact_at: lead.next_contact_at ? lead.next_contact_at.slice(0, 16) : '',
      assignee: lead.assignee ?? '',
      notes: lead.notes ?? '',
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name) { toast.error('Informe o nome'); return; }
    const payload = {
      user_id: user!.id,
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      source: form.source,
      stage: dialogStage,
      estimated_value: Number(form.estimated_value) || 0,
      probability: Number(form.probability) || 50,
      next_contact_at: form.next_contact_at ? new Date(form.next_contact_at).toISOString() : null,
      assignee: form.assignee || null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from('leads').update(payload).eq('id', editing.id)
      : await supabase.from('leads').insert(payload);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success(editing ? 'Lead atualizado' : 'Lead criado');
    setDialogOpen(false);
    fetchLeads();
  }

  async function moveStage(id: string, newStage: string) {
    const patch: { stage: string; won_at?: string; lost_at?: string } = { stage: newStage };
    if (newStage === 'ganho') patch.won_at = new Date().toISOString();
    if (newStage === 'perdido') patch.lost_at = new Date().toISOString();
    await supabase.from('leads').update(patch).eq('id', id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, stage: newStage } : l));
  }

  async function removeLead(id: string) {
    await supabase.from('leads').delete().eq('id', id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    toast.success('Lead removido');
  }

  const leadsByStage = (s: string) => leads.filter((l) => l.stage === s);

  // KPIs
  const active = leads.filter((l) => !['ganho', 'perdido'].includes(l.stage));
  const totalPipeline = active.reduce((acc, l) => acc + Number(l.estimated_value), 0);
  const weighted = active.reduce((acc, l) => acc + Number(l.estimated_value) * (l.probability / 100), 0);
  const won = leads.filter((l) => l.stage === 'ganho');
  const lost = leads.filter((l) => l.stage === 'perdido');
  const closed = won.length + lost.length;
  const winRate = closed > 0 ? (won.length / closed) * 100 : 0;
  const wonValue = won.reduce((acc, l) => acc + Number(l.estimated_value), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">CRM — Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm mt-1">Pipeline comercial com previsão ponderada</p>
        </div>
        <Button className="gradient-primary shadow-primary border-0" onClick={() => openNew('novo')}>
          <Plus className="h-4 w-4 mr-2" /> Novo Lead
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={Target} label="Pipeline Ativo" value={formatBRL(totalPipeline)} sub={`${active.length} leads`} color="text-info" />
        <KPI icon={TrendingUp} label="Previsão Ponderada" value={formatBRL(weighted)} sub="por probabilidade" color="text-primary" />
        <KPI icon={Trophy} label="Taxa de Conversão" value={`${winRate.toFixed(1)}%`} sub={`${won.length} ganhos`} color="text-success" />
        <KPI icon={XCircle} label="Receita Fechada" value={formatBRL(wonValue)} sub={`${won.length} contratos`} color="text-success" />
      </div>

      {/* Funnel kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((col) => {
          const items = leadsByStage(col.id);
          const total = items.reduce((acc, l) => acc + Number(l.estimated_value), 0);
          return (
            <div
              key={col.id}
              className="min-w-[260px] flex-1"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (draggedLead) { moveStage(draggedLead, col.id); setDraggedLead(null); } }}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: col.color }} />
                <h3 className="text-sm font-bold font-display">{col.title}</h3>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {items.length}
                </span>
              </div>
              {items.length > 0 && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {formatBRL(total)}
                </p>
              )}
              <div className="space-y-3">
                {items.map((lead) => (
                  <Card
                    key={lead.id}
                    draggable
                    onDragStart={() => setDraggedLead(lead.id)}
                    onClick={() => openEdit(lead)}
                    className="cursor-grab hover:shadow-md transition-shadow border-l-[3px] active:cursor-grabbing"
                    style={{ borderLeftColor: col.color }}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate flex-1">{lead.name}</p>
                        <button onClick={(e) => { e.stopPropagation(); removeLead(lead.id); }} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-primary">{formatBRL(Number(lead.estimated_value))}</p>
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
                        <span className="bg-muted px-1.5 py-0.5 rounded">{lead.probability}%</span>
                        <span className="bg-muted px-1.5 py-0.5 rounded">{sources.find((s) => s.value === lead.source)?.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {lead.phone && (
                          <a
                            href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-success hover:bg-success/10 rounded p-1"
                          >
                            <MessageCircle className="h-3 w-3" />
                          </a>
                        )}
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="text-info hover:bg-info/10 rounded p-1">
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:bg-primary/10 rounded p-1">
                            <Mail className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {(lead.assignee || lead.next_contact_at) && (
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                          {lead.assignee && (
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{lead.assignee}</span>
                          )}
                          {lead.next_contact_at && (
                            <span className={cn(
                              'flex items-center gap-1',
                              new Date(lead.next_contact_at) < new Date() && 'text-destructive font-semibold'
                            )}>
                              <Calendar className="h-3 w-3" />
                              {new Date(lead.next_contact_at).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <button
                  onClick={() => openNew(col.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? 'Editar Lead' : 'Novo Lead'} — {stages.find((s) => s.id === dialogStage)?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Origem</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sources.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estágio</Label>
                <Select value={dialogStage} onValueChange={setDialogStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor estimado (R$)</Label>
                <Input type="number" step="0.01" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} onFocus={(e) => e.target.select()} />
              </div>
              <div className="space-y-1.5">
                <Label>Probabilidade (%)</Label>
                <Input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} onFocus={(e) => e.target.select()} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Próximo contato</Label>
                <Input type="datetime-local" value={form.next_contact_at} onChange={(e) => setForm({ ...form, next_contact_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full gradient-primary shadow-primary border-0" onClick={save}>
              {editing ? 'Salvar alterações' : 'Criar Lead'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function KPI({ icon: Icon, label, value, sub, color }: { icon: typeof Target; label: string; value: string; sub: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-lg bg-muted flex items-center justify-center', color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-bold text-lg font-display truncate">{value}</p>
          <p className="text-[10px] text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
