import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, X, AlertCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const severityStyles: Record<string, string> = {
  info: 'bg-info/10 text-info border-info/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function NotificationsPage() {
  const { notifications, unreadCount, markAllRead, markRead, dismiss } = useNotifications();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Central de Alertas</h1>
          <p className="text-muted-foreground text-sm mt-1">{unreadCount} não lidas • {notifications.length} no total</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" /> Marcar tudo como lido
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Bell className="h-5 w-5 text-primary" /> Histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              Sem alertas no momento. Tudo sob controle.
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = n.severity === 'critical' ? AlertCircle : Clock;
              const body = (
                <div className={cn('flex gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50', !n.read_at && 'bg-primary/5')}>
                  <div className={cn('h-9 w-9 shrink-0 rounded-full flex items-center justify-center border', severityStyles[n.severity])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {new Date(n.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(n.id); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
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
        </CardContent>
      </Card>
    </div>
  );
}
