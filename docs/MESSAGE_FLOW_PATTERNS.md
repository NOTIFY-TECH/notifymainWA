# Message Flow Patterns - NotifyTechAI

**Purpose**: Define exact data flow paths for all message operations  
**Status**: ARCHITECTURE SPEC  
**Critical**: These flows are ENFORCED  

---

## ⚙️ Message Flow Overview

### Three Directions

1. **Incoming Messages** - WhatsApp → Frontend (Real-time)
2. **Outgoing Messages** - Frontend → WhatsApp (Queued)
3. **Message Status** - Status Updates in Real-time (WebSocket)

---

## 🔴 Incoming Message Flow

### Complete Path
```
WhatsApp Web
↓
OpenWA Webhook (detects message)
↓
Backend Webhook: POST /webhooks/messages
↓
Backend: Save to DB
↓
Backend: Update conversation
↓
Backend: Emit WebSocket event
↓
Redis Pub/Sub Broadcast
↓
WebSocket Gateway
↓
Frontend: Real-time notification
↓
Frontend: Update inbox
↓
User sees message instantly
```

### Detailed Steps

#### Step 1: OpenWA Detects Message
```
WhatsApp Web receives message from contact
↓
OpenWA captures via Puppeteer
↓
OpenWA identifies event type: "message"
```

#### Step 2: OpenWA Sends Webhook
```
OpenWA → HTTP POST
↓
To: Backend URL (configured in .env)
URL: http://backend:3000/webhooks/messages
↓
Payload:
{
  externalSessionId: string,      // OpenWA session ID
  from: string,                    // Contact phone
  body: string,                    // Message text
  timestamp: number,               // Unix timestamp
  mediaUrl?: string,               // If media
  mediaType?: string,              // 'image', 'video', 'audio'
  isForwarded?: boolean,
  isGroup?: boolean,
  groupId?: string,
  quotedMessageId?: string         // Reply context
}
```

#### Step 3: Backend Webhook Handler
```typescript
// backend/src/integrations/openwa/webhooks/openwa-webhooks.controller.ts

@Post('webhooks/messages')
@SkipAuth()  // OpenWA is internal, skip JWT
async handleIncomingMessage(
  @Body() payload: OpenwaWebhookPayload,
  @Headers('x-webhook-signature') signature: string
) {
  // Step 3a: Validate webhook signature
  const isValid = this.validateSignature(signature, payload);
  if (!isValid) throw new UnauthorizedException();

  // Step 3b: Get session from OpenWA session ID
  const session = await this.db.sessions.findOne({
    externalSessionId: payload.externalSessionId
  });
  if (!session) throw new NotFoundException();

  // Step 3c: Get or create contact
  let contact = await this.db.contacts.findOne({
    tenantId: session.tenantId,
    phoneNumber: payload.from
  });
  if (!contact) {
    contact = await this.db.contacts.create({
      tenantId: session.tenantId,
      phoneNumber: payload.from,
      name: payload.from // Default to phone
    });
  }

  // Step 3d: Get or create conversation
  let conversation = await this.db.conversations.findOne({
    tenantId: session.tenantId,
    contactId: contact.id,
    sessionId: session.id
  });
  if (!conversation) {
    conversation = await this.db.conversations.create({
      tenantId: session.tenantId,
      contactId: contact.id,
      sessionId: session.id,
      status: 'OPEN'
    });
  }

  // Step 3e: Create message record
  const message = await this.db.messages.create({
    tenantId: session.tenantId,
    conversationId: conversation.id,
    content: payload.body,
    mediaUrl: payload.mediaUrl,
    mediaType: payload.mediaType,
    sender: 'CONTACT',
    status: 'RECEIVED',
    externalMessageId: payload.id,
    timestamp: new Date(payload.timestamp)
  });

  // Step 3f: Update conversation stats
  await this.db.conversations.update(conversation.id, {
    messageCount: conversation.messageCount + 1,
    unreadCount: conversation.unreadCount + 1,
    lastMessageAt: new Date()
  });

  return { success: true };
}
```

#### Step 4: Backend Emits WebSocket Event

