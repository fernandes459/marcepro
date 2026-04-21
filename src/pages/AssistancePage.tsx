import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LifeBuoy, Plus, AlertOctagon, AlertTriangle, Clock, CheckCircle2,
  User, Calendar, X, MapPin, Phone, Wrench, Hammer, Ruler,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Priority = 'low' | 'normal' | 'high' | 'urgent';
type Status = 'open' | 'in_progress' | 'resolved';
type ActivityType = 'assembly' | 'assistance' | 'measurement';

interface Assistance {
  id: string;
  client_name: string;
  project_name: string;
  description: string;
  priority: Priority;
  status: Status;
  assignee: string | null;
  resolution_notes: string | null;
  opened_at: string;
  resolved_at: string | null;
  activity_type: ActivityType;
  address: string | null;
  phone: string | null;
  scheduled_at: string | null;
}

const priorityMeta: Record<Priority, { label: string; className: string; icon: typeof AlertOctagon; rank: number }> = {
  urgent: { label: 'Urgente', className: 'bg-destructive/10 text-destructive border-destructive/30', icon: AlertOctagon, rank: 0 },
  high:   { label: 'Alta',    className: 'bg-warning/10 text-warning border-warning/30',           icon: AlertTriangle, rank: 1 },
  normal: { label: 'Normal',  className: 'bg-info/10 text-info border-info/30',                    icon: Clock,         rank: 2 },
  low:    { label: 'Baixa',   className: 'bg-muted text-muted-foreground border-border',           icon: Clock,         rank: 3 },
};

const statusMeta: Record<Status, { label: string; className: string }> = {
  open:        { label: 'Aberta',      className: 'bg-destructive/10 text-destructive' },
  in_progress: { label: 'Em andamento', className: 'bg-warning/10 text-warning' },
  resolved:    { label: 'Resolvida',    className: 'bg-success/10 text-success' },
};

const activityMeta: Record<ActivityType, { label: string; icon: typeof Wrench; className: string }> = {
  assembly:    { label: 'Montagem',    icon: Hammer, className: 'bg-info/10 text-info border-info/30' },
  assistance:  { label: 'Assistência', icon: Wrench, className: 'bg-destructive/10 text-destructive border-destructive/30' },
  measurement: { label: 'Medição',     icon: Ruler,  className: 'bg-primary/10 text-primary border-primary/30' },
};

