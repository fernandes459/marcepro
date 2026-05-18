import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertCircle, Clock, CheckCheck, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotifications, generateSmartNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';

const severityStyles: Record<string, string> = {
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
};

export default function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead, dismiss, refresh } = useNotifications();

  // Generate on mount + every 5 min
  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async () => {
      const created = await generateSmartNotifications(user.id);
      if (active && created > 0) refresh();
    };
    run();
    const id = setInterval(run, 5 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [user, refresh]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative rounded-lg p-2 hover:bg-muted transition-colors" aria-label="Notificações">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="font-display text-sm font-bold">Central de alertas</h3>
            <p className="text-[11px] text-muted-foreground">{unreadCount} não lidas</p>
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
              Sem alertas no momento
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = n.severity === 'critical' ? AlertCircle : Clock;
              const body = (
                <div className={cn('flex gap-3 px-4 py-3 border-b last:border-0 transition-colors hover:bg-muted/50', !n.read_at && 'bg-primary/5')}>
                  <div className={cn('h-8 w-8 shrink-0 rounded-full flex items-center justify-center', severityStyles[n.severity])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(n.id); }}
                    className="text-muted-foreground/60 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
              return n.link ? (
                <Link key={n.id} to={n.link} onClick={() => !n.read_at && markRead(n.id)}>{body}</Link>
              ) : (
                <div key={n.id} onClick={() => !n.read_at && markRead(n.id)}>{body}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
