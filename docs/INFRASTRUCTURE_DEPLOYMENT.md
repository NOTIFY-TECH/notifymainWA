# INFRASTRUCTURE & DEPLOYMENT

**Goal**: Production-ready containerization, CI/CD pipeline, and monitoring

---

## Docker Architecture

```
┌─────────────┐
│   Frontend  │ (Node.js + Next.js)
└──────┬──────┘
       │
┌──────▼──────────┐
│   Backend API   │ (Node.js + NestJS)
└──────┬──────────┘
       │
┌──────┼───────────────────────────────────┐
│      │                                   │
▼      ▼                                   ▼
PostgreSQL    Redis              OpenWA Engine
```

---

## Docker Compose Setup

**docker-compose.yml**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: notifytechai
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # OpenWA Engine
  openwa-engine:
    build:
      context: ./openwa-engine
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3500
      REDIS_URL: redis://redis:6379
      CHROME_PATH: /usr/bin/chromium
      API_KEY: ${OPENWA_API_KEY}
      SESSIONS_DIR: /app/sessions
    volumes:
      - openwa_sessions:/app/sessions
    ports:
      - "3500:3500"
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  # NestJS Backend
  backend:
    build:
      context: ./backend
      dockerfile: docker/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/notifytechai
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      OPENWA_API_URL: http://openwa-engine:3500
      OPENWA_API_KEY: ${OPENWA_API_KEY}
      RAZORPAY_KEY_ID: ${RAZORPAY_KEY_ID}
      RAZORPAY_KEY_SECRET: ${RAZORPAY_KEY_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      openwa-engine:
        condition: service_started
    restart: unless-stopped

  # Next.js Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3000
      NEXT_PUBLIC_WS_URL: ws://backend:3000/ws
    ports:
      - "3001:3000"
    depends_on:
      - backend
    restart: unless-stopped

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  openwa_sessions:
```

---

## Dockerfiles

### Backend Dockerfile

**backend/docker/Dockerfile**
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main.js"]
```

### Frontend Dockerfile

**frontend/Dockerfile**
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "start"]
```

### OpenWA Dockerfile

**openwa-engine/Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install Chromium and dependencies
RUN apk add --no-cache \
  chromium \
  dbus \
  font-noto \
  grep \
  dumb-init

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3500

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main.js"]
```

---

## Nginx Configuration

**nginx.conf**
```nginx
upstream backend {
  server backend:3000;
}

upstream frontend {
  server frontend:3000;
}

upstream openwa {
  server openwa-engine:3500;
}

server {
  listen 80;
  server_name notifytechai.com www.notifytechai.com;

  # Redirect to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name notifytechai.com www.notifytechai.com;

  ssl_certificate /etc/letsencrypt/live/notifytechai.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/notifytechai.com/privkey.pem;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "no-referrer-when-downgrade" always;

  # API Backend
  location /api/ {
    proxy_pass http://backend/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  # WebSocket
  location /ws {
    proxy_pass http://backend/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_request_buffering off;
  }

  # Frontend
  location / {
    proxy_pass http://frontend/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  # Health check
  location /health {
    access_log off;
    proxy_pass http://backend/health;
  }
}
```

---

## CI/CD Pipeline (GitHub Actions)

**.github/workflows/deploy.yml**
```yaml
name: Deploy NotifyTechAI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install Backend Dependencies
        run: |
          cd backend
          npm ci

      - name: Run Backend Tests
        run: |
          cd backend
          npm run test

      - name: Install Frontend Dependencies
        run: |
          cd frontend
          npm ci

      - name: Run Frontend Tests
        run: |
          cd frontend
          npm run test

      - name: Install OpenWA Dependencies
        run: |
          cd openwa-engine
          npm ci

      - name: Build OpenWA Engine
        run: |
          cd openwa-engine
          npm run build

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push Backend Image
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          file: ./backend/docker/Dockerfile
          push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:latest
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:buildcache,mode=max

      - name: Build and Push Frontend Image
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:latest

      - name: Build and Push OpenWA Image
        uses: docker/build-push-action@v4
        with:
          context: ./openwa-engine
          file: ./openwa-engine/Dockerfile
          push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/openwa-engine:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Production
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H $DEPLOY_HOST >> ~/.ssh/known_hosts
          
          ssh -i ~/.ssh/deploy_key $DEPLOY_USER@$DEPLOY_HOST << 'EOF'
            cd /app/notifytechai
            git pull origin main
            docker-compose pull
            docker-compose up -d
            docker-compose exec -T backend npm run migrate
          EOF
```

---

## Database Migrations

**Running Migrations**
```bash
# Local development
npm run typeorm migration:generate src/database/migrations/AddNewFeature
npm run typeorm migration:run

# Production (in Docker)
docker-compose exec backend npm run typeorm migration:run
```

---

## Monitoring & Logging

### Health Checks

**src/health/health.controller.ts**
```typescript
@Get()
async check() {
  const checks = {
    database: await this.healthService.checkDatabase(),
    redis: await this.healthService.checkRedis(),
    openwa: await this.healthService.checkOpenWA(),
  };

  const allHealthy = Object.values(checks).every(c => c.status === 'up');

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  };
}
```

### Logging Configuration

**src/main.ts**
```typescript
import { Logger } from '@nestjs/common';
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}
```

---

## Backup Strategy

### Automated PostgreSQL Backups

**backup.sh**
```bash
#!/bin/bash

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="notifytechai"
DB_USER="postgres"

# Full backup
pg_dump -h localhost -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Retain only last 7 daily backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz s3://notifytechai-backups/

echo "✅ Backup completed: backup_$TIMESTAMP.sql.gz"
```

### Cron Job
```
0 2 * * * /app/backup.sh
```

---

## Scaling Strategy

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      replicas: 3

  openwa-engine:
    deploy:
      replicas: 2
```

### Load Balancing with Nginx
```nginx
upstream backend {
  least_conn;
  server backend:3000;
  server backend_2:3000;
  server backend_3:3000;
}
```

---

## Performance Optimization

### Database Connection Pooling
```
Min: 5
Max: 20
Idle timeout: 5 minutes
```

### Redis Configuration
```
maxmemory: 2gb
maxmemory-policy: allkeys-lru
```

### Node.js Settings
```bash
NODE_MAX_OLD_SPACE_SIZE=4096
NODE_OPTIONS="--max-old-space-size=4096"
```

---

## Production Checklist

- [ ] SSL/TLS certificates installed
- [ ] Database backups automated
- [ ] Monitoring alerts configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Secrets not in code
- [ ] Error logging setup
- [ ] Performance baseline established
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Disaster recovery tested
- [ ] Documentation updated

---

## Deployment Steps

1. **Prepare Server**
   ```bash
   ssh root@server
   git clone <repo>
   cd NotifyTechAI
   ```

2. **Set Environment**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

3. **Build Images**
   ```bash
   docker-compose build
   ```

4. **Start Services**
   ```bash
   docker-compose up -d
   ```

5. **Run Migrations**
   ```bash
   docker-compose exec backend npm run typeorm migration:run
   ```

6. **Verify Health**
   ```bash
   curl https://notifytechai.com/health
   ```

---

## Monitoring URLs

- API Health: `https://notifytechai.com/health`
- API Docs: `https://notifytechai.com/api/docs`
- Frontend: `https://notifytechai.com`

---

✅ **DEPLOYMENT COMPLETE**

**You now have a production-ready, scalable, multi-tenant WhatsApp SaaS platform!**
