import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Eye, Send, FileText, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface BudgetItem {
  name: string;
  quantity: number;
  unitPrice: number;
  materialCost: number;
  laborCost: number;
}

interface Budget {
  id: string;
  client: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'expired';
  items: BudgetItem[];
  totalCost: number;
  profitMargin: number;
  finalPrice: number;
  date: string;
}

const mockBudgets: Budget[] = [
  { id: 'ORC-001', client: 'Maria Silva', status: 'approved', items: [], totalCost: 3200, profitMargin: 40, finalPrice: 4480, date: '22/03/2026' },
  { id: 'ORC-002', client: 'João Santos', status: 'pending', items: [], totalCost: 5500, profitMargin: 42, finalPrice: 7810, date: '21/03/2026' },
  { id: 'ORC-003', client: 'Ana Costa', status: 'pending', items: [], totalCost: 2100, profitMargin: 35, finalPrice: 2835, date: '20/03/2026' },
  { id: 'ORC-004', client: 'Pedro Lima', status: 'rejected', items: [], totalCost: 8500, profitMargin: 45, finalPrice: 12325, date: '19/03/2026' },
  { id: 'ORC-005', client: 'Carla Oliveira', status: 'draft', items: [], totalCost: 4000, profitMargin: 38, finalPrice: 5520, date: '18/03/2026' },
  { id: 'ORC-006', client: 'Roberto Dias', status: 'approved', items: [], totalCost: 6200, profitMargin: 40, finalPrice: 8680, date: '17/03/2026' },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  approved: { label: 'Aprovado', className: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeitado', className: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expirado', className: 'bg-muted text-muted-foreground' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function BudgetsPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [items, setItems] = useState<BudgetItem[]>([
    { name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0 },
  ]);
  const [margin, setMargin] = useState(40);

  const filtered = mockBudgets.filter(
    (b) => b.client.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase())
  );

  const totalMaterial = items.reduce((s, i) => s + i.materialCost * i.quantity, 0);
  const totalLabor = items.reduce((s, i) => s + i.laborCost * i.quantity, 0);
  const totalCost = totalMaterial + totalLabor;
  const profit = totalCost * (margin / 100);
  const finalPrice = totalCost + profit;

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0 }]);

  const updateItem = (idx: number, field: keyof BudgetItem, value: string | number) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    updated[idx].unitPrice = updated[idx].materialCost + updated[idx].laborCost;
    setItems(updated);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">{mockBudgets.length} orçamentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-primary border-0">
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Novo Orçamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); toast.success('Orçamento criado!'); setDialogOpen(false); }} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Input placeholder="Selecionar cliente" required />
                </div>
                <div className="space-y-2">
                  <Label>Margem de Lucro (%)</Label>
                  <Input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Itens do Orçamento</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2 rounded-lg bg-muted/50 p-3">
                    <Input
                      placeholder="Descrição"
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      className="col-span-2"
                    />
                    <Input
                      type="number"
                      placeholder="Qtd"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                    />
                    <Input
                      type="number"
                      placeholder="Material R$"
                      value={item.materialCost || ''}
                      onChange={(e) => updateItem(idx, 'materialCost', Number(e.target.value))}
                    />
                    <Input
                      type="number"
                      placeholder="M.O. R$"
                      value={item.laborCost || ''}
                      onChange={(e) => updateItem(idx, 'laborCost', Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>

              {/* Calculator summary */}
              <Card className="bg-accent/30 border-accent">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Material</span>
                    <span className="font-medium">R$ {totalMaterial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mão de Obra</span>
                    <span className="font-medium">R$ {totalLabor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo Total</span>
                    <span className="font-medium">R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lucro ({margin}%)</span>
                    <span className="font-medium text-success">R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between">
                    <span className="font-bold font-display">Preço Final</span>
                    <span className="font-bold font-display text-lg">R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea placeholder="Notas sobre o orçamento..." />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1 gradient-primary shadow-primary border-0">
                  <FileText className="h-4 w-4 mr-2" />
                  Salvar Orçamento
                </Button>
                <Button type="button" variant="outline">
                  <Send className="h-4 w-4 mr-2" />
                  Enviar WhatsApp
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar orçamentos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Budgets table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Margem</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preço Final</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <motion.tr key={b.id} variants={itemVariants} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{b.id}</td>
                    <td className="px-4 py-3 text-sm font-medium">{b.client}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{b.date}</td>
                    <td className="px-4 py-3 text-sm text-right">R$ {b.totalCost.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-sm text-right">{b.profitMargin}%</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">R$ {b.finalPrice.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusConfig[b.status].className}`}>
                        {statusConfig[b.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="rounded p-1.5 hover:bg-muted transition-colors" title="Visualizar">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button className="rounded p-1.5 hover:bg-muted transition-colors" title="Enviar WhatsApp">
                          <Send className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
