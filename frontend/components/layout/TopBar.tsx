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

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : 'User';
  const avatarInitial = user?.firstName?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-[56px]',
        'flex items-center justify-between',
        'border-b border-[hsl(var(--border))]',
        'bg-[hsl(var(--background))]/90 backdrop-blur-xl',
        'px-5',
        'left-0 md:left-[64px]',
      )}
    >
      {/* ── Left: hamburger + page title ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={toggleSidebar}
          aria-label="Open menu"
          className={cn(
            'md:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            'hover:bg-[hsl(var(--muted))] transition-colors',
          )}
        >
          <Menu size={17} />
        </button>

        {/* Page title */}
        <div className="flex items-center gap-2 min-w-0">
          <PageIcon size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{currentPage.title}</span>
          {tenant && (
            <>
              <span className="text-[hsl(var(--border))] text-sm select-none hidden sm:block">/</span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[hsl(var(--green-dim))] text-[hsl(var(--green))]">
                {tenant.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Right: action cluster ── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-lg',
              'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              'hover:bg-[hsl(var(--muted))] transition-colors',
            )}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--green))] text-[hsl(var(--primary-foreground))] text-[9px] font-bold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification panel */}
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} aria-hidden="true" />
              <div
                className={cn(
                  'absolute right-0 top-11 z-50',
                  'w-[min(320px,calc(100vw-2rem))] max-h-[420px] overflow-y-auto',
                  'rounded-[var(--radius)] border border-[hsl(var(--border))]',
                  'bg-[hsl(var(--card))] shadow-2xl',
                )}
              >
                <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Notifications
                  </p>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[hsl(var(--green-dim))] text-[hsl(var(--green))]">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-10 gap-2">
                    <Bell size={18} className="text-[hsl(var(--muted-foreground))]" />
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {notifications.slice(0, 10).map(n => (
                      <div key={n.id} className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              'mt-[5px] shrink-0 h-1.5 w-1.5 rounded-full',
                              n.type === 'success' && 'bg-[hsl(var(--green))]',
                              n.type === 'error' && 'bg-[hsl(var(--destructive))]',
                              n.type === 'warning' && 'bg-yellow-500',
                              n.type === 'info' && 'bg-[hsl(var(--purple))]',
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[hsl(var(--foreground))] leading-snug">{n.title}</p>
                            {n.description && (
                              <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))] line-clamp-2 leading-relaxed">
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
        <div className="hidden sm:block h-5 w-px bg-[hsl(var(--border))] mx-2" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex items-center gap-2.5 rounded-lg',
              'px-2.5 py-1.5',
              'border border-[hsl(var(--border))]',
              'bg-[hsl(var(--card))]',
              'text-[hsl(var(--foreground))]',
              'hover:bg-[hsl(var(--muted))] hover:border-[hsl(var(--muted-foreground))/0.3]',
              'transition-colors duration-150',
              'focus-visible:outline-none cursor-pointer',
            )}
          >
            {/* Avatar */}
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--green))] text-[hsl(var(--primary-foreground))] text-[10px] font-bold uppercase">
              {avatarInitial}
            </div>
            <span className="hidden sm:block text-sm font-medium truncate max-w-[96px]">
              {user?.firstName ?? displayName}
            </span>
            <ChevronDown size={13} className="hidden sm:block shrink-0 text-[hsl(var(--muted-foreground))]" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{displayName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate font-normal mt-0.5">{user?.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="gap-2 cursor-pointer">
                <User size={13} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="gap-2 cursor-pointer">
                <Settings size={13} />
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
                <LogOut size={13} />
                Logout
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
