# Session Management Rules - NotifyTechAI

**Purpose**: Define WhatsApp session lifecycle and ownership  
**Status**: ENFORCED ARCHITECTURE  
**Critical**: Sessions are the foundation of multi-tenant isolation  

---

## Session Ownership Model

### Principle: Sessions belong to Tenant + User

```
Tenant "Company A"
├── User "Alice" (Team Lead)
│   ├── Session: sales@company-a
│   ├── Session: support@company-a
│   └── Session: marketing@company-a
└── User "Bob" (Agent)
    └── Session: bot-replies@company-a

Tenant "Company B"
└── User "Charlie" (Owner)
    └── Session: cs@company-b

// Charlie CANNOT access Company A sessions
// Bob CANNOT use Alice's sessions
// Sessions NEVER shared between tenants
```

---

## Session Entity Definition

```typescript
// backend/src/database/entities/whatsapp-session.entity.ts

@Entity('whatsapp_sessions')
export class WhatsappSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ===== Multi-Tenant =====
  @Column()
  @Index()
  tenantId: string;

  // ===== Ownership =====
  @Column()
  @Index()
  userId: string;

  // ===== OpenWA Reference =====
  @Column()
  externalSessionId: string;  // From OpenWA engine

  // ===== Session Details =====
  @Column({ nullable: true })
  sessionName: string;  // e.g., "Sales Team"

  @Column({ nullable: true })
  phoneNumber: string;  // WhatsApp number (format: 61234567890)

  @Column({ nullable: true })
  displayName: string;  // Profile name shown in WhatsApp

  @Column({ nullable: true })
  profilePicture: string;  // Profile picture URL

  // ===== Status =====
  @Column('enum', {
    enum: WhatsappSessionStatus,
    default: WhatsappSessionStatus.CREATED
  })
  status: WhatsappSessionStatus;

  // ===== QR Code =====
  @Column({ nullable: true, length: 50000 })
  qrCode: string;  // Base64 encoded QR image

  @Column({ nullable: true })
  qrExpiresAt: Date;  // When QR expires

  // ===== Authentication State =====
  @Column({ default: false })
  isAuthenticated: boolean;

  @Column({ nullable: true })
  authenticatedAt: Date;

  @Column({ default: 0 })
  failedAuthAttempts: number;

  // ===== Activity Tracking =====
  @Column({ nullable: true })
  lastActivityAt: Date;

  @Column({ nullable: true })
  lastMessageAt: Date;

  @Column({ default: 0 })
  messagesSentCount: number;

  @Column({ default: 0 })
  messagesReceivedCount: number;

  @Column({ default: 0 })
  conversationsCount: number;

  // ===== Metadata =====
  @Column('jsonb', { default: {} })
  metadata: {
    browserVersion?: string;
    chromeVersion?: string;
    sessionCreationReason?: string;
    lastErrorMessage?: string;
    reconnectAttempts?: number;
  };

  // ===== Timestamps =====
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // ===== Relationships =====
  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}

// Session Status Enum
export enum WhatsappSessionStatus {
  // Creation
  CREATED = 'CREATED',                    // Just created
  INITIALIZING = 'INITIALIZING',          // Starting up

  // QR Code
  QR_READY = 'QR_READY',                  // Ready to scan
  QR_EXPIRED = 'QR_EXPIRED',              // QR expired

  // Authentication
  CONNECTING = 'CONNECTING',              // User scanning QR
  CONNECTED = 'CONNECTED',                // Authenticated

  // Connection Issues
  DISCONNECTED = 'DISCONNECTED',          // Lost connection
  RECONNECTING = 'RECONNECTING',          // Auto retry
  RECONNECT_FAILED = 'RECONNECT_FAILED',  // Reconnect failed

  // Error States
  FAILED = 'FAILED',                      // Auth failed
  BLOCKED = 'BLOCKED',                    // Blocked by WhatsApp
  RATE_LIMITED = 'RATE_LIMITED',          // Rate limited

  // Cleanup
  DELETING = 'DELETING',                  // Being deleted
  DELETED = 'DELETED'                     // Removed
}
```

---

## Session Lifecycle

### State Diagram

