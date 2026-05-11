# REZ Intelligence Architecture

**Version:** 1.0.0
**Last Updated:** May 12, 2026
**Purpose:** AI/ML Services Platform - THE MOAT of the REZ ecosystem

---

## Executive Summary

REZ Intelligence is an AI-powered commerce operating system that transforms raw user interactions into actionable intelligence. Built on a four-phase architecture, it provides Repeat Commerce Intelligence, a Data Network, an Intelligence Moat, and an Ecosystem layer.

**Key Capabilities:**
- **Intent Tracking**: Capture, analyze, and revive dormant purchase intents across hotel, restaurant, and retail apps
- **Autonomous Agents**: 8 AI agents continuously optimizing commerce decisions
- **Personalization**: User DNA profiles with cross-app taste profiling
- **Merchant Intelligence**: Demand forecasting, procurement signals, and pricing optimization

**Technical Stack:**
- Node.js microservices with TypeScript
- MongoDB Atlas for persistence
- Redis for caching and shared memory
- Anthropic Claude and OpenAI for AI capabilities
- Docker and Render for deployment

---

## System Overview

```
+=========================================================================+
|                      REZ INTELLIGENCE PLATFORM                          |
+=========================================================================+
|                                                                          |
|  +-------------------------------------------------------------------+  |
|  | PHASE 4: ECOSYSTEM                                               |  |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |  | REZ-merchant-os   |    | REZ-creator-     |                   |  |
|  |  | (4073)            |    | network (4072)    |                   |  |
|  |  | Merchant SaaS     |    | Creator Intelli- |                   |  |
|  |  | AI Insights       |    | gence, Campaign  |                   |  |
|  |  |                   |    | Matching         |                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |                                                                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |  | REZ-payments-     |    | REZ-inventory-   |                   |  |
|  |  | brain (4070)      |    | sync (4071)       |                   |  |
|  |  | Fraud Detection   |    | Real-time        |                   |  |
|  |  | Payment Optim.   |    | Inventory Sync   |                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                          |
|  +-------------------------------------------------------------------+  |
|  | PHASE 3: INTELLIGENCE MOAT                                       |  |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |  | REZ-knowledge-    |    | REZ-merchant-    |                   |  |
|  |  | graph (4060)      |    | brain (4061)      |                   |  |
|  |  | Semantic Entities |    | Merchant Fore-   |                   |  |
|  |  | Entity Relations  |    | casting          |                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |                                                                   |  |
|  |  +-------------------------------------------------------+       |  |
|  |  | REZ-autonomous-agents (4062)                          |       |  |
|  |  | 8 AI Agents: Demand, Scarcity, Personalization,       |       |  |
|  |  | Attribution, Adaptive Scoring, Feedback, Network,     |       |  |
|  |  | Revenue Attribution                                    |       |  |
|  |  +-------------------------------------------------------+       |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                          |
|  +-------------------------------------------------------------------+  |
|  | PHASE 2: DATA NETWORK                                             |  |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |  | REZ-identity-     |    | REZ-memory-      |                   |  |
|  |  | graph (4050)      |    | engine (4051)     |                   |  |
|  |  | Unified Identity  |    | AI Memory         |                   |  |
|  |  | Cross-app User ID |    | Persistent Context|                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |                                                                   |  |
|  |  +-------------------+                                            |  |
|  |  | REZ-ai-router     |                                            |  |
|  |  | (4052)            |                                            |  |
|  |  | Multi-Provider AI |                                            |  |
|  |  +-------------------+                                            |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                          |
|  +-------------------------------------------------------------------+  |
|  | PHASE 1: WEDGE (Repeat Commerce)                                  |  |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |  | REZ-reorder-      |    | REZ-taste-       |                   |  |
|  |  | engine (4040)     |    | profile (4041)     |                   |  |
|  |  | Cross-category    |    | Consumer Prefs    |                   |  |
|  |  | Reorders          |    | User DNA          |                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |                                                                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |  | REZ-demand-       |    | REZ-price-       |                   |  |
|  |  | forecast (4042)   |    | predictor (4043)  |                   |  |
|  |  | Demand Prediction |    | Dynamic Pricing  |                   |  |
|  |  +-------------------+    +-------------------+                   |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                          |
|  +-------------------------------------------------------------------+  |
|  | SHARED INFRASTRUCTURE                                             |  |
|  +-------------------------------------------------------------------+  |
|  |                                                                   |  |
|  |  shared/logger.js          | Winston JSON logging                 |  |
|  |  shared/errorHandler.js   | Error classes + middleware            |  |
|  |  shared/schemas.js        | Zod validation schemas                |  |
|  |  shared/circuitBreaker.js | Resilience pattern                    |  |
|  |  shared/rateLimiter.js    | Rate limiting                         |  |
|  |  shared/securityMiddleware.js | Helmet, SSRF, sanitization         |  |
|  |                                                                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                          |
+=========================================================================+

                          EXTERNAL DEPENDENCIES
+=========================================================================+
|  +-------------+  +-------------+  +-------------+  +-------------+    |
|  | MongoDB     |  | Redis       |  | Anthropic   |  | OpenAI      |    |
|  | Atlas       |  | 7           |  | Claude API  |  | GPT-4       |    |
|  +-------------+  +-------------+  +-------------+  +-------------+    |
|  +-------------+  +-------------+  +-------------+                      |
|  | Pinecone    |  | RABTUL-     |  | Render      |                      |
|  | (Vectors)   |  | Technologies|  | (Hosting)   |                      |
|  +-------------+  +-------------+  +-------------+                      |
+=========================================================================+
```

