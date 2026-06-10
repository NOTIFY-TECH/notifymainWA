# PHASE_2_BACKEND.md — NestJS Backend Foundation
**NotifyTechAI Platform**
Last Updated: May 2026 | Status: Production-Ready

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Project Initialization](#2-project-initialization)
3. [Environment Configuration](#3-environment-configuration)
4. [Prisma Setup & Database Connection](#4-prisma-setup--database-connection)
5. [Core Module Structure](#5-core-module-structure)
6. [Core Entities & Prisma Schema](#6-core-entities--prisma-schema)
7. [Authentication Service (JWT)](#7-authentication-service-jwt)
8. [Multi-Tenant Isolation Patterns](#8-multi-tenant-isolation-patterns)
9. [Session Module (OpenWA Integration)](#9-session-module-openwa-integration)
10. [Global Guards & Interceptors](#10-global-guards--interceptors)
11. [WebSocket Gateway](#11-websocket-gateway)
12. [Health Check Endpoints](#12-health-check-endpoints)
13. [Module Structure Template](#13-module-structure-template)
14. [Main Application Bootstrap](#14-main-application-bootstrap)
15. [Testing](#15-testing)

---

## 1. Overview & Architecture

### What This Phase Produces
A production-ready **NestJS** REST + WebSocket API server that:
- Authenticates users with JWT (access + refresh tokens)
- Enforces multi-tenant data isolation on every query
- Bridges to the OpenWA engine (Phase 1) for WhatsApp sessions
- Exposes a WebSocket gateway for real-time events
- Runs on **port 3000**

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        NestJS (Port 3000)                      │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Auth    │  │ Session  │  │ Messages │  │  Analytics   │  │
│  │  Module  │  │  Module  │  │  Module  │  │    Module    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │              │               │          │
│  ┌────▼──────────────▼──────────────▼───────────────▼───────┐ │
│  │               Core Infrastructure                         │ │
│  │  PrismaService │ RedisService │ TenantContext             │ │
│  └────────────────────────────────────────────────────────── ┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Global Guards & Interceptors                     │  │
│  │  JwtAuthGuard │ TenantGuard │ RolesGuard │ LogInterceptor│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────┐                        │
│  │        WebSocket Gateway           │                        │
│  │    Socket.io + Redis Adapter       │                        │
│  └────────────────────────────────────┘                        │
└────────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
  PostgreSQL (Prisma)        OpenWA Engine (Port 3500)
```

### Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | NestJS | 10.x |
| Language | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 16 |
| Cache / Pub-Sub | Redis (ioredis) | 7.x |
| Auth | @nestjs/jwt, passport-jwt | Latest |
| WebSocket | @nestjs/websockets, socket.io | Latest |
| Validation | class-validator, class-transformer | Latest |
| HTTP Client | axios | Latest |
| Testing | Jest | Latest |

---

## 2. Project Initialization

```bash
# Install NestJS CLI globally
npm install -g @nestjs/cli

# Create project
nest new backend --package-manager npm
cd backend

# Core NestJS packages
npm install \
  @nestjs/config \
  @nestjs/jwt \
  @nestjs/passport \
  @nestjs/websockets \
  @nestjs/platform-socket.io \
  @nestjs/terminus \
  passport \
  passport-jwt \
  passport-local \
  socket.io \
  @socket.io/redis-adapter

# Database & Cache
npm install prisma @prisma/client
npm install ioredis
npx prisma init

# Utilities
npm install \
  bcrypt \
  uuid \
  axios \
  class-validator \
  class-transformer \
  helmet \
  compression \
  @nestjs/throttler

# Dev dependencies
npm install -D \
  @types/bcrypt \
  @types/passport-jwt \
  @types/passport-local \
  @types/uuid \
  @types/socket.io

# Initialize Prisma
npx prisma init --datasource-provider postgresql
```

### Final Directory Structure

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── tenant.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── tenant.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── response.interceptor.ts
│   │   │   └── tenant.interceptor.ts
│   │   ├── middleware/
│   │   │   └── tenant.middleware.ts
│   │   └── pipes/
│   │       └── validation.pipe.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── redis/
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── refresh-token.dto.ts
│   │   └── strategies/
│   │       ├── jwt.strategy.ts
│   │       └── local.strategy.ts
│   ├── tenants/
│   │   ├── tenants.module.ts
│   │   ├── tenants.controller.ts
│   │   ├── tenants.service.ts
│   │   └── dto/
│   │       └── create-tenant.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   ├── sessions/
│   │   ├── sessions.module.ts
│   │   ├── sessions.controller.ts
│   │   ├── sessions.service.ts
│   │   ├── openwa.client.ts
│   │   └── dto/
│   │       └── create-session.dto.ts
│   ├── gateway/
│   │   └── events.gateway.ts
│   └── health/
│       └── health.controller.ts
├── prisma/
│   └── schema.prisma
├── .env
├── .env.example
├── nest-cli.json
└── tsconfig.json
```

---

## 3. Environment Configuration

### `.env.example`

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/notifytechai?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_REFRESH_EXPIRY=7d

# OpenWA Engine
OPENWA_BASE_URL=http://localhost:3500
OPENWA_API_KEY=openwa-internal-api-key

# Frontend
FRONTEND_URL=http://localhost:3001

# Throttle
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### `src/config/configuration.ts`

```typescript
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  openwa: {
    baseUrl: process.env.OPENWA_BASE_URL || 'http://localhost:3500',
    apiKey: process.env.OPENWA_API_KEY,
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },
});
```

---

## 4. Prisma Setup & Database Connection

### `prisma/schema.prisma` (Core Models Only — Full Schema in DATABASE_DESIGN.md)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  SUPER_ADMIN
  TENANT_OWNER
  TENANT_ADMIN
  MANAGER
  AGENT
  VIEWER
  API_USER
}

enum SessionStatus {
  INITIALIZING
  QR_PENDING
  CONNECTED
  DISCONNECTED
  ERROR
}

enum SubscriptionPlan {
  BASIC
  GROWTH
  PROFESSIONAL
  ENTERPRISE
}

model Tenant {
  id               String           @id @default(uuid())
  name             String
  slug             String           @unique
  email            String           @unique
  plan             SubscriptionPlan @default(BASIC)
  isActive         Boolean          @default(true)
  maxSessions      Int              @default(1)
  maxMessages      Int              @default(1000)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  users            User[]
  sessions         Session[]
  apiKeys          ApiKey[]

  @@map("tenants")
}

model User {
  id               String     @id @default(uuid())
  tenantId         String
  email            String
  passwordHash     String
  firstName        String
  lastName         String
  role             UserRole   @default(AGENT)
  isActive         Boolean    @default(true)
  lastLoginAt      DateTime?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  tenant           Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  refreshTokens    RefreshToken[]

  @@unique([tenantId, email])
  @@index([tenantId])
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

model Session {
  id          String        @id @default(uuid())
  tenantId    String
  name        String
  phoneNumber String?
  status      SessionStatus @default(INITIALIZING)
  openwaId    String?       @unique
  qrCode      String?
  metadata    Json?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  tenant      Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("sessions")
}

model ApiKey {
  id        String   @id @default(uuid())
  tenantId  String
  name      String
  keyHash   String   @unique
  lastUsed  DateTime?
  expiresAt DateTime?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("api_keys")
}
```

### `src/prisma/prisma.service.ts`

```typescript
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: any) => {
        if (e.duration > 500) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Soft-delete helper: sets deletedAt instead of removing rows.
   * Use only on models that have a deletedAt field.
   */
  async softDelete(model: string, where: Record<string, any>) {
    return (this as any)[model].update({
      where,
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Exclude fields from a Prisma result object (e.g., remove passwordHash).
   */
  exclude<T, Key extends keyof T>(entity: T, keys: Key[]): Omit<T, Key> {
    const result = { ...entity };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }
}
```

### `src/prisma/prisma.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## 5. Core Module Structure

### `src/redis/redis.service.ts`

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }
}
```

### `src/redis/redis.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

---

## 6. Core Entities & Prisma Schema

_(Full 14-table schema is in DATABASE_DESIGN.md. This section covers the service-layer DTOs for the core entities.)_

### `src/tenants/dto/create-tenant.dto.ts`

```typescript
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan = SubscriptionPlan.BASIC;
}
```

### `src/tenants/tenants.service.ts`

```typescript
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const slug = this.generateSlug(dto.name);

    const existing = await this.prisma.tenant.findFirst({
      where: { OR: [{ slug }, { email: dto.email }] },
    });

    if (existing) {
      throw new ConflictException('Tenant with this name or email already exists');
    }

    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        email: dto.email,
        plan: dto.plan,
      },
    });
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({ where: { isActive: true } });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
```

### `src/users/dto/create-user.dto.ts`

```typescript
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @IsEnum(UserRole)
  role: UserRole = UserRole.AGENT;
}
```

### `src/users/users.service.ts`

```typescript
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 12;

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists in this tenant');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
    });

    return this.prisma.exclude(user, ['passwordHash']);
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
  }

  async findById(tenantId: string, id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.prisma.exclude(user, ['passwordHash']);
  }

  async findAll(tenantId: string): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.prisma.exclude(u, ['passwordHash']));
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<Omit<User, 'passwordHash'>> {
    await this.findById(tenantId, id); // ensures ownership

    const data: any = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
      delete data.password;
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    return this.prisma.exclude(user, ['passwordHash']);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}
```

---

## 7. Authentication Service (JWT)

### `src/auth/dto/login.dto.ts`

```typescript
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  tenantSlug: string;
}
```

### `src/auth/dto/refresh-token.dto.ts`

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

### `src/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;       // userId
  tenantId: string;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId, isActive: true },
      include: { tenant: true },
    });

    if (!user || !user.tenant.isActive) {
      throw new UnauthorizedException('User or tenant is inactive');
    }

    return {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      tenant: user.tenant,
    };
  }
}
```

### `src/auth/strategies/local.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(req: any, email: string, password: string) {
    const { tenantSlug } = req.body;
    if (!tenantSlug) throw new UnauthorizedException('tenantSlug is required');

    const user = await this.authService.validateUser(email, password, tenantSlug);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}
```

### `src/auth/auth.service.ts`

```typescript
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  async validateUser(email: string, password: string, tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Invalid tenant');
    }

    const user = await this.usersService.findByEmail(tenant.id, email);
    if (!user) return null;

    const isPasswordValid = await this.usersService.validatePassword(user, password);
    if (!isPasswordValid) return null;

    return user;
  }

  async login(dto: LoginDto): Promise<TokenPair & { user: any }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) throw new UnauthorizedException('Invalid tenant');

    const user = await this.usersService.findByEmail(tenant.id, dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await this.usersService.validatePassword(user, dto.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, tenant.id, user.role, user.email);

    return {
      ...tokens,
      user: this.prisma.exclude(user, ['passwordHash']),
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    // Look up the token in the database
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.generateTokens(
      stored.user.id,
      stored.user.tenantId,
      stored.user.role,
      stored.user.email,
    );
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, token: refreshToken },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    // Blacklist all active access tokens for this user
    await this.redis.set(`blacklist:user:${userId}`, '1', 60 * 15); // 15-min TTL matches access token
  }

  private async generateTokens(
    userId: string,
    tenantId: string,
    role: string,
    email: string,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, tenantId, role, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiry'),
    });

    const rawRefreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: rawRefreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 15 * 60, // seconds
    };
  }
}
```

### `src/auth/auth.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: any, @Body() dto: RefreshTokenDto) {
    await this.authService.logout(user.userId, dto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: any) {
    await this.authService.logoutAll(user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return user;
  }
}
```

### `src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessExpiry') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## 8. Multi-Tenant Isolation Patterns

Every request from an authenticated user carries `tenantId` in the JWT. We propagate this through a request-scoped context and enforce it at every database query.

### `src/common/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

### `src/common/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### `src/common/guards/jwt-auth.guard.ts`

```typescript
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private redis: RedisService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Call parent (validates JWT signature + expiry)
    const isValid = await super.canActivate(context);
    if (!isValid) return false;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check user-level blacklist (set on logout-all)
    const blacklisted = await this.redis.get(`blacklist:user:${user.userId}`);
    if (blacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return true;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
```

### `src/common/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Role hierarchy: higher index = more privileged
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.VIEWER,
  UserRole.API_USER,
  UserRole.AGENT,
  UserRole.MANAGER,
  UserRole.TENANT_ADMIN,
  UserRole.TENANT_OWNER,
  UserRole.SUPER_ADMIN,
];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('No user in context');

    const userLevel = ROLE_HIERARCHY.indexOf(user.role);
    const hasPermission = requiredRoles.some(
      (role) => ROLE_HIERARCHY.indexOf(role) <= userLevel,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Role ${user.role} is not authorized for this action`,
      );
    }

    return true;
  }
}
```

### `src/common/guards/tenant.guard.ts`

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Ensures that any :tenantId route param matches the authenticated user's tenantId.
 * Prevents tenant A from accessing tenant B's resources.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Not authenticated');

    // Super admins bypass tenant isolation
    if (user.role === 'SUPER_ADMIN') return true;

    const routeTenantId = request.params?.tenantId;
    if (routeTenantId && routeTenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied: cross-tenant access is not allowed');
    }

    return true;
  }
}
```

### `src/common/interceptors/logging.interceptor.ts`

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log(
            `${method} ${url} ${res.statusCode} - ${Date.now() - now}ms` +
              (user ? ` [tenant:${user.tenantId}]` : ''),
          );
        },
        error: (err) => {
          this.logger.error(
            `${method} ${url} ${err.status || 500} - ${Date.now() - now}ms`,
          );
        },
      }),
    );
  }
}
```

