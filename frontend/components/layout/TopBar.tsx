'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useNotificationStore } from '@/store/notificationStore';
import ThemeToggle from '@/components/common/ThemeToggle';
import {
  Bell,
  Menu,
  LayoutDashboard,
  Smartphone,
  MessageSquare,
  Megaphone,
  Users,
  BarChart2,
  UserCheck,
  CreditCard,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authApi } from '@/services/auth-api';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// ─── Route → Page Title Map ───────────────────────────────────────────────────

const PAGE_TITLES: Record<string, { title: string; icon: React.ElementType }> = {
  '/dashboard': { title: 'Dashboard', icon: LayoutDashboard },
  '/dashboard/sessions': { title: 'Sessions', icon: Smartphone },
  '/dashboard/inbox': { title: 'Inbox', icon: MessageSquare },
  '/dashboard/campaigns': { title: 'Campaigns', icon: Megaphone },
  '/dashboard/contacts': { title: 'Contacts', icon: Users },
  '/dashboard/analytics': { title: 'Analytics', icon: BarChart2 },
  '/dashboard/team': { title: 'Team', icon: UserCheck },
  '/dashboard/billing': { title: 'Billing', icon: CreditCard },
  '/dashboard/settings': { title: 'Settings', icon: Settings },
};

// ─── Avatar color by initial ──────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500'];

function getAvatarColor(initial: string): string {
  const idx = initial.toUpperCase().charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const { notifications } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const currentPage = PAGE_TITLES[pathname] ?? { title: 'Dashboard', icon: LayoutDashboard };
  const PageIcon = currentPage.icon;
  const unreadCount = notifications.length;

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    logout();
    window.location.href = '/login';
  };

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : 'User';
  const avatarInitial = user?.firstName?.charAt(0)?.toUpperCase() ?? 'U';
  const avatarColor = getAvatarColor(avatarInitial);

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-[56px]',
        'flex items-center justify-between',
        'border-b border-[hsl(var(--border))]',
        'bg-[hsl(var(--card))] backdrop-blur-xl',
        'px-4',
        'left-0 md:left-[72px]',
      )}
    >
      {/* ── Left: hamburger + logo (mobile) + breadcrumb ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={toggleSidebar}
          aria-label="Open menu"
          className="md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <Menu size={17} />
        </button>

        {/* Mobile: logo mark */}
        <div className="flex md:hidden h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[hsl(var(--green))] text-white">
          <Zap size={13} strokeWidth={2.5} />
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Page icon chip */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
            <PageIcon size={12} className="text-[hsl(var(--muted-foreground))]" />
          </div>

          {/* Page title */}
          <span className="text-[13.5px] font-[600] text-[hsl(var(--foreground))] truncate">{currentPage.title}</span>

          {/* Tenant chip */}
          {tenant && (
            <>
              <span className="text-[hsl(var(--border))] select-none hidden sm:block">/</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-[500] bg-[hsl(var(--green-subtle))] text-[hsl(var(--green))]">
                {tenant.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Right: actions ── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[hsl(var(--green))] text-white text-[9px] font-bold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} aria-hidden="true" />
              <div
                className={cn(
                  'absolute right-0 top-11 z-50',
                  'w-[min(320px,calc(100vw-2rem))] max-h-[420px] overflow-y-auto',
                  'rounded-[var(--radius)] border border-[hsl(var(--border))]',
                  'bg-[hsl(var(--card))] shadow-[var(--shadow-lg)]',
                )}
              >
                {/* Panel header */}
                <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-t-[var(--radius)]">
                  <p className="text-[11px] font-[600] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">
                    Notifications
                  </p>
                  {unreadCount > 0 && <span className="badge-green">{unreadCount} new</span>}
                </div>

                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-10 gap-2">
                    <Bell size={18} className="text-[hsl(var(--muted-foreground))]" />
                    <p className="text-[12px] text-[hsl(var(--muted-foreground))]">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {notifications.slice(0, 10).map(n => (
                      <div key={n.id} className="px-4 py-3 hover:bg-[hsl(var(--muted))] transition-colors">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              'mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full',
                              n.type === 'success' && 'bg-[hsl(var(--green))]',
                              n.type === 'error' && 'bg-[hsl(var(--destructive))]',
                              n.type === 'warning' && 'bg-amber-400',
                              n.type === 'info' && 'bg-blue-400',
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-[500] text-[hsl(var(--foreground))] leading-snug">
                              {n.title}
                            </p>
                            {n.description && (
                              <p className="mt-0.5 text-[11.5px] text-[hsl(var(--muted-foreground))] line-clamp-2 leading-relaxed">
                                {n.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Separator */}
        <div className="hidden sm:block h-4 w-px bg-[hsl(var(--border))] mx-1.5" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex items-center gap-2 rounded-lg',
              'px-2 py-1.5',
              'hover:bg-[hsl(var(--muted))]',
              'transition-colors duration-150',
              'focus-visible:outline-none cursor-pointer',
            )}
          >
            {/* Colored avatar by initial */}
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-bold uppercase shadow-sm',
                avatarColor,
              )}
            >
              {avatarInitial}
            </div>

            {/* Name + role */}
            <div className="hidden sm:flex flex-col items-start min-w-0">
              <span className="text-[12.5px] font-[600] text-[hsl(var(--foreground))] truncate max-w-[88px] leading-tight">
                {user?.firstName ?? displayName}
              </span>
              {user?.role && (
                <span className="text-[10.5px] text-[hsl(var(--muted-foreground))] truncate max-w-[88px] leading-tight">
                  {user.role
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
              )}
            </div>

            <ChevronDown size={11} className="hidden sm:block shrink-0 text-[hsl(var(--muted-foreground))]" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-[200px] bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-[var(--shadow-lg)]"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="pb-2">
                {/* Mini avatar in dropdown header */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-[11px] font-bold uppercase',
                      avatarColor,
                    )}
                  >
                    {avatarInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-[600] text-[hsl(var(--foreground))] truncate leading-tight">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate font-normal leading-tight mt-0.5">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => router.push('/dashboard/settings')}
                className="gap-2 cursor-pointer text-[13px] text-[hsl(var(--foreground))]"
              >
                <User size={13} className="text-[hsl(var(--muted-foreground))]" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/dashboard/settings')}
                className="gap-2 cursor-pointer text-[13px] text-[hsl(var(--foreground))]"
              >
                <Settings size={13} className="text-[hsl(var(--muted-foreground))]" /> Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 cursor-pointer text-[13px]"
                variant="destructive"
              >
                <LogOut size={13} /> Logout
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
