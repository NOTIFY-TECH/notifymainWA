# AUTHENTICATION & MULTI-TENANT SYSTEM

**Goal**: Implement secure, scalable auth with complete tenant isolation

---

## Authentication Architecture

```
User Credentials
    ↓
Login Endpoint
    ↓
Verify Password (bcrypt)
    ↓
Generate JWT (access + refresh)
    ↓
Client stores tokens
    ↓
Every request includes bearer token
    ↓
JwtGuard validates and extracts user/tenant data
```

---

## JWT Token Structure

### Access Token (15 minutes)
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "tenantId": "tenant-123",
  "role": "ADMIN",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Refresh Token (7 days)
```json
{
  "sub": "user-id",
  "type": "refresh",
  "iat": 1234567890,
  "exp": 1234654290
}
```

---

## Role-Based Access Control (RBAC)

### Role Hierarchy

```
SUPER_ADMIN    (System administrator)
    ↓
PARTNER        (Reseller/agency)
    ↓
CLIENT         (Tenant owner)
    ↓
ADMIN          (Tenant admin)
    ↓
TEAM_LEADER    (Team lead)
    ↓
AGENT          (Team member)
    ↓
USER           (Basic user)
```

### Role Permissions Matrix

| Resource | SUPER_ADMIN | PARTNER | CLIENT | ADMIN | LEADER | AGENT | USER |
|----------|-------------|---------|--------|-------|--------|-------|------|
| Tenants (CRUD) | ✅ | ✅ | - | - | - | - | - |
| Users (CRUD) | ✅ | ✅ | ✅ | ✅ | - | - | - |
| Sessions (CRUD) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Messages (Read) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Messages (Send) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - |
| Campaigns (CRUD) | ✅ | ✅ | ✅ | ✅ | - | - | - |
| Billing | ✅ | ✅ | ✅ | ✅ | - | - | - |
| Analytics | ✅ | ✅ | ✅ | ✅ | ✅ | - | - |
| Team Settings | ✅ | ✅ | ✅ | ✅ | - | - | - |

---

## Multi-Tenant Isolation

### Database Level

Every table includes `tenantId`:
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL,
  userId UUID NOT NULL,
  content TEXT,
  createdAt TIMESTAMP,
  
  CONSTRAINT fk_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id),
  CONSTRAINT fk_user FOREIGN KEY (userId) REFERENCES users(id),
  
  -- Row-Level Security Policy
);

CREATE POLICY tenant_isolation ON messages
  USING (tenantId = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
```

### Query Level

All queries must filter by `tenantId`:
```typescript
// WRONG ❌
const messages = await this.messageRepository.find();

// CORRECT ✅
const messages = await this.messageRepository.find({
  where: {
    tenantId: user.tenantId, // Always include tenantId
  },
});
```

### Middleware Level

**src/middleware/tenant-context.middleware.ts**
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;

    if (user?.tenantId) {
      // Store tenant context for entire request
      (req as any).tenantId = user.tenantId;
      (req as any).currentUser = user;
    }

    next();
  }
}
```

### Cache Level

Redis keys must include `tenantId`:
```typescript
// Cache key structure: tenant:{tenantId}:{resource}:{id}
const cacheKey = `tenant:${tenantId}:sessions:${sessionId}`;
await this.cacheManager.set(cacheKey, data);
```

---

## Login Flow

```
1. Client submits email + password + tenantId
    ↓
2. Backend validates tenantId exists and is active
    ↓
3. Lookup user where email = input AND tenantId = input
    ↓
4. Compare provided password with stored passwordHash (bcrypt)
    ↓
5. If valid:
   - Generate access token (15m)
   - Generate refresh token (7d)
   - Store refresh token in database
   - Return tokens + user data
    ↓
6. Client stores accessToken in localStorage
    ↓
7. Client stores refreshToken in httpOnly cookie (if available)
    ↓
8. Every request includes: Authorization: Bearer <accessToken>
```

---

## Session Endpoints

### Register
```
POST /auth/tenants/:tenantId/register
Content-Type: application/json

{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePassword123!"
}

Response:
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### Login
```
POST /auth/tenants/:tenantId/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response: Same as register
```

### Refresh Token
```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}

Response:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### Logout
```
POST /auth/logout
Authorization: Bearer <accessToken>

Response:
{
  "success": true
}
```

---

## Protected Route Pattern

### Service Level
```typescript
@Injectable()
export class MessagesService {
  async getMessages(tenantId: string, userId: string) {
    // Tenant isolation enforced here
    return this.messageRepository.find({
      where: {
        tenantId,     // Always filter
        userId,
      },
    });
  }
}
```

### Controller Level
```typescript
@Controller('messages')
export class MessagesController {
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMessages(@CurrentUser() user: JwtPayload) {
    // JwtAuthGuard automatically validates token
    // user.tenantId is guaranteed from token
    return this.messagesService.getMessages(user.tenantId, user.sub);
  }
}
```

