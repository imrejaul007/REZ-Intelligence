# REZ Intelligence Deployment Guide

**Version:** 1.0.0
**Last Updated:** May 12, 2026

---

## Overview

This guide covers deploying REZ Intelligence services using Docker and Render. All services follow the same deployment pattern with environment-specific configuration.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Docker | 20+ | Container runtime |
| Docker Compose | 2+ | Multi-container orchestration |
| Node.js | 18+ | Local development |
| MongoDB Atlas | 7+ | Database |
| Redis | 7+ | Caching |

---

## Docker Setup

### Dockerfile

Each service includes a Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV NODE_ENV=production
ENV PORT=4040

EXPOSE 4040

CMD ["node", "dist/index.js"]
```

### Building Images

```bash
# Build a single service
docker build -t rez-reorder-engine ./REZ-reorder-engine

# Build all Phase 1 services
docker build -t rez-reorder-engine ./REZ-reorder-engine
docker build -t rez-taste-profile ./REZ-taste-profile
docker build -t rez-demand-forecast ./REZ-demand-forecast
docker build -t rez-price-predictor ./REZ-price-predictor
```

### Docker Compose (Local Development)

```bash
# Start all services
docker-compose up -d

# View logs for a specific service
docker-compose logs -f rez-reorder-engine

# View all logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Docker Compose File

