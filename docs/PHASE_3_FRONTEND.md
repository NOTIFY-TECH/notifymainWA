# PHASE 3: Frontend Development (Next.js)

**Duration**: 3-4 weeks  
**Goal**: Build modern, premium SaaS dashboard with real-time updates

---

## Frontend Architecture

```
Next.js App Router
├── Authentication (Login/Register)
├── Dashboard (Analytics Overview)
├── Sessions Management (WhatsApp Accounts)
├── QR Code Scanner (Device Registration)
├── Inbox (Real-time Chat)
├── Campaigns (Bulk Messaging)
├── Contacts (CRM)
├── Analytics (Reports)
├── Billing (Subscriptions)
└── Settings (Team & Configuration)
```

---

## Setup Steps

### 1. Create Next.js Project

```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app
```

### 2. Install Dependencies

```bash
npm install \
  axios \
  react-query \
  zustand \
  framer-motion \
  socket.io-client \
  next-themes \
  sonner \
  date-fns \
  recharts \
  lucide-react \
  react-hook-form \
  zod \
  @hookform/resolvers \
  next-auth
```

### 3. Install UI Components

```bash
npx shadcn-ui@latest init
```

Then add components:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add pagination
npx shadcn-ui@latest add form
```

### 4. Configure Environment

**.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
```

### 5. Create Directory Structure

```bash
mkdir -p src/{app,components,hooks,store,types,services,lib}
```

### 6. Create Base Layout

**src/app/layout.tsx**
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NotifyTechAI - WhatsApp CRM',
  description: 'Multi-tenant WhatsApp communication platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
```

### 7. Create API Service

**src/services/api.ts**
```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  // Prefer HttpOnly cookie / backend-managed refresh tokens.
  // If you use in-memory token, populate __ACCESS_TOKEN__ at login time.
  const token = typeof window !== 'undefined' ? (window as any).__ACCESS_TOKEN__ : undefined;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


// Handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Do not rely on localStorage for tokens.
      // Backend cookie/session should be cleared by logout endpoint.
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);


export const authApi = {
  register: (tenantId: string, data: any) =>
    apiClient.post(`/auth/tenants/${tenantId}/register`, data),
  login: (tenantId: string, data: any) =>
    apiClient.post(`/auth/tenants/${tenantId}/login`, data),
};

export const sessionsApi = {
  create: (tenantId: string, data: any) =>
    apiClient.post(`/sessions/tenants/${tenantId}`, data),
  list: (tenantId: string) =>
    apiClient.get(`/sessions/tenants/${tenantId}`),
  getQr: (sessionId: string) =>
    apiClient.get(`/sessions/${sessionId}/qr`),
  delete: (sessionId: string) =>
    apiClient.delete(`/sessions/${sessionId}`),
};

export const messagesApi = {
  send: (data: any) =>
    apiClient.post(`/messages/send`, data),
};

export const contactsApi = {
  list: (tenantId: string) =>
    apiClient.get(`/contacts/tenants/${tenantId}`),
  create: (tenantId: string, data: any) =>
    apiClient.post(`/contacts/tenants/${tenantId}`, data),
};

export const campaignsApi = {
  list: (tenantId: string) =>
    apiClient.get(`/campaigns/tenants/${tenantId}`),
  create: (tenantId: string, data: any) =>
    apiClient.post(`/campaigns/tenants/${tenantId}`, data),
};
```

### 8. Create Store (Zustand)

**src/store/authStore.ts**
```typescript
import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  tenantId: string | null;
  setUser: (user: User) => void;
  setAuth: (user: User, token: string, tenantId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  tenantId: null,

  setUser: (user) => set({ user }),

  setAuth: (user, token, tenantId) =>
    set({ user, accessToken: token, tenantId }),

  logout: () => {
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null, tenantId: null });
  },
}));
```

**src/store/uiStore.ts**
```typescript
import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  darkMode: boolean;
  activeTab: string;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  darkMode: true,
  activeTab: 'dashboard',

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toggleDarkMode: () =>
    set((state) => ({ darkMode: !state.darkMode })),

  setActiveTab: (tab) => set({ activeTab: tab }),
}));
```

### 9. Create Custom Hooks

**src/hooks/useSession.ts**
```typescript
import { useQuery, useMutation } from 'react-query';
import { sessionsApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export const useSessions = () => {
  const { tenantId } = useAuthStore();

  return useQuery(
    ['sessions', tenantId],
    () => sessionsApi.list(tenantId!),
    {
      enabled: !!tenantId,
    },
  );
};

export const useCreateSession = () => {
  const { tenantId } = useAuthStore();

  return useMutation((data: any) =>
    sessionsApi.create(tenantId!, data),
  );
};

export const useQrCode = (sessionId: string) => {
  return useQuery(
    ['qr', sessionId],
    () => sessionsApi.getQr(sessionId),
    {
      refetchInterval: 2000,
      enabled: !!sessionId,
    },
  );
};
```

### 10. Create Core Pages

**src/app/login/page.tsx**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    tenantId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authApi.login(formData.tenantId, {
        email: formData.email,
        password: formData.password,
      });

      const { user, accessToken } = response.data;
      setAuth(user, accessToken, formData.tenantId);
      localStorage.setItem('accessToken', accessToken);
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">NotifyTechAI</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Tenant ID"
            value={formData.tenantId}
            onChange={(e) =>
              setFormData({ ...formData, tenantId: e.target.value })
            }
            required
          />
          
          <Input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
          />
          
          <Input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button 
            type="submit" 
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

**src/app/dashboard/page.tsx**
```typescript
'use client';

import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  const router = useRouter();
  const { accessToken, user } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      router.push('/login');
    }
  }, [accessToken, router]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Sessions</h3>
            <p className="text-3xl font-bold mt-2">12</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Messages Today</h3>
            <p className="text-3xl font-bold mt-2">2,451</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Contacts</h3>
            <p className="text-3xl font-bold mt-2">8,234</p>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Campaigns</h3>
            <p className="text-3xl font-bold mt-2">23</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Recent Messages</h2>
            {/* Chart component */}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Active Conversations</h2>
            {/* Chart component */}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
