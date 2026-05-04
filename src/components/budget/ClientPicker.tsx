import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, X, User, Phone, MapPin, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export interface ClientLite {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  cpf_cnpj: string | null;
  address: string | null;
  neighborhood: string | null;
  state: string | null;
  cep: string | null;
  address_number: string | null;
  complement: string | null;
}

interface Props {
  clients: ClientLite[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClientCreated?: (client: ClientLite) => void;
}

const onlyDigits = (v: string) => v.replace(/\D/g, '');

const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : a ? `(${a}` : '');
  }
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`);
};

const formatCep = (v: string) => onlyDigits(v).slice(0, 8).replace(/^(\d{5})(\d{0,3}).*/, (_, a, b) => b ? `${a}-${b}` : a);

export default function ClientPicker({ clients, selectedId, onSelect, onClientCreated }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => clients.find(c => c.id === selectedId) || null, [clients, selectedId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = onlyDigits(query);
    if (!q) return clients.slice(0, 8);
    return clients
      .filter(c => {
        const nameHit = c.name.toLowerCase().includes(q);
        const phoneHit = qDigits.length > 0 && onlyDigits(c.phone || '').includes(qDigits);
        return nameHit || phoneHit;
      })
      .slice(0, 12);
  }, [clients, query]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => { setHighlighted(0); }, [query, open]);

  const handlePick = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlighted]) handlePick(results[highlighted].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // ---- Create new client modal state ----
  const [form, setForm] = useState({
    name: '', phone: '', cpf_cnpj: '', cep: '',
    address: '', address_number: '', complement: '',
    neighborhood: '', city: '', state: '',
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => setForm({
    name: '', phone: '', cpf_cnpj: '', cep: '',
    address: '', address_number: '', complement: '',
    neighborhood: '', city: '', state: '',
  });

  const lookupCep = async (cep: string) => {
    const cleaned = onlyDigits(cep);
    if (cleaned.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não encontrado');
      } else {
        setForm(f => ({
          ...f,
          address: data.logradouro || f.address,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
      }
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setCepLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) { toast.error('Informe o nome do cliente'); return; }
    if (!form.phone.trim()) { toast.error('Informe o telefone'); return; }

    // duplicate check by phone (digits only)
    const phoneDigits = onlyDigits(form.phone);
    const dup = clients.find(c => onlyDigits(c.phone || '') === phoneDigits && phoneDigits.length >= 10);
    if (dup) {
      toast.warning(`Já existe um cliente com este telefone: ${dup.name}. Selecionado automaticamente.`);
      onSelect(dup.id);
      setCreateOpen(false);
      resetForm();
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.from('clients').insert({
      user_id: user.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      cpf_cnpj: form.cpf_cnpj || null,
      cep: form.cep || null,
      address: form.address || null,
      address_number: form.address_number || null,
      complement: form.complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
    } as any).select('*').single();
    setSaving(false);

    if (error || !data) {
      toast.error('Erro ao cadastrar cliente');
      console.error(error);
      return;
    }
    toast.success('Cliente cadastrado e selecionado');
    onClientCreated?.(data as ClientLite);
    onSelect((data as any).id);
    setCreateOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente *</Label>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Novo Cliente
        </button>
      </div>

      {/* Selected display */}
      {selected && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(''); }}
          className="w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 h-11 text-left hover:bg-muted/40 transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{selected.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {selected.phone}{selected.city ? ` · ${selected.city}` : ''}
              </p>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">Trocar</span>
        </button>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus={open}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKey}
            placeholder="Buscar por nome ou telefone..."
            className="h-11 pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted-foreground/15 hover:bg-muted-foreground/30 flex items-center justify-center"
              aria-label="Limpar"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="relative">
          <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setOpen(false); setCreateOpen(true); }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar novo cliente
                </Button>
              </div>
            ) : (
              <ul className="py-1">
                {results.map((c, idx) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlighted(idx)}
                      onClick={() => handlePick(c.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition',
                        idx === highlighted ? 'bg-accent' : 'hover:bg-muted/60',
                      )}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate flex items-center gap-1.5">
                          {c.name}
                          {c.id === selectedId && <Check className="h-3.5 w-3.5 text-primary" />}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2 truncate">
                          <Phone className="h-3 w-3" /> {c.phone || '—'}
                          {c.city && (<><span>·</span><MapPin className="h-3 w-3" />{c.city}</>)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Auto-fill preview */}
      {selected && !open && (selected.cpf_cnpj || selected.address || selected.cep) && (
        <div className="rounded-md bg-muted/30 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
          {selected.cpf_cnpj && <p><span className="font-medium text-foreground/80">CPF/CNPJ:</span> {selected.cpf_cnpj}</p>}
          {(selected.address || selected.cep) && (
            <p>
              <span className="font-medium text-foreground/80">Endereço:</span>{' '}
              {[
                [selected.address, selected.address_number].filter(Boolean).join(', '),
                selected.complement,
                selected.neighborhood,
                [selected.city, selected.state].filter(Boolean).join('/'),
                selected.cep,
              ].filter(Boolean).join(' — ')}
            </p>
          )}
        </div>
      )}

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone *</Label>
                <Input
                  inputMode="numeric"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input value={form.cpf_cnpj} onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CEP</Label>
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    value={form.cep}
                    onChange={e => {
                      const v = formatCep(e.target.value);
                      setForm(f => ({ ...f, cep: v }));
                      if (onlyDigits(v).length === 8) lookupCep(v);
                    }}
                    placeholder="00000-000"
                  />
                  {cepLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Número</Label>
                <Input value={form.address_number} onChange={e => setForm(f => ({ ...f, address_number: e.target.value }))} maxLength={20} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Endereço</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Complemento</Label>
                <Input value={form.complement} onChange={e => setForm(f => ({ ...f, complement: e.target.value }))} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bairro</Label>
                <Input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade / UF</Label>
                <div className="flex gap-2">
                  <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Cidade" />
                  <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="UF" className="w-16" />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Salvar e selecionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
