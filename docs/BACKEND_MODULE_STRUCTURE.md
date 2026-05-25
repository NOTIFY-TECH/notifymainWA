# Backend Module Structure - NotifyTechAI

**Purpose**: Define exact backend module organization and responsibilities  
**Framework**: NestJS  
**Database**: PostgreSQL + Prisma  
**Status**: ARCHITECTURE SPEC  

---

## Backend Directory Structure

```
backend/
├── src/
│   ├── app.module.ts                    # Root module
│   ├── main.ts                          # Entry point
│   ├── common/                          # Shared utilities
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── admin.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── tenant.guard.ts
│   │   │   └── validate-tenant.guard.ts
│   │   ├── interceptors/
│   │   │   ├── tenant-context.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── pipes/
│   │   │   ├── validation.pipe.ts
│   │   │   └── parse-uuid.pipe.ts
│   │   ├── filters/
│   │   │   └── exception.filter.ts
│   │   ├── interfaces/
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── hash.util.ts
│   │       └── validator.util.ts
│   ├── config/
│   │   └── configuration.ts             # Env config
│   ├── database/
│   │   ├── entities/                    # All entities
│   │   ├── migrations/                  # TypeORM migrations
│   │   ├── data-source.ts              # DB connection
│   │   └── seeds/                       # Seed data
│   ├── modules/                         # Core business modules
│   │   ├── health/                      # Health check
│   │   ├── auth/                        # Authentication
│   │   ├── tenants/                     # Tenant management
│   │   ├── users/                       # User management
│   │   ├── sessions/                    # WhatsApp sessions wrapper
│   │   ├── inbox/                       # Conversations
│   │   ├── campaigns/                   # Campaign management
│   │   ├── crm/                         # CRM features
│   │   ├── contacts/                    # Contact management
│   │   ├── messages/                    # Message history
│   │   ├── analytics/                   # Dashboard metrics
│   │   ├── webhooks/                    # Event subscriptions
│   │   ├── subscriptions/               # Billing plans
│   │   ├── billing/                     # Payment handling
│   │   ├── notifications/               # Email/SMS alerts
│   │   ├── queue/                       # Job management
│   │   └── audit-logs/                  # Compliance logging
│   ├── integrations/                    # External services
│   │   └── openwa/                      # OpenWA wrapper
│   │       ├── openwa.module.ts
│   │       ├── openwa.service.ts
│   │       ├── openwa.controller.ts
│   │       ├── dto/
│   │       ├── interfaces/
│   │       └── webhooks/
│   │           └── openwa-webhooks.controller.ts
│   ├── gateway/                         # WebSocket support
│   │   ├── inbox.gateway.ts             # Real-time inbox
│   │   └── interfaces/
│   └── events/                          # Application events
│       └── event-emitter.service.ts
├── test/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── nest-cli.json
└── README.md
```

---

## Core Module Specifications

### 1. HEALTH Module

**Purpose**: System health and readiness checks  
**Endpoints**:
```
GET /health              # Simple liveness check
GET /health/ready        # Readiness check (DB, Redis, OpenWA)
GET /health/live         # Pod readiness (Kubernetes)
```

**Implementation**:
```typescript
@Controller('health')
export class HealthController {
  constructor(
    private db: DatabaseService,
    private redis: RedisService,
    private openwa: OpenwaService
  ) {}

  @Get()
  async check() {
    return { status: 'ok', timestamp: new Date() };
  }

  @Get('ready')
  async ready() {
    const dbReady = await this.db.ping();
    const redisReady = await this.redis.ping();
    const openwaReady = await this.openwa.ping();
    
    if (dbReady && redisReady && openwaReady) {
      return { status: 'ready' };
    }
    throw new ServiceUnavailableException();
  }
}
```

---

### 2. AUTH Module

**Purpose**: User authentication and session management  
**Features**:
- User registration
- Email/password login
- JWT token generation
- Refresh token logic
- Password reset
- Session tracking

