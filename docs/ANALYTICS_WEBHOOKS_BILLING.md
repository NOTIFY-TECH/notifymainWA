# ANALYTICS, WEBHOOKS & BILLING SYSTEMS

**Goal**: Implement real-time analytics, reliable webhook delivery, and SaaS billing

---

## Analytics System

### Analytics Architecture

```
Events generated
    ↓
Aggregated in Redis
    ↓
Periodically flushed to PostgreSQL
    ↓
Queried for dashboard
    ↓
Real-time updates via WebSocket
```

### Metrics Tracked

1. **Message Metrics**
   - Messages sent (daily, hourly)
   - Messages delivered
   - Messages failed
   - Delivery rate
   - Response time

2. **Session Metrics**
   - Active sessions
   - Session uptime
   - Reconnections
   - Disconnections

3. **Campaign Metrics**
   - Campaigns created
   - Campaign delivery rate
   - Recipients reached
   - Failed deliveries

4. **Contact Metrics**
   - Total contacts
   - Engaged contacts
   - Inactive contacts
   - Contact growth

5. **Team Metrics**
   - Agent performance
   - Response time
   - Conversations handled
   - Resolution rate

### Analytics Service

**src/analytics/analytics.service.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
  ) {}

  /**
   * Track event in Redis
   */
  async trackEvent(
    tenantId: string,
    eventType: string,
    data: Record<string, any>,
  ) {
    const key = `analytics:${tenantId}:${eventType}:${new Date().toISOString().split('T')[0]}`;

    const current = await this.cacheManager.get(key);
    const updated = {
      ...current,
      ...data,
      count: (current?.count || 0) + 1,
    };

    await this.cacheManager.set(key, updated, 86400000); // 24 hours
  }

  /**
   * Get real-time dashboard stats
   */
  async getDashboardStats(tenantId: string) {
    const today = new Date().toISOString().split('T')[0];

    const [
      messagesToday,
      sessionsActive,
      contactsTotal,
      campaignsActive,
    ] = await Promise.all([
      this.messageRepository.count({
        where: {
          tenantId,
          createdAt: MoreThanOrEqual(new Date(`${today}T00:00:00`)),
        },
      }),
      this.sessionRepository.count({
        where: {
          tenantId,
          status: 'connected',
        },
      }),
      this.getContactCount(tenantId),
      this.getCampaignCount(tenantId),
    ]);

    return {
      messagesToday,
      sessionsActive,
      contactsTotal,
      campaignsActive,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(tenantId: string, campaignId: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, tenantId },
    });

    const recipients = await this.campaignRecipientRepository.find({
      where: { campaignId },
    });

    const sent = recipients.filter((r) => r.status === 'sent').length;
    const delivered = recipients.filter((r) => r.status === 'delivered').length;
    const failed = recipients.filter((r) => r.status === 'failed').length;

    return {
      campaign,
      totalRecipients: recipients.length,
      sent,
      delivered,
      failed,
      deliveryRate: delivered / recipients.length,
      failureRate: failed / recipients.length,
    };
  }

  /**
   * Get agent performance metrics
   */
  async getAgentStats(tenantId: string, userId: string) {
    const conversations = await this.conversationRepository.find({
      where: {
        tenantId,
        assignedToUserId: userId,
      },
    });

    const closedConversations = conversations.filter(
      (c) => c.status === 'closed' || c.status === 'resolved',
    );

    const avgResponseTime = this.calculateAvgResponseTime(conversations);

    return {
      conversationsHandled: closedConversations.length,
      activeConversations: conversations.filter((c) => c.status === 'open').length,
      averageResponseTime: avgResponseTime,
      resolutionRate: closedConversations.length / conversations.length,
    };
  }

  /**
   * Get message delivery trends
   */
  async getDeliveryTrends(tenantId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const messages = await this.messageRepository
      .createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId })
      .andWhere('message.createdAt >= :startDate', { startDate })
      .select(
        "DATE(message.createdAt)::text as date",
      )
      .addSelect(
        "COUNT(CASE WHEN status = 'delivered' THEN 1 END)::float / COUNT(*)",
        'deliveryRate',
      )
      .addSelect('COUNT(*)', 'totalMessages')
      .groupBy('DATE(message.createdAt)')
      .orderBy('DATE(message.createdAt)', 'ASC')
      .getRawMany();

    return messages;
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(tenantId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId },
    });

    const invoices = await this.invoiceRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    const paidInvoices = invoices.filter((i) => i.status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.amount, 0);

    return {
      subscription,
      totalRevenue,
      mrr: subscription?.monthlyPrice || 0,
      invoiceCount: invoices.length,
      paidInvoices: paidInvoices.length,
      pendingAmount: invoices
        .filter((i) => i.status !== 'paid')
        .reduce((sum, i) => sum + i.amount, 0),
    };
  }

  private calculateAvgResponseTime(conversations: any[]): number {
    // Implementation
    return 0;
  }
}
```

### Analytics Dashboard Endpoint

```typescript
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('tenants/:tenantId/dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(@Param('tenantId') tenantId: string) {
    return this.analyticsService.getDashboardStats(tenantId);
  }

  @Get('tenants/:tenantId/campaigns/:campaignId')
  @UseGuards(JwtAuthGuard)
  async getCampaignStats(
    @Param('tenantId') tenantId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.analyticsService.getCampaignAnalytics(tenantId, campaignId);
  }

  @Get('tenants/:tenantId/trends')
  @UseGuards(JwtAuthGuard)
  async getTrends(
    @Param('tenantId') tenantId: string,
    @Query('days') days: number = 7,
  ) {
    return this.analyticsService.getDeliveryTrends(tenantId, days);
  }
}
```

---

## Webhook System

### Webhook Types

1. **message:received** - New incoming message
2. **message:delivered** - Message delivery confirmation
3. **message:read** - Message read receipt
4. **session:connected** - WhatsApp session connected
5. **session:disconnected** - Session disconnected
6. **campaign:completed** - Campaign execution completed
7. **contact:updated** - Contact information changed

### Webhook Service

**src/webhooks/webhooks.service.ts**
```typescript
@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
    
    @InjectQueue('webhooks')
    private webhookQueue: Queue,
  ) {}

  /**
   * Register webhook endpoint
   */
  async registerWebhook(
    tenantId: string,
    url: string,
    eventTypes: string[],
  ) {
    const secretKey = crypto.randomBytes(32).toString('hex');

    const webhook = this.webhookRepository.create({
      tenantId,
      url,
      eventTypes,
      secretKey,
      isActive: true,
    });

    return this.webhookRepository.save(webhook);
  }

  /**
   * Emit webhook event
   */
  async emitEvent(
    tenantId: string,
    eventType: string,
    payload: Record<string, any>,
  ) {
    const webhooks = await this.webhookRepository.find({
      where: {
        tenantId,
        isActive: true,
      },
    });

    // Filter webhooks that listen to this event
    const targetWebhooks = webhooks.filter((w) =>
      w.eventTypes.includes(eventType),
    );

    for (const webhook of targetWebhooks) {
      // Create event record
      const event = this.webhookEventRepository.create({
        webhookId: webhook.id,
        tenantId,
        eventType,
        payload,
        status: 'pending',
      });

      await this.webhookEventRepository.save(event);

      // Queue for delivery
      await this.webhookQueue.add(
        'deliver-webhook',
        {
          webhookId: webhook.id,
          eventId: event.id,
          url: webhook.url,
          payload,
          secretKey: webhook.secretKey,
        },
        {
          attempts: webhook.maxRetries,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );
    }
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(tenantId: string, webhookId: string, limit = 100) {
    return this.webhookEventRepository.find({
      where: { tenantId, webhookId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(tenantId: string, webhookId: string) {
    return this.webhookRepository.delete({
      id: webhookId,
      tenantId,
    });
  }
}
```

### Webhook Processor

**src/webhooks/processors/webhook.processor.ts**
```typescript
@Processor('webhooks')
export class WebhookProcessor {
  constructor(
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
  ) {}

  @Process('deliver-webhook')
  async deliverWebhook(job: Job) {
    const { webhookId, eventId, url, payload, secretKey } = job.data;
    const maxRetries = 3;

    try {
      // Create signature
      const signature = crypto
        .createHmac('sha256', secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');

      // POST to webhook
      const response = await axios.post(url, payload, {
        headers: {
          'X-Webhook-Signature': signature,
          'X-Webhook-Event-ID': eventId,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      // Mark event as success
      await this.webhookEventRepository.update(eventId, {
        status: 'success',
        responseStatus: response.status,
        responseBody: JSON.stringify(response.data),
      });

      console.log(`✅ Webhook delivered: ${url}`);
    } catch (error) {
      console.error(`❌ Webhook delivery failed: ${error}`);

      // Update attempts
      const event = await this.webhookEventRepository.findOne({
        where: { id: eventId },
      });

      event.attemptCount++;

      if (event.attemptCount >= maxRetries) {
        event.status = 'failed';
        event.errorMessage = error.message;
      } else {
        event.status = 'retrying';
      }

      await this.webhookEventRepository.save(event);

      // Retry via job
      throw error;
    }
  }
}
```

### Webhook API

```typescript
@Controller('webhooks')
export class WebhooksController {
  @Post('tenants/:tenantId/webhooks')
  @UseGuards(JwtAuthGuard, ValidateTenantGuard)
  async registerWebhook(
    @Param('tenantId') tenantId: string,
    @Body() registerWebhookDto: RegisterWebhookDto,
  ) {
    return this.webhooksService.registerWebhook(
      tenantId,
      registerWebhookDto.url,
      registerWebhookDto.eventTypes,
    );
  }

  @Get('tenants/:tenantId/webhooks/:webhookId/logs')
  @UseGuards(JwtAuthGuard, ValidateTenantGuard)
  async getWebhookLogs(
    @Param('tenantId') tenantId: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.getWebhookLogs(tenantId, webhookId);
  }

  @Delete('tenants/:tenantId/webhooks/:webhookId')
  @UseGuards(JwtAuthGuard, ValidateTenantGuard)
  async deleteWebhook(
    @Param('tenantId') tenantId: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.webhooksService.deleteWebhook(tenantId, webhookId);
  }
}
```

---

## Billing System

### Subscription Plans

```typescript
const PLANS = {
  BASIC: {
    name: 'Basic',
    price: 99,
    currency: 'INR',
    features: {
      sessionsAllowed: 1,
      contactsAllowed: 1000,
      messagesPerMonth: 10000,
      campaignsPerMonth: 5,
      teamMembers: 1,
    },
  },
  GROWTH: {
    name: 'Growth',
    price: 299,
    currency: 'INR',
    features: {
      sessionsAllowed: 5,
      contactsAllowed: 10000,
      messagesPerMonth: 100000,
      campaignsPerMonth: 50,
      teamMembers: 5,
    },
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 799,
    currency: 'INR',
    features: {
      sessionsAllowed: 10,
      contactsAllowed: 50000,
      messagesPerMonth: 500000,
      campaignsPerMonth: 500,
      teamMembers: 20,
    },
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: null, // Custom pricing
    currency: 'INR',
    features: {
      sessionsAllowed: null, // Unlimited
      contactsAllowed: null,
      messagesPerMonth: null,
      campaignsPerMonth: null,
      teamMembers: null,
    },
  },
};
```

### Billing Service

**src/billing/billing.service.ts**
```typescript
@Injectable()
export class BillingService {
  private razorpay: any;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
  ) {
    const Razorpay = require('razorpay');
    
    this.razorpay = new Razorpay({
      key_id: this.configService.get('RAZORPAY_KEY_ID'),
      key_secret: this.configService.get('RAZORPAY_KEY_SECRET'),
    });
  }

  /**
   * Create subscription for tenant
   */
  async createSubscription(
    tenantId: string,
    plan: string,
    billingEmail: string,
  ) {
    const planConfig = PLANS[plan];

    // Create Razorpay subscription
    const razorpaySubscription = await this.razorpay.subscriptions.create({
      plan_id: plan,
      customer_notify: 1,
      quantity: 1,
      total_count: 0, // Infinite
      addons: [],
      notes: {
        tenantId,
        plan,
      },
    });

    // Store locally
    const subscription = this.subscriptionRepository.create({
      tenantId,
      plan,
      status: 'active',
      razorpaySubscriptionId: razorpaySubscription.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      monthlyPrice: planConfig.price,
    });

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Upgrade subscription plan
   */
  async upgradeSubscription(tenantId: string, newPlan: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Update Razorpay
    await this.razorpay.subscriptions.update(
      subscription.razorpaySubscriptionId,
      {
        plan_id: newPlan,
        quantity: 1,
      },
    );

    subscription.plan = newPlan;
    subscription.monthlyPrice = PLANS[newPlan].price;

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId },
    });

    await this.razorpay.subscriptions.cancel(
      subscription.razorpaySubscriptionId,
    );

    subscription.status = 'canceled';
    subscription.canceledAt = new Date();

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Check quota usage
   */
  async checkQuotaUsage(tenantId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId },
    });

    if (!subscription) {
      return { quotaExceeded: true };
    }

    const planLimits = PLANS[subscription.plan].features;
    const usage = await this.getUsageStats(tenantId);

    return {
      quotaExceeded: usage.messagesThisMonth > planLimits.messagesPerMonth,
      usage,
      limits: planLimits,
    };
  }

  /**
   * Generate invoice
   */
  async generateInvoice(tenantId: string, subscription: Subscription) {
    const invoiceNumber = `INV-${Date.now()}`;

    const invoice = this.invoiceRepository.create({
      tenantId,
      subscriptionId: subscription.id,
      invoiceNumber,
      amount: subscription.monthlyPrice,
      status: 'issued',
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return this.invoiceRepository.save(invoice);
  }

  private async getUsageStats(tenantId: string) {
    const currentMonth = new Date();
    currentMonth.setDate(1);

    const messagesThisMonth = await this.messageRepository.count({
      where: {
        tenantId,
        createdAt: MoreThanOrEqual(currentMonth),
      },
    });

    return { messagesThisMonth };
  }
}
```

### Billing Controller

```typescript
@Controller('billing')
export class BillingController {
  @Post('tenants/:tenantId/subscribe')
  @UseGuards(JwtAuthGuard, ValidateTenantGuard)
  async subscribe(
    @Param('tenantId') tenantId: string,
    @Body() subscribeDto: SubscribeDto,
  ) {
    return this.billingService.createSubscription(
      tenantId,
      subscribeDto.plan,
      subscribeDto.billingEmail,
    );
  }

  @Post('tenants/:tenantId/upgrade')
  @UseGuards(JwtAuthGuard, ValidateTenantGuard)
  async upgrade(
    @Param('tenantId') tenantId: string,
    @Body() upgradeDto: UpgradeDto,
  ) {
    return this.billingService.upgradeSubscription(
      tenantId,
      upgradeDto.plan,
    );
  }

  @Get('tenants/:tenantId/subscription')
  @UseGuards(JwtAuthGuard, ValidateTenantGuard)
  async getSubscription(@Param('tenantId') tenantId: string) {
    return this.billingService.getSubscription(tenantId);
  }

  @Get('tenants/:tenantId/quota')
  @UseGuards(JwtAuthGuard, ValidateTenantGuard)
  async checkQuota(@Param('tenantId') tenantId: string) {
    return this.billingService.checkQuotaUsage(tenantId);
  }

  @Post('tenants/:tenantId/invoices/:invoiceId/download')
  @UseGuards(JwtAuthGuard, ValidateTenantGuard)
  async downloadInvoice(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
    @Res() res: Response,
  ) {
    // Generate PDF and return
  }
}
```

---

## Webhook Signature Verification (Frontend)

```typescript
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secretKey: string,
): boolean {
  const crypto = require('crypto');
  
  const computedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  return computedSignature === signature;
}
```

---

## Next: Infrastructure & Deployment