---

## Service Inventory

### Phase 1: Repeat Commerce Wedge

| Port | Service | Description | Database |
|------|---------|-------------|----------|
| 4040 | REZ-reorder-engine | Predict & trigger reorders | MongoDB |
| 4041 | REZ-taste-profile | Consumer preference intelligence | MongoDB |
| 4042 | REZ-demand-forecast | Merchant demand prediction | MongoDB |
| 4043 | REZ-price-predictor | Dynamic pricing optimization | MongoDB |

### Phase 2: Data Network

| Port | Service | Description | Database |
|------|---------|-------------|----------|
| 4050 | REZ-identity-graph | Unified user identity | MongoDB |
| 4051 | REZ-memory-engine | Persistent AI memory | MongoDB + Redis |
| 4052 | REZ-ai-router | Multi-provider AI routing | MongoDB |

### Phase 3: Intelligence Moat

| Port | Service | Description | Database |
|------|---------|-------------|----------|
| 4060 | REZ-knowledge-graph | Semantic entity relationships | MongoDB + Pinecone |
| 4061 | REZ-merchant-brain | Merchant intelligence | MongoDB |
| 4062 | REZ-autonomous-agents | 8 autonomous AI agents | MongoDB |

### Phase 4: Ecosystem

| Port | Service | Description | Database |
|------|---------|-------------|----------|
| 4070 | REZ-payments-brain | Fraud detection & payment optimization | MongoDB |
| 4071 | REZ-inventory-sync | Real-time inventory sync | MongoDB |
| 4072 | REZ-creator-network | Creator/influencer intelligence | MongoDB |
| 4073 | REZ-merchant-os | Merchant SaaS dashboard | MongoDB |

### Supporting Services

