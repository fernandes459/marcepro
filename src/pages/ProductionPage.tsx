import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Clock, User, Plus, X, ChevronRight, Package, CheckCircle2, ShieldCheck } from 'lucide-react';
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
import { AssemblyChecklistDialog, type AssemblyChecklist } from '@/components/production/AssemblyChecklistDialog';

interface ProductionTask {
  id: string;
  project_name: string;
  client_name: string;
  assignee: string | null;
  due_date: string | null;
  stage: string;
  priority: string;
  notes: string | null;
  budget_id: string | null;
  assembly_checklist: AssemblyChecklist | null;
  assembly_completed_at: string | null;
  assembly_completed_by: string | null;
  has_pending_issues: boolean;
}

interface BudgetItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  material_cost: number;
  labor_cost: number;
}

const stages = [
  { id: 'corte',     title: 'Corte',     color: 'hsl(210, 80%, 52%)' },
  { id: 'borda',     title: 'Borda',     color: 'hsl(38, 92%, 50%)' },
  { id: 'usinagem',  title: 'Usinagem',  color: 'hsl(28, 85%, 56%)' },
  { id: 'montagem',  title: 'Montagem',  color: 'hsl(152, 60%, 42%)' },
  { id: 'entregue',  title: 'Entregue',  color: 'hsl(120, 40%, 40%)' },
];

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};
const priorityLabels: Record<string, string> = {
  low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const colVariants = { hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } };

export default function ProductionPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStage, setDialogStage] = useState('corte');
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [materialsDialogOpen, setMaterialsDialogOpen] = useState(false);
  const [selectedTaskMaterials, setSelectedTaskMaterials] = useState<BudgetItem[]>([]);
  const [selectedTaskForMaterials, setSelectedTaskForMaterials] = useState<ProductionTask | null>(null);

  // Assembly checklist
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistTask, setChecklistTask] = useState<ProductionTask | null>(null);

  const [form, setForm] = useState({
    project_name: '', client_name: '', assignee: '', due_date: '', priority: 'normal', notes: '',
  });
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  useEffect(() => { if (user) { fetchTasks(); fetchEmployees(); fetchClients(); } }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`production-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_tasks' }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function fetchTasks() {
    const { data } = await supabase.from('production_tasks').select('*').order('created_at', { ascending: true });
    if (data) setTasks(data as unknown as ProductionTask[]);
    setLoading(false);
  }

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('id, name').eq('status', 'active').order('name');
    if (data) setEmployees(data);
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    if (data) setClients(data);
  }

  function openNewTask(stage: string) {
    setDialogStage(stage);
    setForm({ project_name: '', client_name: '', assignee: '', due_date: '', priority: 'normal', notes: '' });
    setDialogOpen(true);
  }

  async function handleCreateTask() {
    if (!form.project_name || !form.client_name) { toast.error('Preencha o projeto e cliente'); return; }
    const { error } = await supabase.from('production_tasks').insert({
      user_id: user!.id,
      project_name: form.project_name,
      client_name: form.client_name,
      assignee: form.assignee || null,
      due_date: form.due_date || null,
      stage: dialogStage,
      priority: form.priority,
      notes: form.notes || null,
    });
    if (error) { toast.error('Erro ao criar tarefa'); return; }
    toast.success('Tarefa criada!');
    setDialogOpen(false);
    fetchTasks();
  }

  async function moveTask(taskId: string, newStage: string) {
    const task = tasks.find(t => t.id === taskId);
    // If moving FROM montagem TO entregue → must run checklist first
    if (task && task.stage === 'montagem' && newStage === 'entregue' && !task.assembly_completed_at) {
      setChecklistTask(task);
      setChecklistOpen(true);
      return;
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, stage: newStage } : t));
    await supabase.from('production_tasks').update({ stage: newStage }).eq('id', taskId);
  }

  async function handleChecklistConfirm(data: {
    checklist: AssemblyChecklist;
    completedBy: string;
    hasPendingIssues: boolean;
    pendingDescription?: string;
    pendingPriority?: 'low' | 'normal' | 'high' | 'urgent';
  }) {
    if (!checklistTask || !user) return;

    try {
      const { error } = await supabase.from('production_tasks').update({
        stage: 'entregue',
        assembly_checklist: data.checklist as unknown as Record<string, boolean>,
        assembly_completed_at: new Date().toISOString(),
        assembly_completed_by: data.completedBy,
        has_pending_issues: data.hasPendingIssues,
      }).eq('id', checklistTask.id);

      if (error) {
        console.error('[checklist] update error', error);
        toast.error(`Erro ao finalizar montagem: ${error.message}`);
        return;
      }

      if (data.hasPendingIssues && data.pendingDescription) {
        const { error: aErr } = await supabase.from('technical_assistance').insert({
          user_id: user.id,
          production_task_id: checklistTask.id,
          budget_id: checklistTask.budget_id,
          client_name: checklistTask.client_name,
          project_name: checklistTask.project_name,
          description: data.pendingDescription,
          priority: data.pendingPriority ?? 'normal',
          assignee: data.completedBy,
          status: 'open',
        });
        if (aErr) {
          console.error('[checklist] assistance error', aErr);
          toast.error(`Montagem finalizada, mas falhou ao abrir assistência: ${aErr.message}`);
        } else {
          toast.success('Montagem concluída • Assistência aberta');
        }
      } else {
        toast.success('Montagem concluída e entregue!');
      }

      setChecklistOpen(false);
      setChecklistTask(null);
      fetchTasks();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado';
      console.error('[checklist] exception', e);
      toast.error(msg);
    }
  }

  async function deleteTask(taskId: string) {
    await supabase.from('production_tasks').delete().eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    toast.success('Tarefa removida');
  }

  async function openMaterials(task: ProductionTask) {
    setSelectedTaskForMaterials(task);
    if (task.budget_id) {
      const { data } = await supabase.from('budget_items').select('*').eq('budget_id', task.budget_id);
      setSelectedTaskMaterials((data || []) as BudgetItem[]);
    } else {
      setSelectedTaskMaterials([]);
    }
    setMaterialsDialogOpen(true);
  }

  function handleDragStart(taskId: string) { setDraggedTask(taskId); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(stageId: string) {
    if (draggedTask) { moveTask(draggedTask, stageId); setDraggedTask(null); }
  }

  const tasksByStage = (stageId: string) => tasks.filter(t => t.stage === stageId);

  function checklistProgress(task: ProductionTask): { count: number; total: number } {
    const c = task.assembly_checklist;
    if (!c) return { count: 0, total: 5 };
    return { count: Object.values(c).filter(Boolean).length, total: 5 };
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Produção</h1>
          <p className="text-muted-foreground text-sm mt-1">Pipeline com checklist obrigatório de montagem antes da entrega</p>
        </div>
        <Button className="gradient-primary shadow-primary border-0" onClick={() => openNewTask('corte')}>
          <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((col) => (
          <motion.div
            key={col.id}
            variants={colVariants}
            className="min-w-[280px] flex-1"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(col.id)}
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: col.color }} />
              <h3 className="text-sm font-bold font-display">{col.title}</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {tasksByStage(col.id).length}
              </span>
            </div>

            <div className="space-y-3">
              {tasksByStage(col.id).map((task) => {
                const nextStageIdx = stages.findIndex(s => s.id === task.stage) + 1;
                const nextStage = nextStageIdx < stages.length ? stages[nextStageIdx] : null;
                const isMontagem = task.stage === 'montagem';
                const isEntregue = task.stage === 'entregue';
                const progress = checklistProgress(task);

                return (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    className="cursor-grab hover:shadow-md transition-shadow border-l-[3px] active:cursor-grabbing"
                    style={{ borderLeftColor: col.color }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 text-muted-foreground/40 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-semibold">{task.project_name}</p>
                            <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-destructive">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">{task.client_name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColors[task.priority]}`}>
                              {priorityLabels[task.priority]}
                            </span>
                            {isMontagem && (
                              <span className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                progress.count === progress.total
                                  ? 'bg-success/10 text-success'
                                  : 'bg-warning/10 text-warning',
                              )}>
                                <ShieldCheck className="h-3 w-3" />
                                Checklist {progress.count}/{progress.total}
                              </span>
                            )}
                            {isEntregue && task.assembly_completed_at && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold">
                                <CheckCircle2 className="h-3 w-3" /> Conferida
                              </span>
                            )}
                            {task.has_pending_issues && (
                              <span className="inline-flex rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-semibold">
                                Pendência aberta
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            {task.assignee && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" /> <span>{task.assignee}</span>
                              </div>
                            )}
                            {task.due_date && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" /> <span>{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {task.budget_id && (
                              <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => openMaterials(task)}>
                                <Package className="h-3 w-3 mr-1" /> Materiais
                              </Button>
                            )}
                            {isMontagem && !task.assembly_completed_at && (
                              <Button
                                size="sm"
                                className="text-xs h-7 flex-1 gradient-primary border-0"
                                onClick={() => { setChecklistTask(task); setChecklistOpen(true); }}
                              >
                                <ShieldCheck className="h-3 w-3 mr-1" /> Checklist
                              </Button>
                            )}
                            {nextStage && !(isMontagem && !task.assembly_completed_at && nextStage.id === 'entregue') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 flex-1"
                                onClick={() => moveTask(task.id, nextStage.id)}
                              >
                                {nextStage.title} <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <button
                onClick={() => openNewTask(col.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar tarefa
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* New Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Nova Tarefa — {stages.find(s => s.id === dialogStage)?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Projeto *</Label>
              <Input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} placeholder="Ex: Cozinha Planejada" />
            </div>
            <div className="space-y-2">
              <Label>Cliente *</Label>
              {clients.length > 0 ? (
                <Select value={form.client_name} onValueChange={v => setForm({ ...form, client_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Cadastre clientes em /clientes" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={form.assignee} onValueChange={v => setForm({ ...form, assignee: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}
                    <SelectItem value="Sem atribuição">Sem atribuição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
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
            <div className="space-y-2">
              <Label>Data de Entrega</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionais" />
            </div>
            <Button className="w-full gradient-primary shadow-primary border-0" onClick={handleCreateTask}>
              Criar Tarefa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Materials Dialog */}
      <Dialog open={materialsDialogOpen} onOpenChange={setMaterialsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Materiais — {selectedTaskForMaterials?.project_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Cliente: <strong>{selectedTaskForMaterials?.client_name}</strong>
              {selectedTaskForMaterials?.due_date && (
                <> • Entrega: <strong>{new Date(selectedTaskForMaterials.due_date).toLocaleDateString('pt-BR')}</strong></>
              )}
            </div>
            {selectedTaskMaterials.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum material vinculado a este projeto.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">Material</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">Qtd</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">Custo Material</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">M.O.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTaskMaterials.map(item => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-sm font-medium">{item.name}</td>
                        <td className="px-3 py-2 text-sm text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-sm text-right">{formatBRL(item.material_cost)}</td>
                        <td className="px-3 py-2 text-sm text-right">{formatBRL(item.labor_cost)}</td>
                        <td className="px-3 py-2 text-sm text-right font-semibold">{formatBRL(item.unit_price * item.quantity)}</td>
                      </tr>
                    ))}
                    <tr className="bg-accent/50">
                      <td colSpan={4} className="px-3 py-2 text-sm font-bold text-right">Total</td>
                      <td className="px-3 py-2 text-sm text-right font-bold">
                        {formatBRL(selectedTaskMaterials.reduce((s, i) => s + i.unit_price * i.quantity, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assembly Checklist Dialog */}
      <AssemblyChecklistDialog
        open={checklistOpen}
        onOpenChange={(v) => { setChecklistOpen(v); if (!v) setChecklistTask(null); }}
        initial={checklistTask?.assembly_checklist ?? undefined}
        initialAssignee={checklistTask?.assignee ?? ''}
        employees={employees}
        onConfirm={handleChecklistConfirm}
      />
    </motion.div>
  );
}
