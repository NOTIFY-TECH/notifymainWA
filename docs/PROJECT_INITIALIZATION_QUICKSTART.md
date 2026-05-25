# PROJECT INITIALIZATION & QUICK START GUIDE

**Complete step-by-step guide to initialize and launch NotifyTechAI**

---

## Pre-requisites

### System Requirements
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Chrome/Chromium browser
- Git

### Install Node.js
```bash
# macOS
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows
# Download from https://nodejs.org
```

### Install Docker
```bash
# macOS
brew install docker docker-compose

# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

---

## Project Initialization

### 1. Clone or Create Repository

```bash
# Option A: Clone existing
git clone https://github.com/yourusername/notifytechai.git
cd notifytechai

# Option B: Create new from scratch
mkdir notifytechai && cd notifytechai
git init
```

### 2. Create Directory Structure

```bash
mkdir -p {openwa-engine,backend,frontend,docs,scripts,data/{media,plugins,sessions},traefik}
```

### 3. Initialize Git Repository

```bash
git init
git remote add origin https://github.com/yourusername/notifytechai.git
```

---

## Phase 1: OpenWA Engine Setup

### 1. Create OpenWA Project

```bash
cd openwa-engine
npm init -y
npm install express @openwa/wa-automate puppeteer dotenv cors axios redis uuid typescript @types/express @types/node ts-node ts-node-dev nodemon
npm install --save-dev ts-node typescript
```

### 2. Create TypeScript Config

```bash
cat > tsconfig.json << 'EOF'
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
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
EOF
```

### 3. Create .env File

```bash
cat > .env << 'EOF'
NODE_ENV=development
PORT=3500
API_KEY=dev-admin-key
SESSIONS_DIR=./sessions
REDIS_URL=redis://localhost:6379
CHROME_PATH=/usr/bin/chromium
LOG_LEVEL=debug
EOF
```

### 4. Create Project Structure

```bash
mkdir -p src/{routes,services,middleware,utils,config}
touch src/main.ts
touch src/services/session-manager.ts
touch src/routes/{sessions,messages,health,webhooks}.ts
touch src/middleware/{api-key,error-handler}.ts
```

### 5. Update package.json Scripts

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "jest"
  }
}
```

### 6. Start Development Server

```bash
npm run dev
# ✅ OpenWA Engine running on port 3500
```

---

## Phase 2: Backend Setup

### 1. Create NestJS Backend

```bash
cd ../backend
npm i -g @nestjs/cli
nest new . --package-manager npm
```

### 2. Install Dependencies

```bash
npm install \
  @nestjs/common @nestjs/core @nestjs/platform-express \
  @nestjs/jwt @nestjs/passport passport passport-jwt \
  @nestjs/typeorm typeorm pg \
  redis @nestjs/cache-manager cache-manager \
  @nestjs/bull bull \
  @nestjs/swagger swagger-ui-express \
  @nestjs/config dotenv \
  class-validator class-transformer \
  axios bcrypt helmet cors uuid joi

npm install --save-dev @types/express @types/node @types/bcrypt typescript ts-loader ts-node
```

### 3. Create .env File

```bash
cat > .env << 'EOF'
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://postgres:password@localhost:5432/notifytechai
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=notifytechai
DATABASE_USER=postgres
DATABASE_PASSWORD=password

REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRATION=7d

OPENWA_API_URL=http://localhost:3500
OPENWA_API_KEY=dev-admin-key

RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
EOF
```

### 4. Create Project Structure

```bash
mkdir -p src/{auth,tenants,users,sessions,messages,inbox,campaigns,contacts,analytics,billing,webhooks,notifications,common/{decorators,guards,interceptors,pipes,filters,services}}
mkdir -p src/database/{migrations}
```

### 5. Start Backend

```bash
npm run start:dev
# ✅ Backend running on port 3000
# 📚 Swagger docs available at http://localhost:3000/api/docs
```

---

## Phase 3: Frontend Setup

### 1. Create Next.js Frontend

```bash
cd ../frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-git
```

### 2. Install Dependencies

```bash
npm install \
  axios react-query zustand framer-motion socket.io-client \
  next-themes sonner date-fns recharts lucide-react \
  react-hook-form zod @hookform/resolvers

npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input select dialog sheet toast table tabs badge pagination form
```

### 3. Create .env.local

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
EOF
```

### 4. Create Project Structure

```bash
mkdir -p src/{app/{login,dashboard,sessions,inbox,campaigns,contacts,analytics,billing,team,settings},components/{layout,forms,cards,modals,inbox,common},hooks,services,store,types,lib,styles}
```

### 5. Start Frontend

```bash
npm run dev
# ✅ Frontend running on port 3000 (or next available port)
# Visit http://localhost:3001
```

---

## Docker Setup

### 1. Create docker-compose.yml

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
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

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  openwa-engine:
    build:
      context: ./openwa-engine
    environment:
      NODE_ENV: development
      PORT: 3500
      REDIS_URL: redis://redis:6379
    volumes:
      - ./openwa-engine/sessions:/app/sessions
    ports:
      - "3500:3500"
    depends_on:
      redis:
        condition: service_healthy

  backend:
    build:
      context: ./backend
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:password@postgres:5432/notifytechai
      REDIS_URL: redis://redis:6379
      OPENWA_API_URL: http://openwa-engine:3500
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
EOF
```

### 2. Start All Services

```bash
docker-compose up -d

# Check status
docker-compose ps
```

### 3. Run Database Migrations

```bash
docker-compose exec backend npm run typeorm migration:run
```

### 4. Verify Everything

```bash
# Check health
curl http://localhost:3000/health
curl http://localhost:3500/health

# Test OpenWA endpoint
curl -X POST http://localhost:3500/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-admin-key" \
  -d '{"tenantId": "test-tenant", "userId": "test-user"}'
```