```

**src/app/sessions/page.tsx**
```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSessions, useCreateSession } from '@/hooks/useSession';
import SessionCard from '@/components/sessions/SessionCard';

export default function SessionsPage() {
  const { data: sessions, isLoading } = useSessions();
  const createSessionMutation = useCreateSession();
  const [showNewSession, setShowNewSession] = useState(false);

  const handleCreateSession = async () => {
    try {
      await createSessionMutation.mutateAsync({
        name: `Session - ${new Date().toLocaleString()}`,
      });
      setShowNewSession(false);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">WhatsApp Sessions</h1>
          <Button onClick={handleCreateSession}>Add New Session</Button>
        </div>

        {isLoading ? (
          <p>Loading sessions...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions?.data?.map((session: any) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
```

### 11. Create Layout Components

**src/components/layout/DashboardLayout.tsx**
```typescript
'use client';

import { useUIStore } from '@/store/uiStore';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

**src/components/layout/Sidebar.tsx**
```typescript
'use client';

import Link from 'next/link';
import { useUIStore } from '@/store/uiStore';
import {
  MessageSquare,
  BarChart3,
  Users,
  Send,
  Settings,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: BarChart3, href: '/dashboard' },
  { label: 'Sessions', icon: MessageSquare, href: '/sessions' },
  { label: 'Inbox', icon: MessageSquare, href: '/inbox' },
  { label: 'Contacts', icon: Users, href: '/contacts' },
  { label: 'Campaigns', icon: Send, href: '/campaigns' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export default function Sidebar() {
  const { sidebarOpen } = useUIStore();

  return (
    <aside
      className={`${
        sidebarOpen ? 'w-64' : 'w-20'
      } bg-slate-900 border-r border-slate-700 transition-all duration-300`}
    >
      <div className="p-4">
        <h1 className="text-2xl font-bold">NT AI</h1>
      </div>

      <nav className="space-y-2 p-4">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition">
              <item.icon size={20} />
              {sidebarOpen && <span>{item.label}</span>}
            </div>
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <button className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition w-full">
          <LogOut size={20} />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
```

**src/components/layout/TopBar.tsx**
```typescript
'use client';

import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { Menu, Bell, User } from 'lucide-react';

export default function TopBar() {
  const { user } = useAuthStore();
  const { toggleSidebar } = useUIStore();

  return (
    <header className="border-b border-slate-700 bg-slate-900 px-6 py-4 flex justify-between items-center">
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-slate-800 rounded-lg"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center space-x-4">
        <button className="p-2 hover:bg-slate-800 rounded-lg">
          <Bell size={20} />
        </button>

        <div className="flex items-center space-x-2 pl-4 border-l border-slate-700">
          <User size={20} />
          <span className="text-sm">{user?.email}</span>
        </div>
      </div>
    </header>
  );
}
```

### 12. Create Inbox Component

**src/components/inbox/InboxView.tsx**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

export default function InboxView() {
  const { tenantId, user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000', {
      auth: {
        token: localStorage.getItem('accessToken'),
        tenantId,
        userId: user?.id,
      },
    });

    newSocket.on('message:new', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [tenantId, user?.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto space-y-4 p-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.sender === 'incoming' ? 'justify-start' : 'justify-end'
            }`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                msg.sender === 'incoming'
                  ? 'bg-slate-700 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-700">
        <input
          type="text"
          placeholder="Type a message..."
          className="w-full bg-slate-800 text-white rounded-lg px-4 py-2"
        />
      </div>
    </div>
  );
}
```

### 13. Start Development Server

```bash
npm run dev
```

Visit: `http://localhost:3000`

---

## Component Architecture

### Page Structure
- Pages under `src/app/` (App Router)
- Each page handles authentication
- Data fetching with React Query
- State management with Zustand

### Component Hierarchy
```
DashboardLayout
├── Sidebar (Navigation)
├── TopBar (Header)
└── MainContent
    ├── Cards
    ├── Tables
    ├── Charts
    └── Forms
```

### Styling Strategy
- Tailwind CSS for all styling
- Dark mode by default
- shadcn/ui for complex components
- Custom animations with Framer Motion

---

## Key Features Implementation

### Real-time Updates
```typescript
// WebSocket connection in useEffect
const socket = io(WS_URL, { auth: { token, tenantId } });
socket.on('event:name', (data) => {
  // Update state
});
```

### API Error Handling
```typescript
try {
  const response = await apiClient.post(...);
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
  }
  // Show error toast
}
```

### Loading States
```typescript
if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
return <Content data={data} />;
```

---

## Performance Optimization

- Code splitting via Next.js
- Image optimization
- Lazy loading components
- React Query caching
- Zustand for local state (no prop drilling)

---

## Next Steps

✅ Frontend foundation complete

**Next**: Connect frontend to backend APIs and WebSocket gateway
