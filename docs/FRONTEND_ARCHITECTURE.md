# Frontend Architecture - NotifyTechAI

**Framework**: Next.js 14+ with App Router  
**Language**: TypeScript (strict mode)  
**Status**: ARCHITECTURE SPEC  
**Key Rule**: Frontend owns all SaaS UI. NEVER copies OpenWA UI.  

---

## 🚫 Critical Rule

**Frontend NEVER talks to OpenWA directly.**

All communication flows through Backend API:
```
Frontend
  ↓
Backend API
  ↓
OpenWA Engine
```

---

## Frontend Directory Structure

```
frontend/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page
│   │   ├── (auth)/              # Auth routes
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── reset-password/
│   │   ├── (dashboard)/         # Protected routes
│   │   │   ├── layout.tsx       # Dashboard layout
│   │   │   ├── page.tsx         # Dashboard home
│   │   │   ├── sessions/
│   │   │   ├── inbox/
│   │   │   ├── campaigns/
│   │   │   ├── contacts/
│   │   │   ├── crm/
│   │   │   ├── analytics/
│   │   │   ├── billing/
│   │   │   ├── team/
│   │   │   └── settings/
│   │   ├── api/                 # API routes (optional)
│   │   └── error.tsx            # Error boundary
│   ├── components/              # React components
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── Footer.tsx
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Form.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Loader.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ResetPasswordForm.tsx
│   │   ├── sessions/
│   │   │   ├── SessionList.tsx
│   │   │   ├── SessionCard.tsx
│   │   │   ├── QrDisplay.tsx
│   │   │   └── CreateSessionForm.tsx
│   │   ├── inbox/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── ConversationThread.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── MessageBubble.tsx
│   │   ├── campaigns/
│   │   │   ├── CampaignList.tsx
│   │   │   ├── CampaignForm.tsx
│   │   │   ├── CsvUpload.tsx
│   │   │   └── CampaignStats.tsx
│   │   └── analytics/
│   │       ├── StatsCard.tsx
│   │       ├── Chart.tsx
│   │       └── DateRangeFilter.tsx
│   ├── services/                # API clients
│   │   ├── api.ts              # Axios instance
│   │   ├── auth-api.ts
│   │   ├── sessions-api.ts
│   │   ├── messages-api.ts
│   │   ├── campaigns-api.ts
│   │   ├── contacts-api.ts
│   │   └── analytics-api.ts
│   ├── hooks/                  # React hooks
│   │   ├── useAuth.ts
│   │   ├── useSessions.ts
│   │   ├── useMessages.ts
│   │   ├── useQrCode.ts
│   │   ├── useCampaigns.ts
│   │   └── useWebSocket.ts
│   ├── store/                  # Zustand stores
│   │   ├── authStore.ts
│   │   ├── uiStore.ts
│   │   └── notificationStore.ts
│   ├── types/                  # TypeScript types
│   │   ├── auth.ts
│   │   ├── session.ts
│   │   ├── message.ts
│   │   ├── campaign.ts
│   │   └── index.ts
│   ├── utils/                  # Utilities
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   ├── dates.ts
│   │   └── constants.ts
│   ├── styles/                 # Global styles
│   │   ├── globals.css
│   │   └── animations.css
│   ├── middleware.ts           # Next.js middleware (auth redirect)
│   └── env.d.ts                # Env types
├── public/                     # Static assets
├── .env.local                  # Frontend env
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## Pages Owned by NotifyTechAI Frontend

### Authentication Pages

#### `/login`
```typescript
// app/(auth)/login/page.tsx

Purpose: User login with email/password

Features:
- Email and password inputs
- Remember me checkbox
- Forgot password link
- Error message display
- Loading state
- Redirect on success

Never copies OpenWA's login UI
```

#### `/register`
```typescript
Purpose: New tenant registration

Features:
- Company name
- Email
- Password (with strength indicator)
- Email verification
- Tenant creation
- Auto-login after registration
```

#### `/reset-password`
```typescript
Purpose: Password recovery

Features:
- Email input
- Reset token verification
- New password form
- Confirmation email
```

---

### Dashboard Pages

#### `/dashboard`
```typescript
Purpose: Main dashboard with key metrics

Features:
- Overview cards (messages today, active sessions, contacts, campaigns)
- Recent conversations
- Performance chart
- Quick actions
- Notifications

NOT from OpenWA dashboard
Custom design
```

#### `/settings`
```typescript
Purpose: Global settings