```
            ┌──────────────────────────────────────┐
            │                                      │
            ▼                                      │
        ┌─────────────┐                           │
        │   CREATED   │────────────────┐           │
        └──────┬──────┘                │           │
               │                       │           │
               ▼                       ▼           │
        ┌──────────────────┐      ┌────────────┐   │
        │  INITIALIZING    │      │   FAILED   │───┘
        └──────┬───────────┘      └────────────┘
               │
               ▼
        ┌──────────────────┐
        │    QR_READY      │
        └──────┬───────────┘
               │ (user scans QR)
               ▼
        ┌──────────────────┐
        │   CONNECTING     │
        └──────┬───────────┘
               │
               ▼ (success)
        ┌──────────────────┐
        │   CONNECTED      │◄────────────┐
        └──────┬───────────┘             │
               │ (connection lost)       │ (auto reconnect success)
               ▼                         │
        ┌──────────────────┐             │
        │  DISCONNECTED    │             │
        └──────┬───────────┘             │
               │ (auto retry)            │
               ▼                         │
        ┌──────────────────┐             │
        │  RECONNECTING    │─────────────┘
        └──────┬───────────┘
               │ (retry failed)
               ▼
        ┌──────────────────────┐
        │  RECONNECT_FAILED    │───┐
        └──────────────────────┘   │ (user retry)
                                   │
                    ┌──────────────┘
                    │
                    ▼
        ┌──────────────────┐
        │   DELETING       │
        └──────┬───────────┘
               │
               ▼
        ┌──────────────────┐
        │   DELETED        │
        └──────────────────┘
```

---

## Session Creation Flow

### API Endpoint

```
POST /api/sessions

Request Body:
{
  userId: string;      // Optional, defaults to current user
  sessionName?: string; // e.g., "Sales Support"
}

Response:
{
  id: string;                    // NotifyTechAI session ID
  externalSessionId: string;     // OpenWA session ID
  status: "INITIALIZING";
  createdAt: ISO8601;
}
```

### Implementation

```typescript
// backend/src/modules/sessions/sessions.service.ts

@Injectable()
export class SessionsService {
  constructor(
    private db: DatabaseService,
    private openwaService: OpenwaService,
    private gateway: InboxGateway
  ) {}

  // Create new WhatsApp session
  async createSession(
    tenantId: string,
    userId: string,
    dto: CreateSessionDto
  ): Promise<WhatsappSession> {
    // Step 1: Validate user belongs to tenant
    const user = await this.db.users.findOne({
      id: userId,
      tenantId
    });
    if (!user) throw new ForbiddenException();

    // Step 2: Check session limit for tenant (plan quota)
    const existingSessions = await this.db.sessions.count({
      tenantId,
      deletedAt: null
    });

    const planLimit = this.getPlanLimit(tenantId);
    if (existingSessions >= planLimit) {
      throw new BadRequestException(
        `Session limit (${planLimit}) reached. Upgrade your plan.`
      );
    }

    // Step 3: Call OpenWA to create session
    const openwaSession = await this.openwaService.createSession();
    if (!openwaSession) throw new InternalServerErrorException();

    // Step 4: Create session record in DB
    const session = await this.db.sessions.create({
      tenantId,
      userId,
      externalSessionId: openwaSession.id,
      sessionName: dto.sessionName || `Session ${Date.now()}`,
      status: WhatsappSessionStatus.INITIALIZING,
      metadata: {
        sessionCreationReason: dto.reason || 'manual'
      }
    });

    // Step 5: Emit event for real-time update
    this.gateway.broadcastToTenant(tenantId, {
      event: 'session:created',
      data: session
    });

    // Step 6: Automatically start QR generation
    this.startQrGeneration(session);

    return session;
  }

  // Start QR code generation
  private async startQrGeneration(session: WhatsappSession) {
    // Step 1: Request QR from OpenWA
    const qrData = await this.openwaService.getQrCode(
      session.externalSessionId
    );

    // Step 2: Update session with QR
    await this.db.sessions.update(session.id, {
      qrCode: qrData.qrCode,
      qrExpiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
      status: WhatsappSessionStatus.QR_READY
    });

    // Step 3: Emit QR ready event
    this.gateway.broadcastToTenant(session.tenantId, {
      event: 'session:qr-ready',
      data: {
        sessionId: session.id,
        qrCode: qrData.qrCode,
        expiresAt: new Date(Date.now() + 2 * 60 * 1000)
      }
    });
  }
}
```