```typescript
// In the same webhook handler, after DB save:

// Step 4a: Emit to WebSocket gateway
this.gateway.broadcastToTenant(session.tenantId, {
  event: 'message:received',
  data: {
    messageId: message.id,
    conversationId: conversation.id,
    content: payload.body,
    senderName: contact.name,
    timestamp: message.timestamp,
    mediaUrl: payload.mediaUrl,
    mediaType: payload.mediaType
  }
});

// Step 4b: Update unread count for assigned agent
if (conversation.assignedToUserId) {
  this.gateway.broadcastToUser(conversation.assignedToUserId, {
    event: 'unread:updated',
    data: {
      conversationId: conversation.id,
      unreadCount: conversation.unreadCount
    }
  });
}

// Step 4c: Notify team
this.gateway.broadcastToTenant(session.tenantId, {
  event: 'conversation:updated',
  data: conversation
});
```

#### Step 5: Redis Pub/Sub Distribution

```typescript
// InboxGateway uses Redis for multi-instance broadcasting

@WebSocketGateway({
  namespace: 'inbox',
  cors: { origin: '*' }
})
export class InboxGateway {
  constructor(private redis: Redis) {}

  broadcastToTenant(tenantId: string, event: any) {
    // Publish to Redis channel
    this.redis.publish(
      `tenant:${tenantId}:events`,
      JSON.stringify(event)
    );

    // Also emit directly to connected clients
    this.server
      .to(`tenant:${tenantId}`)
      .emit(event.event, event.data);
  }

  @SubscribeMessage('connect')
  handleConnect(client: Socket) {
    const { tenantId, userId } = client.handshake.auth;
    
    // Join tenant room
    client.join(`tenant:${tenantId}`);
    
    // Join user room for DMs
    client.join(`user:${userId}`);
  }
}
```

#### Step 6: Frontend Receives WebSocket Event

```typescript
// frontend/src/hooks/useWebSocket.ts

export const useWebSocket = (tenantId: string) => {
  useEffect(() => {
    const socket = io('ws://localhost:3000/ws', {
      auth: {
        // Token should come from in-memory storage / cookie-based auth, not localStorage.
        token: typeof window !== 'undefined' ? (window as any).__ACCESS_TOKEN__ : undefined
      },
      query: { tenantId }

    });

    // Subscribe to message events
    socket.on('message:received', (message) => {
      // Step 6a: Update state
      useInboxStore.addMessage(message);
      
      // Step 6b: Update unread count
      useInboxStore.incrementUnread(message.conversationId);
      
      // Step 6c: Notify user
      showNotification(`New message from ${message.senderName}`);
    });

    socket.on('conversation:updated', (conversation) => {
      useInboxStore.updateConversation(conversation);
    });

    return () => socket.disconnect();
  }, [tenantId]);
};
```

#### Step 7: Frontend Updates Inbox UI

```typescript
// frontend/src/components/inbox/ConversationThread.tsx

export const ConversationThread = ({ conversationId }) => {
  // Step 7a: Subscribe to real-time updates
  const { subscribe } = useWebSocket(useAuthStore.tenantId);

  useEffect(() => {
    subscribe('message:received', (message) => {
      if (message.conversationId === conversationId) {
        // New message in current conversation
        setMessages(prev => [...prev, message]);
        
        // Scroll to bottom
        scrollToBottom();
        
        // Mark as read (auto-read when viewing)
        markAsRead(conversationId);
      }
    });
  }, [conversationId]);

  return (
    <div className="conversation">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
};
```

---

## 🟢 Outgoing Message Flow

### Complete Path
```
Frontend: User types message
↓
User clicks Send
↓
Frontend: POST /api/messages/send
↓
Backend: Validate tenant ownership
↓
Backend: Add to BullMQ queue
↓
Return immediately (optimistic)
↓
Worker: Processes from queue
↓
Worker: Calls OpenWA API
↓
OpenWA: Sends to WhatsApp
↓
Backend: Update DB status
↓
Backend: Emit WebSocket status update
↓
Frontend: Shows "Sent" ✓
```

### Detailed Steps

#### Step 1: Frontend Sends Message

