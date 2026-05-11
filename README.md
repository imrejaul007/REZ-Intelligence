# REZ-Intelligence

**Company:** REZ-Intelligence  
**Purpose:** AI/ML Services - THE MOAT of the REZ ecosystem  
**GitHub:** https://github.com/imrejaul007/REZ-Intelligence

---

## Overview

REZ Intelligence is an AI-powered commerce operating system that provides:

- **Repeat Commerce Intelligence** - Reorder prediction, taste profiling, demand forecasting
- **Data Network** - Unified identity, persistent memory, AI routing
- **Intelligence Moat** - Knowledge graphs, merchant brain, autonomous agents
- **Ecosystem** - Payments, inventory, creator network, merchant OS

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: ECOSYSTEM │ Phases 1-4 │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ REZ-merchant-os (4073) │ REZ-creator-network (4072) │ │
│ │ Merchant SaaS Dashboard │ Creator Intelligence │ │
│ │ AI Insights │ Campaign Matching │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ REZ-payments-brain (4070) │ REZ-inventory-sync (4071) │ │
│ │ Fraud Detection │ Inventory Predictions │ │
│ │ Payment Optimization │ POS Sync │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ PHASE 3: INTELLIGENCE MOAT │ │
│ │ │ │
│ │ REZ-knowledge-graph (4060) │ REZ-merchant-brain (4061) │ │
│ │ Semantic Entities │ Merchant Forecasting │ │
│ │ │ │
│ │ REZ-autonomous-agents (4062) │ │
│ │ 8 AI Agents │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ PHASE 2: DATA NETWORK │ │
│ │ │ │
│ │ REZ-identity-graph (4050) │ REZ-memory-engine (4051) │ │
│ │ Unified Identity │ AI Memory │ │
│ │ │ │
│ │ REZ-ai-router (4052) │ │
│ │ Multi-Provider AI │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ PHASE 1: WEDGE (Repeat Commerce) │ │
│ │ │ │
│ │ REZ-reorder-engine (4040) │ REZ-taste-profile (4041) │ │
│ │ Cross-category Reorders │ Consumer Preferences │ │
│ │ │ │
│ │ REZ-demand-forecast (4042) │ REZ-price-predictor (4043) │ │
│ │ Demand Prediction │ Dynamic Pricing │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ SHARED INFRASTRUCTURE │ │
│ │ │ │
│ │ shared/logger.js │ Shared Winston logging │ │
│ │ shared/errorHandler.js │ Error classes + middleware │ │
│ │ shared/schemas.js │ Zod validation schemas │ │
│ │ shared/circuitBreaker.js │ Resilience pattern │ │
│ │ shared/rateLimiter.js │ Rate limiting │ │
│ │ shared/securityMiddleware.js │ Helmet, SSRF, sanitization │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Services (47 Total)

### Phase 1: Repeat Commerce Wedge
| Port | Service | Description |
|------|---------|-------------|
| 4040 | REZ-reorder-engine | Predict & trigger reorders |
| 4041 | REZ-taste-profile | Consumer preference intelligence |
| 4042 | REZ-demand-forecast | Merchant demand prediction |
| 4043 | REZ-price-predictor | Dynamic pricing optimization |

### Phase 2: Data Network
| Port | Service | Description |
|------|---------|-------------|
| 4050 | REZ-identity-graph | Unified user identity |
| 4051 | REZ-memory-engine | Persistent AI memory |
| 4052 | REZ-ai-router | Multi-provider AI routing |

### Phase 3: Intelligence Moat
| Port | Service | Description |
|------|---------|-------------|
| 4060 | REZ-knowledge-graph | Semantic entity relationships |
| 4061 | REZ-merchant-brain | Merchant intelligence |
| 4062 | REZ-autonomous-agents | 8 autonomous AI agents |

### Phase 4: Ecosystem
| Port | Service | Description |
|------|---------|-------------|
| 4070 | REZ-payments-brain | Fraud detection & payment optimization |
| 4071 | REZ-inventory-sync | Real-time inventory sync |
| 4072 | REZ-creator-network | Creator/influencer intelligence |
| 4073 | REZ-merchant-os | Merchant SaaS dashboard |

### Existing Services
| Service | Description |
|---------|-------------|
| REZ-action-engine | Decision execution layer |
| REZ-attribution-system | Marketing attribution |
| REZ-creative-engine | Ad copy generation |
| REZ-personalization-engine | User DNA profiles |
| REZ-recommendation-engine | Multi-strategy recommendations |
| REZ-targeting-engine | Ad targeting |
| rez-intent-graph | Intent knowledge graph |
| REZ-support-copilot | Support AI copilot |
| REZ-cdp-service | Customer Data Platform |
| REZ-insights-service | AI-generated insights |
| REZ-event-platform | Event publishing |
| REZ-event-bus | Event bus |
| REZ-audit-logging | Audit logging |
| REZ-observability-system | Logging, metrics, traces |

---

## Quick Start

### Docker Compose (Recommended)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f rez-reorder-engine

# Stop all services
docker-compose down
```

### Individual Service
```bash
cd REZ-reorder-engine
npm install
npm start
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `INTERNAL_SERVICE_TOKEN` | Service-to-service auth | Yes |
| `ANTHROPIC_API_KEY` | Claude API key | For AI Router |
| `OPENAI_API_KEY` | OpenAI API key | For AI Router |
| `PORT` | Service port | No (default varies) |

---

## API Authentication

All endpoints (except `/health` and `/ready`) require:
```
X-Internal-Token: your-internal-token
```

---

## The 8 Autonomous Agents

| Agent | Schedule | Purpose |
|-------|----------|---------|
| DemandSignalAgent | Every 5 min | Aggregate demand |
| ScarcityAgent | Every 1 min | Supply/demand ratios |
| PersonalizationAgent | Event-driven | User profiling |
| AttributionAgent | Event-driven | Multi-touch attribution |
| AdaptiveScoringAgent | Hourly | ML retraining |
| FeedbackLoopAgent | Event-driven | Drift detection |
| NetworkEffectAgent | Daily | Collaborative filtering |
| RevenueAttributionAgent | Every 15 min | GMV tracking |

---

## The Compounding Moat

```
Every QR Scan ──► Event ──► DemandSignal Agent ──► Insight
 │
Every Order ──► Taste Profile ──► Personalization ──► Better Recs
 │
Every Payment ──► Identity Graph ──► Unified User ──► Cross-app Intelligence
 │
Every Interaction ──► Memory ──► AI Copilot ──► Personalized Responses
```

---

## Dependencies

- RABTUL-Technologies (Data, Events)
- OpenAI, Anthropic, Google AI
- MongoDB Atlas
- Redis
- Pinecone (Vector database)

---

## Deployment

- **Render:** All services deployable via render.yaml
- **Docker:** docker-compose.yml for local development
- **AWS:** ML training infrastructure

---

## Last Updated

May 12, 2026