export default function AssistancePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Assistance[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; phone: string | null; address: string | null }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    activity_type: 'assistance' as ActivityType,
    client_name: '',
    project_name: '',
    description: '',
    priority: 'normal' as Priority,
    assignee: '',
    address: '',
    phone: '',
    scheduled_at: '',
  });

  useEffect(() => { if (user) { fetchData(); fetchAux(); } }, [user]);

  async function fetchAux() {
    const [c, e] = await Promise.all([
      supabase.from('clients').select('id, name, phone, address').order('name'),
      supabase.from('employees').select('id, name').eq('status', 'active').order('name'),
    ]);
    if (c.data) setClients(c.data as any);
    if (e.data) setEmployees(e.data);
  }

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`assistance-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technical_assistance' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function fetchData() {
    const { data } = await supabase
      .from('technical_assistance')
      .select('*')
      .order('opened_at', { ascending: false });
    if (data) setItems(data as any);
    setLoading(false);
  }

  function openNew() {
    setForm({
      activity_type: 'assistance',
      client_name: '', project_name: '', description: '',
      priority: 'normal', assignee: '',
      address: '', phone: '', scheduled_at: '',
    });
    setDialogOpen(true);
  }

  function onClientChange(name: string) {
    const c = clients.find(x => x.name === name);
    setForm(f => ({
      ...f,
      client_name: name,
      address: c?.address || f.address,
      phone: c?.phone || f.phone,
    }));
  }

  async function handleSave() {
    if (!form.client_name || !form.project_name || !form.description) {
      toast.error('Preencha cliente, projeto e descrição'); return;
    }
    if (!form.scheduled_at) {
      toast.error('Defina data e horário do atendimento'); return;
    }
    if (!form.assignee) {
      toast.error('Selecione o responsável'); return;
    }
    const { error } = await supabase.from('technical_assistance').insert({
      user_id: user!.id,
      client_name: form.client_name,
      project_name: form.project_name,
      description: form.description,
      priority: form.priority,
      assignee: form.assignee || null,
      activity_type: form.activity_type,
      address: form.address || null,
      phone: form.phone || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
    } as any);
    if (error) { toast.error('Erro ao criar atendimento'); return; }
    toast.success('Atendimento agendado e enviado para o calendário do responsável');
    setDialogOpen(false);
    fetchData();
  }

  async function updateStatus(id: string, status: Status) {
    const updates: any = { status };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    await supabase.from('technical_assistance').update(updates).eq('id', id);
    fetchData();
  }

  async function updatePriority(id: string, priority: Priority) {
    await supabase.from('technical_assistance').update({ priority }).eq('id', id);
    fetchData();
  }

  async function remove(id: string) {
    await supabase.from('technical_assistance').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success('Removido');
  }

  const filtered = items
    .filter(i => filter === 'all' ? true : filter === 'resolved' ? i.status === 'resolved' : i.status !== 'resolved')
    .sort((a, b) => {
      if (a.status !== 'resolved' && b.status === 'resolved') return -1;
      if (a.status === 'resolved' && b.status !== 'resolved') return 1;
      // Sort by scheduled date if available, else by priority
      if (a.scheduled_at && b.scheduled_at) {
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      }
      const r = priorityMeta[a.priority].rank - priorityMeta[b.priority].rank;
      if (r !== 0) return r;
      return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();
    });

  const counts = {
    urgent: items.filter(i => i.status !== 'resolved' && i.priority === 'urgent').length,
    high:   items.filter(i => i.status !== 'resolved' && i.priority === 'high').length,
    open:   items.filter(i => i.status === 'open').length,
    inProgress: items.filter(i => i.status === 'in_progress').length,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" /> Atendimentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Montagens, assistências e medições — agendados e visíveis no calendário do responsável.
          </p>
        </div>
        <Button className="gradient-primary shadow-primary border-0" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo Atendimento
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Urgentes" value={counts.urgent} icon={AlertOctagon} tone="destructive" />
        <KpiCard label="Alta prioridade" value={counts.high} icon={AlertTriangle} tone="warning" />
        <KpiCard label="Abertos" value={counts.open} icon={Clock} tone="info" />
        <KpiCard label="Em andamento" value={counts.inProgress} icon={CheckCircle2} tone="primary" />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum atendimento {filter === 'active' ? 'ativo' : filter === 'resolved' ? 'resolvido' : ''}.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(item => {
            const pm = priorityMeta[item.priority];
            const am = activityMeta[item.activity_type];
            const sm = statusMeta[item.status];
            const ActIcon = am.icon;
            return (
              <Card
                key={item.id}
                className={cn(
                  'border-l-4 hover:shadow-md transition-shadow',
                  item.priority === 'urgent' && item.status !== 'resolved' && 'border-l-destructive',
                  item.priority === 'high' && item.status !== 'resolved' && 'border-l-warning',
                  item.priority === 'normal' && item.status !== 'resolved' && 'border-l-info',
                  (item.priority === 'low' || item.status === 'resolved') && 'border-l-border',
                )}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('rounded-lg p-2 shrink-0', am.className)}>
                      <ActIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{item.project_name}</h3>
                        <Badge variant="outline" className={cn('text-[10px] border', am.className)}>{am.label}</Badge>
                        <Badge variant="outline" className={cn('text-[10px] border', pm.className)}>{pm.label}</Badge>
                        <Badge variant="outline" className={cn('text-[10px]', sm.className)}>{sm.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Cliente: <strong>{item.client_name}</strong></p>
                      <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap">{item.description}</p>

                      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                        {item.scheduled_at && (
                          <p className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            <strong className="text-foreground">
                              {new Date(item.scheduled_at).toLocaleString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </strong>
                          </p>
                        )}
                        {item.assignee && (
                          <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {item.assignee}</p>
                        )}
                        {item.phone && (
                          <a href={`tel:${item.phone}`} className="flex items-center gap-1.5 hover:text-primary">
                            <Phone className="h-3.5 w-3.5" /> {item.phone}
                          </a>
                        )}
                        {item.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 hover:text-primary truncate"
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{item.address}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Select value={item.priority} onValueChange={(v) => updatePriority(item.id, v as Priority)}>
                      <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                    {item.status === 'open' && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateStatus(item.id, 'in_progress')}>
                        Iniciar
                      </Button>
                    )}
                    {item.status !== 'resolved' && (
                      <Button size="sm" className="h-8 text-xs gradient-primary border-0" onClick={() => updateStatus(item.id, 'resolved')}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
                      </Button>
                    )}
                    {item.status === 'resolved' && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateStatus(item.id, 'in_progress')}>
                        Reabrir
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de atividade *</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(activityMeta) as ActivityType[]).map(t => {
                  const m = activityMeta[t];
                  const Icon = m.icon;
                  const active = form.activity_type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, activity_type: t })}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                        active ? 'border-primary bg-primary/5 shadow-primary' : 'border-border hover:border-primary/50',
                      )}
                    >
                      <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="text-xs font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={form.client_name} onValueChange={onClientChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum cliente cadastrado</div>
                    ) : clients.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Projeto *</Label>
                <Input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} placeholder="Ex: Cozinha planejada" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label>Data e horário *</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço *</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" />
            </div>

            <div className="space-y-2">
              <Label>Descrição do serviço *</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhe exatamente o que precisa ser feito no cliente..."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável *</Label>
                <Select value={form.assignee} onValueChange={(v) => setForm({ ...form, assignee: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum colaborador ativo</div>
                    ) : employees.map(e => (
                      <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg bg-info/5 border border-info/20 p-3 text-xs text-muted-foreground flex gap-2">
              <Calendar className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <span>O atendimento aparecerá automaticamente no <strong>calendário do responsável</strong> em Gestão, com endereço, telefone e descrição completa.</span>
            </div>

            <Button className="w-full gradient-primary border-0" onClick={handleSave}>Agendar Atendimento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: {
  label: string; value: number; icon: typeof AlertOctagon;
  tone: 'destructive' | 'warning' | 'info' | 'primary';
}) {
  const toneClass = {
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
    primary: 'bg-primary/10 text-primary',
  }[tone];
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className={cn('rounded-lg p-2', toneClass)}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold font-display leading-none">{value}</p>
      </div>
    </CardContent></Card>
  );
}
