import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LifeBuoy, Plus, AlertOctagon, AlertTriangle, Clock, CheckCircle2, User, Calendar, X } from 'lucide-react';
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

export default function AssistancePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Assistance[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assistance | null>(null);
  const [form, setForm] = useState({
    client_name: '', project_name: '', description: '', priority: 'normal' as Priority, assignee: '',
  });

  useEffect(() => { if (user) { fetchData(); fetchAux(); } }, [user]);

  async function fetchAux() {
    const [c, e] = await Promise.all([
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('employees').select('id, name').eq('status', 'active').order('name'),
    ]);
    if (c.data) setClients(c.data);
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
    if (data) setItems(data as Assistance[]);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ client_name: '', project_name: '', description: '', priority: 'normal', assignee: '' });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.client_name || !form.project_name || !form.description) {
      toast.error('Preencha cliente, projeto e descrição'); return;
    }
    const { error } = await supabase.from('technical_assistance').insert({
      user_id: user!.id,
      client_name: form.client_name,
      project_name: form.project_name,
      description: form.description,
      priority: form.priority,
      assignee: form.assignee || null,
    });
    if (error) { toast.error('Erro ao criar assistência'); return; }
    toast.success('Assistência aberta');
    setDialogOpen(false);
    fetchData();
  }

  async function updateStatus(id: string, status: Status) {
    const updates: Partial<Assistance> = { status };
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
    toast.success('Removida');
  }

  const filtered = items
    .filter(i => filter === 'all' ? true : filter === 'resolved' ? i.status === 'resolved' : i.status !== 'resolved')
    .sort((a, b) => {
      // Active first by priority rank, then by date desc
      if (a.status !== 'resolved' && b.status === 'resolved') return -1;
      if (a.status === 'resolved' && b.status !== 'resolved') return 1;
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

  function daysOpen(d: string) {
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" /> Assistência Técnica
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Pendências e ajustes pós-entrega, priorizados por urgência.</p>
        </div>
        <Button className="gradient-primary shadow-primary border-0" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nova Assistência
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Urgentes" value={counts.urgent} icon={AlertOctagon} tone="destructive" />
        <KpiCard label="Alta prioridade" value={counts.high} icon={AlertTriangle} tone="warning" />
        <KpiCard label="Abertas" value={counts.open} icon={Clock} tone="info" />
        <KpiCard label="Em andamento" value={counts.inProgress} icon={CheckCircle2} tone="primary" />
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="active">Ativas</TabsTrigger>
          <TabsTrigger value="resolved">Resolvidas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma assistência {filter === 'active' ? 'ativa' : filter === 'resolved' ? 'resolvida' : ''}.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(item => {
            const pm = priorityMeta[item.priority];
            const sm = statusMeta[item.status];
            const Icon = pm.icon;
            const days = daysOpen(item.opened_at);
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
                    <div className={cn('rounded-lg p-2 shrink-0', pm.className)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{item.project_name}</h3>
                        <Badge variant="outline" className={cn('text-[10px] border', pm.className)}>{pm.label}</Badge>
                        <Badge variant="outline" className={cn('text-[10px]', sm.className)}>{sm.label}</Badge>
                        {item.status !== 'resolved' && days >= 3 && (
                          <Badge variant="outline" className="text-[10px] bg-destructive/5 text-destructive border-destructive/20">
                            {days}d em aberto
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Cliente: <strong>{item.client_name}</strong></p>
                      <p className="text-sm mt-2 leading-relaxed">{item.description}</p>
                      {item.assignee && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <User className="h-3 w-3" /> {item.assignee}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Aberta em {new Date(item.opened_at).toLocaleDateString('pt-BR')}
                        {item.resolved_at && <> • Resolvida em {new Date(item.resolved_at).toLocaleDateString('pt-BR')}</>}
                      </p>
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
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Resolver
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Nova Assistência Técnica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={form.client_name} onValueChange={(v) => setForm({ ...form, client_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
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
                <Input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
                <Label>Responsável</Label>
                <Select value={form.assignee} onValueChange={(v) => setForm({ ...form, assignee: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um funcionário" /></SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum funcionário ativo</div>
                    ) : employees.map(e => (
                      <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full gradient-primary border-0" onClick={handleSave}>Abrir Assistência</Button>
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