```typescript
// frontend/src/components/inbox/MessageInput.tsx

const handleSend = async () => {
  const message = inputValue.trim();
  if (!message) return;

  try {
    // Step 1a: Optimistic update (show in UI immediately)
    const tempMessage = {
      id: 'temp-' + Date.now(),
      content: message,
      status: 'SENDING',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, tempMessage]);
    setInputValue('');

    // Step 1b: Call backend API
    const response = await messagesApi.sendMessage({
      conversationId: conversationId,
      content: message,
      sessionId: sessionId
    });

    // Step 1c: Update with real message ID
    setMessages(prev => 
      prev.map(m => 
        m.id === 'temp-' + Date.now() 
          ? { ...m, id: response.id }
          : m
      )
    );

  } catch (error) {
    showError('Failed to send message');
    setMessages(prev => 
      prev.map(m => 
        m.id === 'temp-' + Date.now() 
          ? { ...m, status: 'FAILED' }
          : m
      )
    );
  }
};

return (
  <div className="message-input">
    <textarea 
      value={inputValue}
      onChange={e => setInputValue(e.target.value)}
      placeholder="Type message..."
    />
    <button 
      onClick={handleSend}
      disabled={isLoading || !inputValue.trim()}
    >
      Send
    </button>
  </div>
);
```

#### Step 2: Backend Receives Request

```typescript
// backend/src/modules/messages/messages.controller.ts

@UseGuards(JwtAuthGuard, TenantGuard)
@Post('api/messages/send')
async sendMessage(
  @Body() dto: SendMessageDto,
  @CurrentUser() user: User
) {
  // Step 2a: Validate conversation ownership
  const conversation = await this.db.conversations.findOne({
    id: dto.conversationId,
    tenantId: user.tenantId
  });
  if (!conversation) throw new ForbiddenException();

  // Step 2b: Validate session exists
  const session = await this.db.sessions.findOne({
    id: dto.sessionId,
    tenantId: user.tenantId
  });
  if (!session) throw new ForbiddenException();

  // Step 2c: Create message record in DB
  const message = await this.db.messages.create({
    tenantId: user.tenantId,
    conversationId: dto.conversationId,
    content: dto.content,
    sender: 'AGENT',
    status: 'SENDING',
    sentByUserId: user.id
  });

  // Step 2d: Queue for processing
  await this.queue.add('send-message', {
    messageId: message.id,
    sessionId: session.externalSessionId,
    phoneNumber: conversation.contact.phoneNumber,
    content: dto.content,
    mediaUrl: dto.mediaUrl
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true
  });

  // Step 2e: Return immediately (optimistic)
  return {
    id: message.id,
    status: 'SENDING',
    timestamp: message.createdAt
  };
}
```

#### Step 3: BullMQ Worker Processes

```typescript
// backend/src/modules/queue/workers/send-message.worker.ts

@Processor('send-message')
export class SendMessageWorker {
  constructor(
    private openwaService: OpenwaService,
    private db: DatabaseService,
    private gateway: InboxGateway
  ) {}

  @Process()
  async handle(job: Job<SendMessageJobData>) {
    try {
      // Step 3a: Get message from DB
      const message = await this.db.messages.findById(job.data.messageId);

      // Step 3b: Call OpenWA API to send
      const result = await this.openwaService.sendMessage({
        sessionId: job.data.sessionId,
        phoneNumber: job.data.phoneNumber,
        message: job.data.content,
        mediaUrl: job.data.mediaUrl
      });

      // Step 3c: Update message status
      await this.db.messages.update(message.id, {
        status: 'SENT',
        externalMessageId: result.messageId,
        sentAt: new Date()
      });

      // Step 3d: Update conversation
      await this.db.conversations.update(message.conversationId, {
        lastMessageAt: new Date()
      });

      // Step 3e: Emit status update
      this.gateway.broadcastToTenant(message.tenantId, {
        event: 'message:sent',
        data: {
          messageId: message.id,
          status: 'SENT'
        }
      });

      return { success: true };

    } catch (error) {
      // Step 3f: On error, update status to FAILED
      await this.db.messages.update(job.data.messageId, {
        status: 'FAILED',
        errorMessage: error.message
      });

      // Step 3g: Emit error event
      const message = await this.db.messages.findById(job.data.messageId);
      this.gateway.broadcastToTenant(message.tenantId, {
        event: 'message:failed',
        data: {
          messageId: message.id,
          reason: error.message
        }
      });

      throw error; // Trigger retry
    }
  }

  @OnWaitingCount()
  async onWaiting() {
    console.log('Send message queue has waiting jobs');
  }
}
```