### `src/common/interceptors/response.interceptor.ts`

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### `src/common/filters/http-exception.filter.ts`

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && (res as any).message) {
        message = Array.isArray((res as any).message)
          ? (res as any).message.join(', ')
          : (res as any).message;
        errors = (res as any).errors || null;
      } else {
        message = res as string;
      }
    } else {
      this.logger.error('Unhandled exception', exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 9. Session Module (OpenWA Integration)

### `src/sessions/openwa.client.ts`

```typescript
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface OpenWASession {
  id: string;
  status: string;
  qrCode?: string;
  phoneNumber?: string;
}

@Injectable()
export class OpenWAClient {
  private readonly logger = new Logger(OpenWAClient.name);
  private http: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.http = axios.create({
      baseURL: this.configService.get<string>('openwa.baseUrl'),
      timeout: 30000,
      headers: {
        'x-api-key': this.configService.get<string>('openwa.apiKey'),
        'Content-Type': 'application/json',
      },
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        this.logger.error(
          `OpenWA request failed: ${err.config?.url} - ${err.message}`,
        );
        if (err.code === 'ECONNREFUSED') {
          throw new ServiceUnavailableException('WhatsApp engine is unavailable');
        }
        throw err;
      },
    );
  }

  async createSession(sessionId: string): Promise<OpenWASession> {
    const res = await this.http.post('/sessions', { id: sessionId });
    return res.data;
  }

  async getSession(sessionId: string): Promise<OpenWASession> {
    const res = await this.http.get(`/sessions/${sessionId}`);
    return res.data;
  }

  async getQrCode(sessionId: string): Promise<string> {
    const res = await this.http.get(`/sessions/${sessionId}/qr`);
    return res.data.qrCode;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.http.delete(`/sessions/${sessionId}`);
  }

  async sendTextMessage(
    sessionId: string,
    to: string,
    text: string,
  ): Promise<string> {
    const res = await this.http.post(`/sessions/${sessionId}/messages`, {
      to,
      type: 'text',
      text,
    });
    return res.data.messageId;
  }

  async sendMediaMessage(
    sessionId: string,
    to: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<string> {
    const res = await this.http.post(`/sessions/${sessionId}/messages`, {
      to,
      type: 'media',
      mediaUrl,
      caption,
    });
    return res.data.messageId;
  }

  async getSessionStats(sessionId: string): Promise<any> {
    const res = await this.http.get(`/sessions/${sessionId}/stats`);
    return res.data;
  }
}
```

### `src/sessions/dto/create-session.dto.ts`

```typescript
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
```

### `src/sessions/sessions.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OpenWAClient } from './openwa.client';
import { CreateSessionDto } from './dto/create-session.dto';
import { Session, SessionStatus } from '@prisma/client';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private openwa: OpenWAClient,
  ) {}

  async create(tenantId: string, dto: CreateSessionDto): Promise<Session> {
    // Check plan limits
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const sessionCount = await this.prisma.session.count({ where: { tenantId } });

    if (sessionCount >= tenant.maxSessions) {
      throw new BadRequestException(
        `Your plan allows a maximum of ${tenant.maxSessions} sessions`,
      );
    }

    // Create local record first
    const session = await this.prisma.session.create({
      data: {
        tenantId,
        name: dto.name,
        status: SessionStatus.INITIALIZING,
      },
    });

    // Initialize in OpenWA engine
    try {
      await this.openwa.createSession(session.id);
      await this.prisma.session.update({
        where: { id: session.id },
        data: { openwaId: session.id, status: SessionStatus.QR_PENDING },
      });
    } catch (err) {
      this.logger.error(`Failed to create OpenWA session: ${err.message}`);
      await this.prisma.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.ERROR },
      });
    }

    return this.prisma.session.findUnique({ where: { id: session.id } });
  }

  async getQrCode(tenantId: string, sessionId: string): Promise<string> {
    const session = await this.findByTenant(tenantId, sessionId);

    if (session.status === SessionStatus.CONNECTED) {
      throw new BadRequestException('Session is already connected');
    }

    const qr = await this.openwa.getQrCode(sessionId);

    // Cache QR briefly
    await this.redis.set(`qr:${sessionId}`, qr, 60);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { qrCode: qr, status: SessionStatus.QR_PENDING },
    });

    return qr;
  }

  async findAll(tenantId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, sessionId: string): Promise<Session> {
    return this.findByTenant(tenantId, sessionId);
  }

  async delete(tenantId: string, sessionId: string): Promise<void> {
    await this.findByTenant(tenantId, sessionId);

    try {
      await this.openwa.deleteSession(sessionId);
    } catch (err) {
      this.logger.warn(`Could not delete OpenWA session: ${err.message}`);
    }

    await this.prisma.session.delete({ where: { id: sessionId } });
    await this.redis.del(`qr:${sessionId}`);
  }

  /**
   * Called by OpenWA webhook when session status changes.
   */
  async handleStatusUpdate(
    sessionId: string,
    status: SessionStatus,
    phoneNumber?: string,
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status,
        phoneNumber: phoneNumber || undefined,
        qrCode: status === SessionStatus.CONNECTED ? null : undefined,
      },
    });

    this.logger.log(`Session ${sessionId} status → ${status}`);
  }

  private async findByTenant(tenantId: string, sessionId: string): Promise<Session> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    return session;
  }
}
```

### `src/sessions/sessions.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('sessions')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_OWNER)
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.sessionsService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.sessionsService.findOne(tenantId, id);
  }

  @Get(':id/qr')
  getQrCode(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.sessionsService.getQrCode(tenantId, id);
  }

  @Delete(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.TENANT_OWNER)
  delete(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.sessionsService.delete(tenantId, id);
  }
}
```

### `src/sessions/sessions.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { OpenWAClient } from './openwa.client';

