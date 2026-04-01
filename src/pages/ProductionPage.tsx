import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Factory, GripVertical, Clock, User, Plus, X, ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProductionTask {
  id: string;
  project_name: string;
  client_name: string;
  assignee: string | null;
  due_date: string | null;
  stage: string;
  priority: string;
  notes: string | null;
}

const stages = [
  { id: 'corte', title: 'Corte', color: 'hsl(210, 80%, 52%)' },
  { id: 'borda', title: 'Borda', color: 'hsl(38, 92%, 50%)' },
  { id: 'usinagem', title: 'Usinagem', color: 'hsl(28, 85%, 56%)' },
  { id: 'montagem', title: 'Montagem', color: 'hsl(152, 60%, 42%)' },
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const colVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};

export default function ProductionPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStage, setDialogStage] = useState('corte');
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    project_name: '', client_name: '', assignee: '', due_date: '', priority: 'normal', notes: '',
  });

  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  useEffect(() => { if (user) { fetchTasks(); fetchEmployees(); } }, [user]);

  async function fetchTasks() {
    const { data } = await supabase.from('production_tasks').select('*').order('created_at', { ascending: true });
    if (data) setTasks(data as ProductionTask[]);
    setLoading(false);
  }

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('id, name').eq('status', 'active');
    if (data) setEmployees(data);
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
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, stage: newStage } : t));
    await supabase.from('production_tasks').update({ stage: newStage }).eq('id', taskId);
  }

  async function deleteTask(taskId: string) {
    await supabase.from('production_tasks').delete().eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    toast.success('Tarefa removida');
  }

  function handleDragStart(taskId: string) { setDraggedTask(taskId); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(stageId: string) {
    if (draggedTask) { moveTask(draggedTask, stageId); setDraggedTask(null); }
  }

  const tasksByStage = (stageId: string) => tasks.filter(t => t.stage === stageId);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Produção</h1>
          <p className="text-muted-foreground text-sm mt-1">Kanban do cronograma de produção</p>
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
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColors[task.priority]}`}>
                              {priorityLabels[task.priority]}
                            </span>
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
                          {nextStage && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs h-7 mt-1"
                              onClick={() => moveTask(task.id, nextStage.id)}
                            >
                              Mover para {nextStage.title} <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
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
              <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Nome do cliente" />
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
    </motion.div>
  );
}