| Service | Description |
|---------|-------------|
| REZ-action-engine | Decision execution layer |
| REZ-attribution-system | Marketing attribution |
| REZ-creative-engine | Ad copy generation |
| REZ-personalization-engine | User DNA profiles |
| REZ-recommendation-engine | Multi-strategy recommendations |
| REZ-targeting-engine | Ad targeting |
| REZ-cdp-service | Customer Data Platform |
| REZ-insights-service | AI-generated insights |
| REZ-event-platform | Event publishing |
| REZ-event-bus | Event bus |
| REZ-audit-logging | Audit logging |
| REZ-observability-system | Logging, metrics, traces |
| REZ-experimentation-engine | A/B testing |
| REZ-ab-testing-service | Experiment management |
| REZ-feature-flags | Feature flag service |
| REZ-event-connector | Event ingestion |
| REZ-ledger-service | Financial ledger |
| REZ-stream-processing | Stream processing |
| REZ-data-governance | Data governance |
| REZ-error-intelligence | Error tracking |
| REZ-real-time-decision-engine | Real-time decisions |
| rez-intelligence-hub | Central intelligence hub |
| rez-intent-predictor | Intent prediction |
| rez-intent-graph | Intent knowledge graph |
| REZ-support-copilot | Support AI copilot |
| REZ-consumer-copilot | Consumer AI copilot |
| rez-ai-platform | AI platform services |
| rez-ai-plugins | AI plugin system |
| rez-ai-voice | Voice AI |
| rez-aggregator-hub | Data aggregation |
| rez-customer-360 | 360-degree customer view |
| rez-ml-engine | ML engine |
| rez-ml-feature-store | Feature store |
| rez-ml-model-registry | Model registry |
| rez-ml-models | ML models |
| REZ-MIND-CLIENT | Client SDK |

---

## Data Flow Diagrams

### Intent Capture Flow

```
+=========================================================================+
|                         INTENT CAPTURE FLOW                             |
+=========================================================================+
|                                                                          |
|  Consumer Apps                      REZ Intelligence                    |
|  +-----------+                     +------------------+                 |
|  | Hotel OTA |                     |                  |                 |
|  +-----------+                     | IntentCapture    |                 |
|       |                            | Service          |                 |
|       | Hotel Search               |                  |                 |
|       |---------------------------->|                  |                 |
|       |                            +--------+---------+                 |
|       |                                      |                           |
|  +-----------+                              |                           |
|  | Restaurant|                              v                           |
|  |     App   |                     +------------------+                 |
|  +-----------+                     |    MongoDB       |                 |
|       |                            |    intents       |                 |
|       | Restaurant View            |    collection    |                 |
|       |---------------------------->                  |                 |
|       |                            +------------------+                 |
|       |                                      |                           |
|  +-----------+                              |                           |
|  |  Retail   |                              v                           |
|  |     App   |                     +------------------+                 |
|  +-----------+                     |   DemandSignal   |                 |
|       |                            |   Agent          |                 |
|       | Product View               |   (5 min cycle) |                 |
|       |---------------------------->                  |                 |
|       |                            +------------------+                 |
|                                                                          |
+=========================================================================+
```

### Dormant Intent Revival Flow

```
+=========================================================================+
|                    DORMANT INTENT REVIVAL FLOW                         |
+=========================================================================+
|                                                                          |
|  Intent Activity                                                        |
|       |                                                                 |
|       v                                                                 |
|  +---------+     No activity     +-------------+                       |
|  |  ACTIVE | --------------------> |   DORMANT   |                      |
|  +---------+     7+ days          +------+------+                       |
|                                          |                              |
|                                          v                              |
|                                 +-----------------+                   |
|                                 | Calculate       |                   |
|                                 | Revival Score   |                   |
|                                 +--------+--------+                   |
|                                          |                              |
|                                          v                              |
|                                 +-----------------+                   |
|                                 | Score >= 0.3?  |---No---> Wait       |
|                                 +--------+--------+                     |
|                                          |Yes                           |
|                                          v                              |
|                                 +-----------------+                   |
|                                 | Queue Nudge     |                   |
|                                 | Job             |                   |
|                                 +--------+--------+                   |
|                                          |                              |
|                                          v                              |
|                                 +-----------------+                   |
|                                 | Deliver via     |                   |
|                                 | Push/Email/SMS  |                   |
|                                 +--------+--------+                   |
|                                          |                              |
|           +------------------------------+------------------------------+
|           |                              |                              |
|           v                              v                              |
|      +---------+                    +---------+                        |
|      |CONVERTED|                   |DECLINED |                        |
|      +---------+                    +---------+                        |
|                                                                          |
+=========================================================================+
```

### Agent Swarm Flow

