import { useState, createContext, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Factory,
  LifeBuoy,
  DollarSign,
  TrendingUp,
  Settings,
  Menu,
  LogOut,
  Package,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from '@/components/NotificationBell';

type NavGroup = {
  label: string;
  items: { path: string; label: string; icon: typeof LayoutDashboard }[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Comercial',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/crm', label: 'Funil CRM', icon: Target },
      { path: '/clientes', label: 'Clientes', icon: Users },
      { path: '/orcamentos', label: 'Orçamentos', icon: FileText },
    ],
  },
  {
    label: 'Operacional',
    items: [
      { path: '/producao', label: 'Produção', icon: Factory },
      { path: '/assistencia', label: 'Assistência', icon: LifeBuoy },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { path: '/financeiro', label: 'Financeiro', icon: DollarSign },
      { path: '/gestao', label: 'Gestão', icon: TrendingUp },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { path: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

interface LayoutContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType>({ collapsed: false, setCollapsed: () => {} });

export function useLayout() {
  return useContext(LayoutContext);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth() as any;

  // Discover the page title from current route
  const currentItem = navGroups.flatMap((g) => g.items).find((i) => i.path === location.pathname);
  const pageTitle = currentItem?.label ?? '';

  // Initial of user for avatar
  const initial = (user?.email?.[0] ?? 'A').toUpperCase();

  return (
    <LayoutContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 lg:relative border-r border-sidebar-border',
            collapsed ? 'w-[72px]' : 'w-64',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Brand */}
          <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-gold shadow-primary">
              <span className="font-display text-xl font-extrabold text-primary-foreground">M</span>
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col leading-tight"
              >
                <span className="font-display text-base font-bold text-sidebar-primary-foreground">
                  Marcenaria PRO
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                  ERP Premium v2.0
                </span>
              </motion.div>
            )}
          </div>

          {/* Nav grouped */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/45">
                    {group.label}
                  </p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                            : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />
                        )}
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-primary')} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer — user + collapse */}
          <div className="border-t border-sidebar-border p-3 space-y-2">
            {!collapsed && user && (
              <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs">
                <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center font-bold text-primary-foreground shrink-0">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sidebar-primary-foreground truncate">Usuário</p>
                  <p className="text-[10px] text-sidebar-foreground/60 truncate">{user.email}</p>
                </div>
                {signOut && (
                  <button
                    onClick={() => signOut()}
                    title="Sair"
                    className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-destructive transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
            >
              <Menu className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Recolher menu</span>}
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card/80 backdrop-blur px-4 lg:px-6">
            <button
              className="lg:hidden rounded-lg p-2 hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
              {pageTitle}
            </h2>
            <div className="flex-1" />
            <NotificationBell />
            <div className="h-9 w-9 rounded-full gradient-gold flex items-center justify-center text-sm font-bold text-primary-foreground shadow-primary">
              {initial}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
