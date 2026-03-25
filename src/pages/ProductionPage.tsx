import { useState } from 'react';
import { motion } from 'framer-motion';
import { Factory, GripVertical, Clock, User, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProductionTask {
  id: string;
  project: string;
  client: string;
  assignee: string;
  dueDate: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  tasks: ProductionTask[];
}

const initialColumns: KanbanColumn[] = [
  {
    id: 'corte',
    title: 'Corte',
    color: 'hsl(210, 80%, 52%)',
    tasks: [
      { id: '1', project: 'Rack Suspenso', client: 'Pedro Lima', assignee: 'Carlos', dueDate: '28/03' },
      { id: '2', project: 'Prateleira Sala', client: 'Roberto Dias', assignee: 'Lucas', dueDate: '30/03' },
    ],
  },
  {
    id: 'borda',
    title: 'Borda',
    color: 'hsl(38, 92%, 50%)',
    tasks: [
      { id: '3', project: 'Closet Casal', client: 'João Santos', assignee: 'Carlos', dueDate: '26/03' },
    ],
  },
  {
    id: 'usinagem',
    title: 'Usinagem',
    color: 'hsl(28, 85%, 56%)',
    tasks: [
      { id: '4', project: 'Cozinha Planejada', client: 'Maria Silva', assignee: 'André', dueDate: '25/03' },
      { id: '5', project: 'Armário Quarto', client: 'Carla Oliveira', assignee: 'Lucas', dueDate: '27/03' },
    ],
  },
  {
    id: 'montagem',
    title: 'Montagem',
    color: 'hsl(152, 60%, 42%)',
    tasks: [
      { id: '6', project: 'Painel TV', client: 'Ana Costa', assignee: 'André', dueDate: '24/03' },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const colVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};

export default function ProductionPage() {
  const [columns] = useState(initialColumns);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Produção</h1>
          <p className="text-muted-foreground text-sm mt-1">Kanban do cronograma de produção</p>
        </div>
        <Button className="gradient-primary shadow-primary border-0">
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <motion.div key={col.id} variants={colVariants} className="min-w-[280px] flex-1">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: col.color }} />
              <h3 className="text-sm font-bold font-display">{col.title}</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {col.tasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {col.tasks.map((task) => (
                <Card key={task.id} className="cursor-grab hover:shadow-md transition-shadow border-l-[3px]" style={{ borderLeftColor: col.color }}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-0.5 h-4 w-4 text-muted-foreground/40 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-semibold">{task.project}</p>
                        <p className="text-xs text-muted-foreground">{task.client}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{task.assignee}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{task.dueDate}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
                <Plus className="h-3.5 w-3.5" />
                Adicionar tarefa
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
