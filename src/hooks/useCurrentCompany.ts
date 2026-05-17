import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { AppRole } from '@/lib/rbac';

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  plan: string;
  active: boolean;
  settings: Record<string, any>;
}

interface State {
  company: Company | null;
  roles: AppRole[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Resolve a empresa ativa do usuário e seus roles.
 * Onda 1 — apenas leitura. As próximas ondas usarão isto para escopo + permissões.
 */
export function useCurrentCompany(): State {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) {
      setCompany(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: ownerIdData }, { data: rolesData }] = await Promise.all([
        supabase.rpc('get_data_owner_id', { _user_id: user.id }),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
      ]);

      const ownerId = (ownerIdData as string | null) ?? user.id;

      const { data: companyData } = await supabase
        .from('companies' as any)
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();

      setCompany((companyData as Company | null) ?? null);
      setRoles((rolesData ?? []).map((r: any) => r.role as AppRole));
    } catch (err) {
      console.error('useCurrentCompany error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { company, roles, loading, refresh: load };
}
