'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SupportModal from '@/components/support/SupportModal';
import { UserRole } from '@/types/auth';
import {
  LayoutDashboard,
  Smartphone,
  MessageSquare,
  Megaphone,
  Users,
  BarChart2,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
  LifeBuoy,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Nav Config ───────────────────────────────────────────────────────────────
//
// `roles` is optional per item (NEW — RBAC hierarchy feature, Team
// Performance page). Omitted = visible to everyone, same as before this
// field existed. When present, the item only renders for users whose role
// is in the list. Existing items are all unchanged (no `roles` field), so
// their visibility is exactly the same as before.

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Sessions', href: '/dashboard/sessions', icon: Smartphone },
      { label: 'Inbox', href: '/dashboard/inbox', icon: MessageSquare },
      // NEW (RBAC hierarchy feature) — Manager-only. Can't live under
      // Settings → Team since that page hard-gates to Admin/Owner.
      { label: 'Team Performance', href: '/dashboard/team-performance', icon: TrendingUp, roles: ['MANAGER'] },
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
      { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const sidebarRef = useRef<HTMLElement>(null);
  const [supportOpen, setSupportOpen] = useState(false);

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

  // Filter nav items by role. Items with no `roles` field stay visible to
  // everyone (unchanged behavior). Sections that end up with zero visible
  // items are dropped entirely rather than rendering an empty header.
  const visibleSections = NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => !item.roles || (!!user?.role && item.roles.includes(user.role))),
  })).filter(section => section.items.length > 0);

  // ── Help button variants ──────────────────────────────────────────────────

  const helpButtonFull = (
    <button
      onClick={() => setSupportOpen(true)}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-[450] text-slate-400 hover:text-white hover:bg-white/8 transition-all duration-150"
    >
      <LifeBuoy size={15} className="shrink-0" />
      <span className="truncate">Help &amp; Support</span>
    </button>
  );

  const helpButtonIcon = (
    <button
      onClick={() => setSupportOpen(true)}
      className="flex h-9 w-9 mx-auto items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all duration-150"
      aria-label="Help & Support"
    >
      <LifeBuoy size={15} className="shrink-0" />
    </button>
  );

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
          // Dark background
          'bg-slate-900',
          'border-r border-slate-800',
          'transition-all duration-300 ease-in-out',
          'w-[240px]',
          !sidebarOpen && '-translate-x-full',
          'md:translate-x-0 md:w-[60px]',
          'lg:w-[60px]',
          sidebarOpen && 'lg:w-[240px]',
        )}
      >
        {/* ── Expand / collapse toggle (desktop only) ── */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'hidden lg:flex absolute -right-3 top-6 z-50',
            'h-6 w-6 items-center justify-center rounded-full',
            'bg-slate-800 border border-slate-700',
            'text-slate-400 hover:text-white',
            'shadow-sm transition-colors duration-150',
          )}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* ── Logo / Brand ── */}
        <div className="flex h-[56px] shrink-0 items-center gap-3 px-4 border-b border-slate-800">
          {/* Logo mark */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[hsl(var(--green))] text-white shadow-lg shadow-green-900/40">
            <Zap size={15} strokeWidth={2.5} />
          </div>

          {/* Brand name — hidden when collapsed */}
          <div className={cn('flex-1 min-w-0 md:hidden', sidebarOpen && 'lg:flex lg:flex-col')}>
            <span className="text-[13.5px] font-[700] tracking-tight text-white truncate leading-tight">
              NotifyTechAI
            </span>
            <span className="text-[10px] text-slate-500 truncate leading-tight">WhatsApp Platform</span>
          </div>

          {/* Mobile close */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/8 transition-colors md:hidden"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
          {visibleSections.map(section => (
            <div key={section.label}>
              {/* Section label */}
              <p
                className={cn(
                  'mb-1.5 px-2 text-[10px] font-[700] uppercase tracking-[0.1em] text-slate-500 select-none',
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
                    <Link
                      href={item.href}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-[450] transition-all duration-150',
                        active
                          ? 'bg-[hsl(var(--green))] text-white font-[550] shadow-md shadow-green-900/40'
                          : 'text-slate-400 hover:bg-white/8 hover:text-white',
                      )}
                    >
                      <Icon
                        size={15}
                        className={cn(
                          'shrink-0 transition-colors duration-150',
                          active ? 'text-white' : 'text-slate-500 group-hover:text-white',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );

                  const iconLink = (
                    <Link
                      href={item.href}
                      className={cn(
                        'relative flex h-9 w-9 mx-auto items-center justify-center rounded-lg transition-all duration-150',
                        active
                          ? 'bg-[hsl(var(--green))] text-white shadow-md shadow-green-900/40'
                          : 'text-slate-500 hover:bg-white/8 hover:text-white',
                      )}
                    >
                      <Icon size={15} className="shrink-0" />
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
        </nav>

        {/* ── Help & Support ── */}
        <div className="shrink-0 px-2 pb-3">
          <span className="md:hidden">{helpButtonFull}</span>
          <span className="hidden md:block lg:hidden">
            <Tooltip>
              <TooltipTrigger render={helpButtonIcon} />
              <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
                Help &amp; Support
              </TooltipContent>
            </Tooltip>
          </span>
          <span className={cn('hidden', sidebarOpen && 'lg:block')}>{helpButtonFull}</span>
          <span className={cn('hidden lg:block', sidebarOpen && 'lg:hidden')}>
            <Tooltip>
              <TooltipTrigger render={helpButtonIcon} />
              <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
                Help &amp; Support
              </TooltipContent>
            </Tooltip>
          </span>
        </div>
      </aside>

      {/* ── Support Modal ── */}
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