```yaml
version: '3.8'

services:
  # MongoDB
  mongodb:
    image: mongo:7
    container_name: rez-intelligence-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    networks:
      - rez-network

  # Redis
  redis:
    image: redis:7-alpine
    container_name: rez-intelligence-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - rez-network

  # Phase 1: Wedge Services
  rez-reorder-engine:
    build:
      context: ./REZ-reorder-engine
      dockerfile: Dockerfile
    container_name: rez-reorder-engine
    restart: unless-stopped
    ports:
      - "4040:4040"
    environment:
      - NODE_ENV=development
      - PORT=4040
      - MONGODB_URI=mongodb://mongodb:27017/rez_reorder
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-taste-profile:
    build:
      context: ./REZ-taste-profile
      dockerfile: Dockerfile
    container_name: rez-taste-profile
    restart: unless-stopped
    ports:
      - "4041:4041"
    environment:
      - NODE_ENV=development
      - PORT=4041
      - MONGODB_URI=mongodb://mongodb:27017/rez_taste
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-demand-forecast:
    build:
      context: ./REZ-demand-forecast
      dockerfile: Dockerfile
    container_name: rez-demand-forecast
    restart: unless-stopped
    ports:
      - "4042:4042"
    environment:
      - NODE_ENV=development
      - PORT=4042
      - MONGODB_URI=mongodb://mongodb:27017/rez_demand
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-price-predictor:
    build:
      context: ./REZ-price-predictor
      dockerfile: Dockerfile
    container_name: rez-price-predictor
    restart: unless-stopped
    ports:
      - "4043:4043"
    environment:
      - NODE_ENV=development
      - PORT=4043
      - MONGODB_URI=mongodb://mongodb:27017/rez_pricing
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  # Phase 2: Data Network
  rez-identity-graph:
    build:
      context: ./REZ-identity-graph
      dockerfile: Dockerfile
    container_name: rez-identity-graph
    restart: unless-stopped
    ports:
      - "4050:4050"
    environment:
      - NODE_ENV=development
      - PORT=4050
      - MONGODB_URI=mongodb://mongodb:27017/rez_identity
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-memory-engine:
    build:
      context: ./REZ-memory-engine
      dockerfile: Dockerfile
    container_name: rez-memory-engine
    restart: unless-stopped
    ports:
      - "4051:4051"
    environment:
      - NODE_ENV=development
      - PORT=4051
      - MONGODB_URI=mongodb://mongodb:27017/rez_memory
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-ai-router:
    build:
      context: ./REZ-ai-router
      dockerfile: Dockerfile
    container_name: rez-ai-router
    restart: unless-stopped
    ports:
      - "4052:4052"
    environment:
      - NODE_ENV=development
      - PORT=4052
      - MONGODB_URI=mongodb://mongodb:27017/rez_ai_router
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  # Phase 3: Intelligence Moat
  rez-knowledge-graph:
    build:
      context: ./REZ-knowledge-graph
      dockerfile: Dockerfile
    container_name: rez-knowledge-graph
    restart: unless-stopped
    ports:
      - "4060:4060"
    environment:
      - NODE_ENV=development
      - PORT=4060
      - MONGODB_URI=mongodb://mongodb:27017/rez_knowledge
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-merchant-brain:
    build:
      context: ./REZ-merchant-brain
      dockerfile: Dockerfile
    container_name: rez-merchant-brain
    restart: unless-stopped
    ports:
      - "4061:4061"
    environment:
      - NODE_ENV=development
      - PORT=4061
      - MONGODB_URI=mongodb://mongodb:27017/rez_merchant_brain
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-autonomous-agents:
    build:
      context: ./REZ-autonomous-agents
      dockerfile: Dockerfile
    container_name: rez-autonomous-agents
    restart: unless-stopped
    ports:
      - "4062:4062"
    environment:
      - NODE_ENV=development
      - PORT=4062
      - MONGODB_URI=mongodb://mongodb:27017/rez_agents
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  # Phase 4: Ecosystem
  rez-payments-brain:
    build:
      context: ./REZ-payments-brain
      dockerfile: Dockerfile
    container_name: rez-payments-brain
    restart: unless-stopped
    ports:
      - "4070:4070"
    environment:
      - NODE_ENV=development
      - PORT=4070
      - MONGODB_URI=mongodb://mongodb:27017/rez_payments_brain
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-inventory-sync:
    build:
      context: ./REZ-inventory-sync
      dockerfile: Dockerfile
    container_name: rez-inventory-sync
    restart: unless-stopped
    ports:
      - "4071:4071"
    environment:
      - NODE_ENV=development
      - PORT=4071
      - MONGODB_URI=mongodb://mongodb:27017/rez_inventory
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-creator-network:
    build:
      context: ./REZ-creator-network
      dockerfile: Dockerfile
    container_name: rez-creator-network
    restart: unless-stopped
    ports:
      - "4072:4072"
    environment:
      - NODE_ENV=development
      - PORT=4072
      - MONGODB_URI=mongodb://mongodb:27017/rez_creator
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

  rez-merchant-os:
    build:
      context: ./REZ-merchant-os
      dockerfile: Dockerfile
    container_name: rez-merchant-os
    restart: unless-stopped
    ports:
      - "4073:4073"
    environment:
      - NODE_ENV=development
      - PORT=4073
      - MONGODB_URI=mongodb://mongodb:27017/rez_merchant_os
      - REDIS_URL=redis://redis:6379
      - INTERNAL_SERVICE_TOKEN=dev-token-change-in-prod
    depends_on:
      - mongodb
      - redis
    networks:
      - rez-network

networks:
  rez-network:
    driver: bridge

volumes:
  mongodb_data:
  redis_data:
```

---

## Render Deployment

### render.yaml

Each service includes a render.yaml for Render deployment:

```yaml
services:
  - type: web
    name: rez-reorder-engine
    env: node
    region: singapore
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 4040
      - key: MONGODB_URI
        sync: false
      - key: REDIS_URL
        sync: false
      - key: INTERNAL_SERVICE_TOKEN
        sync: false
```

### Deploy Script

Use the provided deploy.sh script:

```bash
# Make it executable
chmod +x deploy.sh

# Deploy all services
./deploy.sh

# Deploy specific service
./deploy.sh rez-reorder-engine
```

### Render Environment Groups

Create environment groups in Render dashboard:

1. **REZ-Intelligence-Core**
   - MONGODB_URI
   - REDIS_URL
   - INTERNAL_SERVICE_TOKEN

