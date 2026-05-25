# MESSAGE, INBOX & CAMPAIGN SYSTEMS

**Goal**: Build real-time messaging, team inbox, and bulk campaign features

---

## Message System Architecture

```
WhatsApp Message Arrives
    ↓
OpenWA Webhook
    ↓
Backend validates signature
    ↓
Store in database (messages table)
    ↓
Update conversation metadata
    ↓
Emit WebSocket event
    ↓
Frontend receives real-time update
    ↓
Display in inbox
```

---

## Messages Service

**src/messages/messages.service.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Conversation } from '../inbox/entities/conversation.entity';
import { BullQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import axios from 'axios';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    
    @InjectQueue('messages')
    private messageQueue: Queue,
    
    private configService: ConfigService,
  ) {}

  /**
   * Send text message via OpenWA
   */
  async sendTextMessage(
    tenantId: string,
    userId: string,
    sessionId: string,
    phoneNumber: string,
    content: string,
  ) {
    // 1. Call OpenWA API
    const openwaUrl = this.configService.get('OPENWA_API_URL');
    const openwaKey = this.configService.get('OPENWA_API_KEY');

    try {
      const response = await axios.post(
        `${openwaUrl}/api/messages/send`,
        {
          sessionId,
          phoneNumber,
          message: content,
        },
        {
          headers: { 'X-API-Key': openwaKey },
        },
      );

      // 2. Store message locally
      const message = this.messageRepository.create({
        tenantId,
        conversationId: '', // Get from session
        senderId: userId,
        content,
        messageType: 'text',
        status: 'sent',
        isFromContact: false,
        metadata: { openwaMessageId: response.data.messageId },
      });

      await this.messageRepository.save(message);

      // 3. Update conversation
      await this.conversationRepository.update(
        { id: message.conversationId },
        {
          messageCount: () => 'message_count + 1',
          lastMessageAt: new Date(),
        },
      );

      return message;
    } catch (error) {
      // Queue for retry
      await this.messageQueue.add(
        'send-message',
        {
          tenantId,
          userId,
          sessionId,
          phoneNumber,
          content,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
        },
      );

      throw error;
    }
  }

  /**
   * Send media message
   */
  async sendMediaMessage(
    tenantId: string,
    userId: string,
    sessionId: string,
    phoneNumber: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption?: string,
  ) {
    const openwaUrl = this.configService.get('OPENWA_API_URL');
    const openwaKey = this.configService.get('OPENWA_API_KEY');

    try {
      const response = await axios.post(
        `${openwaUrl}/api/messages/send-media`,
        {
          sessionId,
          phoneNumber,
          mediaUrl,
          mediaType,
          caption,
        },
        {
          headers: { 'X-API-Key': openwaKey },
        },
      );

      const message = this.messageRepository.create({
        tenantId,
        senderId: userId,
        messageType: mediaType,
        mediaUrl,
        mediaType,
        content: caption,
        status: 'sent',
        isFromContact: false,
      });

      await this.messageRepository.save(message);

      return message;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process incoming message from webhook
   */
  async processIncomingMessage(
    tenantId: string,
    sessionId: string,
    payload: any,
  ) {
    const { from, body, id, type, mediaUrl } = payload;

    // Find or create contact
    let contact = await this.contactRepository.findOne({
      where: {
        tenantId,
        phoneNumber: from,
      },
    });

    if (!contact) {
      contact = this.contactRepository.create({
        tenantId,
        name: from,
        phoneNumber: from,
      });
      await this.contactRepository.save(contact);
    }

    // Find or create conversation
    let conversation = await this.conversationRepository.findOne({
      where: {
        tenantId,
        contactId: contact.id,
        sessionId,
      },
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        tenantId,
        contactId: contact.id,
        sessionId,
        status: 'open',
      });
      await this.conversationRepository.save(conversation);
    }

    // Store message
    const message = this.messageRepository.create({
      tenantId,
      conversationId: conversation.id,
      content: body,
      messageType: type || 'text',
      mediaUrl: mediaUrl || null,
      status: 'delivered',
      isFromContact: true,
      metadata: { openwaMessageId: id },
    });

    await this.messageRepository.save(message);

    // Update conversation
    conversation.messageCount++;
    conversation.unreadCount++;
    conversation.lastMessageAt = new Date();
    await this.conversationRepository.save(conversation);

    // Emit WebSocket event
    this.inboxGateway.broadcastToTenant(tenantId, 'message:received', {
      conversationId: conversation.id,
      message: message,
    });

    return message;
  }

  /**
   * Get conversation messages with pagination
   */
  async getMessages(
    tenantId: string,
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const [messages, total] = await this.messageRepository.findAndCount({
      where: {
        tenantId,
        conversationId,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: messages.reverse(), // Oldest first
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search messages
   */
  async searchMessages(
    tenantId: string,
    query: string,
    conversationId?: string,
  ) {
    const qb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId })
      .andWhere(
        'message.content ILIKE :query',
        { query: `%${query}%` },
      );

    if (conversationId) {
      qb.andWhere('message.conversationId = :conversationId', {
        conversationId,
      });
    }

    return qb
      .orderBy('message.createdAt', 'DESC')
      .limit(100)
      .getMany();
  }

  /**
   * Mark messages as read
   */
  async markAsRead(
    tenantId: string,
    conversationId: string,
    userId: string,
  ) {
    // Update messages
    await this.messageRepository.update(
      {
        tenantId,
        conversationId,
      },
      {
        status: 'read',
      },
    );

    // Update conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, tenantId },
    });

    if (conversation) {
      conversation.unreadCount = 0;
      await this.conversationRepository.save(conversation);
    }

    return { success: true };
  }
}
```

---

## Inbox System

### Conversation Entity

**src/inbox/entities/conversation.entity.ts**
```typescript
import {
  Entity,
  Column,
  ManyToOne,
  PrimaryUUID,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';
import { User } from '../../users/entities/user.entity';
import { Session } from '../../sessions/entities/session.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryUUID()
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column('uuid')
  contactId: string;

  @Column('uuid')
  sessionId: string;

  @Column('uuid', { nullable: true })
  assignedToUserId?: string;

  @Column('varchar', { default: 'open' })
  status: 'open' | 'closed' | 'pending' | 'resolved';

  @Column('text', { nullable: true })
  subject?: string;

  @Column('int', { default: 0 })
  messageCount: number;

  @Column('int', { default: 0 })
  unreadCount: number;

  @Column('timestamp', { nullable: true })
  lastMessageAt?: Date;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Contact)
  contact: Contact;

  @ManyToOne(() => User, { nullable: true })
  assignedTo?: User;

  @ManyToOne(() => Session)
  session: Session;
}
```

### Inbox Service

**src/inbox/inbox.service.ts**
```typescript
@Injectable()
export class InboxService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
  ) {}

  /**
   * Get all conversations for tenant with filtering
   */
  async getConversations(
    tenantId: string,
    options?: {
      status?: string;
      assignedTo?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const {
      status,
      assignedTo,
      search,
      page = 1,
      limit = 20,
    } = options || {};

    const qb = this.conversationRepository
      .createQueryBuilder('conversation')
      .where('conversation.tenantId = :tenantId', { tenantId })
      .leftJoinAndSelect('conversation.contact', 'contact')
      .leftJoinAndSelect('conversation.assignedTo', 'assignedTo');

    if (status) {
      qb.andWhere('conversation.status = :status', { status });
    }

    if (assignedTo) {
      qb.andWhere('conversation.assignedToUserId = :assignedTo', {
        assignedTo,
      });
    }

    if (search) {
      qb.andWhere(
        '(contact.name ILIKE :search OR conversation.subject ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [conversations, total] = await qb
      .orderBy('conversation.lastMessageAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Assign conversation to user
   */
  async assignConversation(
    tenantId: string,
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.assignedToUserId = userId;
    conversation.status = 'open';

    await this.conversationRepository.save(conversation);

    // Notify via WebSocket
    this.inboxGateway.broadcastToUser(
      tenantId,
      userId,
      'conversation:assigned',
      { conversationId },
    );

    return conversation;
  }

  /**
   * Update conversation status
   */
  async updateStatus(
    tenantId: string,
    conversationId: string,
    status: string,
  ) {
    await this.conversationRepository.update(
      { id: conversationId, tenantId },
      { status },
    );

    // Broadcast status change
    this.inboxGateway.broadcastToTenant(tenantId, 'conversation:updated', {
      conversationId,
      status,
    });
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(tenantId: string, userId: string) {
    const unreadCount = await this.conversationRepository.count({
      where: {
        tenantId,
        assignedToUserId: userId,
        unreadCount: MoreThan(0),
      },
    });

    return unreadCount;
  }
}
```

---

## Campaign System

### Campaign Service

**src/campaigns/campaigns.service.ts**
```typescript
@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    
    @InjectRepository(CampaignRecipient)
    private recipientRepository: Repository<CampaignRecipient>,
    
    @InjectQueue('campaigns')
    private campaignQueue: Queue,
    
    private messagesService: MessagesService,
  ) {}

  /**
   * Create campaign from CSV upload
   */
  async createCampaignFromCSV(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    campaignData: {
      name: string;
      templateId: string;
      sessionId: string;
    },
  ) {
    // Parse CSV
    const records = await this.parseCSV(file);

    // Create campaign
    const campaign = this.campaignRepository.create({
      tenantId,
      createdByUserId: userId,
      name: campaignData.name,
      templateId: campaignData.templateId,
      status: 'draft',
      totalRecipients: records.length,
    });

    await this.campaignRepository.save(campaign);

    // Create recipient records
    const recipients = records.map((record) =>
      this.recipientRepository.create({
        campaignId: campaign.id,
        tenantId,
        contactId: record.contactId,
        phoneNumber: record.phoneNumber,
        status: 'pending',
        metadata: record.metadata,
      }),
    );

    await this.recipientRepository.save(recipients);

    return campaign;
  }

  /**
   * Schedule campaign for execution
   */
  async scheduleCampaign(
    tenantId: string,
    campaignId: string,
    scheduledAt: Date,
  ) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, tenantId },
    });

    campaign.status = 'scheduled';
    campaign.scheduledAt = scheduledAt;

    await this.campaignRepository.save(campaign);

    // Queue for execution
    await this.campaignQueue.add(
      'execute-campaign',
      { campaignId, tenantId },
      {
        delay: scheduledAt.getTime() - Date.now(),
      },
    );

    return campaign;
  }

  /**
   * Execute campaign
   */
  async executeCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, tenantId },
    });

    campaign.status = 'executing';
    campaign.startedAt = new Date();

    await this.campaignRepository.save(campaign);

    // Get all pending recipients
    const recipients = await this.recipientRepository.find({
      where: {
        campaignId,
        status: 'pending',
      },
    });

    // Queue each message send
    for (const recipient of recipients) {
      await this.campaignQueue.add(
        'send-campaign-message',
        {
          campaignId,
          recipientId: recipient.id,
          phoneNumber: recipient.phoneNumber,
          tenantId,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(tenantId: string, campaignId: string) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, tenantId },
    });

    const stats = await this.recipientRepository
      .createQueryBuilder('recipient')
      .where('recipient.campaignId = :campaignId', { campaignId })
      .select('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END)",
        'sent',
      )
      .addSelect(
        "SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)",
        'delivered',
      )
      .addSelect(
        "SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END)",
        'read',
      )
      .addSelect(
        "SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)",
        'failed',
      )
      .getRawOne();

    return {
      campaign,
      stats,
      deliveryRate: stats.delivered / stats.total,
    };
  }

  private async parseCSV(file: Express.Multer.File) {
    // Use CSV parser library (e.g., csv-parser)
    const records = [];
    // Parse and validate records
    return records;
  }
}
```

### Campaign Processor

**src/campaigns/processors/campaign.processor.ts**
```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('campaigns')
export class CampaignProcessor {
  constructor(
    private campaignRepository: Repository<Campaign>,
    private recipientRepository: Repository<CampaignRecipient>,
    private messagesService: MessagesService,
  ) {}

