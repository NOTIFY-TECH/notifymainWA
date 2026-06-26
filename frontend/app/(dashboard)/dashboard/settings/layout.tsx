'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, User, Users, Key, Shield, LayoutTemplate } from 'lucide-react';

const TABS = [
  { href: '/dashboard/settings', label: 'Profile', icon: User },
  { href: '/dashboard/settings/team', label: 'Team', icon: Users },
  { href: '/dashboard/settings/api-keys', label: 'API Keys', icon: Key },
  { href: '/dashboard/settings/audit-log', label: 'Audit Log', icon: Shield },
  { href: '/dashboard/settings/templates', label: 'Templates', icon: LayoutTemplate },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--green))]/12 text-[hsl(var(--green))]">
          <Settings size={16} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[hsl(var(--foreground))]">Settings</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Manage your tenant profile and team</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-[hsl(var(--border))]">
        {TABS.map(tab => {
          const isActive = tab.href === '/dashboard/settings' ? pathname === tab.href : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-[hsl(var(--green))] text-[hsl(var(--foreground))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