Features:
- Profile settings
- Password change
- Notification preferences
- Time zone
- Theme settings
```

---

### WhatsApp Session Pages

#### `/sessions`
```typescript
Purpose: WhatsApp session management

Features:
- List all sessions with status
- Create new session button
- Session status indicators
- Delete session action
- Last activity timestamp
- Session owner display

Custom UI showing:
- Session ID
- Phone number
- Connection status
- Created date
- Last message date
```

#### `/sessions/new`
```typescript
Purpose: Create new WhatsApp session and scan QR

Flow:
1. User clicks "New Session"
2. Frontend calls: POST /api/sessions
3. Backend returns: Session ID
4. Frontend starts QR polling: GET /api/sessions/:id/qr
5. QR displays in Modal
6. Show polling spinner while waiting
7. User scans with phone
8. Status changes to "CONNECTED"
9. Redirect to sessions list

Real-time Polling:
- Query string with 2-second refetch interval
- Displays "Waiting for scan..." message
- Expires after 5 minutes (show retry button)
- Cancel button to abort
```

#### `/sessions/:id`
```typescript
Purpose: View session details

Shows:
- Phone number
- Connection status
- QR code (if available)
- Created date
- Last activity
- Action buttons (reconnect, delete)
- Session info (messages sent, contacts)
```

---

### Communication Pages

#### `/inbox`
```typescript
Purpose: Team inbox with conversations

Features:
- Conversation list (left sidebar)
- Filter by status (all, open, closed, pending)
- Search conversations
- Unread count badge
- Conversation cards showing:
  - Contact name
  - Last message preview
  - Last message time
  - Unread badge
  - Assigned agent
  - Status indicator

Real-time Updates:
- WebSocket subscription
- New messages highlighted
- Status changes reflected instantly
- Unread count updates
```

#### `/inbox/:conversationId`
```typescript
Purpose: Conversation thread view

Features:
- Message list
- Message pagination (load more)
- Message bubbles (incoming/outgoing)
- Timestamp for each message
- Message status (sent, delivered, read)
- Reply composer
- Assign to agent dropdown
- Status selector
- Conversation details panel

Message Composer:
- Text input
- Send button (disabled while sending)
- File/media upload
- Emoji picker
- Message history

Real-time:
- New messages appear instantly
- Typing indicators
- Delivery status updates
- Read receipts
```

#### `/contacts`
```typescript
Purpose: Contact directory

Features:
- Contact list with search
- Filter by group/tag
- Import from CSV
- Add new contact
- Contact cards showing:
  - Name
  - Phone
  - Total messages
  - Last message date
  - Status (active, inactive)
  - Tags
```

---

### Campaign Pages

#### `/campaigns`
```typescript
Purpose: Campaign management

Features:
- Campaign list with filters
- Status indicators (draft, scheduled, running, completed, paused)
- Campaign stats (sent, delivered, failed, pending)
- Create new campaign button
- Delete campaign
- Pause/resume campaign
- View campaign details

Campaign Card:
- Name
- Template preview
- Target count
- Sent/Delivered/Failed counts
- Schedule date (if scheduled)
- Created by
- Last updated
```

#### `/campaigns/new`
```typescript
Purpose: Create new campaign

Steps:
1. Campaign name & description
2. Select template or write message
3. Upload CSV or select contacts
4. Preview recipients
5. Choose session
6. Set schedule (now or future)
7. Review and confirm

CSV Upload:
- Headers: phone_number, first_name (optional)
- Validation
- Show duplicate detection
- Count of recipients to send

Preview:
- Show first 10 recipients
- Message preview with personalization
```

#### `/campaigns/:id`
```typescript
Purpose: Campaign details and statistics

Features:
- Campaign info (name, created by, date)
- Message content
- Target list
- Real-time stats:
  - Total recipients
  - Sent count
  - Delivered count
  - Failed count
  - Pending count
- Retry failed button
- Cancel campaign button
- Export stats as CSV

Chart:
- Delivery status pie chart
- Timeline chart
```

---

### CRM Pages

#### `/crm`
```typescript
Purpose: CRM dashboard

Features:
- Contact segments
- Hot leads
- Recent conversations
- Contact insights
- Performance metrics
```

#### `/contacts/:id`
```typescript
Purpose: Contact profile

Features:
- Contact info
- Conversation history
- Tags
- Notes
- Activity timeline
- Custom fields
```

---

### Analytics Pages

#### `/analytics`
```typescript
Purpose: Performance dashboard

Features:
- Date range selector
- KPI cards:
  - Messages today
  - Delivery rate
  - Response time
  - Active sessions
  - Total contacts

