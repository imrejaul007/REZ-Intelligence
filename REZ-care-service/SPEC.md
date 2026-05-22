# REZ Care Service - Specification

**Version:** 3.1.0
**Port:** 4058
**Company:** REZ-Intelligence
**Category:** Customer Support Intelligence
**Updated:** May 22, 2026

---

## Overview

AI Commerce Recovery & Customer Intelligence Platform. Provides unified customer support with AI-powered assistance, proactive issue detection, self-service tools, and complete customer intelligence.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          REZ Care Service (4058)                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                          CORE SERVICES                                        │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  Customer360Service      │ Unified customer view                             │   │
│  │  CSATService            │ Satisfaction tracking                             │   │
│  │  SentimentService       │ Text sentiment analysis                           │   │
│  │  ProactiveDetection     │ Issue prediction & prevention                     │   │
│  │  SelfServiceService     │ Self-help automation                             │   │
│  │  AutoTicketService      │ Auto ticket creation                             │   │
│  │  AgentManagementService │ Agent routing & performance                       │   │
│  │  EscalationEngine       │ Smart escalation rules                           │   │
│  │  ReportsService         │ Analytics & dashboards                           │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                      CHANNEL SERVICES                                         │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  WhatsAppService        │ WhatsApp Business API                            │   │
│  │  WhatsAppSupportService │ WhatsApp support features                        │   │
│  │  EmailIntegration       │ Email support (SendGrid, SES, Mailgun)           │   │
│  │  MultiTenantEmail       │ Multi-tenant email                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    ECOSYSTEM INTEGRATIONS (v3.1)                             │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  Memory Layer (4201)       │ Customer Timeline & Patterns                 │   │
│  │  Unified Profile (4060)    │ Customer 360 & Segments                      │   │
│  │  Workflow Builder (4045)    │ Automation Workflows                         │   │
│  │  Vector Search (4127)      │ RAG/Knowledge Base                           │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    RABTUL PLATFORM                                           │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  Auth (4002)  │ Wallet (4004)  │ Notifications (4011)  │ Profile (4013)  │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    REZ INTELLIGENCE                                          │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  Intent (4018) │ Predictive (4123) │ Signals (4121) │ Recommendations (4120) │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    EXPERT SERVICES (8 Verticals)                            │   │
│  ├─────────────────────────────────────────────────────────────────────────────┤   │
│  │  Hospitality │ Salon │ Fitness │ Health │ Education │ Travel │ Retail │ Culinary │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Features

### 1. Customer 360 View

Aggregates all service data into unified customer profile.

**Data Sources:**
- Order history from Order Service
- Payment history from Payment Service
- Support tickets from Care Service
- Engagement metrics from Signal Aggregator
- Social signals from Social Signals
- Predictions from Predictive Engine
- Timeline from Memory Layer
- Profile from Unified Profile

**Response:**
```json
{
  "success": true,
  "data": {
    "customerId": "cust_123",
    "identity": { "name": "John D.", "phone": "+91...", "email": "john@example.com" },
    "value": { "lifetimeValue": 12500, "totalOrders": 45, "avgOrderValue": 278 },
    "loyalty": { "karmaTier": "gold", "karmaPoints": 5000 },
    "risk": { "churnProbability": 0.15, "vipStatus": true },
    "engagement": { "preferredChannel": "whatsapp", "lastActiveDate": "2026-05-22" },
    "wallet": { "currentBalance": 500, "pendingCashback": 150 },
    "summary": { "status": "happy", "openTickets": 0, "sentiment": 0.85 }
  }
}
```

### 2. CSAT (Customer Satisfaction)

Track and analyze satisfaction scores.

**Metrics:**
- CSAT Score (1-5 scale)
- NPS (Net Promoter Score: -100 to 100)
- CES (Customer Effort Score: 1-7)
- Response rate

**Survey Types:**
- Post-interaction surveys
- Post-order surveys
- Periodic satisfaction polls

**Endpoints:**
- `POST /api/csat/respond` - Submit survey
- `GET /api/csat/metrics` - Get metrics
- `POST /api/csat/send` - Send survey

### 3. Sentiment Analysis

Analyze text for customer sentiment.

**Analysis Types:**
- Ticket description sentiment
- Chat sentiment
- Review sentiment
- Feedback sentiment

**Sentiment Levels:**
- `positive` (> 0.2)
- `neutral` (-0.2 to 0.2)
- `negative` (< -0.2)

**Endpoint:** `POST /api/sentiment/analyze`

### 4. Proactive Issue Detection

Predict and prevent issues before they escalate.