---

## QR Polling Flow

### Frontend Polling

```typescript
// frontend/src/hooks/useQrCode.ts

export const useQrCode = (sessionId: string) => {
  const [isScanning, setIsScanning] = useState(false);

  const { data: qrData } = useQuery(
    ['qr', sessionId],
    () => sessionsApi.getQrCode(sessionId),
    {
      enabled: isScanning,
      refetchInterval: 2000,  // Poll every 2 seconds
      staleTime: 0,
      retry: 3,
      onError: (error) => {
        if (error.response?.status === 404) {
          setIsScanning(false); // QR expired
        }
      }
    }
  );

  return {
    qrCode: qrData?.qrCode,
    isExpired: qrData?.isExpired,
    expiresAt: qrData?.expiresAt
  };
};

// Usage in component
export const CreateSessionModal = () => {
  const { qrCode } = useQrCode(sessionId);

  return (
    <div className="modal">
      <h2>Scan QR Code</h2>
      {qrCode ? (
        <img src={qrCode} alt="QR Code" />
      ) : (
        <div>Loading QR Code...</div>
      )}
      <p>Expires in {remainingTime}s</p>
    </div>
  );
};
```

### Backend Handling

```typescript
// backend/src/modules/sessions/sessions.controller.ts

@UseGuards(JwtAuthGuard, TenantGuard)
@Get('api/sessions/:id/qr')
async getQrCode(
  @Param('id') sessionId: string,
  @Query('tenantId') tenantId: string
) {
  // Step 1: Validate session exists and belongs to tenant
  const session = await this.db.sessions.findOne({
    id: sessionId,
    tenantId
  });
  if (!session) throw new NotFoundException();

  // Step 2: Check QR is not expired
  if (session.qrExpiresAt && session.qrExpiresAt < new Date()) {
    // QR expired, need to regenerate
    const newQr = await this.openwaService.refreshQrCode(
      session.externalSessionId
    );

    await this.db.sessions.update(sessionId, {
      qrCode: newQr.qrCode,
      qrExpiresAt: new Date(Date.now() + 2 * 60 * 1000)
    });

    return {
      qrCode: newQr.qrCode,
      isExpired: false,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000)
    };
  }

  // Step 3: Return existing QR if still valid
  return {
    qrCode: session.qrCode,
    isExpired: false,
    expiresAt: session.qrExpiresAt
  };
}
```

---

## Session Authentication Flow

### When User Scans QR Code

```
User scans QR on phone
↓
WhatsApp Web links to Puppeteer browser
↓
OpenWA detects: "authenticated"
↓
OpenWA calls: POST /webhooks/session-authenticated
↓
Backend: Update session status to CONNECTED
↓
Backend: Store phone number
↓
Backend: Emit WebSocket event
↓
Frontend: Show "Connected" status
↓
User can now send/receive messages
```

### Backend Handler

```typescript
// backend/src/integrations/openwa/webhooks/openwa-webhooks.controller.ts

@Post('webhooks/session-authenticated')
@SkipAuth()
async handleSessionAuthenticated(@Body() payload: any) {
  // Step 1: Get session from external ID
  const session = await this.db.sessions.findOne({
    externalSessionId: payload.externalSessionId
  });
  if (!session) throw new NotFoundException();

  // Step 2: Update session status
  await this.db.sessions.update(session.id, {
    status: WhatsappSessionStatus.CONNECTED,
    phoneNumber: payload.phoneNumber,
    displayName: payload.displayName,
    profilePicture: payload.profilePicture,
    isAuthenticated: true,
    authenticatedAt: new Date(),
    failedAuthAttempts: 0,
    metadata: {
      ...session.metadata,
      reconnectAttempts: 0
    }
  });

  // Step 3: Emit real-time event
  this.gateway.broadcastToTenant(session.tenantId, {
    event: 'session:connected',
    data: {
      sessionId: session.id,
      phoneNumber: payload.phoneNumber,
      displayName: payload.displayName
    }
  });

  // Step 4: Emit to specific user
  this.gateway.broadcastToUser(session.userId, {
    event: 'my-session:connected',
    data: { sessionId: session.id }
  });
}
```

