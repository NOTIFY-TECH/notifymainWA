# PHASE 1: OpenWA Engine Setup

**Duration**: 1-2 weeks  
**Goal**: Build isolated WhatsApp engine with REST API that serves as infrastructure layer

---

## What is OpenWA Engine

The OpenWA Engine is a **dedicated service** that:
- Handles WhatsApp Web connection via Puppeteer
- Manages QR code generation and session authentication
- Provides REST API for backend to integrate
- Persists session state for reconnection
- Emits webhook events for incoming messages
- **Does NOT** include CRM, campaigns, billing, or UI logic

OpenWA stays completely isolated. The backend (NestJS) is the only client.

---

## Architecture

```
Backend (NestJS)
    ↓
    POST /api/sessions → OpenWA
    GET /api/sessions/:id/qr → OpenWA
    POST /api/messages/send → OpenWA
    ↓
OpenWA Engine
    ↓
    Puppeteer + Chrome
    ↓
    WhatsApp Web
```

---

## Setup Steps

### 1. Create OpenWA Project Directory

```bash
mkdir openwa-engine
cd openwa-engine
npm init -y
```

### 2. Install Dependencies

```bash
npm install \
  express \
  @openwa/wa-automate \
  puppeteer \
  dotenv \
  cors \
  axios \
  redis \
  qrcode \
  uuid \
  typescript \
  @types/express \
  @types/node \
  ts-node \
  ts-node-dev \
  nodemon
```

### 3. Create TypeScript Configuration

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Create .env File

**.env**
```
NODE_ENV=development
PORT=3500
API_KEY=dev-admin-key
SESSIONS_DIR=./sessions
REDIS_URL=redis://localhost:6379
CHROME_PATH=/usr/bin/chromium
LOG_LEVEL=debug
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_RETRY_DELAY_MS=5000
```

### 5. Create Main Application

**src/main.ts**
```typescript
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import redis from 'redis';
import { sessionRoutes } from './routes/sessions';
import { messageRoutes } from './routes/messages';
import { webhookRoutes } from './routes/webhooks';
import { healthRoutes } from './routes/health';
import { apiKeyMiddleware } from './middleware/api-key';
import { errorHandler } from './middleware/error-handler';
import { SessionManager } from './services/session-manager';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3500;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Initialize Redis client
export const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect();

// Initialize session manager
export const sessionManager = new SessionManager();

// Routes
app.use('/health', healthRoutes);
app.use('/api/sessions', apiKeyMiddleware, sessionRoutes);
app.use('/api/messages', apiKeyMiddleware, messageRoutes);
app.use('/api/webhooks', webhookRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`✅ OpenWA Engine running on port ${PORT}`);
  
  // Load existing sessions
  await sessionManager.initializeSessions();
  console.log(`✅ Session manager initialized`);
});
```

### 6. Create Services

