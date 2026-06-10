import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  activeTab: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      sidebarOpen: true,
      activeTab: 'dashboard',

      toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: open => set({ sidebarOpen: open }),
      setActiveTab: tab => set({ activeTab: tab }),
    }),
    {
      name: 'notifytechai-ui',
      partialize: state => ({ sidebarOpen: state.sidebarOpen }),
    },
  ),
);