**Detectable Issues:**
- Delayed orders
- Payment failures
- Product quality issues
- Delivery problems
- Service outages

**Endpoint:** `GET /api/alerts/active`

### 5. Self-Service Recovery

Automated resolution without agent intervention.

**Self-Service Actions:**
- Cashback retry
- Payment retry
- Wallet sync
- Refund status
- Order cancellation
- Booking reschedule

**Endpoints:**
- `GET /api/mobile/actions` - Available actions
- `POST /api/mobile/execute` - Execute action
- `POST /api/mobile/retry-payment` - Retry payment
- `POST /api/mobile/sync-wallet` - Sync wallet

### 6. Auto-Ticket Generation

Automatically create tickets for technical issues.

**Triggers:**
- Payment failures
- QR scan failures
- App errors
- Delivery delays

**Endpoints:**
- `GET /api/auto-tickets` - List auto-tickets
- `POST /api/auto-tickets` - Create ticket
- `POST /api/auto-tickets/:id/resolve` - Resolve

### 7. Agent Management

Complete agent lifecycle management.

**Features:**
- Agent creation and profile
- Status management (online/offline/busy)
- Auto-routing based on category
- Manual assignment
- Performance tracking
- Team performance

**Endpoints:**
- `POST /api/agents` - Create agent
- `GET /api/agents` - List agents
- `POST /api/agents/:id/status` - Set status
- `POST /api/agents/assign` - Auto-assign
- `GET /api/agents/:id/performance` - Performance

### 8. Escalation Engine

Smart escalation based on rules and conditions.

**Escalation Triggers:**
- SLA breach
- High severity
- VIP customer
- Negative sentiment
- Multiple reassignments

**Endpoints:**
- `POST /api/escalation/check` - Check escalations
- `POST /api/escalation/rules` - Create rule
- `GET /api/escalation/metrics` - Metrics

### 9. WhatsApp Integration

Send and receive via WhatsApp Business API.

**Features:**
- Text messages
- Interactive buttons
- List messages
- Template messages
- Webhook handling
- Template management

**Endpoints:**
- `POST /api/whatsapp/webhook` - Receive
- `POST /api/whatsapp/send` - Send text
- `POST /api/whatsapp/menu` - Send buttons
- `POST /api/whatsapp/list` - Send list

### 10. Cross-Platform Memory

Track issues across all platforms and touchpoints.

**Features:**
- Record issues with context
- Find similar issues
- Predict customer issues
- Detect platform-wide issues
- Merchant issue profiles

**Endpoints:**
- `POST /api/issues/record` - Record issue
- `GET /api/issues/similar` - Find similar
- `GET /api/customers/:id/predict-issues` - Predict
- `GET /api/issues/platform-wide` - Platform-wide

### 11. Reports & Analytics

Comprehensive reporting dashboards.

**Reports:**
- Overview dashboard
- CSAT trends
- Category breakdown
- Platform comparison
- Agent leaderboard
- Merchant issues

**Endpoints:**
- `GET /api/reports/overview`
- `GET /api/reports/csat-trends`
- `GET /api/reports/categories`
- `GET /api/reports/platforms`
- `GET /api/reports/leaderboard`

### 12. Ecosystem Integration (v3.1)

Connect to REZ infrastructure services.

**Memory Layer (4201):**
- Customer timeline
- Pattern detection

**Unified Profile (4060):**
- Customer 360
- Segments
- Signal scores

**Workflow Builder (4045):**
- Automation workflows
- Trigger workflows

**Vector Search (4127):**
- Semantic search
- RAG context

**Endpoints:**
- `GET /api/ecosystem/health` - Health check
- `GET /api/ecosystem/customer/:id` - Enriched context
- `POST /api/ecosystem/timeline` - Add event
- `GET /api/ecosystem/timeline/:id` - Get timeline
- `GET /api/ecosystem/profile/:id` - Get profile
- `POST /api/ecosystem/workflows/trigger` - Trigger
- `POST /api/ecosystem/knowledge/search` - Search
- `POST /api/ecosystem/ai/suggest` - AI suggestion

---

## Data Models

### Customer360

```typescript
interface Customer360 {
  customerId: string;
  identity: { phone, email?, name, avatar?, registeredAt, verified };
  value: { lifetimeValue, totalOrders, avgOrderValue, ... };
  loyalty: { karmaTier, karmaPoints, pointsValue, ... };
  risk: { churnProbability, fraudScore, refundRiskScore, vipStatus, ... };
  engagement: { lastActiveDate, appOpenFrequency, preferredChannel, ... };
  wallet: { currentBalance, totalEarned, pendingCashback, ... };
  summary: { status, priorityLevel, openTickets, sentiment, ... };
}
```

