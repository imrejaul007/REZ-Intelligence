# REZ-Intelligence Developer Guide

**Version:** 5.0
**Updated:** June 4, 2026
**Status:** ACTIVE - Naming standards enforced

---

## OVERVIEW

**REZ-Intelligence** is the AI/ML platform for the REZ ecosystem. It provides:
- Intent prediction and user intelligence
- Recommendation and personalization engines
- 11 Expert Domain Agents (Hospitality, Health, Retail, etc.)
- 16 MCP Servers for tool access
- 263+ microservices

**Company:** HOJAI-AI (AI Infrastructure parent)
**Independent:** Yes - operates independently from RABTUL-Technologies

---

## CRITICAL: Naming Conventions

### MUST use `rez-` prefix (lowercase)

All new services MUST use lowercase `rez-` prefix. This is MANDATORY.

```bash
# CORRECT
rez-event-bus
rez-intent-predictor
rez-ml-models

# WRONG - Will be rejected
REZ-event-bus
REZ-Intent-Predictor
```

See `NAMING-STANDARDS.md` for full migration plan.

---

## Quick Start

### Start All Services
```bash
./start-all.sh
```

### Start Specific Service
```bash
cd rez-event-bus && npm start
```

### Environment Variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

---

## Service Categories

### 1. AI Agents & Autonomy (10 services)

| Service | Port | Purpose |
|---------|------|---------|
| rez-ai-orchestrator | 4101 | Multi-agent coordination |
| rez-autonomous-agents | 4062 | 8 self-learning agents |
| rez-ai-router | 4052 | Intent routing |
| rez-orchestrator-v2 | 4170 | Enhanced orchestration |
| rez-agent-registry | - | Agent discovery |

### 2. Expert Domain Agents (11 services)

| Service | Port | Domain |
|---------|------|--------|
| rez-hospitality-expert | 3000 | Hotels |
| rez-travel-expert | 3003 | Travel |
| rez-retail-expert | 3004 | Retail |
| rez-salon-expert | 3005 | Beauty |
| rez-education-expert | 3006 | Education |
| rez-fitness-expert | 3010 | Fitness |
| rez-health-expert | 3011 | Healthcare |
| rez-culinary-expert | - | Food |
| rez-real-estate-expert | 3013 | Real Estate |
| rez-finance-expert | 3014 | Finance |
| rez-logistics-expert | 3015 | Logistics |

### 3. Prediction & ML (15 services)

| Service | Port | Purpose |
|---------|------|---------|
| rez-ml-models | - | Production ML models |
| rez-ml-engine | - | Training & inference |
| rez-ml-feature-store | 3005 | Feature serving |
| rez-ml-model-registry | - | Model versioning |
| rez-predictive-engine | 4123 | Churn, LTV prediction |
| rez-intent-predictor | 4018 | Intent prediction |
| rez-demand-forecast | - | Demand forecasting |
| rez-reinforcement-optimizer | 4147 | RL bandits |

### 4. Customer Intelligence (12 services)

| Service | Port | Purpose |
|---------|------|---------|
| rez-identity-graph | 4050 | Cross-platform identity |
| rez-unified-profile | 4120 | Customer profile |
| rez-memory-layer | 4201 | Customer timeline |
| rez-customer-360 | - | 360 view |
| rez-context-engine | - | Session context |

### 5. MCP Servers (16 services)

| Service | Purpose |
|---------|---------|
| rez-mcp-event-bus | Event subscriptions |
| rez-mcp-analytics | Analytics queries |
| rez-mcp-identity | Identity lookups |
| rez-mcp-payment | Payment operations |
| rez-mcp-order | Order management |
| rez-mcp-notification | Notifications |
| rez-mcp-inventory | Inventory |
| rez-mcp-agent-invoke | Agent execution |

### 6. Communication (8 services)

| Service | Port | Purpose |
|---------|------|---------|
| rez-whatsapp | 4202 | WhatsApp commerce |
| rez-sms-bridge | - | SMS integration |
| rez-email-bridge | - | Email integration |
| rez-rcs-bridge | 4140 | RCS messaging |
| rez-notification-router | - | Multi-channel routing |

---

## Port Registry

