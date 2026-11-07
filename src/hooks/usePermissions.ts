import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, type AppRole, type Permission } from '@/lib/rbac';

export function usePermissions() {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['permissions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      if (error) throw error;
      return data.map(row => row.role as AppRole);
    },
    staleTime: 30_000,
  });
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`permissions-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        () => { void client.invalidateQueries({ queryKey: ['permissions', user.id] }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, client]);
  const roles = query.isError ? [] : query.data ?? [];
  return { roles, loading: !!user && query.isPending, error: query.isError,
    can: (permission: Permission) => hasPermission(roles, permission) };
}