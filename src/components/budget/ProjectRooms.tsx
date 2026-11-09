import { useCallback, useEffect, useState } from 'react';
import Decimal from 'decimal.js';
import { Plus, Trash2, Wand2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBRL } from '@/lib/format';
import { toast } from 'sonner';

export const ROOM_STATUSES: Record<string, string> = {
  projeto: 'Projeto', aprovado: 'Aprovado', fabricacao: 'Fabricação', instalacao: 'Instalação', concluido: 'Concluído',
};

interface Room { id: string; name: string; status: string; value: number; due_date: string | null; notes: string | null; sort_order: number; }

export default function ProjectRooms({ budgetId, finalPrice }: { budgetId: string; finalPrice: number }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('project_rooms').select('*').eq('budget_id', budgetId).order('sort_order');
    if (error) toast.error('Erro ao carregar ambientes');
    setRooms((data as Room[]) || []);
    setLoading(false);
  }, [budgetId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`rooms-${budgetId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_rooms', filter: `budget_id=eq.${budgetId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [budgetId, load]);

  const add = async (name: string, value = 0) => {
    if (!name.trim()) return;
    const { error } = await supabase.from('project_rooms').insert({ budget_id: budgetId, name: name.trim(), value, sort_order: rooms.length });
    if (error) toast.error('Erro ao adicionar ambiente'); else { setNewName(''); load(); }
  };

  const update = async (id: string, patch: Partial<Room>) => {
    setRooms(r => r.map(x => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('project_rooms').update(patch).eq('id', id);
    if (error) { toast.error('Erro ao salvar'); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este ambiente?')) return;
    const { error } = await supabase.from('project_rooms').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else load();
  };

  const importFromItems = async () => {
    const { data } = await supabase.from('budget_items').select('room_label, unit_price, quantity').eq('budget_id', budgetId);
    const map = new Map<string, Decimal>();
    (data || []).forEach(i => {
      const k = (i.room_label || '').trim();
      if (!k) return;
      map.set(k, (map.get(k) || new Decimal(0)).plus(new Decimal(i.unit_price || 0).times(i.quantity || 1)));
    });
    const existing = new Set(rooms.map(r => r.name.toLowerCase()));
    const rows = [...map.entries()].filter(([k]) => !existing.has(k.toLowerCase()))
      .map(([name, v], idx) => ({ budget_id: budgetId, name, value: v.toDecimalPlaces(2).toNumber(), sort_order: rooms.length + idx }));
    if (!rows.length) { toast.info('Nenhum ambiente novo encontrado nos itens do orçamento'); return; }
    const { error } = await supabase.from('project_rooms').insert(rows);
    if (error) toast.error('Erro ao importar'); else { toast.success(`${rows.length} ambiente(s) importado(s)`); load(); }
  };

  const total = rooms.reduce((s, r) => s.plus(r.value || 0), new Decimal(0));
  const diff = new Decimal(finalPrice || 0).minus(total);
  const done = rooms.filter(r => r.status === 'concluido').length;

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Soma dos ambientes</p><p className="font-semibold">{formatBRL(total.toNumber())}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Diferença p/ orçamento</p><p className={`font-semibold ${diff.abs().gt(0.01) ? 'text-warning' : 'text-success'}`}>{formatBRL(diff.toNumber())}</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Concluídos</p><p className="font-semibold">{done} de {rooms.length}</p></div>
      </div>

      <div className="space-y-2">
        {rooms.map(r => (
          <div key={r.id} className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_140px_150px_140px_auto] sm:items-center">
            <Input defaultValue={r.name} onBlur={e => e.target.value !== r.name && update(r.id, { name: e.target.value })} className="h-9" />
            <Input type="number" step="0.01" defaultValue={r.value} onFocus={e => e.target.select()}
              onBlur={e => Number(e.target.value) !== r.value && update(r.id, { value: Number(e.target.value) || 0 })} className="h-9" />
            <Select value={r.status} onValueChange={v => update(r.id, { status: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ROOM_STATUSES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={r.due_date || ''} onChange={e => update(r.id, { due_date: e.target.value || null })} className="h-9" />
            <button onClick={() => remove(r.id)} className="justify-self-end rounded p-1.5 hover:bg-destructive/10" title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></button>
          </div>
        ))}
        {!rooms.length && <p className="text-sm text-muted-foreground">Nenhum ambiente ainda. Adicione (ex.: Cozinha, Suíte) ou importe dos itens do orçamento.</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Novo ambiente (ex.: Cozinha)" value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add(newName)} className="h-9 max-w-xs" />
        <Button size="sm" onClick={() => add(newName)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        <Button size="sm" variant="outline" onClick={importFromItems}><Wand2 className="h-4 w-4 mr-1" /> Importar dos itens</Button>
      </div>
    </div>
  );
}