#### Step 4: OpenWA Sends to WhatsApp

```typescript
// backend/src/integrations/openwa/openwa.service.ts

async sendMessage(dto: SendMessageDto) {
  // Call OpenWA REST API
  const response = await this.httpClient.post(
    `${this.openwaUrl}/api/messages/send`,
    {
      sessionId: dto.sessionId,
      phoneNumber: dto.phoneNumber,
      message: dto.message,
      mediaUrl: dto.mediaUrl
    },
    {
      headers: { 'X-API-Key': this.apiKey },
      timeout: 30000
    }
  ).toPromise();

  return {
    messageId: response.data.id,
    status: 'SENT'
  };
}
```

#### Step 5: Frontend Receives Status Update

```typescript
// frontend/src/components/inbox/MessageBubble.tsx

export const MessageBubble = ({ message }) => {
  const { subscribe } = useWebSocket(tenantId);
  const [status, setStatus] = useState(message.status);

  useEffect(() => {
    // Listen for status updates
    subscribe('message:sent', (event) => {
      if (event.messageId === message.id) {
        setStatus('SENT');
      }
    });

    subscribe('message:failed', (event) => {
      if (event.messageId === message.id) {
        setStatus('FAILED');
      }
    });
  }, [message.id]);

  return (
    <div className={`message ${message.sender}`}>
      <div className="content">{message.content}</div>
      <div className="footer">
        <span className="time">{formatTime(message.timestamp)}</span>
        <span className="status">
          {status === 'SENDING' && '⏱️ Sending...'}
          {status === 'SENT' && '✓ Sent'}
          {status === 'DELIVERED' && '✓✓ Delivered'}
          {status === 'READ' && '✓✓ Read'}
          {status === 'FAILED' && '❌ Failed'}
        </span>
      </div>
    </div>
  );
};
```

---

## 🟡 Message Status Update Flow

### WhatsApp Status Events

```
WhatsApp
↓
Message: Delivered
↓
OpenWA Detects: "ack" event
↓
OpenWA Webhook: POST /webhooks/message-status
↓
Backend Updates DB
↓
Backend Emits WebSocket
↓
Frontend Shows: ✓✓ Delivered
```

### Implementation

```typescript
// backend/src/integrations/openwa/webhooks/openwa-webhooks.controller.ts

@Post('webhooks/message-status')
@SkipAuth()
async handleMessageStatus(@Body() payload: any) {
  // Update message status in DB
  await this.db.messages.update(payload.messageId, {
    status: payload.status,  // 'SENT', 'DELIVERED', 'READ'
    deliveredAt: payload.status === 'DELIVERED' ? new Date() : null,
    readAt: payload.status === 'READ' ? new Date() : null
  });

  // Get message with conversation
  const message = await this.db.messages.findById(payload.messageId);

  // Emit event to frontend
  this.gateway.broadcastToTenant(message.tenantId, {
    event: 'message:status-updated',
    data: {
      messageId: message.id,
      status: payload.status
    }
  });
}
```

---

## 📊 Campaign Message Flow

### Different from Direct Messages

```
Frontend: User creates campaign
↓
Select CSV with phone numbers
↓
Backend: Create campaign record
↓
Backend: Parse CSV, create recipients
↓
Backend: Queue campaign execution
↓
Worker: Process batch
  ├─ Create message for each recipient
  ├─ Add send-message job per recipient
  └─ Track progress
↓
Multiple workers: Send in parallel
↓
Track delivery per recipient
↓
Frontend: Show campaign stats in real-time
```

### Campaign Job