2. **REZ-Intelligence-AI**
   - ANTHROPIC_API_KEY
   - OPENAI_API_KEY
   - GOOGLE_API_KEY

3. **REZ-Intelligence-Payments**
   - RAZORPAY_KEY_ID
   - RAZORPAY_KEY_SECRET
   - RAZORPAY_WEBHOOK_SECRET

4. **REZ-Intelligence-Voice**
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_PHONE_NUMBER
   - ELEVENLABS_API_KEY

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/rez_intelligence` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `INTERNAL_SERVICE_TOKEN` | Service-to-service auth token | `your-secure-random-token` |

### AI Services (Optional)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `PINECONE_API_KEY` | Pinecone vector DB key |

### Payment Services (Optional)

| Variable | Description |
|----------|-------------|
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature secret |

### Voice Services (Optional)

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS API key |

### Service Ports

| Variable | Default | Service |
|----------|---------|---------|
| `PORT` | varies | Service HTTP port |

### Phase 1 Ports

| Variable | Default |
|----------|---------|
| `PORT_REORDER` | 4040 |
| `PORT_TASTE` | 4041 |
| `PORT_DEMAND` | 4042 |
| `PORT_PRICE` | 4043 |

### Phase 2 Ports

| Variable | Default |
|----------|---------|
| `PORT_IDENTITY` | 4050 |
| `PORT_MEMORY` | 4051 |
| `PORT_AI_ROUTER` | 4052 |

### Phase 3 Ports

| Variable | Default |
|----------|---------|
| `PORT_KNOWLEDGE` | 4060 |
| `PORT_MERCHANT_BRAIN` | 4061 |
| `PORT_AGENTS` | 4062 |

### Phase 4 Ports

| Variable | Default |
|----------|---------|
| `PORT_PAYMENTS_BRAIN` | 4070 |
| `PORT_INVENTORY_SYNC` | 4071 |
| `PORT_CREATOR_NETWORK` | 4072 |
| `PORT_MERCHANT_OS` | 4073 |

---

## Health Checks

### Endpoint

All services expose `/health` endpoint:

```bash
curl https://rez-reorder-engine.onrender.com/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-12T10:30:00.000Z"
}
```

### Readiness Check

For detailed readiness including dependencies:

```bash
curl https://rez-reorder-engine.onrender.com/ready
```

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true
  }
}
```

### Render Health Check Configuration

In render.yaml:
```yaml
healthCheckPath: /health
```

### Circuit Breaker Health

Check circuit breaker status:

```bash
curl https://rez-intent-graph.onrender.com/api/services/circuit-breaker/status
```

**Response:**
```json
{
  "services": [
    { "name": "wallet", "status": "closed", "failures": 0 },
    { "name": "order", "status": "open", "failures": 5 },
    { "name": "notification", "status": "closed", "failures": 0 }
  ]
}
```

---

## Monitoring

### Metrics Endpoint

```bash
curl https://rez-intelligence-hub.onrender.com/api/monitoring/metrics
```

### Prometheus Export

```bash
curl https://rez-intelligence-hub.onrender.com/api/monitoring/metrics/export
```

### Dashboard Metrics

```bash
curl https://rez-intelligence-hub.onrender.com/api/monitoring/dashboard
```

**Response:**
```json
{
  "timestamp": 1746092400000,
  "uptime": 172800,
  "system": {
    "memoryUsageMB": 128.45,
    "sharedMemoryEntries": 1542
  },
  "intents": {
    "captured": 15420,
    "dormant": 342,
    "fulfilled": 890
  },
  "nudges": {
    "sent": 1234,
    "delivered": 1180,
    "clicked": 156,
    "converted": 45,
    "conversionRate": 3.65
  },
  "agents": {
    "totalRuns": 890,
    "successRate": 94.5,
    "avgDuration": 234
  }
}
```

### Alerts

