import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { canAccessRoute, ROUTE_PERMISSIONS } from '@/lib/rbac';

export default function RouteAccess({ children }: { children: React.ReactNode }) {
  const { roles, loading, error } = usePermissions();
  const { pathname } = useLocation();
  if (loading) return <div role="status" className="py-10 text-center text-muted-foreground">Verificando acesso…</div>;
  if (error) return <div role="alert" className="py-10 text-center text-destructive">Não foi possível verificar suas permissões. Atualize a página.</div>;
  if (!canAccessRoute(roles, pathname)) {
    const allowed = Object.keys(ROUTE_PERMISSIONS).find(path => canAccessRoute(roles, path));
    if (pathname === '/' && allowed) return <Navigate to={allowed} replace />;
    return <div role="alert" className="py-10 text-center text-muted-foreground">Seu perfil não tem acesso a esta área.</div>;
  }
  return <>{children}</>;
}