```typescript
// backend/src/modules/queue/workers/execute-campaign.worker.ts

@Processor('execute-campaign')
export class ExecuteCampaignWorker {
  @Process()
  async handle(job: Job<ExecuteCampaignJobData>) {
    const campaignId = job.data.campaignId;
    const campaign = await this.db.campaigns.findById(campaignId);
    
    // Get all recipients
    const recipients = await this.db.campaignRecipients.find({
      campaignId,
      status: 'PENDING'
    });

    // Queue individual message sends
    for (const recipient of recipients) {
      await this.messageQueue.add('send-message', {
        recipientId: recipient.id,
        phoneNumber: recipient.phoneNumber,
        content: campaign.template,
        isCampaign: true
      });
    }

    // Update campaign status
    await this.db.campaigns.update(campaignId, {
      status: 'RUNNING',
      startedAt: new Date()
    });

    return { recipientsQueued: recipients.length };
  }
}
```

---

## ⚠️ Error Handling & Retries

### Retry Strategy

```
BullMQ Retry Logic:

Attempt 1: Fail
  → Wait 2 seconds

Attempt 2: Fail
  → Wait 4 seconds

Attempt 3: Fail
  → Mark as FAILED
  → Emit error event
  → Don't retry further
```

### Error Scenarios

```
1. OpenWA Timeout
   → Queue retry (automatic via BullMQ)
   → Max 3 attempts
   → Then mark FAILED

2. Invalid Phone Number
   → Don't retry
   → Mark FAILED immediately
   → Log error

3. Session Disconnected
   → Queue for retry
   → Show user: "Session not connected"
   → Retry when session reconnects

4. Rate Limited by WhatsApp
   → Exponential backoff
   → Don't exceed 60 msgs/minute per session
   → Queue delays automatically managed
```

---

## 🔐 Security in Message Flow

### Validation At Each Step

```
Frontend → Backend:
  ✓ JWT token valid
  ✓ Tenant ownership verified
  ✓ User has permission to send
  ✓ Conversation belongs to tenant
  ✓ Session belongs to tenant
  ✓ Content validated (no injection)

Backend → OpenWA:
  ✓ API key validated
  ✓ Session ID valid
  ✓ Phone number format valid
  ✓ Message content sanitized

OpenWA → WhatsApp:
  ✓ Session authenticated
  ✓ Rate limits respected
  ✓ Throttling applied
```

---

## 📊 Scalability Considerations

### Message Load Scaling

```
Frontend
↓
Load Balancer
↓
Backend Instance 1  Backend Instance 2  Backend Instance 3
↓              ↓                   ↓
Redis (shared cache)
↓
PostgreSQL (connection pool)
↓
Message Queue (BullMQ on Redis)
↓
Worker 1  Worker 2  Worker 3  Worker 4  Worker 5
↓         ↓        ↓        ↓         ↓
OpenWA Engine
```

### Queue Scaling

```
Multiple worker instances can process queue jobs in parallel

Each worker:
- Processes 10 jobs simultaneously
- With 5 workers: 50 messages/second

PostgreSQL partitions messages by date for fast queries
Redis caches conversation status
WebSocket broadcasts via Redis pub/sub
```

---

## 🧪 Testing Message Flows

### Unit Tests
```typescript
// Test sendMessage service
describe('MessagesService.sendMessage', () => {
  it('should create message and queue job', async () => {
    const result = await service.sendMessage(dto, user);
    expect(result.status).toBe('SENDING');
    expect(queue.add).toHaveBeenCalledWith('send-message', expect.any(Object));
  });
});
```

### Integration Tests
```typescript
// Test end-to-end send
describe('Send message E2E', () => {
  it('should send message through full pipeline', async () => {
    // 1. Create session
    // 2. Send message
    // 3. Verify in DB
    // 4. Check queue
    // 5. Process worker
    // 6. Verify OpenWA called
    // 7. Check WebSocket event
  });
});
```

---

## Summary

| Flow | Path | Speed | Queue |
|------|------|-------|-------|
| Incoming | WhatsApp → OpenWA → Webhook → DB → WebSocket → Frontend | Instant | No |
| Outgoing | Frontend → Backend → Queue → Worker → OpenWA → WhatsApp | Queued | Yes |
| Status | WhatsApp → OpenWA → Webhook → DB → WebSocket → Frontend | Instant | No |
| Campaign | Frontend → Backend → Queue × N Recipients → Workers → OpenWA | Batch | Yes |

---

*These flows are the foundation of NotifyTechAI's messaging system. Follow them exactly.*