```
+=========================================================================+
|                         AGENT SWARM FLOW                                |
+=========================================================================+
|                                                                          |
|                         +------------------+                           |
|                         |  Swarm           |                           |
|                         |  Coordinator     |                           |
|                         +--------+---------+                           |
|                                  |                                       |
|          +---------+----------+----------+---------+                    |
|          |         |          |          |         |                     |
|          v         v          v          v         v                     |
|    +---------+ +---------+ +---------+ +---------+ +---------+           |
|    | Demand  | |Scarcity | | Perso-  | | Attri-  | |Adaptive |           |
|    | Signal  | |         | | nalize  | | bution  | | Scoring |           |
|    | Agent  | | Agent   | | Agent   | | Agent   | | Agent   |           |
|    +---------+ +---------+ +---------+ +---------+ +---------+           |
|          |         |          |          |         |                     |
|          +---------+----------+----------+---------+                    |
|                              |                                           |
|                              v                                           |
|                    +------------------+                                 |
|                    |    MongoDB       |                                 |
|                    |    memories,     |                                 |
|                    |    insights      |                                 |
|                    +------------------+                                 |
|                                                                          |
+=========================================================================+
```

---

## Integration Points

### External Services

| Service | Integration Method | Purpose |
|---------|-------------------|---------|
| RABTUL-Technologies | REST API | Core data, events |
| OpenAI | API | GPT-4 for AI capabilities |
| Anthropic | API | Claude for advanced AI |
| Google AI | API | Additional AI capabilities |
| MongoDB Atlas | Native Driver | Primary database |
| Redis | Native Driver | Caching, sessions |
| Pinecone | REST API | Vector search |

### Internal Service Communication

| Service | Connection Type | Authentication |
|---------|----------------|----------------|
| Wallet Service | HTTP | X-Internal-Token |
| Order Service | HTTP | X-Internal-Token |
| Notification Service | HTTP | X-Internal-Token |
| Merchant Service | HTTP | X-Internal-Token |
| PMS Service | HTTP | X-Internal-Token |
| Auth Service | HTTP | X-Internal-Token |

### Webhook Events

| Event | Source | Destination |
|-------|--------|-------------|
| hotel/search | Hotel App | Intent Graph |
| hotel/hold | Hotel App | Intent Graph |
| hotel/confirm | Hotel App | Intent Graph |
| restaurant/view | Restaurant App | Intent Graph |
| restaurant/add-to-cart | Restaurant App | Intent Graph |
| restaurant/order | Restaurant App | Intent Graph |
| nudge/delivered | Notification Service | Intent Graph |
| nudge/clicked | Notification Service | Intent Graph |
| nudge/converted | Notification Service | Intent Graph |

---

## Technology Stack

### Core Runtime

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | Node.js | 18+ | Server runtime |
| Language | TypeScript/JavaScript | ES2022 | Type-safe development |
| Framework | Express.js | 4.18+ | HTTP server |
| Validation | Zod | 3.22+ | Schema validation |

### Data Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Primary DB | MongoDB Atlas | Document storage, intent tracking |
| Cache | Redis 7 | Sessions, caching, rate limiting |
| Vector DB | Pinecone | Semantic search |
| ORM | Mongoose | MongoDB object modeling |

### AI/ML

| Component | Technology | Purpose |
|-----------|------------|---------|
| LLM Router | Custom | Multi-provider AI routing |
| Claude | Anthropic | Advanced reasoning |
| GPT-4 | OpenAI | Text generation |
| Models | Custom | Domain-specific ML |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Container | Docker | Service isolation |
| Hosting | Render | Cloud deployment |
| Logging | Winston | Structured logging |
| Error Tracking | Sentry | Error monitoring |

---

## Security Model

### Authentication

**Service-to-Service:**
```
X-Internal-Token: <INTERNAL_SERVICE_TOKEN>
```

All endpoints except `/health` and `/ready` require authentication.

**Webhook Verification:**
- HMAC-SHA256 signature validation
- Timestamp validation (5-minute window)
- Replay prevention via Redis (24-hour deduplication)

### Input Validation

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| HTTP | express-rate-limit | DDoS protection |
| API | Zod schemas | Type validation |
| Database | Mongoose | Schema enforcement |

