# PHASE 2: Backend Foundation (NestJS)

**Duration**: 3-4 weeks  
**Goal**: Build production-ready multi-tenant backend API that orchestrates all business logic

---

## What is the Backend

The backend is the **heart of NotifyTechAI**:
- Handles authentication and authorization
- Manages multi-tenant isolation
- Orchestrates all business logic (CRM, campaigns, billing)
- Communicates with OpenWA engine for WhatsApp operations
- Real-time WebSocket gateway for inbox
- Job queues for async processing
- Database persistence layer

Backend is the **ONLY interface** between frontend, external systems, and OpenWA.

---

## Architecture

```
Frontend (Next.js)
    ↓
Backend API (NestJS)
    ├── Auth Module
    ├── Tenant Module
    ├── Session Module (talks to OpenWA)
    ├── Message Module
    ├── Campaign Module
    ├── Contact Module
    ├── Analytics Module
    ├── Billing Module
    └── WebSocket Gateway (real-time)
        ↓
PostgreSQL + Redis + BullMQ + OpenWA
```

---

## Setup Steps

### 1. Initialize NestJS Project

```bash
npx @nestjs/cli new backend
cd backend
```

Choose package manager: **npm**

### 2. Install Core Dependencies

```bash
npm install \
  @nestjs/common \
  @nestjs/core \
  @nestjs/platform-express \
  @nestjs/platform-ws \
  @nestjs/jwt \
  @nestjs/passport \
  passport \
  passport-jwt \
  @nestjs/typeorm \
  typeorm \
  pg \
  redis \
  @nestjs/cache-manager \
  cache-manager \
  @nestjs/bull \
  bull \
  @nestjs/swagger \
  swagger-ui-express \
  @nestjs/config \
  dotenv \
  class-validator \
  class-transformer \
  axios \
  bcrypt \
  @prisma/client \
  helmet \
  cors \
  uuid \
  joi
```

### 3. Install Dev Dependencies

```bash
npm install --save-dev \
  @types/express \
  @types/node \
  @types/bcrypt \
  typescript \
  ts-loader \
  ts-node \
  @nestjs/testing \
  jest \
  @types/jest \
  ts-jest \
  eslint \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin
```

### 4. Create Environment File

**.env**
```
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/notifytechai
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=notifytechai
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRATION=7d

# OpenWA Engine
OPENWA_API_URL=http://localhost:3500
OPENWA_API_KEY=dev-admin-key

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf

# Webhook
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY_MS=5000

# Features
ENABLE_TRIAL_PERIOD=true
TRIAL_PERIOD_DAYS=14
```

### 5. Update App Module

**src/app.module.ts**
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as redisStore from 'cache-manager-redis-store';
import type { RedisClientOptions } from 'redis';

import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenants/tenants.module';
import { UserModule } from './users/users.module';
import { SessionModule } from './sessions/sessions.module';
import { MessageModule } from './messages/messages.module';
import { CampaignModule } from './campaigns/campaigns.module';
import { ContactModule } from './contacts/contacts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BillingModule } from './billing/billing.module';
import { NotificationModule } from './notifications/notifications.module';
import { WebhookModule } from './webhooks/webhooks.module';
import { HealthModule } from './health/health.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USER'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        entities: ['src/**/*.entity.ts'],
        migrations: ['src/database/migrations/*.ts'],
      }),
    }),

    CacheModule.registerAsync<RedisClientOptions>({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore as any,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        ttl: 600,
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
        },
      }),
    }),

    JwtModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION'),
        },
      }),
    }),

    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Feature modules
    AuthModule,
    TenantModule,
    UserModule,
    SessionModule,
    MessageModule,
    CampaignModule,
    ContactModule,
    AnalyticsModule,
    BillingModule,
    NotificationModule,
    WebhookModule,
    HealthModule,
    GatewayModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

### 6. Create Core Entities

**src/common/entities/base.entity.ts**
```typescript
import {
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
  PrimaryUUID,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryUUID()
  id: string;

  @Column('uuid')
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
```

**src/tenants/entities/tenant.entity.ts**
```typescript
import { Entity, Column, PrimaryUUID, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryUUID()
  id: string;

  @Column('text', { unique: true })
  name: string;

  @Column('text')
  slug: string;

  @Column('text', { nullable: true })
  logo?: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('timestamp')
  createdAt: Date;

  @Column('timestamp')
  updatedAt: Date;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];
}
```

**src/users/entities/user.entity.ts**
```typescript
import {
  Entity,
  Column,
  ManyToOne,
  PrimaryUUID,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PARTNER = 'PARTNER',
  CLIENT = 'CLIENT',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  TEAM_LEADER = 'TEAM_LEADER',
  USER = 'USER',
}

@Entity('users')
export class User {
  @PrimaryUUID()
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column('text')
  email: string;

  @Column('text')
  firstName: string;

  @Column('text')
  lastName: string;

  @Column('text')
  passwordHash: string;

  @Column('enum', { enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  profilePicture?: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.users)
  tenant: Tenant;
}
```

### 7. Create Authentication Module

**src/auth/auth.module.ts**
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule,
    UserModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

**src/auth/auth.service.ts**
```typescript
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(tenantId: string, createUserDto: CreateUserDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email, tenantId },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      tenantId,
      email: createUserDto.email,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      passwordHash,
      role: UserRole.USER,
    });

    await this.userRepository.save(user);

    return this.generateTokens(user);
  }

  async login(tenantId: string, loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email, tenantId },
    });

    if (!user || !(await bcrypt.compare(loginDto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  async validateToken(token: string) {
    return this.jwtService.verify(token);
  }
}
```