**Services**:
```typescript
export class AuthService {
  // Registration with validation
  async register(dto: RegisterDto): Promise<User> { }
  
  // Login with verification
  async login(dto: LoginDto): Promise<{ accessToken, refreshToken }> { }
  
  // Token refresh
  async refresh(refreshToken: string): Promise<{ accessToken }> { }
  
  // Logout/session cleanup
  async logout(userId: string, refreshToken: string): Promise<void> { }
  
  // Password reset
  async requestPasswordReset(email: string): Promise<void> { }
  async resetPassword(token: string, newPassword: string): Promise<void> { }
  
  // Validate token
  async validateToken(token: string): Promise<User> { }
}
```

**Entities**:
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  passwordHash: string;

  @Column('enum', { enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ default: 0 })
  loginCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}

enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PARTNER = 'PARTNER',
  CLIENT = 'CLIENT',
  ADMIN = 'ADMIN',
  TEAM_LEADER = 'TEAM_LEADER',
  AGENT = 'AGENT',
  USER = 'USER'
}
```

---

### 3. TENANTS Module

**Purpose**: Multi-tenant organization management  
**Features**:
- Tenant creation
- Tenant settings
- Tenant quota management
- Subscription tier

**Services**:
```typescript
export class TenantsService {
  // Create tenant
  async createTenant(dto: CreateTenantDto): Promise<Tenant> { }
  
  // Get tenant details
  async getTenant(tenantId: string): Promise<Tenant> { }
  
  // Update settings
  async updateSettings(tenantId: string, dto: UpdateSettingsDto): Promise<Tenant> { }
  
  // Check quota
  async checkQuota(tenantId: string, resource: string): Promise<boolean> { }
}
```

**Entity**:
```typescript
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  website: string;

  @Column('enum', { enum: SubscriptionTier, default: SubscriptionTier.BASIC })
  subscriptionTier: SubscriptionTier;

  @Column({ default: true })
  isActive: boolean;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
```

---

### 4. USERS Module

**Purpose**: Team member management  
**Features**:
- Add/remove users
- Role assignment
- User permissions
- Profile management

**Services**:
```typescript
export class UsersService {
  // Create user in tenant
  async createUser(tenantId: string, dto: CreateUserDto): Promise<User> { }
  
  // Update user
  async updateUser(userId: string, dto: UpdateUserDto): Promise<User> { }
  
  // Delete user
  async deleteUser(userId: string): Promise<void> { }
  
  // List tenant users
  async listTenantUsers(tenantId: string): Promise<User[]> { }
  
  // Get user by ID
  async getUser(userId: string): Promise<User> { }
}
```

---

### 5. SESSIONS Module (WhatsApp Sessions)

**Purpose**: WhatsApp session management wrapper  
**Features**:
- Create sessions
- Delete sessions
- Get session status
- QR polling
- Session ownership validation

**Key**: This is a WRAPPER around OpenWA, not the full OpenWA implementation

**Services**:
```typescript
export class SessionsService {
  constructor(
    private openwaService: OpenwaService,
    private db: DatabaseService
  ) {}

  // Create session
  async createSession(
    tenantId: string,
    userId: string,
    dto: CreateSessionDto
  ): Promise<Session> {
    // Call OpenWA
    const openwaSession = await this.openwaService.createSession(dto);
    
    // Store in DB with tenant context
    const session = await this.db.sessions.create({
      tenantId,
      userId,
      externalSessionId: openwaSession.id,
      status: 'INITIALIZING'
    });
    
    return session;
  }

  // Get session with tenant validation
  async getSession(tenantId: string, sessionId: string): Promise<Session> {
    return this.db.sessions.findOne({
      tenantId,  // Always filter by tenant
      id: sessionId
    });
  }