```bash
# Get active alerts
curl https://rez-intelligence-hub.onrender.com/api/monitoring/alerts

# Get alert history
curl https://rez-intelligence-hub.onrender.com/api/monitoring/alerts/history?limit=100
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] MongoDB Atlas cluster accessible
- [ ] Redis instance available
- [ ] AI API keys configured (if using AI features)
- [ ] Internal service token generated (strong random string)

### Deployment Steps

1. **Build Phase**
   ```bash
   # Local build test
   docker-compose build
   ```

2. **Service Deployment**
   ```bash
   # Deploy via script
   ./deploy.sh
   
   # Or manual Render deploy
   render deploy --service rez-reorder-engine
   ```

3. **Health Verification**
   ```bash
   # Check all services
   curl https://rez-reorder-engine.onrender.com/health
   curl https://rez-taste-profile.onrender.com/health
   curl https://rez-demand-forecast.onrender.com/health
   curl https://rez-price-predictor.onrender.com/health
   ```

4. **Integration Test**
   ```bash
   # Run smoke tests
   curl -X POST https://rez-intent-graph.onrender.com/api/intent/capture \
     -H "X-Internal-Token: $INTERNAL_SERVICE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId":"test_user","category":"TRAVEL","intentKey":"test"}'
   ```

### Post-Deployment

- [ ] Verify all health checks pass
- [ ] Check monitoring dashboard
- [ ] Verify internal service communication
- [ ] Test webhook endpoints
- [ ] Verify agent execution

---

## Rollback Procedure

### Docker Rollback

```bash
# Stop current containers
docker-compose down

# Rollback to previous version
docker-compose pull
docker-compose up -d

# Verify
docker-compose logs -f
```

### Render Rollback

1. Go to Render Dashboard
2. Select the service
3. Go to Deployments tab
4. Click "Redeploy" on a previous successful deployment

### Database Rollback

```bash
# Restore from backup
mongorestore --uri="mongodb+srv://..." --backup=/path/to/backup
```

---

## Troubleshooting

### Service Won't Start

1. Check logs: `docker-compose logs <service-name>`
2. Verify environment variables
3. Check MongoDB/Redis connectivity

### High Latency

1. Check circuit breaker status
2. Review Redis cache hit rates
3. Check MongoDB query performance
4. Review agent execution times

### Agent Failures

1. Check agent status: `GET /api/agent/tools`
2. Review agent logs
3. Verify AI API keys
4. Check circuit breaker for external services

### Webhook Failures

1. Verify webhook signatures
2. Check timestamp validity (5-minute window)
3. Review Redis replay prevention

---

## Performance Tuning

### Docker Resource Limits

```yaml
services:
  rez-reorder-engine:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Connection Pooling

MongoDB connections are pooled by default. Adjust via MONGODB_URI:
```
mongodb+srv://user:pass@cluster.mongodb.net/rez?maxPoolSize=50&minPoolSize=10
```

### Redis Optimization

```bash
# Set max memory
redis-cli config set maxmemory 256mb

# Enable AOF persistence
redis-cli config set appendonly yes
```

---

## Security Considerations

### Never Commit Secrets

- Use environment variables only
- Never commit .env files
- Use Render environment groups

### Network Security

- All internal traffic uses X-Internal-Token
- Webhook signatures verified via HMAC-SHA256
- CORS configured for allowed origins only

### Monitoring Security

- Monitor authentication failures
- Set up alerts for unusual patterns
- Review access logs regularly

---

## Appendix: Service URLs

### Production Endpoints

```
WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com
ORDER_SERVICE_URL=https://rez-order-service-hz18.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
MERCHANT_SERVICE_URL=https://rez-merchant-service-n3q2.onrender.com
NOTIFICATION_SERVICE_URL=https://rez-notification-events-mwdz.onrender.com
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
REZ_INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com
```

### Internal Service Token

The INTERNAL_SERVICE_TOKEN must be shared across all services for inter-service communication. Generate using:

```bash
openssl rand -hex 32
```