---

## Session Disconnection & Reconnection

### Automatic Reconnect

```typescript
// backend/src/integrations/openwa/webhooks/openwa-webhooks.controller.ts

@Post('webhooks/session-disconnected')
@SkipAuth()
async handleSessionDisconnected(@Body() payload: any) {
  const session = await this.db.sessions.findOne({
    externalSessionId: payload.externalSessionId
  });

  // Update status
  await this.db.sessions.update(session.id, {
    status: WhatsappSessionStatus.DISCONNECTED,
    lastActivityAt: new Date()
  });

  // Emit event
  this.gateway.broadcastToTenant(session.tenantId, {
    event: 'session:disconnected',
    data: {
      sessionId: session.id,
      reason: payload.reason
    }
  });

  // Auto-reconnect attempt (wait 5 seconds first)
  setTimeout(() => {
    this.attemptReconnect(session);
  }, 5000);
}

async attemptReconnect(session: WhatsappSession) {
  // Update status
  await this.db.sessions.update(session.id, {
    status: WhatsappSessionStatus.RECONNECTING
  });

  try {
    // Try to reconnect
    const result = await this.openwaService.reconnectSession(
      session.externalSessionId
    );

    if (result.isAuthenticated) {
      // Successful reconnect
      await this.db.sessions.update(session.id, {
        status: WhatsappSessionStatus.CONNECTED,
        metadata: {
          ...session.metadata,
          reconnectAttempts: 0
        }
      });

      this.gateway.broadcastToTenant(session.tenantId, {
        event: 'session:reconnected',
        data: { sessionId: session.id }
      });
    } else {
      // Failed reconnect
      throw new Error('Reconnect failed');
    }

  } catch (error) {
    // Max retries?
    const attempts = (session.metadata?.reconnectAttempts || 0) + 1;
    const maxAttempts = 3;

    if (attempts >= maxAttempts) {
      // Give up
      await this.db.sessions.update(session.id, {
        status: WhatsappSessionStatus.RECONNECT_FAILED,
        metadata: {
          ...session.metadata,
          lastErrorMessage: error.message,
          reconnectAttempts: attempts
        }
      });

      // Notify user
      this.gateway.broadcastToTenant(session.tenantId, {
        event: 'session:reconnect-failed',
        data: {
          sessionId: session.id,
          message: 'Could not reconnect after 3 attempts. Please reconnect manually.'
        }
      });
    } else {
      // Retry again
      await this.db.sessions.update(session.id, {
        metadata: {
          ...session.metadata,
          reconnectAttempts: attempts
        }
      });

      // Schedule retry (exponential backoff)
      setTimeout(
        () => this.attemptReconnect(session),
        5000 * attempts
      );
    }
  }
}
```

---

## Session Deletion Flow

### User Initiates Delete

```typescript
// API
DELETE /api/sessions/:id

// Backend Handler
@UseGuards(JwtAuthGuard, TenantGuard)
@Delete('api/sessions/:id')
async deleteSession(
  @Param('id') sessionId: string,
  @Query('tenantId') tenantId: string,
  @CurrentUser() user: User
) {
  // Step 1: Validate ownership
  const session = await this.db.sessions.findOne({
    id: sessionId,
    tenantId,
    userId: user.id  // Can only delete own sessions (or ADMIN can delete any)
  });
  if (!session) throw new ForbiddenException();

  // Step 2: Update status
  await this.db.sessions.update(sessionId, {
    status: WhatsappSessionStatus.DELETING
  });

  // Step 3: Queue deletion job
  await this.queue.add('delete-session', {
    sessionId,
    externalSessionId: session.externalSessionId
  });

  return { success: true };
}
```

### Worker Processes Deletion