### Guard Implementation
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = request.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    return user;
  }
}
```

---

## Decorator: Extract Current User

**src/common/decorators/current-user.decorator.ts**
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

Usage:
```typescript
@Get()
@UseGuards(JwtAuthGuard)
async getMessages(@CurrentUser() user: JwtPayload) {
  // user has userId, tenantId, role
}
```

---

## Multi-Tenant Isolation Rules

### ✅ DO

1. Always query with `tenantId` filter
2. Include `tenantId` in every entity
3. Validate `tenantId` matches JWT token
4. Use parameterized queries (ORM handles this)
5. Store audit logs with `tenantId`
6. Prefix cache keys with `tenant:{tenantId}`

### ❌ DON'T

1. Query without `tenantId` filter
2. Mix data from different tenants
3. Expose `tenantId` in API responses
4. Cache without tenant prefix
5. Allow cross-tenant API calls
6. Store global settings (always per-tenant)

---

## Tenant Validation Decorator

**src/common/decorators/validate-tenant.decorator.ts**
```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class ValidateTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { tenantId: paramTenantId } = request.params;
    const user = request.user;

    if (!paramTenantId || !user) {
      throw new ForbiddenException('Missing tenant context');
    }

    if (user.tenantId !== paramTenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}
```

Usage:
```typescript
@Get('tenants/:tenantId/messages')
@UseGuards(JwtAuthGuard, ValidateTenantGuard)
async getMessages(@CurrentUser() user: JwtPayload) {
  // Only user's tenant data is accessible
}
```

---

## Password Security

### Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- At least 1 special character

### Hashing
```typescript
const passwordHash = await bcrypt.hash(plainPassword, 10);
const isValid = await bcrypt.compare(plainPassword, passwordHash);
```

### Storage
- Never store plain passwords
- Use bcrypt with salt rounds = 10+
- Hash reset tokens with SHA256

---

## Account Recovery Flow

```
1. User clicks "Forgot Password"
    ↓
2. User enters email + tenantId
    ↓
3. System generates reset token (UUID)
    ↓
4. Store token with TTL (15 minutes)
    ↓
5. Send reset link: /reset-password?token=<token>&email=<email>
    ↓
6. User clicks link, enters new password
    ↓
7. Validate token is valid and not expired
    ↓
8. Update passwordHash
    ↓
9. Invalidate all existing refresh tokens
    ↓
10. User must login again
```

---

## Audit Logging

Track all sensitive operations:

**src/common/services/audit.service.ts**
```typescript
@Injectable()
export class AuditService {
  async logAction(
    tenantId: string,
    userId: string,
    action: string,
    resource: string,
    changes?: Record<string, any>,
  ) {
    const auditLog = this.auditLogRepository.create({
      tenantId,
      userId,
      action,        // CREATE, UPDATE, DELETE, READ
      resource,      // User, Message, Campaign, etc
      changes,       // Before/after values
      ipAddress: this.getClientIp(),
      userAgent: this.getUserAgent(),
      timestamp: new Date(),
    });

    await this.auditLogRepository.save(auditLog);
  }
}
```

Sensitive operations to audit:
- User creation/deletion
- Role changes
- Password changes
- Campaign creation/execution
- Billing actions
- API key generation

---

## Security Best Practices

### Environment
```
NODE_ENV=production
JWT_SECRET=<very-long-random-string>
JWT_REFRESH_SECRET=<different-very-long-random-string>
```

### API Layer
```typescript
// Helmet for security headers
app.use(helmet());

// Rate limiting
const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
});
app.use(rateLimitMiddleware);

// CORS
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
});
```

### Database
- Use parameterized queries only (TypeORM/Prisma)
- Enable Row Level Security (RLS)
- Encrypt sensitive fields
- Regular backups

---

## Session Management

### Active Sessions Tracking
```typescript
@Entity('active_sessions')
export class ActiveSession {
  @PrimaryUUID()
  id: string;

  @Column('uuid')
  tenantId: string;

  @Column('uuid')
  userId: string;

  @Column('text')
  refreshToken: string;

  @Column('text')
  ipAddress: string;

  @Column('text')
  userAgent: string;

  @Column('timestamp')
  expiresAt: Date;

  @Column('timestamp')
  createdAt: Date;
}
```

### Logout All Devices
```typescript
async logoutAllDevices(userId: string) {
  await this.activeSessions.delete({
    userId,
  });
  
  // All refresh tokens invalidated
  // User must login again
}
```

---

## Testing Authentication

### Unit Tests
```typescript
describe('AuthService', () => {
  it('should register new user', async () => {
    const result = await authService.register(tenantId, registerDto);
    expect(result).toHaveProperty('accessToken');
  });

  it('should fail on invalid credentials', async () => {
    await expect(
      authService.login(tenantId, { email: 'test@example.com', password: 'wrong' })
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

### Integration Tests
```typescript
describe('Auth Endpoints (e2e)', () => {
  it('POST /auth/tenants/:tenantId/login should return tokens', async () => {
    const response = await request(app.getHttpServer())
      .post(`/auth/tenants/${tenantId}/login`)
      .send({ email: 'test@example.com', password: 'password' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
  });
});
```

---

## Next: Database Design Patterns for Tenant Isolation