  // Delete session
  async deleteSession(tenantId: string, sessionId: string): Promise<void> {
    const session = await this.getSession(tenantId, sessionId);
    
    // Call OpenWA to cleanup
    await this.openwaService.deleteSession(session.externalSessionId);
    
    // Update DB
    await this.db.sessions.update(sessionId, { status: 'DELETED' });
  }
}
```

**Entity**:
```typescript
@Entity('whatsapp_sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  userId: string;

  @Column()
  externalSessionId: string;  // From OpenWA

  @Column({ nullable: true })
  phoneNumber: string;

  @Column('enum', { enum: SessionStatus })
  status: SessionStatus;

  @Column({ nullable: true })
  qrCode: string;

  @Column({ default: false })
  isAuthenticated: boolean;

  @Column({ nullable: true })
  lastActivityAt: Date;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
```

---

### 6. INBOX Module

**Purpose**: Conversation and team inbox management  
**Features**:
- List conversations with filters
- Assign conversations to agents
- Update conversation status
- Unread count tracking
- Real-time updates

**Services**:
```typescript
export class InboxService {
  // Get conversations for tenant
  async getConversations(
    tenantId: string,
    options: {
      status?: string;
      assignedTo?: string;
      search?: string;
      page: number;
      limit: number;
    }
  ): Promise<{ data: Conversation[], total: number }> { }

  // Assign conversation to agent
  async assignConversation(
    tenantId: string,
    conversationId: string,
    userId: string
  ): Promise<Conversation> { }

  // Update status
  async updateStatus(
    tenantId: string,
    conversationId: string,
    status: string
  ): Promise<Conversation> { }

  // Get unread count
  async getUnreadCount(tenantId: string, userId: string): Promise<number> { }
}
```

**Entity**:
```typescript
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  contactId: string;

  @Column()
  sessionId: string;

  @Column({ nullable: true })
  assignedToUserId: string;

  @Column('enum', { enum: ConversationStatus, default: ConversationStatus.OPEN })
  status: ConversationStatus;

  @Column({ nullable: true })
  subject: string;

  @Column({ default: 0 })
  messageCount: number;

  @Column({ default: 0 })
  unreadCount: number;

  @Column({ nullable: true })
  lastMessageAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
```

---

### 7. CAMPAIGNS Module

**Purpose**: Bulk message campaign execution  
**Features**:
- Campaign creation
- CSV upload
- Schedule campaigns
- Execution tracking
- Statistics

**Services**:
```typescript
export class CampaignsService {
  // Create campaign
  async createCampaign(
    tenantId: string,
    userId: string,
    dto: CreateCampaignDto
  ): Promise<Campaign> { }

  // Upload CSV and create recipients
  async uploadCsv(
    tenantId: string,
    file: Express.Multer.File
  ): Promise<Campaign> { }

  // Schedule execution
  async scheduleCampaign(
    tenantId: string,
    campaignId: string,
    scheduledAt: Date
  ): Promise<Campaign> { }

  // Execute now
  async executeCampaign(tenantId: string, campaignId: string): Promise<void> { }

  // Get statistics
  async getCampaignStats(
    tenantId: string,
    campaignId: string
  ): Promise<CampaignStats> { }

  // Pause campaign
  async pauseCampaign(tenantId: string, campaignId: string): Promise<void> { }
}
```

---

### 8. CONTACTS Module

**Purpose**: Contact directory and enrichment  
**Features**:
- Import contacts
- Contact groups
- Contact enrichment
- Duplicate detection

**Services**:
```typescript
export class ContactsService {
  // Create contact
  async createContact(tenantId: string, dto: CreateContactDto): Promise<Contact> { }

  // Update contact
  async updateContact(tenantId: string, contactId: string, dto: UpdateContactDto): Promise<Contact> { }

  // List contacts
  async listContacts(tenantId: string, options: { search?, page, limit }): Promise<{ data: Contact[], total }> { }

  // Import contacts from CSV
  async importContacts(tenantId: string, file: Express.Multer.File): Promise<{ imported: number }> { }

  // Delete contact
  async deleteContact(tenantId: string, contactId: string): Promise<void> { }
}
```

---

### 9. MESSAGES Module

**Purpose**: Message history and search  
**Features**:
- Store messages
- Search messages
- Message pagination
- Mark as read
- Message forwarding

**Services**:
```typescript
export class MessagesService {
  // Send message
  async sendMessage(
    tenantId: string,
    userId: string,
    dto: SendMessageDto
  ): Promise<Message> { }

  // Get conversation messages
  async getMessages(
    tenantId: string,
    conversationId: string,
    options: { page: number; limit: number }
  ): Promise<{ data: Message[], total: number }> { }

  // Search messages
  async searchMessages(
    tenantId: string,
    query: string,
    options?: { conversationId?: string }
  ): Promise<Message[]> { }

  // Mark as read
  async markAsRead(tenantId: string, conversationId: string): Promise<void> { }
}
```

---

### 10. ANALYTICS Module

**Purpose**: Dashboard metrics and reporting  
**Features**:
- Real-time metrics
- Campaign stats
- Agent performance
- Delivery trends
- Revenue metrics

**Services**:
```typescript
export class AnalyticsService {
  // Dashboard stats
  async getDashboardStats(tenantId: string): Promise<DashboardStats> { }

  // Campaign analytics
  async getCampaignAnalytics(tenantId: string, campaignId: string): Promise<CampaignAnalytics> { }

  // Agent performance
  async getAgentStats(tenantId: string, userId: string): Promise<AgentStats> { }

  // Delivery trends
  async getDeliveryTrends(tenantId: string, days: number): Promise<TrendData[]> { }

  // Revenue metrics
  async getRevenueMetrics(tenantId: string): Promise<RevenueMetrics> { }
}
```

---

### 11. WEBHOOKS Module

**Purpose**: Event subscriptions and delivery  
**Features**:
- Webhook registration
- Event delivery with retries
- Webhook logs
- Signature verification

**Services**:
```typescript
export class WebhooksService {
  // Register webhook
  async registerWebhook(
    tenantId: string,
    dto: RegisterWebhookDto
  ): Promise<Webhook> { }

  // Get webhooks
  async getWebhooks(tenantId: string): Promise<Webhook[]> { }

  // Delete webhook
  async deleteWebhook(tenantId: string, webhookId: string): Promise<void> { }

  // Get webhook logs
  async getWebhookLogs(
    tenantId: string,
    webhookId: string,
    limit: number
  ): Promise<WebhookLog[]> { }

  // Emit event (queued for delivery)
  async emitEvent(tenantId: string, eventType: string, payload: any): Promise<void> { }
}
```

---

### 12. SUBSCRIPTIONS Module

**Purpose**: Subscription plan management  
**Features**:
- Create subscription
- Upgrade/downgrade plans
- Cancel subscription
- Usage tracking
- Quota enforcement

**Services**:
```typescript
export class SubscriptionsService {
  // Create subscription
  async createSubscription(
    tenantId: string,
    dto: CreateSubscriptionDto
  ): Promise<Subscription> { }

  // Upgrade plan
  async upgradePlan(tenantId: string, newPlan: string): Promise<Subscription> { }

  // Downgrade plan
  async downgradePlan(tenantId: string, newPlan: string): Promise<Subscription> { }

  // Cancel subscription
  async cancelSubscription(tenantId: string): Promise<void> { }

  // Get current subscription
  async getSubscription(tenantId: string): Promise<Subscription> { }

  // Check usage quota
  async checkQuota(tenantId: string, resource: string, count: number): Promise<boolean> { }
}
```

---

### 13. BILLING Module

**Purpose**: Payment processing and invoices  
**Features**:
- Razorpay integration
- Invoice generation
- Payment tracking
- Refunds

**Services**:
```typescript
export class BillingService {
  // Create subscription (Razorpay)
  async createSubscription(
    tenantId: string,
    dto: CreateBillingDto
  ): Promise<Subscription> { }

  // Download invoice
  async downloadInvoice(
    tenantId: string,
    invoiceId: string
  ): Promise<Buffer> { }

  // Get invoices
  async getInvoices(tenantId: string): Promise<Invoice[]> { }

  // Update payment status
  async updatePaymentStatus(
    tenantId: string,
    externalPaymentId: string,
    status: string
  ): Promise<void> { }
}
```

---

### 14. NOTIFICATIONS Module

**Purpose**: Alert and notification delivery  
**Features**:
- Email notifications
- SMS notifications
- In-app notifications
- Notification preferences

**Services**:
```typescript
export class NotificationsService {
  // Send email
  async sendEmail(dto: SendEmailDto): Promise<void> { }

  // Send SMS
  async sendSms(dto: SendSmsDto): Promise<void> { }

  // Send in-app notification
  async notifyUser(userId: string, notification: NotificationDto): Promise<void> { }

  // Get user notifications
  async getUserNotifications(userId: string): Promise<Notification[]> { }

  // Mark as read
  async markAsRead(notificationId: string): Promise<void> { }
}
```

---

### 15. QUEUE Module

**Purpose**: Job management and processing  
**Features**:
- Campaign sending queue
- Webhook delivery queue
- Message retry queue
- Job status tracking

**Queues**:
```typescript
// BullMQ Queues
- send-campaign-message   // Individual message sending
- deliver-webhook          // Webhook delivery with retries
- retry-message            // Failed message retries
- process-csv              // CSV file processing
- generate-report          // Report generation
- aggregate-analytics      // Metrics aggregation
```

---

### 16. AUDIT-LOGS Module

**Purpose**: Compliance and audit trail  
**Features**:
- Log all modifications
- Change tracking
- User actions
- Compliance reports

**Services**:
```typescript
export class AuditLogsService {
  // Log action
  async logAction(dto: LogActionDto): Promise<void> { }

  // Get audit logs
  async getAuditLogs(
    tenantId: string,
    options: { userId?, resourceType?, page, limit }
  ): Promise<{ data: AuditLog[], total: number }> { }

  // Generate compliance report
  async generateReport(tenantId: string, startDate: Date, endDate: Date): Promise<Buffer> { }
}
```

---

## Common Guards & Interceptors

### Guards

#### JwtAuthGuard
```typescript
// Validates JWT token from Authorization header
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return user;
}
```

#### TenantGuard
```typescript
// Validates tenantId from URL params matches JWT tenantId
@UseGuards(TenantGuard)
@Get('tenants/:tenantId/sessions')
getSessions(@Param('tenantId') tenantId: string) {
  // User can only see their own tenant data
}
```

#### ValidateTenantGuard
```typescript
// Additional tenant ownership validation
@UseGuards(ValidateTenantGuard)
@Post('tenants/:tenantId/campaigns')
createCampaign(
  @Param('tenantId') tenantId: string,
  @Body() dto: CreateCampaignDto
) {
  // Extra safety check
}
```

### Interceptors

#### TenantContextInterceptor
```typescript
// Automatically adds tenantId to all queries
// Sets it from JWT token context
```

#### TransformInterceptor
```typescript
// Transforms responses to consistent format
Response:
{
  data: any,
  timestamp: ISO8601,
  success: boolean
}
```

---

## Module Dependencies

```
HealthModule (no deps)
  ↓
