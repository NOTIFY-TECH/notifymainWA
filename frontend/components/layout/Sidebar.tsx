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
      { label: 'Team', href: '/dashboard/team', icon: UserCheck },
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

  // ── Close drawer on route change (mobile) ──
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [pathname, setSidebarOpen]);

  // ── Close drawer on outside click (mobile) ──
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

  // ── Lock body scroll when mobile drawer is open ──
  useEffect(() => {
    if (window.innerWidth < 768) {
      document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  // ── On tablet, sidebar is always icon-only ──
  // ── On desktop, sidebar respects sidebarOpen ──
  // ── isExpanded drives label visibility ──
  const isExpanded = sidebarOpen;

  return (
    <>
      {/* ── Mobile Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Panel ── */}
      <aside
        ref={sidebarRef}
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col',
          'border-r border-[hsl(var(--sidebar-border))]',
          'bg-[hsl(var(--sidebar))]',
          'transition-all duration-300 ease-in-out',

          // Mobile: full width drawer, hidden off-screen when closed
          'w-[240px]',
          !sidebarOpen && '-translate-x-full',

          // Tablet: always visible, icon-only, no translate
          'md:translate-x-0 md:w-[64px]',

          // Desktop: respects sidebarOpen for width
          'lg:w-[64px]',
          sidebarOpen && 'lg:w-[240px]',
        )}
      >
        {/* ── Logo ── */}
        <div className="flex h-14 shrink-0 items-center border-b border-[hsl(var(--sidebar-border))] px-4 gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--green))]">
            <Zap size={16} className="text-[hsl(var(--primary-foreground))]" />
          </div>
          {/* Show label: always on mobile drawer, only when expanded on desktop */}
          <span
            className={cn(
              'gradient-text font-semibold text-sm tracking-wide truncate',
              'md:hidden',
              sidebarOpen && 'lg:block',
            )}
          >
            NotifyTechAI
          </span>

          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-6">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              {/* Section label */}
              <p
                className={cn(
                  'mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]',
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

                  const fullLink = (
                    <Link href={item.href} className={cn('nav-link', active && 'active')}>
                      <Icon size={18} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );

                  const iconLink = (
                    <Link href={item.href} className={cn('nav-link justify-center px-0', active && 'active')}>
                      <Icon size={18} className="shrink-0" />
                    </Link>
                  );

                  return (
                    <li key={item.href}>
                      {/* Mobile drawer: full link with label */}
                      <span className="md:hidden">{fullLink}</span>

                      {/* Tablet: icon-only with tooltip */}
                      <span className="hidden md:block lg:hidden">
                        <Tooltip>
                          <TooltipTrigger render={iconLink} />
                          <TooltipContent side="right" sideOffset={8}>
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      </span>

                      {/* Desktop expanded: full link with label */}
                      <span className={cn('hidden', sidebarOpen && 'lg:block')}>{fullLink}</span>

                      {/* Desktop collapsed: icon-only with tooltip */}
                      <span className={cn('hidden lg:block', sidebarOpen && 'lg:hidden')}>
                        <Tooltip>
                          <TooltipTrigger render={iconLink} />
                          <TooltipContent side="right" sideOffset={8}>
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
        </nav>

        {/* ── User Info ── */}
        {user && (
          <div
            className={cn(
              'border-t border-[hsl(var(--sidebar-border))] p-3',
              'flex items-center gap-3',
              'md:justify-center',
              sidebarOpen && 'lg:justify-start',
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-semibold uppercase">
              {user.firstName?.charAt(0) ?? 'U'}
            </div>
            <div className={cn('flex-1 min-w-0', 'md:hidden', sidebarOpen && 'lg:block')}>
              <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                {user.firstName} {user.lastName}
              </p>
              <span className={cn('mt-0.5 inline-block', ROLE_COLORS[user.role] ?? 'badge-green')}>
                {user.role.replace('_', ' ')}
              </span>
            </div>
          </div>
        )}

        {/* ── Collapse Toggle (desktop only) ── */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className={cn(
            'hidden lg:flex h-10 w-full items-center',
            'border-t border-[hsl(var(--sidebar-border))]',
            'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            'hover:bg-[hsl(var(--sidebar-accent))] transition-colors duration-150',
            sidebarOpen ? 'justify-end px-4' : 'justify-center',
          )}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </aside>
    </>
  );
}
