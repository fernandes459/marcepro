import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings, User, Building, Users, Plus, Pencil, Trash2, LogOut, Shield, UserPlus, Copy, Link, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Employee {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  salary: number;
  hire_date: string | null;
  status: string;
  notes: string | null;
}

interface CardFees {
  [installments: string]: number; // e.g. "1": 0, "2": 3.5, "12": 12
}

interface CompanySettings {
  company_name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  cep: string;
  default_margin: string;
  card_fees: CardFees;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  sales: 'Vendedor',
  production: 'Produção',
  assembly: 'Montagem',
  partner: 'Sócio',
};

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-destructive/10 text-destructive',
  manager: 'bg-primary/10 text-primary',
  sales: 'bg-info/10 text-info',
  production: 'bg-warning/10 text-warning',
  assembly: 'bg-accent text-accent-foreground',
  partner: 'bg-success/10 text-success',
};

const accessRoleLabels: Record<string, string> = {
  admin: 'Administrador (acesso total)',
  partner: 'Sócio (ver cadastros, contratos, relatórios)',
  sales: 'Vendedor (cadastros, orçamentos)',
  production: 'Produção (kanban de produção)',
  viewer: 'Somente Leitura (ver relatórios)',
};

const accessPermissions: Record<string, string[]> = {
  admin: ['Acesso total a todos os módulos', 'Gerenciar equipe e configurações', 'Lançar e editar financeiro', 'Cadastrar clientes e orçamentos'],
  partner: ['Ver cadastro de clientes', 'Ver contratos e orçamentos', 'Ver relatórios financeiros', 'Ver contas a pagar/receber', 'Sem acesso para editar ou lançar'],
  sales: ['Cadastrar e editar clientes', 'Criar e editar orçamentos', 'Ver relatórios de vendas'],
  production: ['Ver e gerenciar kanban de produção', 'Ver materiais dos projetos'],
  viewer: ['Ver relatório financeiro', 'Ver contas a pagar/receber', 'Sem acesso para editar ou lançar'],
};

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanySettings>({
    company_name: '', cnpj: '', phone: '', email: '', address: '', city: '', state: '', cep: '', default_margin: '40', card_fees: {},
  });

  // Team access
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamEmail, setTeamEmail] = useState('');
  const [teamRole, setTeamRole] = useState('partner');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const emptyEmpForm = {
    name: '', role: 'production', email: '', phone: '', cpf: '', salary: '', hire_date: '', notes: '',
  };
  const [empForm, setEmpForm] = useState(emptyEmpForm);

  useEffect(() => { if (user) { fetchEmployees(); fetchCompany(); fetchTeamMembers(); } }, [user]);

  async function fetchEmployees() {
    const { data } = await supabase.from('employees').select('*').order('name');
    if (data) setEmployees(data as Employee[]);
  }

  async function fetchCompany() {
    const { data } = await supabase.from('company_settings').select('*').maybeSingle();
    if (data) {
      setCompany({
        company_name: data.company_name || '',
        cnpj: data.cnpj || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        cep: data.cep || '',
        default_margin: String(data.default_margin || 40),
        card_fees: (data as any).card_fees || {},
      });
    }
  }

  async function fetchTeamMembers() {
    const { data } = await supabase.from('user_roles').select('*');
    if (data) setTeamMembers(data as TeamMember[]);
  }

  async function saveCompany() {
    const { data: existing } = await supabase.from('company_settings').select('id').eq('user_id', user!.id).maybeSingle();
    const payload = {
      user_id: user!.id,
      company_name: company.company_name || null,
      cnpj: company.cnpj || null,
      phone: company.phone || null,
      email: company.email || null,
      address: company.address || null,
      city: company.city || null,
      state: company.state || null,
      cep: company.cep || null,
      default_margin: parseFloat(company.default_margin) || 40,
      card_fees: company.card_fees,
    } as any;
    if (existing) {
      await supabase.from('company_settings').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('company_settings').insert(payload);
    }
    toast.success('Configurações da empresa salvas!');
  }

  function openNewEmployee() {
    setEditingId(null);
    setEmpForm(emptyEmpForm);
    setDialogOpen(true);
  }

  function openEditEmployee(emp: Employee) {
    setEditingId(emp.id);
    setEmpForm({
      name: emp.name, role: emp.role, email: emp.email || '', phone: emp.phone || '',
      cpf: emp.cpf || '', salary: String(emp.salary || ''), hire_date: emp.hire_date || '', notes: emp.notes || '',
    });
    setDialogOpen(true);
  }

  async function saveEmployee() {
    if (!empForm.name) { toast.error('Nome é obrigatório'); return; }
    const payload = {
      user_id: user!.id,
      name: empForm.name,
      role: empForm.role,
      email: empForm.email || null,
      phone: empForm.phone || null,
      cpf: empForm.cpf || null,
      salary: parseFloat(empForm.salary) || 0,
      hire_date: empForm.hire_date || null,
      notes: empForm.notes || null,
    };
    if (editingId) {
      await supabase.from('employees').update(payload).eq('id', editingId);
      toast.success('Funcionário atualizado!');
    } else {
      await supabase.from('employees').insert(payload);
      toast.success('Funcionário cadastrado!');
    }
    setDialogOpen(false);
    fetchEmployees();
  }

  async function toggleStatus(emp: Employee) {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    await supabase.from('employees').update({ status: newStatus }).eq('id', emp.id);
    fetchEmployees();
    toast.success(newStatus === 'active' ? 'Funcionário ativado' : 'Funcionário desativado');
  }

  async function deleteEmployee(id: string) {
    await supabase.from('employees').delete().eq('id', id);
    setEmployees(prev => prev.filter(e => e.id !== id));
    toast.success('Funcionário removido');
  }

  async function removeTeamMember(id: string) {
    await supabase.from('user_roles').delete().eq('id', id);
    fetchTeamMembers();
    toast.success('Acesso removido');
  }

  async function addTeamMember() {
    if (!teamEmail.trim()) { toast.error('Informe o email do colaborador'); return; }
    // Look up user by email - we need to find their user_id
    // Since we can't query auth.users directly, we'll insert the role
    // and use a lookup approach: check if a user with this email exists via user_roles
    // We'll use the supabase admin approach - search by email in auth
    const { data: userData, error: lookupError } = await supabase.rpc('get_user_id_by_email' as any, { _email: teamEmail.trim() });
    
    if (lookupError || !userData) {
      // Fallback: try to find from existing team members or just save with email for later linking
      toast.error('Usuário não encontrado. Verifique se o colaborador já criou a conta com este email.');
      return;
    }

    const targetUserId = userData as string;
    
    // Check if already has a role
    const { data: existing } = await supabase.from('user_roles').select('id').eq('user_id', targetUserId);
    if (existing && existing.length > 0) {
      // Update existing role
      await supabase.from('user_roles').update({ role: teamRole as any, owner_id: user!.id } as any).eq('user_id', targetUserId);
      toast.success('Acesso atualizado!');
    } else {
      await supabase.from('user_roles').insert({ user_id: targetUserId, role: teamRole as any, owner_id: user!.id } as any);
      toast.success('Acesso concedido!');
    }
    setTeamEmail('');
    fetchTeamMembers();
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie sua empresa, equipe e preferências</p>
        </div>
        <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-2" /> Sair</Button>
      </div>

      <Tabs defaultValue="company">
        <TabsList className="flex-wrap">
          <TabsTrigger value="company"><Building className="h-4 w-4 mr-1" /> Empresa</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-4 w-4 mr-1" /> Equipe</TabsTrigger>
          <TabsTrigger value="access"><Shield className="h-4 w-4 mr-1" /> Acessos</TabsTrigger>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1" /> Perfil</TabsTrigger>
        </TabsList>

        {/* Company */}
        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><Building className="h-4 w-4" /> Dados da Empresa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nome da Empresa</Label><Input value={company.company_name} onChange={e => setCompany({ ...company, company_name: e.target.value })} placeholder="Marcenaria XYZ" /></div>
                <div className="space-y-2"><Label>CNPJ</Label><Input value={company.cnpj} onChange={e => setCompany({ ...company, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} placeholder="(00) 00000-0000" /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} placeholder="contato@empresa.com" /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })} placeholder="Rua, número, bairro" /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={company.city} onChange={e => setCompany({ ...company, city: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>UF</Label><Input value={company.state} onChange={e => setCompany({ ...company, state: e.target.value })} maxLength={2} /></div>
                  <div className="space-y-2"><Label>CEP</Label><Input value={company.cep} onChange={e => setCompany({ ...company, cep: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Margem de Lucro Padrão (%)</Label><Input type="number" value={company.default_margin} onChange={e => setCompany({ ...company, default_margin: e.target.value })} /></div>
              </div>
              <Button className="gradient-primary shadow-primary border-0" onClick={saveCompany}>Salvar Configurações</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-display flex items-center gap-2"><Users className="h-4 w-4" /> Equipe</CardTitle>
              <Button size="sm" className="gradient-primary shadow-primary border-0" onClick={openNewEmployee}>
                <Plus className="h-4 w-4 mr-1" /> Novo Funcionário
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Cargo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Contato</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Salário</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum funcionário cadastrado</td></tr>
                    ) : employees.map(emp => (
                      <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{emp.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${roleBadgeColors[emp.role] || 'bg-muted text-muted-foreground'}`}>
                            {roleLabels[emp.role] || emp.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{emp.phone || emp.email || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {emp.salary ? `R$ ${Number(emp.salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleStatus(emp)} className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer ${emp.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                            {emp.status === 'active' ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditEmployee(emp)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteEmployee(emp.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Control */}
        <TabsContent value="access">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Controle de Acessos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Gerencie quem tem acesso ao sistema e quais permissões cada pessoa possui.
                </p>
                
                {/* Current team members */}
                <div className="space-y-3">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="text-sm font-medium">{member.user_id === user?.id ? 'Você' : member.user_id.slice(0, 8) + '...'}</p>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold mt-1 ${
                          member.role === 'admin' ? 'bg-destructive/10 text-destructive' :
                          member.role === 'partner' ? 'bg-success/10 text-success' :
                          member.role === 'viewer' ? 'bg-muted text-muted-foreground' :
                          'bg-info/10 text-info'
                        }`}>
                          {accessRoleLabels[member.role] || member.role}
                        </span>
                      </div>
                      {member.user_id !== user?.id && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeTeamMember(member.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Role descriptions */}
                <div className="space-y-3 mt-6">
                  <h3 className="text-sm font-semibold">Níveis de Acesso Disponíveis</h3>
                  {Object.entries(accessPermissions).map(([role, perms]) => (
                    <div key={role} className="rounded-lg border border-border p-4">
                      <p className="text-sm font-semibold mb-2">{accessRoleLabels[role]}</p>
                      <ul className="space-y-1">
                        {perms.map((perm, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            {perm}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 bg-accent/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Link className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Convidar Colaborador</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compartilhe o link abaixo para que o colaborador crie uma conta no sistema. Após o cadastro, volte aqui e atribua o nível de acesso.
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={`${window.location.origin}/login`} 
                      className="text-xs"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/login`);
                        toast.success('Link copiado!');
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Email do colaborador" value={teamEmail} onChange={e => setTeamEmail(e.target.value)} className="text-xs" />
                    <Select value={teamRole} onValueChange={setTeamRole}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(accessRoleLabels).filter(([k]) => k !== 'admin').map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label.split(' (')[0]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full gradient-primary shadow-primary border-0 mt-2" onClick={addTeamMember}>
                    <UserPlus className="h-4 w-4 mr-2" /> Confirmar Acesso
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    💡 O colaborador precisa ter criado a conta primeiro. Depois, informe o email e o nível de acesso aqui.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><User className="h-4 w-4" /> Seu Perfil</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>
              <p className="text-xs text-muted-foreground">Seu email é vinculado à conta de autenticação e não pode ser alterado aqui.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? 'Editar Funcionário' : 'Novo Funcionário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} placeholder="Nome completo" /></div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={empForm.role} onValueChange={v => setEmpForm({ ...empForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="sales">Vendedor</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                  <SelectItem value="assembly">Montagem</SelectItem>
                  <SelectItem value="partner">Sócio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>CPF</Label><Input value={empForm.cpf} onChange={e => setEmpForm({ ...empForm, cpf: e.target.value })} /></div>
              <div className="space-y-2"><Label>Salário (R$)</Label><Input type="number" value={empForm.salary} onChange={e => setEmpForm({ ...empForm, salary: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Data de Admissão</Label><Input type="date" value={empForm.hire_date} onChange={e => setEmpForm({ ...empForm, hire_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Observações</Label><Input value={empForm.notes} onChange={e => setEmpForm({ ...empForm, notes: e.target.value })} placeholder="Notas" /></div>
            <Button className="w-full gradient-primary shadow-primary border-0" onClick={saveEmployee}>{editingId ? 'Salvar Alterações' : 'Cadastrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