Charts:
- Messages over time (line)
- Delivery status (pie)
- Top conversations (bar)
- Response rate trend (area)

Real-time Updates:
- Metrics refresh every 5 minutes
- WebSocket for instant updates
```

---

### Team Pages

#### `/team`
```typescript
Purpose: Team member management

Features:
- Team member list
- Add member form
- Remove member
- Change role
- Invite pending members

Show:
- Name
- Email
- Role
- Status (active, pending, inactive)
- Conversations assigned
- Messages sent
- Join date
```

---

### Billing Pages

#### `/billing`
```typescript
Purpose: Subscription and billing

Features:
- Current plan display
- Plan features
- Monthly cost
- Next billing date
- Upgrade button
- Usage metrics vs limits

Actions:
- Upgrade plan
- Download invoice
- Cancel subscription
```

#### `/billing/invoices`
```typescript
Purpose: Invoice history

Features:
- Invoice list with dates
- Amount
- Status
- Download button
- PDF preview
```

---

## Core Services (API Clients)

### `api.ts` - Axios Configuration
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 10000,
});

// JWT interceptor
// NOTE: Do NOT persist access tokens in localStorage.
// Prefer in-memory token storage or HttpOnly cookies.
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? (window as any).__ACCESS_TOKEN__ : undefined;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Refresh strategy should not rely on storing tokens in localStorage.
      // Prefer HttpOnly cookie refresh managed by backend.
      try {
        await axios.post('/auth/refresh');
        // Retry original request (handled by caller / interceptor if implemented)
      } catch (e) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);


export default apiClient;
```

### `sessions-api.ts` - Session Service
```typescript
import apiClient from './api';

export const sessionsApi = {
  // Create session
  async createSession() {
    return apiClient.post('/api/sessions');
  },

  // List sessions
  async listSessions() {
    return apiClient.get('/api/sessions');
  },

  // Get QR code (for polling)
  async getQrCode(sessionId: string) {
    return apiClient.get(`/api/sessions/${sessionId}/qr`);
  },

  // Delete session
  async deleteSession(sessionId: string) {
    return apiClient.delete(`/api/sessions/${sessionId}`);
  },

  // Get session status
  async getSessionStatus(sessionId: string) {
    return apiClient.get(`/api/sessions/${sessionId}`);
  }
};
```

### `messages-api.ts` - Message Service
```typescript
import apiClient from './api';

export const messagesApi = {
  // Send message
  async sendMessage(conversationId: string, content: string, mediaUrl?: string) {
    return apiClient.post('/api/messages/send', {
      conversationId,
      content,
      mediaUrl
    });
  },

  // Get messages
  async getMessages(conversationId: string, page: number = 1, limit: number = 50) {
    return apiClient.get(`/api/messages`, {
      params: { conversationId, page, limit }
    });
  },

  // Mark as read
  async markAsRead(conversationId: string) {
    return apiClient.post(`/api/messages/mark-read`, { conversationId });
  },

  // Search messages
  async searchMessages(query: string, conversationId?: string) {
    return apiClient.get('/api/messages/search', {
      params: { query, conversationId }
    });
  }
};
```

---

## Core Hooks

### `useAuth.ts` - Authentication Hook
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/services/auth-api';

export const useAuth = () => {
  const { user, setUser, logout: storeLogout } = useAuthStore();

  const loginMutation = useMutation(
    (credentials: { email: string; password: string }) =>
      authApi.login(credentials),
    {
      onSuccess: (data) => {
        // Do NOT store access tokens in localStorage.
        // Store access token in memory or rely on HttpOnly cookie session.
        // Store refresh token ONLY in HttpOnly cookie (backend-managed) when possible.
        // This is an architecture doc: actual token storage strategy must match security spec.
        setUser(data.user);

      }
    }
  );

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    storeLogout();
  };

  return {
    user,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    logout,
    isLoading: loginMutation.isLoading
  };
};
```

### `useQrCode.ts` - QR Polling Hook
```typescript
import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '@/services/sessions-api';