@Module({
  providers: [SessionsService, OpenWAClient],
  controllers: [SessionsController],
  exports: [SessionsService, OpenWAClient],
})
export class SessionsModule {}
```

---

## 10. Global Guards & Interceptors

The global configuration is applied in `main.ts` (see Section 14). Here are remaining pieces:

### `src/common/pipes/validation.pipe.ts`

```typescript
import { ValidationPipe } from '@nestjs/common';

export const globalValidationPipe = new ValidationPipe({
  whitelist: true,            // Strip unknown properties
  forbidNonWhitelisted: true, // Throw on unknown properties
  transform: true,            // Auto-convert types (string → number etc.)
  transformOptions: {
    enableImplicitConversion: true,
  },
});
```

---

## 11. WebSocket Gateway

### `src/gateway/events.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  // Map of tenantId → Set of socket IDs for targeted broadcasts
  private tenantSockets = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Attach user data to socket
      client.data.userId = payload.sub;
      client.data.tenantId = payload.tenantId;
      client.data.role = payload.role;

      // Join tenant room
      client.join(`tenant:${payload.tenantId}`);

      if (!this.tenantSockets.has(payload.tenantId)) {
        this.tenantSockets.set(payload.tenantId, new Set());
      }
      this.tenantSockets.get(payload.tenantId).add(client.id);

      this.logger.log(
        `Client connected: ${client.id} (tenant: ${payload.tenantId})`,
      );
    } catch (err) {
      this.logger.warn(`Unauthorized WebSocket connection attempt`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const { tenantId } = client.data;
    if (tenantId) {
      this.tenantSockets.get(tenantId)?.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    client.join(`session:${data.sessionId}`);
    return { event: 'joined', data: { sessionId: data.sessionId } };
  }

  @SubscribeMessage('leave-session')
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    client.leave(`session:${data.sessionId}`);
  }

  // --- Server-side emit helpers ---

  /** Emit to all sockets in a tenant */
  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  /** Emit to all sockets watching a specific session */
  emitToSession(sessionId: string, event: string, data: any) {
    this.server.to(`session:${sessionId}`).emit(event, data);
  }

  /** Emit QR code update */
  emitQrUpdate(tenantId: string, sessionId: string, qrCode: string) {
    this.emitToTenant(tenantId, 'session:qr', { sessionId, qrCode });
  }

  /** Emit session status change */
  emitSessionStatus(tenantId: string, sessionId: string, status: string) {
    this.emitToTenant(tenantId, 'session:status', { sessionId, status });
  }

  /** Emit incoming message */
  emitIncomingMessage(tenantId: string, message: any) {
    this.emitToTenant(tenantId, 'message:incoming', message);
  }

  /** Emit message status update (sent / delivered / read) */
  emitMessageStatus(tenantId: string, messageId: string, status: string) {
    this.emitToTenant(tenantId, 'message:status', { messageId, status });
  }
}
```

### Gateway Module

```typescript
// src/gateway/gateway.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
```

---

## 12. Health Check Endpoints

### `src/health/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { InjectableHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memoryHealth: MemoryHealthIndicator,
    private diskHealth: DiskHealthIndicator,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database
      () => this.prismaHealth.pingCheck('database', this.prisma),

      // Redis
      async () => {
        try {
          await this.redis.set('health:ping', 'pong', 5);
          const val = await this.redis.get('health:ping');
          return val === 'pong'
            ? { redis: { status: 'up' } }
            : { redis: { status: 'down' } };
        } catch {
          return { redis: { status: 'down' } };
        }
      },

      // Memory: warn above 500MB heap
      () =>
        this.memoryHealth.checkHeap('memory_heap', 500 * 1024 * 1024),

      // Disk: warn above 90% usage
      () =>
        this.diskHealth.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get('ready')
  ready() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

### Health Module

```typescript
// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

---

## 13. Module Structure Template

Use this template whenever you add a new feature module (e.g., Contacts, Campaigns, Webhooks).

```typescript
// src/[feature]/[feature].module.ts
import { Module } from '@nestjs/common';
import { [Feature]Service } from './[feature].service';
import { [Feature]Controller } from './[feature].controller';

@Module({
  // Import shared modules if needed (PrismaModule is global, skip it)
  imports: [],
  providers: [[Feature]Service],
  controllers: [[Feature]Controller],
  exports: [[Feature]Service],
})
export class [Feature]Module {}
```

```typescript
// src/[feature]/[feature].controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { [Feature]Service } from './[feature].service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Create[Feature]Dto } from './dto/create-[feature].dto';

@Controller('[feature]s')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class [Feature]Controller {
  constructor(private [feature]Service: [Feature]Service) {}

  @Post()
  @Roles(UserRole.AGENT)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: Create[Feature]Dto,
  ) {
    return this.[feature]Service.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.[feature]Service.findAll(tenantId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.[feature]Service.findOne(tenantId, id);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.[feature]Service.remove(tenantId, id);
  }
}
```

```typescript
// src/[feature]/[feature].service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Create[Feature]Dto } from './dto/create-[feature].dto';

@Injectable()
export class [Feature]Service {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: Create[Feature]Dto) {
    return this.prisma.[feature].create({
      data: { tenantId, ...dto },
    });
  }

  async findAll(tenantId: string) {
    // tenantId always applied — never omit this
    return this.prisma.[feature].findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.[feature].findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException(`[Feature] ${id} not found`);
    return item;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // ownership check
    return this.prisma.[feature].delete({ where: { id } });
  }
}
```

---

## 14. Main Application Bootstrap

### `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { SessionsModule } from './sessions/sessions.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Config (global)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Infrastructure (global)
    PrismaModule,
    RedisModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TenantsModule,
    SessionsModule,
    GatewayModule,
    HealthModule,
  ],
})
export class AppModule {}
```

### `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { globalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  const apiPrefix = configService.get<string>('apiPrefix');
  const frontendUrl = configService.get<string>('frontendUrl');

  // Security headers
  app.use(helmet());

  // Gzip compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix(apiPrefix);

  // Global pipes
  app.useGlobalPipes(globalValidationPipe);

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`🚀 NotifyTechAI API running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`🔌 WebSocket gateway on ws://localhost:${port}/events`);
  logger.log(`❤️  Health check at http://localhost:${port}/health`);
}

