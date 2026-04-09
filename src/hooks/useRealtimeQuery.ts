import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook for fetching data with Supabase realtime subscriptions.
 * Automatically refetches when the table changes.
 */
export function useRealtimeData<T>(
  tables: string[],
  fetchFn: () => Promise<T>,
  deps: any[] = []
) {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const result = await fetchRef.current();
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      console.error('useRealtimeData fetch error:', err);
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh, ...deps]);

  // Realtime subscription
  useEffect(() => {
    if (!user || tables.length === 0) return;

    const channelName = `rt-${tables.join('-')}-${user.id}-${Date.now()}`;
    let channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => { refresh(); }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, tables.join(','), refresh]);

  return { data, loading, refresh };
}
