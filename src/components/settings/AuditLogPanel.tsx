import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Plus, Pencil, Trash2, LogIn, CheckCircle2, Sparkles } from 'lucide-react';
import { listAuditLogs, type AuditLogRow } from '@/lib/audit';

const actionMeta: Record<string, { label: string; icon: any; tone: string }> = {
  create:   { label: 'Criou',     icon: Plus,         tone: 'bg-success/10 text-success' },
  update:   { label: 'Editou',    icon: Pencil,       tone: 'bg-primary/10 text-primary' },
  delete:   { label: 'Excluiu',   icon: Trash2,       tone: 'bg-destructive/10 text-destructive' },
  approve:  { label: 'Aprovou',   icon: CheckCircle2, tone: 'bg-success/10 text-success' },
  login:    { label: 'Entrou',    icon: LogIn,        tone: 'bg-muted text-foreground' },
  ai_run:   { label: 'IA',        icon: Sparkles,     tone: 'bg-accent text-accent-foreground' },
};

const moduleLabel: Record<string, string> = {
  budgets: 'Orçamentos',
  finance: 'Financeiro',
  clients: 'Clientes',
  production: 'Produção',
  assistance: 'Assistência',
  employees: 'Equipe',
  company: 'Empresa',
  auth: 'Acesso',
  settings: 'Configurações',
  ai: 'IA',
};

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAuditLogs({ limit: 100 })
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Activity className="h-5 w-5 text-primary" />
          Trilha de Auditoria
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Últimas 100 ações registradas na empresa.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há registros de auditoria.
          </p>
        ) : (
          <ScrollArea className="h-[420px] pr-2">
            <ul className="space-y-2">
              {logs.map((log) => {
                const meta = actionMeta[log.action] ?? {
                  label: log.action, icon: Activity, tone: 'bg-muted text-foreground',
                };
                const Icon = meta.icon;
                return (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className={`rounded-md p-1.5 ${meta.tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold">{meta.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {moduleLabel[log.module] ?? log.module}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {log.summary && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {log.summary}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