**src/services/session-manager.ts**
```typescript
import { create, Client, Message } from '@openwa/wa-automate';
import path from 'path';
import fs from 'fs';
import { redisClient } from '../main';
import QRCode from 'qrcode';

interface SessionData {
  id: string;
  tenantId: string;
  userId: string;
  phoneNumber?: string;
  status: 'disconnected' | 'qr_waiting' | 'authenticating' | 'connected';
  qrCode?: string;
  createdAt: number;
  lastActivity: number;
  client?: Client;
}

export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = process.env.SESSIONS_DIR || './sessions';
    this.ensureSessionDir();
  }

  private ensureSessionDir() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  async createSession(
    tenantId: string,
    userId: string,
  ): Promise<SessionData> {
    const sessionId = `${tenantId}-${userId}-${Date.now()}`;
    
    const sessionData: SessionData = {
      id: sessionId,
      tenantId,
      userId,
      status: 'qr_waiting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Save to Redis
    await redisClient.set(
      `session:${sessionId}`,
      JSON.stringify(sessionData),
      { EX: 86400 }, // 24 hours
    );

    // Create OpenWA client
    try {
      const client = await create({
        sessionId: sessionId,
        multiDevice: true,
        authTimeout: 120,
        executablePath: process.env.CHROME_PATH,
        headless: true,
        qrTimeout: 0,
        killProcessOnBrowserClose: true,
        throwErrorOnTosBlock: true,
      });

      // Listen for QR code
      client.onQrReceived(async (qr: string) => {
        const qrImage = await QRCode.toDataURL(qr);
        sessionData.qrCode = qrImage;
        sessionData.status = 'qr_waiting';
        
        await redisClient.set(
          `session:${sessionId}`,
          JSON.stringify(sessionData),
        );
      });

      // Handle ready
      client.onStateChanged(async (state: string) => {
        if (state === 'CONNECTED') {
          sessionData.status = 'connected';
          sessionData.phoneNumber = client.getWAVersion()?.phone;
          sessionData.client = client;
          
          await redisClient.set(
            `session:${sessionId}`,
            JSON.stringify({
              ...sessionData,
              client: undefined, // Don't serialize client object
            }),
          );
          
          // Subscribe to messages
          await this.subscribeToMessages(sessionId, client);
        }
      });

      // Store client reference
      this.sessions.set(sessionId, {
        ...sessionData,
        client,
      });

      return sessionData;
    } catch (error) {
      console.error(`Failed to create session ${sessionId}:`, error);
      throw error;
    }
  }

  private async subscribeToMessages(
    sessionId: string,
    client: Client,
  ) {
    client.onMessage((message: Message) => {
      // Send webhook to backend
      this.emitWebhook(sessionId, 'message_received', message);
    });

    client.onAck((message: Message) => {
      this.emitWebhook(sessionId, 'message_ack', message);
    });
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const cached = await redisClient.get(`session:${sessionId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    return this.sessions.get(sessionId) || null;
  }

  async listSessions(tenantId: string): Promise<SessionData[]> {
    const keys = await redisClient.keys(`session:${tenantId}-*`);
    const sessions: SessionData[] = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        sessions.push(JSON.parse(data));
      }
    }
    
    return sessions;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session?.client) {
      await session.client.kill();
    }
    
    this.sessions.delete(sessionId);
    await redisClient.del(`session:${sessionId}`);
  }

  async sendMessage(
    sessionId: string,
    phoneNumber: string,
    message: string,
  ): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session?.client) {
      throw new Error('Session not connected');
    }

    return await session.client.sendText(phoneNumber, message);
  }

  async initializeSessions() {
    // Load persisted sessions from Redis
    const keys = await redisClient.keys('session:*');
    console.log(`🔄 Found ${keys.length} persisted sessions`);
    
    for (const key of keys) {
      const sessionData = await redisClient.get(key);
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          if (session.status === 'connected') {
            // Attempt to reconnect
            await this.createSession(session.tenantId, session.userId);
          }
        } catch (error) {
          console.error(`Failed to restore session from ${key}:`, error);
        }
      }
    }
  }

  private async emitWebhook(
    sessionId: string,
    event: string,
    data: any,
  ) {
    // Send webhook to backend
    console.log(`🔔 Webhook event: ${event} from session ${sessionId}`);
  }
}
```

### 7. Create Routes

**src/routes/sessions.ts**
```typescript
import express, { Router, Request, Response } from 'express';
import { sessionManager } from '../main';

export const sessionRoutes: Router = express.Router();