**src/auth/strategies/jwt.strategy.ts**
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }
}
```

**src/auth/auth.controller.ts**
```typescript
import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('tenants/:tenantId/register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Param('tenantId') tenantId: string,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.authService.register(tenantId, createUserDto);
  }

  @Post('tenants/:tenantId/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Param('tenantId') tenantId: string,
    @Body() loginDto: LoginDto,
  ) {
    return this.authService.login(tenantId, loginDto);
  }
}
```

### 8. Create Session Module (Talks to OpenWA)

**src/sessions/sessions.service.ts**
```typescript
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionsService {
  private openwaClient: axios.AxiosInstance;

  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    configService: ConfigService,
  ) {
    this.openwaClient = axios.create({
      baseURL: configService.get('OPENWA_API_URL'),
      headers: {
        'X-API-Key': configService.get('OPENWA_API_KEY'),
      },
    });
  }

  async createSession(tenantId: string, userId: string) {
    try {
      // Call OpenWA to create session
      const response = await this.openwaClient.post('/api/sessions', {
        tenantId,
        userId,
      });

      const sessionData = response.data;

      // Store in database
      const session = this.sessionRepository.create({
        tenantId,
        userId,
        sessionId: sessionData.id,
        status: sessionData.status,
        phoneNumber: sessionData.phoneNumber,
        metadata: sessionData,
      });

      await this.sessionRepository.save(session);

      return session;
    } catch (error) {
      throw new HttpException(
        'Failed to create session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getQrCode(sessionId: string) {
    try {
      const response = await this.openwaClient.get(
        `/api/sessions/${sessionId}/qr`,
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Failed to get QR code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async listSessions(tenantId: string) {
    return this.sessionRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteSession(sessionId: string) {
    try {
      await this.openwaClient.delete(`/api/sessions/${sessionId}`);
      await this.sessionRepository.delete({ sessionId });
      return { success: true };
    } catch (error) {
      throw new HttpException(
        'Failed to delete session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

### 9. Create Global Guards and Interceptors

**src/common/guards/tenant.guard.ts**
```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { tenantId } = request.params;
    const user = request.user;

    if (!tenantId || !user) {
      throw new ForbiddenException('Access denied');
    }

    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}
```

**src/common/interceptors/tenant.interceptor.ts**
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { tenantId } = request.params;

    if (request.user && tenantId) {
      request.user.currentTenantId = tenantId;
    }

    return next.handle();
  }
}
```

### 10. Create WebSocket Gateway

**src/gateway/inbox.gateway.ts**
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
  cors: {
    origin: '*',
  },
})
@Injectable()
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<string, Socket> = new Map();

  handleConnection(client: Socket) {
    const { tenantId, userId } = client.handshake.query;
    
    if (tenantId && userId) {
      const key = `${tenantId}:${userId}`;
      this.connectedUsers.set(key, client);
      console.log(`✅ User connected: ${key}`);
    }
  }

  handleDisconnect(client: Socket) {
    const { tenantId, userId } = client.handshake.query;
    
    if (tenantId && userId) {
      const key = `${tenantId}:${userId}`;
      this.connectedUsers.delete(key);
      console.log(`❌ User disconnected: ${key}`);
    }
  }

  @SubscribeMessage('message:send')
  handleSendMessage(client: Socket, payload: any) {
    const { conversationId, message } = payload;
    
    // Broadcast to all users in same tenant
    this.server.emit('message:new', {
      conversationId,
      message,
      timestamp: new Date(),
    });
  }

  broadcastToTenant(tenantId: string, event: string, data: any) {
    this.server.emit(`tenant:${tenantId}:${event}`, data);
  }

  broadcastToUser(tenantId: string, userId: string, event: string, data: any) {
    const key = `${tenantId}:${userId}`;
    const socket = this.connectedUsers.get(key);
    
    if (socket) {
      socket.emit(event, data);
    }
  }
}
```

### 11. Create Health Check Module

**src/health/health.controller.ts**
```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'NotifyTechAI Backend',
      version: '1.0.0',
    };
  }
}
```

### 12. Update main.ts

**src/main.ts**
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors();

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('NotifyTechAI API')
    .setDescription('Multi-tenant WhatsApp SaaS API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 NotifyTechAI Backend running on port ${port}`);
  console.log(`📚 API Docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
```

### 13. Database Setup

```bash
npx typeorm database sync
# or
npx typeorm migration:generate src/database/migrations/InitialMigration
```

### 14. Start Backend

```bash
npm run dev
```

### 15. Verify Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 42.123,
  "service": "NotifyTechAI Backend",
  "version": "1.0.0"
}
```

---

## Module Structure Template

Each feature module follows this structure:

```
module-name/
├── dto/
│   ├── create-{entity}.dto.ts
│   └── update-{entity}.dto.ts
├── entities/
│   └── {entity}.entity.ts
├── {module}.controller.ts
├── {module}.service.ts
├── {module}.module.ts
└── interfaces/
    └── {entity}.interface.ts
```

---

## Key Implementation Patterns

### 1. Tenant Isolation
Every query includes `tenantId` filtering:
```typescript
await this.repository.find({
  where: {
    tenantId: user.tenantId,
    isActive: true,
  },
});
```

### 2. Error Handling
```typescript
catch (error) {
  this.logger.error(`Failed operation: ${error.message}`);
  throw new HttpException(
    'Operation failed',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
```

### 3. Response Format
```typescript
{
  success: true,
  data: { /* entity */ },
  message: 'Operation completed'
}
```

---

## Next Steps

✅ Backend foundation complete

**Next**: Create remaining modules (messages, campaigns, contacts, etc.) following these patterns