bootstrap();
```

---

## 15. Testing

### Auth Service Unit Test

```typescript
// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let usersService: jest.Mocked<UsersService>;

  const mockTenant = {
    id: 'tenant-1',
    slug: 'acme',
    isActive: true,
  };

  const mockUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'test@acme.com',
    passwordHash: '$2b$12$hashedpassword',
    role: 'AGENT',
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            tenant: { findUnique: jest.fn(), update: jest.fn() },
            refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
            user: { update: jest.fn() },
            exclude: jest.fn((u, _) => u),
          },
        },
        {
          provide: RedisService,
          useValue: { set: jest.fn(), get: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            validatePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock.jwt.token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    usersService = module.get(UsersService);
  });

  it('should throw UnauthorizedException for invalid tenant', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@x.com', password: 'pass', tenantSlug: 'bad-slug' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should login successfully with valid credentials', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
    (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
    (usersService.validatePassword as jest.Mock).mockResolvedValue(true);
    (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
      id: 'rt-1',
      token: 'refresh-token',
      expiresAt: new Date(),
    });

    const result = await service.login({
      email: 'test@acme.com',
      password: 'password123',
      tenantSlug: 'acme',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should throw on invalid password', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(mockTenant);
    (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
    (usersService.validatePassword as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@acme.com', password: 'wrong', tenantSlug: 'acme' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

### Run Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Quick API Smoke Test (curl)

```bash
BASE=http://localhost:3000/api/v1

# Health
curl $BASE/../health

# Login
curl -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@acme.com","password":"Password123!","tenantSlug":"acme"}'

# Store token
TOKEN=<access_token_from_above>

# Get current user
curl $BASE/auth/me -H "Authorization: Bearer $TOKEN"

# List sessions
curl $BASE/sessions -H "Authorization: Bearer $TOKEN"

# Create session
curl -X POST $BASE/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Primary WhatsApp"}'
```

---

## Summary

| Component | File | Purpose |
|---|---|---|
| Entry Point | `main.ts` | Bootstrap, CORS, global middleware |
| App Module | `app.module.ts` | Module wiring |
| Database | `prisma/prisma.service.ts` | Prisma client wrapper |
| Cache | `redis/redis.service.ts` | Redis operations |
| Auth | `auth/auth.service.ts` | JWT login, refresh, logout |
| JWT Strategy | `auth/strategies/jwt.strategy.ts` | Token validation |
| Tenant Guard | `guards/tenant.guard.ts` | Cross-tenant access prevention |
| Roles Guard | `guards/roles.guard.ts` | RBAC enforcement |
| Sessions | `sessions/sessions.service.ts` | WhatsApp session lifecycle |
| OpenWA Client | `sessions/openwa.client.ts` | HTTP bridge to OpenWA engine |
| WebSocket | `gateway/events.gateway.ts` | Real-time events |
| Health | `health/health.controller.ts` | Liveness + readiness probes |

**Next Step → DATABASE_DESIGN.md** for the full 14-table PostgreSQL schema with RLS, partitioning, and Prisma mappings.