```typescript
// Worker
@Process('delete-session')
async handleDeleteSession(job: Job) {
  const { sessionId, externalSessionId } = job.data;

  try {
    // Step 1: Call OpenWA to logout
    await this.openwaService.logoutSession(externalSessionId);

    // Step 2: Delete from DB
    await this.db.sessions.softDelete(sessionId);

    // Step 3: Delete related data
    // - Conversations for this session (soft delete)
    await this.db.conversations.softDelete({ sessionId });

    // Step 4: Get session to get tenant ID
    const session = await this.db.sessions.findById(sessionId);

    // Step 5: Emit event
    this.gateway.broadcastToTenant(session.tenantId, {
      event: 'session:deleted',
      data: { sessionId }
    });

  } catch (error) {
    console.error('Delete session failed:', error);
    throw error; // Retry
  }
}
```

---

## Session Security Rules

### Rule 1: Tenant Isolation

```typescript
// ✅ Correct - Always include tenantId
const session = await this.db.sessions.findOne({
  id: sessionId,
  tenantId: user.tenantId  // MANDATORY
});

// ❌ Wrong - Missing tenant check
const session = await this.db.sessions.findById(sessionId);
```

### Rule 2: User Isolation (Optional but Recommended)

```typescript
// Can ADMIN access other user's sessions?
// Option 1: Strict - Only own sessions
const session = await this.db.sessions.findOne({
  id: sessionId,
  tenantId: user.tenantId,
  userId: user.id  // Only own
});

// Option 2: Admin can access - With role check
if (user.role !== UserRole.ADMIN) {
  // Non-admin can only access own
  where.userId = user.id;
}
```

### Rule 3: Status Validation

```typescript
// Before sending message, verify session status
const session = await this.db.sessions.findOne({
  id: sessionId,
  tenantId: user.tenantId
});

if (session.status !== WhatsappSessionStatus.CONNECTED) {
  throw new BadRequestException(
    `Cannot send messages: Session is ${session.status}`
  );
}
```

### Rule 4: Rate Limiting

```typescript
// Max messages per minute per session
const recentMessages = await this.db.messages.count({
  sessionId,
  createdAt: { $gte: new Date(Date.now() - 60000) }
});

if (recentMessages > 60) {
  throw new TooManyRequestsException('Rate limit exceeded');
}
```

---

## Session Monitoring & Metrics

### Dashboard Metrics

```typescript
// Get tenant session stats
async getTenantSessionStats(tenantId: string) {
  const stats = {
    totalSessions: await this.db.sessions.count({ tenantId }),
    
    byStatus: {
      connected: await this.db.sessions.count({
        tenantId,
        status: WhatsappSessionStatus.CONNECTED
      }),
      disconnected: await this.db.sessions.count({
        tenantId,
        status: WhatsappSessionStatus.DISCONNECTED
      }),
      qrReady: await this.db.sessions.count({
        tenantId,
        status: WhatsappSessionStatus.QR_READY
      }),
      failed: await this.db.sessions.count({
        tenantId,
        status: WhatsappSessionStatus.FAILED
      })
    },

    metrics: {
      avgMessagesPerSession: 0,
      avgMessagesPerDay: 0,
      oldestSession: await this.getMostRecentSession(tenantId, 'asc'),
      newestSession: await this.getMostRecentSession(tenantId, 'desc'),
      lastActivityAgo: ''
    }
  };

  return stats;
}
```

---

## Session Limits by Plan

```
BASIC Plan:
  - Max 1 session
  - Max 1 day offline
  - Auto-delete after disconnection

GROWTH Plan:
  - Max 5 sessions
  - Max 7 days offline
  - Auto-reconnect enabled

PROFESSIONAL Plan:
  - Max 10 sessions
  - Max 30 days offline
  - Priority reconnect

ENTERPRISE Plan:
  - Unlimited sessions
  - Unlimited offline period
  - Dedicated support
```

---

## Summary

| Aspect | Rule |
|--------|------|
| **Ownership** | Tenant + User |
| **Isolation** | Always filter by tenantId |
| **Status** | Use enum, never raw strings |
| **QR Polling** | 2-second interval, 5-min expiry |
| **Reconnection** | Automatic with exponential backoff |
| **Rate Limiting** | 60 msgs/min per session |
| **Deletion** | Soft delete, queue async job |
| **Quotas** | Plan-based limits enforced |
| **Monitoring** | Real-time WebSocket events |

---

*Sessions are the foundation of multi-tenant WhatsApp integration. Maintain strict isolation.*

