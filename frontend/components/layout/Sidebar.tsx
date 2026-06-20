'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  Smartphone,
  MessageSquare,
  Megaphone,
  Users,
  BarChart2,
  UserCheck,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Nav Config ───────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Sessions', href: '/dashboard/sessions', icon: Smartphone },
      { label: 'Inbox', href: '/dashboard/inbox', icon: MessageSquare },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { label: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
      { label: 'Contacts', href: '/dashboard/contacts', icon: Users },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart2 },
      { label: 'Team', href: '/dashboard/settings/team', icon: UserCheck },
      { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'badge-purple',
  TENANT_ADMIN: 'badge-green',
  AGENT: 'badge-green',
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        window.innerWidth < 768 &&
        sidebarOpen &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen, setSidebarOpen]);

  useEffect(() => {
    if (window.innerWidth < 768) {
      document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const isActive = (href: string) => (href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href));

  return (
    <>
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ── */}
      <aside
        ref={sidebarRef}
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col',
          'bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))]',
          'transition-all duration-300 ease-in-out',
          'w-[240px]',
          !sidebarOpen && '-translate-x-full',
          'md:translate-x-0 md:w-[64px]',
          'lg:w-[64px]',
          sidebarOpen && 'lg:w-[240px]',
        )}
      >
        {/* ── Desktop toggle ── */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'hidden lg:flex absolute -right-3 top-[26px] z-50',
            'h-6 w-6 items-center justify-center rounded-full',
            'border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))]',
            'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            'shadow-sm transition-colors duration-150',
          )}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* ── Logo ── */}
        <div className="flex h-14 shrink-0 items-center gap-3 px-4 border-b border-[hsl(var(--sidebar-border))]">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              'bg-[hsl(var(--green))] text-[hsl(var(--primary-foreground))]',
            )}
          >
            <Zap size={16} strokeWidth={2.5} />
          </div>
          <span
            className={cn(
              'text-sm font-semibold tracking-tight text-[hsl(var(--foreground))] truncate',
              'md:hidden',
              sidebarOpen && 'lg:block',
            )}
          >
            NotifyTechAI
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] md:hidden transition-colors"
            aria-label="Close sidebar"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-5 px-2">
          <div className="space-y-6">
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                {/* Section label */}
                <p
                  className={cn(
                    'mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.1em]',
                    'text-[hsl(var(--muted-foreground))]/50',
                    'md:hidden',
                    sidebarOpen && 'lg:block',
                  )}
                >
                  {section.label}
                </p>

                <ul className="space-y-0.5">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    // Full link (mobile drawer + desktop expanded)
                    const fullLink = (
                      <Link
                        href={item.href}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150',
                          active
                            ? 'text-[hsl(var(--green))] bg-[hsl(var(--green))]/8 font-medium'
                            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--sidebar-accent))]',
                        )}
                      >
                        {/* Left accent bar for active */}
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-[hsl(var(--green))]" />
                        )}
                        <Icon
                          size={17}
                          className={cn(
                            'shrink-0 transition-colors duration-150',
                            active
                              ? 'text-[hsl(var(--green))]'
                              : 'text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))]',
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );

                    // Icon-only link (tablet + desktop collapsed)
                    const iconLink = (
                      <Link
                        href={item.href}
                        className={cn(
                          'relative flex h-10 w-10 mx-auto items-center justify-center rounded-lg transition-colors duration-150',
                          active
                            ? 'text-[hsl(var(--green))] bg-[hsl(var(--green))]/8'
                            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--sidebar-accent))]',
                        )}
                      >
                        {/* Left accent bar for active — icon mode */}
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-[hsl(var(--green))]" />
                        )}
                        <Icon size={17} className="shrink-0" />
                      </Link>
                    );

                    return (
                      <li key={item.href}>
                        {/* Mobile */}
                        <span className="md:hidden">{fullLink}</span>

                        {/* Tablet: icon + tooltip */}
                        <span className="hidden md:block lg:hidden">
                          <Tooltip>
                            <TooltipTrigger render={iconLink} />
                            <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
                              {item.label}
                            </TooltipContent>
                          </Tooltip>
                        </span>

                        {/* Desktop expanded */}
                        <span className={cn('hidden', sidebarOpen && 'lg:block')}>{fullLink}</span>

                        {/* Desktop collapsed: icon + tooltip */}
                        <span className={cn('hidden lg:block', sidebarOpen && 'lg:hidden')}>
                          <Tooltip>
                            <TooltipTrigger render={iconLink} />
                            <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
                              {item.label}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* ── User info ── */}
        {user && (
          <div className="shrink-0 border-t border-[hsl(var(--sidebar-border))] p-3">
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg p-2',
                'hover:bg-[hsl(var(--sidebar-accent))] transition-colors duration-150 cursor-default',
                !sidebarOpen && 'md:justify-center',
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  'bg-[hsl(var(--green))]/12 text-[hsl(var(--green))] text-xs font-bold uppercase',
                )}
              >
                {user.firstName?.charAt(0) ?? 'U'}
              </div>

              {/* Name + role */}
              <div className={cn('flex-1 min-w-0 md:hidden', sidebarOpen && 'lg:block')}>
                <p className="truncate text-xs font-semibold text-[hsl(var(--foreground))] leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <span className={cn('mt-1 inline-block', ROLE_COLORS[user.role] ?? 'badge-green')}>
                  {user.role.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
