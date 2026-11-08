import { render, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { usePermissions } from './usePermissions';

const { channels, removed } = vi.hoisted(() => ({ channels: new Map<string, { subscribed: boolean }>(), removed: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: async () => ({ data: [{ role: 'admin' }], error: null }) }) }),
  channel: (name: string) => {
    const state = channels.get(name) ?? { subscribed: false };
    channels.set(name, state);
    const channel = {
      on: () => {
        if (state.subscribed) throw new Error('cannot add callbacks after subscribe');
        return channel;
      },
      subscribe: () => { state.subscribed = true; return channel; },
    };
    return channel;
  },
  removeChannel: removed,
} }));

afterEach(() => { cleanup(); channels.clear(); removed.mockClear(); });

it('Concurrent permission consumers never reuse a subscribed channel', async () => {
  function Consumer() {
    const { can, loading } = usePermissions();
    return <span>{loading ? 'loading' : can('finance.view') ? 'allowed' : 'denied'}</span>;
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(<QueryClientProvider client={client}><Consumer /><Consumer /><Consumer /></QueryClientProvider>);
  await waitFor(() => expect(rendered.getAllByText('allowed')).toHaveLength(3));
  expect(channels.size).toBe(3);
  rendered.unmount();
  expect(removed).toHaveBeenCalledTimes(3);
});