| Port | Service |
|------|---------|
| 3000 | rez-hospitality-expert |
| 3003 | rez-travel-expert |
| 3004 | rez-retail-expert |
| 3005 | rez-salon-expert |
| 3006 | rez-education-expert |
| 3010 | rez-fitness-expert |
| 3011 | rez-health-expert |
| 3013 | rez-real-estate-expert |
| 3014 | rez-finance-expert |
| 3015 | rez-logistics-expert |
| 4000 | rez-api-gateway |
| 4017 | rez-recommendation-engine |
| 4018 | rez-intent-predictor |
| 4030 | rez-feature-flags |
| 4033 | rez-support-copilot |
| 4050 | rez-identity-graph |
| 4051 | rez-memory-engine |
| 4062 | rez-autonomous-agents |
| 4082 | rez-event-bus |
| 4101 | rez-ai-orchestrator |
| 4121 | rez-signal-aggregator |
| 4122 | rez-merchant-intelligence |
| 4123 | rez-predictive-engine |
| 4200 | rez-flow-runtime |
| 4201 | rez-memory-layer |
| 4202 | rez-whatsapp |

---

## Adding a New Service

### 1. Create Service Directory
```bash
mkdir rez-my-new-service
cd rez-my-new-service
```

### 2. Initialize Package
```bash
npm init -y
npm install express mongoose winston cors helmet
npm install -D typescript @types/node
```

### 3. Create Structure
```
rez-my-new-service/
├── src/
│   ├── index.ts          # Entry point
│   ├── routes/
│   ├── services/
│   └── types/
├── package.json
├── tsconfig.json
└── README.md
```

### 4. Follow Naming Rules
- Directory: `rez-{service-name}` (lowercase)
- Package: `@rez-ecosystem/rez-{service-name}`
- Import prefix: `rez-{service-name}`

### 5. Add to Documentation
- Update COMPREHENSIVE-SERVICE-INDEX.md
- Update SOT.md
- Add SPEC.md with API documentation

---

## Integration with Other Companies

### RABTUL-Technologies (Auth, Wallet, Payment)
```bash
AUTH_SERVICE_URL=http://localhost:4002
WALLET_SERVICE_URL=http://localhost:4004
PAYMENT_SERVICE_URL=http://localhost:4001
```

### KHAIRMOVE (Mobility)
```bash
RIDE_SERVICE_URL=http://localhost:4500
```

### AdBazaar (Marketing)
```bash
DOOH_SERVICE_URL=http://localhost:4600
```

---

## ML Models

### Available Models

| Model | File | Purpose |
|-------|------|---------|
| FraudModel | `rez-ml-models/src/models/fraudModel.ts` | Pattern fraud |
| RecommendationEngine | `rez-ml-models/src/models/recommendationEngine.ts` | Recommendations |
| PriceOptimization | `rez-ml-models/src/models/priceOptimization.ts` | Dynamic pricing |
| BanditModel | `REZ-rl-learning/src/models/banditModel.ts` | Reinforcement learning |
| LifeStoryEngine | `REZ-life-story-engine/src/services/storyService.ts` | NLP story |

---

## Security

### Internal Communication
```typescript
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
headers: { 'X-Internal-Token': INTERNAL_TOKEN }
```

### Rate Limiting
Apply rate limiting to all public endpoints.

### Circuit Breakers
Use circuit breakers for external service calls.

---

## Testing

### Run All Tests
```bash
npm test
```

### Run Integration Tests
```bash
npm run test:integration
```

### Run E2E Tests
```bash
cd rez-e2e-tests && npm test
```

---

## Deployment

### Build All Services
```bash
./build-all-services.sh
```

### Deploy to Docker
```bash
docker-compose up -d
```

### Check Status
```bash
curl http://localhost:4000/health
```

---

## Key Documentation Files

| File | Purpose |
|------|---------|
| `NAMING-STANDARDS.md` | Naming conventions and migration |
| `COMPREHENSIVE-SERVICE-INDEX.md` | Complete service catalog |
| `SOT.md` | Source of truth |
| `PORT-REGISTRY.md` | Port assignments |
| `SERVICE-DEPENDENCIES.md` | Dependency graph |

---

## Common Patterns

### Service Template
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@rez-ecosystem/rez-shared';

const logger = createLogger('my-service');
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/health/live', (req, res) => {
  res.json({ status: 'alive' });
});

app.get('/health/ready', (req, res) => {
  // Check dependencies
  res.json({ status: 'ready' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Service started on port ${PORT}`);
});
```

### Event Bus Integration
```typescript
import { EventBus } from 'rez-event-bus';

// Subscribe to events
EventBus.subscribe('order.completed', async (event) => {
  logger.info('Order completed', { orderId: event.orderId });
});

// Publish events
EventBus.publish('user.created', { userId: '123' });
```

---

**Last Updated:** June 4, 2026
**Version:** 5.0
