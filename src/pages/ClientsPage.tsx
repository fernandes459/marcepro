import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Search, Phone, Mail, MapPin, MoreHorizontal, Share2, Loader2, Trash2, Edit,
  Users, TrendingUp, Receipt, FileSpreadsheet, MessageCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SearchInput } from '@/components/SearchInput';
import { formatBRL } from '@/lib/format';

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf_cnpj: string | null;
  cep: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  total_spent: number;
  budgets_count: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '', phone: '', cpf_cnpj: '', email: '', cep: '',
    address: '', address_number: '', complement: '', neighborhood: '', city: '', state: '',
  });

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar clientes');
      console.error(error);
    } else {
      setClients((data || []) as Client[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  // Realtime subscription for clients
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`clients-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchClients();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.city || '').toLowerCase().includes(search.toLowerCase())
  );

  const kpis = useMemo(() => {
    const totalRevenue = clients.reduce((s, c) => s + Number(c.total_spent || 0), 0);
    const totalBudgets = clients.reduce((s, c) => s + Number(c.budgets_count || 0), 0);
    const ticket = totalBudgets > 0 ? totalRevenue / totalBudgets : 0;
    return { count: clients.length, revenue: totalRevenue, ticket };
  }, [clients]);

  const exportToExcel = () => {
    if (filtered.length === 0) { toast.error('Nada para exportar'); return; }
    const rows = filtered.map(c => ({
      'Nome': c.name,
      'Telefone': c.phone,
      'Email': c.email || '',
      'CPF/CNPJ': c.cpf_cnpj || '',
      'CEP': c.cep || '',
      'Endereço': [c.address, c.address_number, c.complement].filter(Boolean).join(', '),
      'Bairro': c.neighborhood || '',
      'Cidade': c.city || '',
      'UF': c.state || '',
      'Orçamentos': Number(c.budgets_count || 0),
      'Total Gasto': Number(c.total_spent || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filtered.length} cliente(s) exportado(s)`);
  };

  const openWhatsAppChat = (client: Client) => {
    const phone = (client.phone || '').replace(/\D/g, '');
    if (!phone) { toast.error('Cliente sem telefone'); return; }
    const intl = phone.startsWith('55') ? phone : `55${phone}`;
    window.open(`https://wa.me/${intl}`, '_blank');
  };

  const lookupCep = async (cep: string) => {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não encontrado');
      } else {
        setForm((f) => ({
          ...f,
          address: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || '',
        }));
      }
    } catch {
      toast.error('Erro ao buscar CEP');
    }
    setCepLoading(false);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('clients').insert({
      user_id: user.id,
      name: form.name,
      phone: form.phone,
      cpf_cnpj: form.cpf_cnpj || null,
      email: form.email || null,
      cep: form.cep || null,
      address: form.address || null,
      address_number: form.address_number || null,
      complement: form.complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error('Erro ao cadastrar cliente');
      console.error(error);
    } else {
      toast.success('Cliente cadastrado com sucesso!');
      setForm({ name: '', phone: '', cpf_cnpj: '', email: '', cep: '', address: '', address_number: '', complement: '', neighborhood: '', city: '', state: '' });
      setDialogOpen(false);
      fetchClients();
    }
  };

  const handleDeleteClient = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir cliente');
    } else {
      toast.success('Cliente excluído');
      fetchClients();
    }
  };

  const shareAddressWhatsApp = (client: Client) => {
    const addrParts = [client.address, client.address_number].filter(Boolean).join(', ');
    const parts = [addrParts, client.complement, client.neighborhood, client.city, client.state].filter(Boolean);
    const addressText = parts.join(', ');
    if (!addressText) {
      toast.error('Cliente sem endereço cadastrado');
      return;
    }
    const text = `📍 Endereço de ${client.name}:\n${addressText}${client.cep ? `\nCEP: ${client.cep}` : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{clients.length} clientes cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-primary border-0">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input placeholder="Nome completo" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Input placeholder="(00) 00000-0000" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <Input placeholder="000.000.000-00" value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>

              {/* CEP auto-fill */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input
                      placeholder="00000-000"
                      value={form.cep}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm({ ...form, cep: v });
                        if (v.replace(/\D/g, '').length === 8) lookupCep(v);
                      }}
                    />
                    {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input placeholder="UF" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-1">
                  <Label>Endereço</Label>
                  <Input placeholder="Rua" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input placeholder="Nº" value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input placeholder="Bloco, Apto..." value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} />
                </div>
              </div>

              <Button type="submit" className="w-full gradient-primary shadow-primary border-0" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cadastrar Cliente
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, telefone ou cidade..." className="flex-1 min-w-[220px] max-w-md" />
        {search && <span className="text-xs text-muted-foreground">{filtered.length} resultado(s)</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Nenhum cliente encontrado</p>
          <p className="text-sm mt-1">Cadastre seu primeiro cliente clicando no botão acima.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <motion.div key={client.id} variants={itemVariants}>
              <Card className="hover:shadow-md transition-shadow group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                        {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.cpf_cnpj || '—'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClient(client.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span>{client.email}</span>
                      </div>
                    )}
                    {(client.city || client.address) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{[client.city, client.state].filter(Boolean).join(' - ') || client.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => shareAddressWhatsApp(client)}
                    >
                      <Share2 className="h-3 w-3 mr-1" />
                      Endereço WhatsApp
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total gasto</p>
                      <p className="text-sm font-bold">R$ {Number(client.total_spent).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Orçamentos</p>
                      <p className="text-sm font-bold">{client.budgets_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