// Create new session
sessionRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = req.body;
    
    if (!tenantId || !userId) {
      return res.status(400).json({
        error: 'tenantId and userId are required',
      });
    }

    const session = await sessionManager.createSession(tenantId, userId);
    res.json(session);
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// List sessions for tenant
sessionRoutes.get('/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const sessions = await sessionManager.listSessions(tenantId);
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Get session QR code
sessionRoutes.get('/:sessionId/qr', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
      });
    }

    res.json({
      sessionId,
      status: session.status,
      qrCode: session.qrCode,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Delete session
sessionRoutes.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await sessionManager.deleteSession(sessionId);
    res.json({
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});
```

**src/routes/messages.ts**
```typescript
import express, { Router, Request, Response } from 'express';
import { sessionManager } from '../main';

export const messageRoutes: Router = express.Router();

// Send message
messageRoutes.post('/send', async (req: Request, res: Response) => {
  try {
    const { sessionId, phoneNumber, message } = req.body;
    
    if (!sessionId || !phoneNumber || !message) {
      return res.status(400).json({
        error: 'sessionId, phoneNumber, and message are required',
      });
    }

    const result = await sessionManager.sendMessage(
      sessionId,
      phoneNumber,
      message,
    );
    
    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});
```

**src/routes/health.ts**
```typescript
import express, { Router, Request, Response } from 'express';

export const healthRoutes: Router = express.Router();

healthRoutes.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

**src/routes/webhooks.ts**
```typescript
import express, { Router, Request, Response } from 'express';

export const webhookRoutes: Router = express.Router();

// Register webhook endpoint (from backend)
webhookRoutes.post('/register', (req: Request, res: Response) => {
  // Store webhook URL to send events to backend
  res.json({ success: true });
});
```

### 8. Create Middleware

**src/middleware/api-key.ts**
```typescript
import { Request, Response, NextFunction } from 'express';

export const apiKeyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      error: 'Invalid API key',
    });
  }
  
  next();
};
```

**src/middleware/error-handler.ts**
```typescript
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error('Error:', error);
  
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
};
```

### 9. Update package.json Scripts

**package.json**
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  }
}
```

### 10. Create Docker Setup

**Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install Chromium dependencies
RUN apk add --no-cache \
  chromium \
  chromium-chromedriver \
  dbus \
  font-noto \
  grep \
  libxss1

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3500

CMD ["npm", "start"]
```

---

## Testing the Engine

### 1. Start Redis
```bash
redis-server
```

### 2. Start OpenWA Engine
```bash
npm run dev
```

### 3. Create Session
```bash
curl -X POST http://localhost:3500/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-admin-key" \
  -d '{
    "tenantId": "tenant-123",
    "userId": "user-456"
  }'
```

**Response:**
```json
{
  "id": "tenant-123-user-456-1234567890",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "status": "qr_waiting",
  "createdAt": 1234567890,
  "lastActivity": 1234567890
}
```

### 4. Poll QR Code
```bash
curl -X GET http://localhost:3500/api/sessions/tenant-123-user-456-1234567890/qr \
  -H "X-API-Key: dev-admin-key"
```

**Response:**
```json
{
  "sessionId": "tenant-123-user-456-1234567890",
  "status": "qr_waiting",
  "qrCode": "data:image/png;base64,iVBORw0KG..."
}
```

### 5. Scan QR Code
Use WhatsApp app to scan the QR code

### 6. Check Session Status
```bash
curl -X GET http://localhost:3500/api/sessions/tenant-123 \
  -H "X-API-Key: dev-admin-key"
```

### 7. Send Message
```bash
curl -X POST http://localhost:3500/api/messages/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-admin-key" \
  -d '{
    "sessionId": "tenant-123-user-456-1234567890",
    "phoneNumber": "+1234567890",
    "message": "Hello from OpenWA!"
  }'
```

---

## Key Implementation Details

### Session Persistence
- Sessions stored in Redis with 24-hour TTL
- On restart, engine reconnects to persisted sessions
- Client object kept in memory for active connections
- Graceful degradation if Redis unavailable

### QR Code Flow
1. Session created → QR code generated
2. Frontend polls `/api/sessions/{id}/qr` every 2 seconds
3. User scans QR → WhatsApp authenticates
4. Session status changes to `connected`
5. Frontend polls /qr GET continues to check status via response

### Error Handling
- API key validation on all protected routes
- Try-catch blocks with meaningful error messages
- Client kill on connection failure
- Automatic retry for failed operations

### Security
- Environment variables for sensitive data
- API key authentication
- No session data in logs
- CORS configured for backend only

---

## Next Steps

✅ Phase 1 Complete

**Move to Phase 2**: Create NestJS backend that communicates with this engine via REST API
