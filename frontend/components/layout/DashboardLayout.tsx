'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, rehydrated } = useAuthStore();
  const { sidebarOpen } = useUIStore();

  // Browser notifications — requests permission once, then fires on WS events
  useNotifications();

  useEffect(() => {
    if (!rehydrated) return; // wait for AuthRehydrator to finish
    if (!isAuthenticated) {
      router.replace('/login'); // no valid session → go to login
    }
  }, [rehydrated, isAuthenticated]);

  // Show nothing until rehydration is done
  if (!rehydrated || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Sidebar />
      <TopBar />
      <main
        className={cn(
          'min-h-screen pt-14',
          'transition-all duration-300 ease-in-out',
          'ml-0',
          'md:ml-[64px]',
          sidebarOpen ? 'lg:ml-[240px]' : 'lg:ml-[64px]',
        )}
      >
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