export const useQrCode = (sessionId: string, enabled: boolean = true) => {
  return useQuery(
    ['qr', sessionId],
    () => sessionsApi.getQrCode(sessionId),
    {
      enabled,
      refetchInterval: 2000, // Poll every 2 seconds
      refetchIntervalInBackground: true,
      staleTime: 0
    }
  );
};
```

### `useWebSocket.ts` - Real-time Updates
```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useWebSocket = (tenantId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
  const newSocket = io(
      process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws',
      {
        auth: {
          // Token should come from in-memory storage / cookie-based auth, not localStorage.
          token: typeof window !== 'undefined' ? (window as any).__ACCESS_TOKEN__ : undefined,
        },
        query: {
          tenantId
        }
      }
    );


    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [tenantId]);

  const subscribe = (event: string, callback: (data: any) => void) => {
    socket?.on(event, callback);
  };

  const unsubscribe = (event: string) => {
    socket?.off(event);
  };

  return { subscribe, unsubscribe };
};
```

---

## Core Stores (Zustand)

### `authStore.ts`
```typescript
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  tenantId: string | null;
  setUser: (user: User) => void;
  setTenant: (tenantId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenantId: null,
  setUser: (user) => set({ user, tenantId: user.tenantId }),
  setTenant: (tenantId) => set({ tenantId }),
  logout: () => set({ user: null, tenantId: null })
}));
```

### `uiStore.ts`
```typescript
interface UIState {
  sidebarOpen: boolean;
  darkMode: boolean;
  activeTab: string;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  darkMode: false,
  activeTab: 'dashboard',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setActiveTab: (tab) => set({ activeTab: tab })
}));
```

---

## Environment Variables

```
# .env.local

# API
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=your-id

# Features
NEXT_PUBLIC_ENABLE_CAMPAIGNS=true
NEXT_PUBLIC_ENABLE_CRM=true
NEXT_PUBLIC_ENABLE_BILLING=true
```

**Important**: 
- ✅ Frontend env variables start with `NEXT_PUBLIC_`
- ✅ NO sensitive data (API keys, secrets) in frontend
- ✅ NO OpenWA credentials exposed
- ✅ All sensitive operations through Backend API

---

## Component Library (shadcn/ui)

```
- Button
- Input
- Form
- Table
- Dialog/Modal
- Select
- Dropdown Menu
- Tabs
- Card
- Badge
- Alert
- Toast
- Tooltip
- Skeleton
- Progress
- Chart (Recharts integration)
```

---

## Styling

```
Framework: Tailwind CSS
Component Library: shadcn/ui
Animations: Framer Motion
Icons: lucide-react

Color Scheme:
- Primary: Blue
- Secondary: Gray
- Success: Green
- Warning: Orange
- Danger: Red

Theme:
- Light mode (default)
- Dark mode (supported)
```

---

## Authentication Flow

```
1. User visits /login
2. Enters email + password
3. Frontend submits to: POST /api/auth/login
4. Backend validates and returns JWT tokens
5. Frontend stores tokens securely (prefer HttpOnly cookie-managed refresh token)
6. Redirects to /dashboard

7. All subsequent requests include JWT in Authorization header
8. Backend validates token and tenant ownership
9. If token expires: Use refresh token to get new one
10. If refresh fails: Redirect to /login
```

---

## Real-Time Flow

```
1. User logs in
2. Frontend connects WebSocket to /ws with JWT token
3. Backend validates tenant ownership
4. Client joins room: tenant:{tenantId}:user:{userId}
5. Events pushed from backend:
   - message:new → Update inbox
   - conversation:assigned → Show notification
   - session:connected → Update status
   - campaign:completed → Show alert
6. Frontend updates UI reactively
```

---

## Critical Rules for Frontend

1. ✅ All API calls through Backend
2. ✅ NEVER call OpenWA directly
3. ✅ NEVER expose OpenWA endpoints
4. ✅ NEVER store sensitive tokens in localStorage (refresh only)
5. ✅ NEVER build custom OpenWA integration
6. ✅ ALWAYS validate JWT before rendering protected pages
7. ✅ ALWAYS include tenantId in requests
8. ✅ ALWAYS use TypeScript strict mode
9. ✅ ALWAYS handle loading and error states
10. ✅ ALWAYS use real-time for live updates

---

## What Frontend Does NOT Own

❌ WhatsApp connection logic  
❌ Session authentication  
❌ QR generation  
❌ Message sending (Backend does it)  
❌ Database access  
❌ Payment processing  
❌ Campaign execution  
❌ Analytics aggregation  
❌ User authentication internals  
❌ Any OpenWA integration  

---

## What Frontend DOES Own

✅ All UI pages  
✅ User interactions  
✅ Form validation  
✅ State management  
✅ Real-time subscriptions  
✅ Error display  
✅ Loading states  
✅ Theme switching  
✅ Responsive design  
✅ Accessibility  

---

*Frontend is a complete, professional SaaS dashboard. It never knows OpenWA exists.*