### Security Headers

All services include:
- Helmet.js security headers
- CORS configuration
- XSS sanitization
- SSRF protection

### Data Protection

| Concern | Mitigation |
|---------|------------|
| Secrets | Environment variables only |
| PII | Sanitized logging |
| SQL Injection | MongoDB parameterized queries |
| XSS | Output encoding |

---

## Network Architecture

```
+=========================================================================+
|                      NETWORK ARCHITECTURE                               |
+=========================================================================+
|                                                                          |
|                           INTERNET                                      |
|                              |                                          |
|                              v                                          |
|  +---------------------------------------------------------------+      |
|  |                     Load Balancer                             |      |
|  +---------------------------------------------------------------+      |
|                              |                                          |
|        +---------------------+---------------------+                    |
|        |                     |                     |                    |
|        v                     v                     v                    |
|  +-------------+       +-------------+       +-------------+             |
|  |   Render    |       |   Render    |       |   Render    |             |
|  |  Service 1  |       |  Service 2  |       |  Service N  |             |
|  +-------------+       +-------------+       +-------------+             |
|        |                     |                     |                    |
|        +---------------------+---------------------+                    |
|                              |                                          |
|                              v                                          |
|  +---------------------------------------------------------------+      |
|  |                     Internal Network                          |      |
|  +---------------------------------------------------------------+      |
|        |                     |                     |                    |
|        v                     v                     v                    |
|  +-------------+       +-------------+       +-------------+             |
|  |   MongoDB   |       |    Redis    |       |  Pinecone   |             |
|  |   Atlas     |       |   Cluster   |       |   (Vectors) |             |
|  +-------------+       +-------------+       +-------------+             |
|                                                                          |
+=========================================================================+
```

---

## Performance Characteristics

### Latency Targets

| Service Type | Target | p99 |
|--------------|--------|-----|
| Health Checks | < 10ms | 50ms |
| Intent Capture | < 50ms | 200ms |
| Agent Processing | < 500ms | 2000ms |
| ML Inference | < 100ms | 500ms |

### Throughput

| Service | Expected RPS | Max RPS |
|---------|-------------|---------|
| REZ-reorder-engine | 100 | 500 |
| REZ-ai-router | 50 | 200 |
| REZ-autonomous-agents | 10 | 50 |

### Scaling Strategy

| Component | Scaling | Mechanism |
|-----------|---------|-----------|
| Services | Horizontal | Render auto-scaling |
| MongoDB | Vertical + Sharding | Atlas cluster |
| Redis | Vertical + Clustering | Redis Cluster |
| Agent Workers | Horizontal | BullMQ workers |

---

## Disaster Recovery

### Backup Strategy

| Data | Frequency | Retention |
|------|-----------|-----------|
| MongoDB | Daily + Oplog | 30 days |
| Redis | RDB snapshots | 7 days |
| Config | On deploy | Versioned |

### Failover

| Component | Strategy | RTO |
|-----------|----------|-----|
| Services | Multi-region Render | < 5 min |
| MongoDB | Atlas HA | < 30 sec |
| Redis | Sentinel | < 30 sec |

---

## Appendix: Service URLs (Development)

```
WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com
MONOLITH_URL=https://rez-backend-8dfu.onrender.com
ORDER_SERVICE_URL=https://rez-order-service-hz18.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
MERCHANT_SERVICE_URL=https://rez-merchant-service-n3q2.onrender.com
NOTIFICATION_SERVICE_URL=https://rez-notification-events-mwdz.onrender.com
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
CATALOG_SERVICE_URL=https://rez-catalog-service-1.onrender.com
SEARCH_SERVICE_URL=https://rez-search-service.onrender.com
MARKETING_SERVICE_URL=https://rez-marketing-service.onrender.com
GAMIFICATION_SERVICE_URL=https://rez-gamification-service-3b5d.onrender.com
ADS_SERVICE_URL=https://rez-ads-service.onrender.com
ANALYTICS_SERVICE_URL=https://analytics-events-37yy.onrender.com
REZ_INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com
```