  @Process('execute-campaign')
  async executeJob(job: Job) {
    const { campaignId, tenantId } = job.data;

    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) return;

    campaign.status = 'executing';
    campaign.startedAt = new Date();
    await this.campaignRepository.save(campaign);

    console.log(`⏱️  Executing campaign ${campaignId}`);
  }

  @Process('send-campaign-message')
  async sendMessageJob(job: Job) {
    const { campaignId, recipientId, phoneNumber, tenantId } = job.data;

    try {
      // Send message
      await this.messagesService.sendTextMessage(
        tenantId,
        recipientId,
        phoneNumber,
        'Campaign message',
      );

      // Update recipient
      await this.recipientRepository.update(recipientId, {
        status: 'sent',
        sentAt: new Date(),
      });
    } catch (error) {
      console.error(`Failed to send campaign message: ${error}`);
      throw error; // Retry
    }
  }
}
```

---

## Real-time Inbox Gateway

**src/gateway/inbox.gateway.ts** (Enhanced)
```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: true,
  namespace: 'inbox',
})
@Injectable()
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const { tenantId, userId } = client.handshake.query;

    if (tenantId && userId) {
      // Join room: tenant:{tenantId}:user:{userId}
      client.join(`tenant:${tenantId}:user:${userId}`);
      console.log(`✅ ${userId} connected to inbox`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(client: Socket, payload: any) {
    const { tenantId, conversationId, content } = payload;

    // Send message
    const message = await this.messagesService.sendTextMessage(
      tenantId,
      client.handshake.query.userId,
      conversationId,
      content,
    );

    // Broadcast to all users in tenant
    this.server
      .to(`tenant:${tenantId}`)
      .emit('message:new', { conversationId, message });
  }

  @SubscribeMessage('conversation:assign')
  async handleAssign(client: Socket, payload: any) {
    const { tenantId, conversationId, userId } = payload;

    await this.inboxService.assignConversation(
      tenantId,
      conversationId,
      userId,
    );

    this.broadcastToTenant(
      tenantId,
      'conversation:assigned',
      payload,
    );
  }

  broadcastToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  broadcastToUser(tenantId: string, userId: string, event: string, data: any) {
    this.server
      .to(`tenant:${tenantId}:user:${userId}`)
      .emit(event, data);
  }
}
```

---

## API Endpoints

### Messages API
```
POST   /messages/send
POST   /messages/send-media
GET    /messages/search
GET    /conversations/:conversationId/messages
POST   /messages/:messageId/mark-read
```

### Campaigns API
```
POST   /campaigns (create)
POST   /campaigns/:campaignId/execute
GET    /campaigns/:campaignId/stats
POST   /campaigns/upload-csv (bulk create)
DELETE /campaigns/:campaignId (pause)
```

### Inbox API
```
GET    /inbox/conversations
PUT    /conversations/:conversationId/assign
PUT    /conversations/:conversationId/status
GET    /inbox/unread-count
```

---

## Next: Analytics & Webhooks System
