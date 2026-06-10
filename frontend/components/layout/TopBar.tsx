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
    console.log('LOGOUT CLICKED');
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    logout();
    window.location.href = '/login';
  };

  // Derived display values
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : 'User';
  const avatarInitial = user?.firstName?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-14',
        'flex items-center justify-between',
        'border-b border-[hsl(var(--border))]',
        'bg-[hsl(var(--background)/0.8)] backdrop-blur-md',
        'px-4 gap-4',
        'left-0 md:left-[64px] lg:left-[64px]',
      )}
    >
      {/* ── Left: Hamburger + Page Title ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          aria-label="Open menu"
          className={cn(
            'md:hidden',
            'flex h-8 w-8 items-center justify-center rounded-md',
            'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            'hover:bg-[hsl(var(--muted))] transition-colors',
          )}
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <PageIcon size={18} className="shrink-0 text-[hsl(var(--green))]" />
          <h1 className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{currentPage.title}</h1>
          {tenant && <span className="hidden sm:inline-flex badge-green shrink-0">{tenant.name}</span>}
        </div>
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-md',
              'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              'hover:bg-[hsl(var(--muted))] transition-colors',
            )}
          >
            <Bell size={17} />
            {unreadCount > 0 && <span className="badge-green">{unreadCount} new</span>}
          </button>

          {notifOpen && (
            <div
              className={cn(
                'absolute right-0 top-10 z-50',
                'w-[320px] max-h-[400px] overflow-y-auto',
                'rounded-[var(--radius)] border border-[hsl(var(--border))]',
                'bg-[hsl(var(--card))] shadow-xl',
                'divide-y divide-[hsl(var(--border))]',
              )}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                {unreadCount > 0 && <span className="badge-green">{unreadCount} new</span>}
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 10).map(n => (
                  <div
                    key={n.id}
                    className={cn('px-4 py-3 text-sm', 'border-b border-[hsl(var(--border))] last:border-0')}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'shrink-0 w-1.5 h-1.5 rounded-full',
                          n.type === 'success' && 'bg-[hsl(var(--green))]',
                          n.type === 'error' && 'bg-[hsl(var(--destructive))]',
                          n.type === 'warning' && 'bg-yellow-500',
                          n.type === 'info' && 'bg-[hsl(var(--purple))]',
                        )}
                      />
                      <p className="font-medium text-[hsl(var(--foreground))]">{n.title}</p>
                    </div>
                    {n.description && (
                      <p className="mt-0.5 ml-3.5 text-[hsl(var(--muted-foreground))] text-xs line-clamp-2">
                        {n.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius)]',
              'px-2 py-1.5 h-8',
              'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              'hover:bg-[hsl(var(--muted))] transition-colors',
              'focus-visible:outline-none cursor-pointer',
            )}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--green))] text-[10px] font-bold text-[hsl(var(--primary-foreground))] uppercase">
              {avatarInitial}
            </div>
            <span className="hidden sm:inline text-sm font-medium truncate max-w-[120px]">{displayName}</span>
            <ChevronDown size={14} className="hidden sm:inline shrink-0" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate font-normal">{user?.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="gap-2 cursor-pointer">
                <User size={14} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="gap-2 cursor-pointer">
                <Settings size={14} />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  console.log('clicked');
                  handleLogout();
                }}
                className="gap-2 cursor-pointer"
                variant="destructive"
              >
                <LogOut size={14} />
                Logout
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