AuthModule → TenantsModule, UsersModule
  ↓
SessionsModule → OpenwaModule (integration)
  ↓
InboxModule
  ↓
CampaignsModule → QueueModule
  ↓
ContactsModule
  ↓
MessagesModule → InboxModule, ContactsModule
  ↓
AnalyticsModule
  ↓
WebhooksModule → QueueModule
  ↓
SubscriptionsModule
  ↓
BillingModule → SubscriptionsModule
  ↓
NotificationsModule
  ↓
AuditLogsModule
```

---

## AppModule Configuration

```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      // PostgreSQL connection
    }),
    CacheModule.register(),  // Redis
    BullModule.forRoot({
      // Redis connection for queues
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' }
    }),
    // Core modules
    HealthModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    // WhatsApp
    SessionsModule,
    OpenwaModule,
    // Business
    InboxModule,
    CampaignsModule,
    ContactsModule,
    MessagesModule,
    // Analytics
    AnalyticsModule,
    WebhooksModule,
    // Billing
    SubscriptionsModule,
    BillingModule,
    // Operations
    NotificationsModule,
    QueueModule,
    AuditLogsModule,
    // Real-time
    GatewayModule
  ]
})
export class AppModule {}
```

---

## Critical Implementation Rules

1. **Every module handles ONE concern**
2. **Tenant validation on every endpoint**
3. **Queue for all heavy operations**
4. **WebSocket for real-time updates**
5. **Audit logging for all changes**
6. **Error handling with consistent format**
7. **Rate limiting on public endpoints**
8. **CORS configured properly**
9. **Security headers via Helmet**
10. **Database migrations versioned**

---

*This module structure ensures NotifyTechAI is a complete, independent SaaS platform.*