### CSATSurvey

```typescript
interface CSATSurvey {
  ticketId: string;
  customerId: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'inapp';
  status: 'pending' | 'sent' | 'completed' | 'expired';
  overallRating?: number; // 1-5
  npsScore?: number; // 0-10
  cesScore?: number; // 1-7
  feedback?: string;
}
```

### ProactiveAlert

```typescript
interface ProactiveAlert {
  type: 'payment' | 'qr' | 'app' | 'delivery' | 'merchant' | 'fraud' | 'sentiment';
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'active' | 'investigating' | 'resolved' | 'auto_resolved';
  detectedAt: Date;
  triggeredBy: string;
  description: string;
  affectedUsers: string[];
  actions: { type, timestamp, details }[];
}
```

### TimelineEvent

```typescript
interface TimelineEvent {
  customerId: string;
  eventType: 'ticket' | 'chat' | 'refund' | 'payment' | 'order' | 'loyalty' | 'delivery' | 'support' | 'compensation';
  source: string;
  timestamp?: Date;
  data: Record<string, any>;
  sentiment?: number;
  intent?: string;
  category?: string;
}
```

### UnifiedCustomerProfile

```typescript
interface UnifiedCustomerProfile {
  customerId: string;
  identity: { email?, phone?, name? };
  segments: string[];
  signalScores: { engagement: number; loyalty: number; risk: number };
  lifetimeMetrics: { ltv: number; orders: number; avgOrderValue: number };
  churnRisk?: number;
  sentiment?: number;
  lastActivity?: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "socket.io": "^4.8.3",
  "node-cron": "^3.0.3",
  "axios": "^1.6.0",
  "uuid": "^9.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.0.0",
  "zod": "^3.22.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4058 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-care | MongoDB |
| `NODE_ENV` | development | Environment |
| `INTERNAL_SERVICE_TOKEN` | - | Service authentication |

### Service URLs

```bash
# RABTUL
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
NOTIFICATIONS_SERVICE_URL=https://rez-notifications.onrender.com
PROFILE_SERVICE_URL=https://rez-profile-service.onrender.com

# REZ Intelligence
INTENT_SERVICE_URL=https://rez-intent-predictor.onrender.com
PREDICTIVE_ENGINE_URL=https://REZ-predictive-engine.onrender.com
SIGNAL_AGGREGATOR_URL=https://REZ-signal-aggregator.onrender.com

# Ecosystem (v3.1)
REZ_MEMORY_URL=https://rez-memory-layer.onrender.com
REZ_UNIFIED_PROFILE_URL=https://rez-unified-profile.onrender.com
REZ_WORKFLOW_URL=https://rez-workflow-builder.onrender.com
VECTOR_SEARCH_URL=https://rez-vector-search.onrender.com

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Order Service | Read | Order history, status |
| Payment Service | Read | Payment history |
| Auth Service | Read | User authentication |
| Signal Aggregator | Read | Engagement data |
| Notification Service | Trigger | Proactive alerts |
| Memory Layer | Write | Customer timeline |
| Unified Profile | Read/Write | Customer 360 |
| Workflow Builder | Trigger | Automation |
| Vector Search | Read/Write | Knowledge base |

---

## Real-time Features

Socket.IO events for live updates:

- `ticket:created` - New ticket
- `ticket:updated` - Ticket status change
- `csat:submitted` - New survey response
- `alert:triggered` - Proactive issue detected
- `customer:360:updated` - Profile updated
- `metrics:update` - Dashboard metrics

---

## Status

### Completed (v3.1)

- [x] Customer 360 view
- [x] CSAT tracking
- [x] Sentiment analysis
- [x] Proactive detection
- [x] Self-service recovery
- [x] Auto-ticket generation
- [x] Agent management
- [x] Escalation engine
- [x] WhatsApp integration
- [x] Reports & analytics
- [x] Cross-platform memory
- [x] **Ecosystem integrations (v3.1)**
- [x] **Memory Layer (4201)**
- [x] **Unified Profile (4060)**
- [x] **Workflow Builder (4045)**
- [x] **Vector Search (4127)**
- [x] Real-time updates (Socket.IO)
- [x] Scheduled analysis

### Next Phase

- [ ] Human-agent copilot UI
- [ ] Revenue/monetization layer
- [ ] SaaS productization

---

**Last Updated:** May 22, 2026
**Version:** 3.1.0
