# REZ-Intelligence - Complete Service Documentation

> **Version:** 2.0.0
> **Last Updated:** 2026-05-13
> **Total Services:** 60+

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Phase 1: Wedge Services (4040-4043)](#phase-1-wedge-services-4040-4043)
3. [Phase 2: Data Network (4050-4052)](#phase-2-data-network-4050-4052)
4. [Phase 3: Intelligence Moat (4060-4062)](#phase-3-intelligence-moat-4060-4062)
5. [Phase 4: Ecosystem (4070-4073)](#phase-4-ecosystem-4070-4073)
6. [Platform Services (4008, 4031, 4091-4095)](#platform-services)
7. [AI Services (3003-3010)](#ai-services)
8. [Event Architecture](#event-architecture)

---

## Platform Overview

### Mission
AI-powered commerce intelligence platform with 60+ microservices.

### Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20.x |
| Language | TypeScript/JavaScript |
| Database | MongoDB |
| Cache | Redis |
| Queue | BullMQ |
| Search | Elasticsearch |
| API | REST, WebSocket |

---

## Phase 1: Wedge Services (4040-4043)

### REZ-reorder-engine (Port 4040)

**Purpose:** Predict and trigger reorders for restaurant commerce

**Features:**
- Order frequency tracking
- Reorder score calculation
- Nudge queue system
- Homepage personalization

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reorder/profile` | Create/update reorder profile |
| GET | `/api/reorder/user/:userId` | Get user recommendations |
| GET | `/api/reorder/homepage/:userId` | Homepage suggestions |
| POST | `/api/reorder/nudge/:id/click` | Track nudge click |
| POST | `/api/reorder/nudge/:id/convert` | Track conversion |
| GET | `/api/reorder/analytics` | Merchant analytics |

**Commerce Categories:**
- Restaurant
- Hotel
- Retail
- Booking
- Services
- Fintech

---

### REZ-taste-profile (Port 4041)

**Purpose:** Consumer taste and preference intelligence

**Features:**
- Multi-dimensional preference tracking
- 9 commerce categories
- Preference inference
- Taste embedding

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/taste/profile` | Create/update profile |
| GET | `/api/taste/user/:userId` | Get taste profile |
| GET | `/api/taste/recommendations/:userId` | Taste-based recommendations |

---

### REZ-demand-forecast (Port 4042)

**Purpose:** 7-day demand prediction

**Features:**
- Time-series forecasting
- Demand clustering
- Seasonal patterns
- Inventory optimization

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/forecast/demand` | Get demand forecast |
| GET | `/api/forecast/merchant/:merchantId` | Merchant forecasts |

---

### REZ-price-predictor (Port 4043)

**Purpose:** Price optimization

**Features:**
- Dynamic pricing
- Competitive analysis
- Margin optimization
- Price elasticity

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/price/predict` | Predict optimal price |
| GET | `/api/price/merchant/:merchantId` | Merchant pricing |

---

## Phase 2: Data Network (4050-4052)

### REZ-identity-graph (Port 4050)

**Purpose:** Unified user identity across apps

**Features:**
- Identity resolution
- Profile linking
- Cross-platform tracking
- Device fingerprinting

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/identity/resolve` | Resolve identity |
| POST | `/api/identity/link` | Link identities |
| GET | `/api/identity/:id` | Get identity |
| POST | `/api/identity/fingerprint` | Device fingerprint |

**Identity Types:**
- app_user
- whatsapp
- web
- qr
- device
- wallet
- phone
- email

---

### REZ-memory-engine (Port 4051)

**Purpose:** Agent memory storage

**Features:**
- Short-term memory
- Long-term memory
- Episodic memory
- Semantic memory

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/memory/store` | Store memory |
| GET | `/api/memory/retrieve` | Retrieve memories |
| DELETE | `/api/memory/clear` | Clear memories |

---

### REZ-ai-router (Port 4052)

**Purpose:** AI routing with cost optimization

**Features:**
- Multi-model routing
- Cost optimization
- Latency optimization
- Model fallbacks

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/route` | Route AI request |
| GET | `/api/ai/models` | Available models |
| POST | `/api/ai/compare` | Compare model outputs |

---

## Phase 3: Intelligence Moat (4060-4062)

### REZ-knowledge-graph (Port 4060)

**Purpose:** Knowledge base

**Features:**
- Entity extraction
- Relationship mapping
- Knowledge embedding
- Query engine

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/knowledge/query` | Query knowledge |
| POST | `/api/knowledge/entity` | Extract entities |
| GET | `/api/knowledge/related/:entityId` | Related entities |

---

### REZ-merchant-brain (Port 4061)

**Purpose:** Merchant intelligence

**Features:**
- Business insights
- Growth recommendations
- Competitor analysis
- Performance tracking

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/brain/merchant/:merchantId` | Get insights |
| GET | `/api/brain/recommendations/:merchantId` | Actionable recommendations |

---

### REZ-autonomous-agents (Port 4062)

**Purpose:** 30 AI agents

**Agent Categories:**

| Category | Count | Examples |
|----------|-------|----------|
| Customer Service | 5 | Order tracking, refunds |
| Sales | 4 | Upsell, cross-sell |
| Operations | 6 | Inventory, scheduling |
| Marketing | 5 | Campaigns, segmentation |
| Finance | 4 | Invoicing, collections |
| Analytics | 6 | Reporting, forecasting |

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents/:agentId/invoke` | Invoke agent |
| GET | `/api/agents/:agentId/history` | Conversation history |

---

## Phase 4: Ecosystem (4070-4073)

### REZ-payments-brain (Port 4070)

**Purpose:** Payment intelligence

**Features:**
- Fraud detection
- Payment optimization
- Revenue forecasting
- Cash flow analysis

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/fraud-check` | Fraud detection |
| GET | `/api/payments/insights/:merchantId` | Payment insights |

---

### REZ-inventory-sync (Port 4071)

**Purpose:** Inventory management

**Features:**
- Real-time sync
- Multi-location inventory
- Low-stock alerts
- Reorder automation

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/:merchantId` | Get inventory |
| POST | `/api/inventory/update` | Update stock |
| GET | `/api/inventory/alerts` | Stock alerts |

---

### REZ-creator-network (Port 4072)

**Purpose:** Creator marketplace

**Features:**
- Creator discovery
- Campaign management
- Performance tracking
- Payment automation

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/creators` | List creators |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/:id/performance` | Campaign metrics |

---

### REZ-merchant-os (Port 4073)

**Purpose:** Merchant operating system

**Features:**
- Dashboard
- Analytics
- Inventory management
- Customer management
- Marketing tools

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/os/dashboard/:merchantId` | Dashboard data |
| GET | `/api/os/analytics/:merchantId` | Analytics |

---

## Platform Services

### REZ-event-bus (Port 4031)

**Purpose:** Event distribution

**Features:**
- Pub/Sub messaging
- Event history
- Subscription management
- Event replay

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/events/publish` | Publish event |
| GET | `/api/events/history` | Event history |
| POST | `/api/subscriptions` | Create subscription |
| DELETE | `/api/subscriptions/:id` | Delete subscription |
| GET | `/api/stats` | Service stats |

**Event Channels:**
```
events.payment.*
events.identity.*
events.order.*
events.user.*
```

---

### REZ-event-platform (Port 4008)

**Purpose:** Event publishing

**Features:**
- Event sourcing
- Event replay
- Audit trail

---

### REZ-integration-sdk (Port 4091)

**Purpose:** Unified SDK for all apps

**Features:**
- Single integration point
- TypeScript types
- React hooks
- REST + WebSocket

---

### REZ-identity-bridge (Port 4092)

**Purpose:** Cross-app user identity

**Features:**
- Multi-source identity resolution
- Profile aggregation
- Identity graph

---

### REZ-feedback-collector (Port 4085)

**Purpose:** Conversion tracking

**Features:**
- NPS surveys
- User feedback
- Sentiment analysis

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/feedback` | Submit feedback |
| GET | `/api/feedback/:id/sentiment` | Sentiment analysis |

---

### REZ-unified-recommendations (Port 4090)

**Purpose:** All recommendations

**Features:**
- Collaborative filtering
- Content-based
- Hybrid approach

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recommendations/:userId` | User recommendations |
| POST | `/api/recommendations/feedback` | Recommendation feedback |

---

### REZ-notification-router (Port 4093)

**Purpose:** Push/SMS/Email routing

**Features:**
- Channel selection
- Template management
- Delivery tracking

---

### REZ-realtime-gateway (Port 4094)

**Purpose:** WebSocket events

**Features:**
- Real-time updates
- Presence detection
- Channel subscriptions

---

### REZ-health-monitor (Port 4095)

**Purpose:** System health

**Features:**
- Service monitoring
- Alert management
- Uptime tracking

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | System health |
| GET | `/api/health/services` | Service statuses |

---

## AI Services

### REZ-copilot-service

**Purpose:** AI copilot assistant

**Features:**
- Chat interface
- Task automation
- Natural language queries

---

### REZ-decision-service

**Purpose:** Decision engine

**Features:**
- Rule-based decisions
- ML-based recommendations
- A/B testing

---

### REZ-ad-platform

**Purpose:** Advertising platform

**Features:**
- Ad targeting
- Campaign management
- Performance analytics

---

## Event Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Publishers                       │
├──────────┬──────────┬──────────┬──────────────────┤
│ Payment  │ Identity │ Order   │ Other Services    │
└────┬────┴────┬────┴────┬────┴────────┬──────────────┘
     │         │         │            │
     ▼         ▼         ▼            ▼
┌─────────────────────────────────────────────────────┐
│              REZ-event-bus (4031)                  │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐      │
│  │ Pub/Sub │  │  History │  │ Subscriptions│      │
│  └─────────┘  └──────────┘  └────────────┘      │
└──────────────────────────┬──────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
     ▼                     ▼                     ▼
┌─────────┐         ┌─────────────┐       ┌──────────┐
│Analytics│         │ Notifications│       │ Fraud    │
│ Service │         │ Service     │       │ Detection│
└─────────┘         └─────────────┘       └──────────┘
```

---

## Port Reference

| Service | Port | Purpose |
|---------|------|---------|
| REZ-reorder-engine | 4040 | Reorders |
| REZ-taste-profile | 4041 | Preferences |
| REZ-demand-forecast | 4042 | Forecasting |
| REZ-price-predictor | 4043 | Pricing |
| REZ-identity-graph | 4050 | Identity |
| REZ-memory-engine | 4051 | Memory |
| REZ-ai-router | 4052 | AI Routing |
| REZ-knowledge-graph | 4060 | Knowledge |
| REZ-merchant-brain | 4061 | Insights |
| REZ-autonomous-agents | 4062 | Agents |
| REZ-payments-brain | 4070 | Payments AI |
| REZ-inventory-sync | 4071 | Inventory |
| REZ-creator-network | 4072 | Creators |
| REZ-merchant-os | 4073 | Merchant OS |
| REZ-event-bus | 4031 | Events |
| REZ-event-platform | 4008 | Event sourcing |
| REZ-integration-sdk | 4091 | SDK |
| REZ-identity-bridge | 4092 | Identity bridge |
| REZ-feedback-collector | 4085 | Feedback |
| REZ-unified-recommendations | 4090 | Recommendations |
| REZ-notification-router | 4093 | Notifications |
| REZ-realtime-gateway | 4094 | WebSocket |
| REZ-health-monitor | 4095 | Monitoring |

---

## Quick Reference

### Health Check

```bash
curl http://localhost:4031/health
```

### Publish Event

```bash
curl -X POST http://localhost:4031/api/events/publish \
  -H "X-Internal-Token: $TOKEN" \
  -d '{"eventType":"user.order","data":{}}'
```

### Get Recommendations

```bash
curl http://localhost:4090/api/recommendations/user123
```

---

**Document Owner:** REZ-Intelligence Team
**Next Review:** 2026-06-13
