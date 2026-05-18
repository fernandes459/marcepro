import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Factory, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const STAGES = [
  { id: 'corte',     label: 'Corte' },
  { id: 'borda',     label: 'Borda' },
  { id: 'usinagem',  label: 'Usinagem' },
  { id: 'montagem',  label: 'Montagem' },
];

interface Capacity {
  stage: string;
  hours_per_day: number;
  parallel_tasks: number;
  estimated_load?: number;
}

export default function CapacitySettings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, Capacity>>({});
  const [load, setLoad] = useState<Record<string, number>>({});

  useEffect(() => { if (user) load_(); }, [user]);

  async function load_() {
    const { data } = await supabase.from('production_capacity').select('*');
    const map: Record<string, Capacity> = {};
    STAGES.forEach((s) => {
      const r = (data ?? []).find((d) => d.stage === s.id);
      map[s.id] = {
        stage: s.id,
        hours_per_day: r?.hours_per_day ?? 8,
        parallel_tasks: r?.parallel_tasks ?? 1,
      };
    });
    setRows(map);

    // load current backlog by stage from production_tasks
    const { data: tasks } = await supabase
      .from('production_tasks')
      .select('stage, estimated_hours')
      .not('stage', 'eq', 'entregue');
    const lmap: Record<string, number> = {};
    (tasks ?? []).forEach((t) => {
      lmap[t.stage] = (lmap[t.stage] ?? 0) + (Number(t.estimated_hours) || 0);
    });
    setLoad(lmap);
  }

  async function save() {
    if (!user) return;
    const upserts = Object.values(rows).map((r) => ({
      user_id: user.id,
      stage: r.stage,
      hours_per_day: Number(r.hours_per_day) || 0,
      parallel_tasks: Number(r.parallel_tasks) || 1,
    }));
    const { error } = await supabase.from('production_capacity').upsert(upserts, { onConflict: 'company_id,stage' });
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Capacidade atualizada');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Factory className="h-5 w-5 text-primary" /> Capacidade Produtiva (PCP)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Configure horas/dia disponíveis por estágio. O sistema identifica gargalos comparando carga estimada × capacidade.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30 text-xs">
                <th className="px-3 py-2 text-left font-semibold uppercase text-muted-foreground">Estágio</th>
                <th className="px-3 py-2 text-center font-semibold uppercase text-muted-foreground">Horas/Dia</th>
                <th className="px-3 py-2 text-center font-semibold uppercase text-muted-foreground">Tarefas Paralelas</th>
                <th className="px-3 py-2 text-right font-semibold uppercase text-muted-foreground">Carga (h)</th>
                <th className="px-3 py-2 text-right font-semibold uppercase text-muted-foreground">Dias p/ Limpar</th>
                <th className="px-3 py-2 text-center font-semibold uppercase text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((s) => {
                const r = rows[s.id];
                if (!r) return null;
                const carga = load[s.id] ?? 0;
                const cap = r.hours_per_day * r.parallel_tasks;
                const dias = cap > 0 ? carga / cap : 0;
                const gargalo = dias > 5;
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-sm font-medium">{s.label}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number" step="0.5" min={0}
                        value={r.hours_per_day}
                        onChange={(e) => setRows({ ...rows, [s.id]: { ...r, hours_per_day: Number(e.target.value) } })}
                        onFocus={(e) => e.target.select()}
                        className="h-8 text-center"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number" min={1}
                        value={r.parallel_tasks}
                        onChange={(e) => setRows({ ...rows, [s.id]: { ...r, parallel_tasks: Number(e.target.value) } })}
                        onFocus={(e) => e.target.select()}
                        className="h-8 text-center"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-right">{carga.toFixed(1)}h</td>
                    <td className="px-3 py-2 text-sm text-right font-semibold">{dias.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">
                      {gargalo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-semibold">
                          <AlertTriangle className="h-3 w-3" /> Gargalo
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          💡 Dica: preencha "Horas estimadas" em cada tarefa de produção para um cálculo de carga preciso.
        </p>
        <Button onClick={save} className="gradient-primary shadow-primary border-0">
          <Save className="h-4 w-4 mr-2" /> Salvar Capacidade
        </Button>
      </CardContent>
    </Card>
  );
}