---

## Database Setup

### 1. Create Database (Local Development)

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE notifytechai;

# Create user
CREATE USER notifytechai_user WITH PASSWORD 'secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE notifytechai TO notifytechai_user;

# Exit
\q
```

### 2. Initialize Migrations

```bash
cd backend
npm run typeorm migration:generate src/database/migrations/InitialSchema
npm run typeorm migration:run
```

---

## First Login

### 1. Create Tenant

```bash
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Tenant",
    "slug": "my-tenant"
  }'
```

### 2. Register User

```bash
curl -X POST http://localhost:3000/auth/tenants/my-tenant/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "password": "SecurePassword123!"
  }'
```

### 3. Login

```bash
curl -X POST http://localhost:3000/auth/tenants/my-tenant/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'
```

Response will include `accessToken`

### 4. Open Frontend

Visit `http://localhost:3001` and login with the credentials

---

## Development Workflow

### Working on OpenWA Engine

```bash
cd openwa-engine
npm run dev

# In another terminal
curl -X POST http://localhost:3500/api/sessions \
  -H "X-API-Key: dev-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "tenant-1", "userId": "user-1"}'
```

### Working on Backend

```bash
cd backend
npm run start:dev

# Watch logs
docker-compose logs -f backend
```

### Working on Frontend

```bash
cd frontend
npm run dev

# Visit http://localhost:3001
```

### Testing API Endpoints

```bash
# Get access token first
TOKEN=$(curl -s -X POST http://localhost:3000/auth/tenants/my-tenant/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "SecurePassword123!"}' \
  | jq -r '.accessToken')

# Use token in requests
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/sessions/tenants/my-tenant
```

---

## Environment Variables Quick Reference

### Development (.env files)

**openwa-engine/.env**
```
NODE_ENV=development
PORT=3500
API_KEY=dev-admin-key
REDIS_URL=redis://localhost:6379
SESSIONS_DIR=./sessions
```

**backend/.env**
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/notifytechai
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-key
OPENWA_API_URL=http://localhost:3500
OPENWA_API_KEY=dev-admin-key
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
```

---

## Common Issues & Fixes

### Issue: Port Already in Use
```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Issue: PostgreSQL Connection Failed
```bash
# Check PostgreSQL is running
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Issue: Redis Connection Error
```bash
# Check Redis
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### Issue: OpenWA Chrome Not Found
```bash
# Install Chromium
sudo apt-get install chromium-browser

# Or use system Chrome
export CHROME_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

---

## Testing the Complete Flow

### 1. Check All Services Are Running

```bash
docker-compose ps

# Should show all green ✅
```

### 2. Test OpenWA Connection

```bash
curl http://localhost:3500/health
# Response: {"status": "healthy", ...}
```

### 3. Test Backend API

```bash
curl http://localhost:3000/health
# Response: {"status": "healthy", ...}
```

### 4. Create WhatsApp Session

```bash
TOKEN="<your-access-token>"

curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Session 1"}'

# Should return session with QR code
```

### 5. Scan QR Code

Visit the sessions page in frontend and scan the QR code with WhatsApp

### 6. Send Test Message

```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<session-id>",
    "phoneNumber": "+1234567890",
    "message": "Test message"
  }'
```

---

## Next Steps

1. **Read Master Plan**: Review [NOTIFYTECHAI_MASTER_PLAN.md](NOTIFYTECHAI_MASTER_PLAN.md)
2. **Phase 1 Details**: Check [PHASE_1_OPENWA_SETUP.md](PHASE_1_OPENWA_SETUP.md)
3. **Phase 2 Details**: Check [PHASE_2_BACKEND.md](PHASE_2_BACKEND.md)
4. **Phase 3 Details**: Check [PHASE_3_FRONTEND.md](PHASE_3_FRONTEND.md)
5. **Auth System**: Read [AUTH_MULTITENANT_SYSTEM.md](AUTH_MULTITENANT_SYSTEM.md)
6. **Database**: Review [DATABASE_DESIGN.md](DATABASE_DESIGN.md)
7. **Features**: Check [MESSAGE_INBOX_CAMPAIGNS.md](MESSAGE_INBOX_CAMPAIGNS.md)
8. **Monitoring**: Review [ANALYTICS_WEBHOOKS_BILLING.md](ANALYTICS_WEBHOOKS_BILLING.md)
9. **Deployment**: Check [INFRASTRUCTURE_DEPLOYMENT.md](INFRASTRUCTURE_DEPLOYMENT.md)

---

## Documentation Files

| Document | Purpose |
|----------|---------|
| NOTIFYTECHAI_MASTER_PLAN.md | Project overview and architecture |
| PHASE_1_OPENWA_SETUP.md | OpenWA engine implementation |
| PHASE_2_BACKEND.md | NestJS backend setup |
| PHASE_3_FRONTEND.md | Next.js frontend implementation |
| AUTH_MULTITENANT_SYSTEM.md | Auth and tenant isolation |
| DATABASE_DESIGN.md | PostgreSQL schema design |
| MESSAGE_INBOX_CAMPAIGNS.md | Core features implementation |
| ANALYTICS_WEBHOOKS_BILLING.md | Advanced features |
| INFRASTRUCTURE_DEPLOYMENT.md | Docker, CI/CD, deployment |
| PROJECT_INITIALIZATION_QUICKSTART.md | This file |

---

## Support Resources

- **OpenWA Docs**: https://openwa.dev
- **NestJS Docs**: https://docs.nestjs.com
- **Next.js Docs**: https://nextjs.org/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs
- **Docker Docs**: https://docs.docker.com

---

✅ **You're ready to start building NotifyTechAI!**

**Questions? Review the relevant documentation or create an issue in the repository.**
