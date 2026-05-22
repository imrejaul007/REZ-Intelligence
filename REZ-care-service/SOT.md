# REZ Care Service - Source of Truth
# Complete Technical Documentation
# Version: 3.1.0 | Updated: May 22, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [All API Endpoints](#all-api-endpoints)
5. [Services](#services)
6. [Ecosystem Integrations](#ecosystem-integrations)
7. [Routes](#routes)
8. [Types](#types)
9. [Environment Variables](#environment-variables)
10. [Features by Category](#features-by-category)
11. [Mobile SDK](#mobile-sdk)
12. [WebSocket Events](#websocket-events)
13. [Deployment](#deployment)
14. [Next Session Checklist](#next-session-checklist)

---

## Overview

**REZ Care Service v3.1.0** is an AI Commerce Recovery & Customer Intelligence Platform that provides unified customer support across all channels.

### Service Information

| Property | Value |
|-----------|-------|
| **Port** | 4058 |
| **Company** | REZ-Intelligence |
| **Category** | Customer Support Intelligence |
| **Version** | 3.1.0 |
| **MongoDB** | `rez-care` database |

### Unique Value Proposition

- CSAT surveys & tracking (unique to REZ Care)
- Proactive issue detection
- Self-service recovery
- Auto-ticket creation
- Merchant communication
- Cross-platform issue memory
- Agent management & routing
- Escalation engine
- WhatsApp support
- Reports & analytics
- Customer timeline (via Memory Layer)
- Unified profile (via Unified Profile)
- Workflow automation (via Workflow Builder)
- RAG/Knowledge (via Vector Search)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              REZ CARE ECOSYSTEM                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                    REZ Care Platform (4058)                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────────  │   │
│  │  Mobile SDK │ WhatsApp │ Email │ Self-Service │ CSAT │ Tickets │ Reports │   │
│  │  Agents │ Escalation │ Proactive Detection │ Cross-Platform Memory        │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                              │
│  ┌───────────────────────────────────┼───────────────────────────────────────────┐ │
│  │                    ECOSYSTEM INTEGRATIONS                                      │ │
│  ├───────────────────────────────────┼───────────────────────────────────────────┤ │
│  │  REZ-memory-layer (4201)          │ Customer Timeline & Patterns            │ │
│  │  REZ-unified-profile (4060)       │ Customer 360 & Segments                 │ │
│  │  REZ-workflow-builder (4045)      │ Automation Workflows                    │ │
│  │  Vector Search (4127)             │ RAG/Knowledge Base                      │ │
│  └───────────────────────────────────┴───────────────────────────────────────────┘ │
│                                      │                                              │
│  ┌───────────────────────────────────┼───────────────────────────────────────────┐ │
│  │                    RABTUL PLATFORM                                             │ │
│  ├───────────────────────────────────┼───────────────────────────────────────────┤ │
│  │  Auth (4002)  │ Wallet (4004)    │ Notifications (4011) │ Profile (4013)   │ │
│  └───────────────────────────────────┴───────────────────────────────────────────┘ │
│                                      │                                              │
│  ┌───────────────────────────────────┼───────────────────────────────────────────┐ │
│  │                    REZ INTELLIGENCE                                            │ │
│  ├───────────────────────────────────┼───────────────────────────────────────────┤ │
│  │  Intent (4018) │ Predictive (4123) │ Signals (4121) │ Recommendations (4120) │ │
│  └───────────────────────────────────┴───────────────────────────────────────────┘ │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Three Domain Architecture

```
BEFORE (10 services):                    AFTER (3 domains):
├── rez-care-service (4058)              ├── REZ Care Platform (4058)
├── rez-support-copilot (4033)           ├── REZ Care Intelligence (4033)
├── rez-hospitality-expert (3005)        └── REZ Care Experts (3005)
├── rez-salon-expert (3006)
├── rez-fitness-expert (3007)
├── rez-health-expert (3008)
├── rez-education-expert (3009)
├── rez-travel-expert (3010)
├── rez-retail-expert (3011)
└── rez-culinary-expert (3012)
```

---

## File Structure

### Complete File Inventory

```
REZ-care-service/
├── src/
│   ├── index.ts                      # Main entry (960+ lines)
│   ├── rabtul.ts                     # RABTUL platform integration
│   │
│   ├── routes/
│   │   ├── mobileRoutes.ts           # Mobile SDK (400+ lines)
│   │   ├── whatsappRoutes.ts         # WhatsApp integration (365 lines)
│   │   ├── supportRoutes.ts          # Unified support (15K+ lines)
│   │   ├── selfServiceRoutes.ts      # Self-service (440 lines)
│   │   ├── ecosystemRoutes.ts        # Ecosystem API (350+ lines)
│   │   ├── emailRoutes.ts            # Email support (9.5K lines)
│   │   ├── clientRoutes.ts           # Multi-tenant (11K lines)
│   │   ├── merchantRoutes.ts         # Merchant portal (12K lines)
│   │   ├── upsellRoutes.ts           # Upsells (4.6K lines)
│   │   └── smartUpsellRoutes.ts      # Smart upsells (6.2K lines)
│   │
│   ├── services/
│   │   ├── agentManagementService.ts    # Agent routing (16K)
│   │   ├── autoTicketService.ts         # Auto-tickets (17K)
│   │   ├── crossPlatformIssueMemory.ts  # Issue tracking (24K)
│   │   ├── csatService.ts               # CSAT surveys (15K)
│   │   ├── proactiveDetectionService.ts # Issue detection (18K)
│   │   ├── selfServiceService.ts        # Self-service (15K)
│   │   ├── escalationEngine.ts          # Escalation (16K)
│   │   ├── merchantCommunicationService.ts # Messaging (18K)
│   │   ├── reportsService.ts            # Analytics (11K)
│   │   ├── whatsappService.ts           # WhatsApp API (11K)
│   │   ├── whatsappSupportService.ts    # WhatsApp support (14K)
│   │   ├── websocketServer.ts           # Real-time (8.7K)
│   │   ├── expertRouter.ts              # Expert routing (8.5K)
│   │   ├── expertServices.ts            # Consolidated experts (300+)
│   │   ├── autonomousLoop.ts            # Autonomous actions (14K)
│   │   ├── autonomousActions.ts         # Action execution (9K)
│   │   ├── serviceIntegrations.ts       # Service connectors (11K)
│   │   ├── aiIntegrationService.ts      # AI integration (8.5K)
│   │   ├── mlIntelligence.ts            # ML features (4.8K)
│   │   ├── upsellEngine.ts              # Upsell logic (9.9K)
│   │   ├── smartUpsellEngine.ts         # Smart upsells (15K)
│   │   ├── emailIntegration.ts          # Email support (12K)
│   │   ├── multiTenantEmail.ts          # Multi-tenant (10K)
│   │   ├── merchantPortal.ts            # Merchant portal (9.9K)
│   │   ├── emailPoller.ts               # Email polling (6K)
│   │   ├── supportMetricsService.ts     # Metrics (9.2K)
│   │   ├── serviceConnector.ts          # Service connector
│   │   └── serviceIntegrations.ts       # Integration helper
│   │
│   ├── integrations/
│   │   ├── ecosystemServices.ts         # Memory, Profile, Workflow, Vector (600+)
│   │   ├── rezIntelligence.ts          # Intent, Predictive, Signals
│   │   ├── rabtulPlatform.ts           # RABTUL platform
│   │   └── index.ts                    # Integration exports
│   │
│   ├── middleware/
│   │   └── errorHandler.ts             # Error handling, validation
│   │
│   ├── utils/
│   │   ├── logger.ts                   # Structured logging
│   │   ├── eventEmitter.ts             # Event handling
│   │   └── integrationHelpers.ts       # Helper functions
│   │
│   ├── database/
│   │   ├── index.ts                    # Database connection
│   │   └── indexes.ts                  # MongoDB indexes
│   │
│   ├── types/
│   │   └── index.ts                    # TypeScript interfaces
│   │
│   └── config/
│       └── serviceEndpoints.ts          # Service URLs
│
├── render.yaml                         # Render blueprint
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript config
├── SOT.md                            # Source of Truth (THIS FILE)
├── README.md                          # Quick reference
├── SPEC.md                            # Feature specification
├── DEPLOYMENT-CHECKLIST.md            # Pre-deployment checklist
├── INTEGRATION-MANIFEST.md            # Complete inventory
├── INTEGRATION-STATUS.md              # Current integration status
└── PRIORITY-ROADMAP.md               # Future roadmap
```

---

## All API Endpoints

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health with version 3.1.0 |

### Mobile SDK (`/api/mobile-sdk/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tickets` | List tickets |
| GET | `/tickets/:id` | Get ticket |
| POST | `/tickets` | Create ticket |
| POST | `/tickets/:id/respond` | Reply to ticket |
| POST | `/tickets/:id/resolve` | Resolve ticket |
| POST | `/csat` | Submit CSAT survey |
| GET | `/csat/pending` | Pending surveys |
| GET | `/knowledge/search` | Search knowledge base |
| GET | `/knowledge/:id` | Get article |
| GET | `/faqs` | List FAQs |
| POST | `/chat/start` | Start chat session |
| POST | `/chat/send` | Send chat message |
| GET | `/chat/:id/history` | Get chat history |
| GET | `/orders/:id/support-options` | Get support options |
| POST | `/orders/:id/cancel` | Cancel order |
| POST | `/orders/:id/refund` | Request refund |

### WhatsApp (`/api/whatsapp/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhook` | Verify webhook |
| POST | `/webhook` | Receive message |
| POST | `/send` | Send text message |
| POST | `/menu` | Send button menu |
| POST | `/list` | Send list message |
| GET | `/templates` | List templates |

### Ecosystem (`/api/ecosystem/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | All services health |
| GET | `/customer/:id` | Enriched customer context |
| POST | `/timeline` | Add timeline event |
| GET | `/timeline/:id` | Get customer timeline |
| GET | `/timeline/:id/summary` | Timeline summary |
| GET | `/timeline/:id/patterns` | Detect patterns |
| GET | `/profile/:id` | Get unified profile |
| GET | `/profile/:id/segments` | Get customer segments |
| GET | `/profile/:id/signals` | Get signal scores |
| POST | `/workflows/trigger` | Trigger workflow |
| GET | `/workflows/:id` | Get workflow status |
| POST | `/knowledge/search` | Semantic search |
| POST | `/knowledge/rag` | Get RAG context |
| POST | `/knowledge/index` | Index document |
| POST | `/ai/suggest` | AI suggested response |
| POST | `/record` | Record interaction |

### Self-Service (`/api/mobile/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/actions` | Available self-service actions |
| POST | `/execute` | Execute action |
| POST | `/retry-payment` | Retry payment |
| POST | `/sync-wallet` | Sync wallet balance |
| GET | `/history` | Issue history |
| GET | `/similar-issues` | Find similar issues |
| GET | `/predictions` | Issue predictions |
| POST | `/report-issue` | Report new issue |
| POST | `/rate` | Rate experience |
| GET | `/refund-status/:id` | Refund status |
| GET | `/help-topics` | Help topics |
| GET | `/help-articles/:id` | Get help article |

### Support (`/api/support/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tickets` | Create ticket |
| GET | `/tickets` | List tickets |
| GET | `/tickets/:id` | Get ticket |
| PATCH | `/tickets/:id` | Update ticket |
| POST | `/tickets/:id/messages` | Add message |
| GET | `/tickets/:id/history` | Get history |

### CSAT (`/api/csat/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/respond` | Submit survey response |
| GET | `/metrics` | Get CSAT metrics |
| POST | `/send` | Send survey |

### Proactive Alerts (`/api/alerts/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/active` | Get active alerts |
| POST | `/` | Create alert |

### Agent Management (`/api/agents/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create agent |
| GET | `/` | List agents |
| GET | `/:id` | Get agent |
| PATCH | `/:id` | Update agent |
| POST | `/:id/status` | Set status |
| POST | `/assign` | Auto-assign ticket |
| POST | `/:id/assign` | Manual assign |
| POST | `/:id/escalate` | Escalate ticket |
| GET | `/:id/performance` | Get performance |
| GET | `/team/performance` | Team performance |

### Escalation (`/api/escalation/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/check` | Check escalations |
| POST | `/rules` | Create rule |
| GET | `/metrics` | Escalation metrics |
| GET | `/history/:ticketId` | Ticket history |

### Reports (`/api/reports/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/overview` | Overview dashboard |
| GET | `/csat-trends` | CSAT trends |
| GET | `/categories` | Category breakdown |
| GET | `/platforms` | Platform comparison |
| GET | `/leaderboard` | Agent leaderboard |
| GET | `/merchants` | Merchant issues |

### Metrics (`/api/metrics/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Dashboard metrics |
| GET | `/services/health` | Service health |

### Cross-Platform Memory (`/api/issues/*`, `/api/customers/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/issues/record` | Record issue |
| GET | `/customers/:id/issue-history` | Issue history |
| GET | `/issues/similar` | Find similar issues |
| GET | `/merchant/:id/issue-profile` | Merchant profile |
| GET | `/issues/platform-wide` | Platform-wide issues |
| GET | `/customers/:id/predict-issues` | Predict issues |

### Events (`/api/events`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Receive events (payment_failed, qr_scan_failed, app_error, etc.) |

### Additional Routes

| Mount | Description |
|-------|-------------|
| `/api/email` | Email support (SendGrid, SES, Mailgun, Postmark) |
| `/api/clients` | Multi-tenant client support |
| `/api/merchant` | Merchant portal |
| `/api/upsell` | Upsell engine |
| `/api/smart-upsell` | Smart upsell engine |

---

## Services

### Core Services (src/services/)

| Service | Lines | Purpose |
|---------|-------|---------|
| `agentManagementService.ts` | 16K | Agent routing, performance tracking |
| `autoTicketService.ts` | 17K | Auto-ticket creation |
| `crossPlatformIssueMemory.ts` | 24K | Issue tracking across platforms |
| `csatService.ts` | 15K | CSAT surveys |
| `proactiveDetectionService.ts` | 18K | Issue detection before escalation |
| `selfServiceService.ts` | 15K | Self-service recovery |
| `escalationEngine.ts` | 16K | Escalation logic |
| `merchantCommunicationService.ts` | 18K | Merchant messaging |
| `reportsService.ts` | 11K | Analytics |
| `whatsappService.ts` | 11K | WhatsApp Business API |
| `whatsappSupportService.ts` | 14K | WhatsApp support features |
| `websocketServer.ts` | 8.7K | Real-time updates |
| `expertRouter.ts` | 8.5K | Expert routing |
| `expertServices.ts` | 300+ | Consolidated 8 experts |
| `autonomousLoop.ts` | 14K | Autonomous actions |
| `autonomousActions.ts` | 9K | Action execution |
| `serviceIntegrations.ts` | 11K | Service connectors |
| `aiIntegrationService.ts` | 8.5K | AI integration |
| `mlIntelligence.ts` | 4.8K | ML features |
| `upsellEngine.ts` | 9.9K | Upsell logic |
| `smartUpsellEngine.ts` | 15K | Smart upsells |
| `emailIntegration.ts` | 12K | Email support |
| `multiTenantEmail.ts` | 10K | Multi-tenant email |
| `merchantPortal.ts` | 9.9K | Merchant portal |
| `emailPoller.ts` | 6K | Email polling |
| `supportMetricsService.ts` | 9.2K | Metrics |

### Integration Services (src/integrations/)

| Service | Connects To | Purpose |
|---------|-------------|---------|
| `ecosystemServices.ts` | Memory (4201), Profile (4060), Workflow (4045), Vector (4127) | Ecosystem integration |
| `rezIntelligence.ts` | Intent (4018), Predictive (4123), Signals (4121) | AI services |
| `rabtulPlatform.ts` | Auth, Wallet, Notifications, Profile | RABTUL platform |

---

## Ecosystem Integrations

### Memory Layer (REZ-memory-layer - Port 4201)

Customer timeline and pattern detection.

```typescript
import { memoryLayer } from './integrations/ecosystemServices';

// Add event to timeline
await memoryLayer.addToTimeline({
  customerId: 'cust_123',
  eventType: 'ticket',
  source: 'REZ-care',
  data: { ticketId: 'ticket_456', category: 'delivery' },
  sentiment: 0.3,
  intent: 'refund_request'
});

// Get customer timeline
const { events } = await memoryLayer.getTimeline('cust_123', { limit: 20 });

// Get timeline summary
const summary = await memoryLayer.getTimelineSummary('cust_123');

// Detect patterns
const { patterns, insights } = await memoryLayer.detectPatterns('cust_123');
```

### Unified Profile (REZ-unified-profile - Port 4060)

Customer 360 with segments and signals.

```typescript
import { unifiedProfile } from './integrations/ecosystemServices';

// Get unified profile
const { profile } = await unifiedProfile.getProfile('cust_123');
// profile.segments, profile.signalScores, profile.lifetimeMetrics

// Get customer segments
const { segments } = await unifiedProfile.getSegments('cust_123');

// Get signal scores
const { scores } = await unifiedProfile.getSignalScores('cust_123');
```

### Workflow Builder (REZ-workflow-builder - Port 4045)

Automation workflows.

```typescript
import { workflowBuilder } from './integrations/ecosystemServices';

// Trigger workflow
const { success, executionId } = await workflowBuilder.triggerWorkflow(
  'vip-refund',
  'cust_123',
  { ticketId: 'ticket_456', amount: 500 }
);

// Get workflow status
const { status, result } = await workflowBuilder.getWorkflowStatus(executionId);

// Cancel workflow
await workflowBuilder.cancelWorkflow(executionId);
```

### Vector Search (Vector Search - Port 4127)

Semantic search and RAG.

```typescript
import { vectorSearch } from './integrations/ecosystemServices';

// Semantic search
const { results } = await vectorSearch.semanticSearch('refund policy', {
  limit: 5,
  category: 'support'
});

// Get RAG context for AI
const { context, sources } = await vectorSearch.getRAGContext(
  'How do I get a refund?',
  'cust_123'
);

// Index document
await vectorSearch.indexDocument({
  id: 'doc_123',
  title: 'Refund Policy',
  content: 'Full refund policy text...',
  category: 'support'
});
```

### Unified Enrichment Function

Get all customer data in one call.

```typescript
import { enrichCustomerContext, recordSupportInteraction, triggerSupportWorkflow, getAISuggestedResponse } from './integrations/ecosystemServices';

// Enrich customer context
const context = await enrichCustomerContext('cust_123', {
  ticketId: 'ticket_456',
  message: 'I need a refund'
});
// Returns: { profile, timeline, patterns, ragContext }

// Record support interaction
await recordSupportInteraction('cust_123', {
  type: 'ticket',
  data: { ticketId: 'ticket_456' },
  sentiment: 0.3,
  intent: 'refund_request'
});

// Trigger automation workflow
const { success, executionId } = await triggerSupportWorkflow(
  'auto-refund-vip',
  'cust_123',
  { ticketId: 'ticket_456', sentiment: 0.3, ltv: 50000 }
);

// Get AI suggestion
const { suggestion, sources, confidence } = await getAISuggestedResponse(
  'cust_123',
  { message: 'I need a refund', category: 'payment', sentiment: 0.3 }
);
```

### Health Check

```typescript
import { checkAllServicesHealth } from './integrations/ecosystemServices';

const health = await checkAllServicesHealth();
// { 'memory-layer': true, 'unified-profile': true, 'workflow-builder': true, 'vector-search': true }
```

---

## Routes

### Route Mounting (src/index.ts)

```typescript
// Mobile Self-Service Routes
app.use('/api/mobile', selfServiceRoutes);
app.use('/api/mobile-sdk', mobileRoutes);

// Unified Support Routes
app.use('/api/support', supportRoutes);

// Email Support Routes
app.use('/api/email', emailRoutes);

// Multi-Tenant Client Routes
app.use('/api/clients', clientRoutes);

// Merchant Portal Routes
app.use('/api/merchant', merchantRoutes);

// Upsell Routes
app.use('/api/upsell', upsellRoutes);
app.use('/api/smart-upsell', smartUpsellRoutes);

// WhatsApp Routes
app.use('/api/whatsapp', whatsappRoutes);

// Ecosystem Routes
app.use('/api/ecosystem', ecosystemRoutes);
```

---

## Types

### Core Types (src/types/index.ts)

```typescript
// Customer 360
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

// CSAT Survey
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

// Proactive Alert
interface ProactiveAlert {
  type: 'payment' | 'qr' | 'app' | 'delivery' | 'merchant' | 'fraud' | 'sentiment';
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'active' | 'investigating' | 'resolved' | 'auto_resolved';
  detectedAt: Date;
  triggeredBy: string;
  description: string;
}

// Auto Ticket
interface AutoTicket {
  type: 'payment' | 'qr' | 'app' | 'delivery' | 'booking' | 'merchant' | 'technical';
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'created' | 'assigned' | 'in_progress' | 'resolved' | 'auto_resolved';
  detectedAt: Date;
  ruleId: string;
  customerId?: string;
  merchantId?: string;
  orderId?: string;
}
```

### Ecosystem Types (src/integrations/ecosystemServices.ts)

```typescript
// Timeline Event
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

// Unified Profile
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

// Knowledge Search Result
interface KnowledgeSearchResult {
  id: string;
  content: string;
  title: string;
  category: string;
  similarity: number;
  metadata?: Record<string, any>;
}
```

---

## Environment Variables

### Required

```bash
# Core
PORT=4058
NODE_ENV=production
MONGODB_URI=mongodb+srv://...

# Security
INTERNAL_SERVICE_TOKEN=
```

### RABTUL Services

```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
NOTIFICATIONS_SERVICE_URL=https://rez-notifications.onrender.com
PROFILE_SERVICE_URL=https://rez-profile-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
ORDER_SERVICE_URL=https://rez-order-service.onrender.com
```

### REZ Intelligence

```bash
INTENT_SERVICE_URL=https://rez-intent-predictor.onrender.com
PREDICTIVE_ENGINE_URL=https://REZ-predictive-engine.onrender.com
SIGNAL_AGGREGATOR_URL=https://REZ-signal-aggregator.onrender.com
RECOMMENDATION_ENGINE_URL=https://REZ-recommendation-engine.onrender.com
```

### Ecosystem Services

```bash
REZ_MEMORY_URL=https://rez-memory-layer.onrender.com
REZ_UNIFIED_PROFILE_URL=https://rez-unified-profile.onrender.com
REZ_WORKFLOW_URL=https://rez-workflow-builder.onrender.com
VECTOR_SEARCH_URL=https://rez-vector-search.onrender.com
```

### WhatsApp

```bash
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

---

## Features by Category

### Core Support
- [x] Ticket management (create, update, resolve)
- [x] Ticket routing (auto-assign, manual)
- [x] Agent management
- [x] Escalation engine
- [x] Priority handling

### Customer Experience
- [x] CSAT surveys
- [x] Sentiment analysis
- [x] Self-service recovery
- [x] Auto-ticket creation
- [x] Cross-platform memory

### Channels
- [x] WhatsApp (send/receive)
- [x] Mobile SDK
- [x] Web chat
- [x] Email integration
- [x] SMS notifications

### AI/Intelligence
- [x] Intent detection
- [x] Churn prediction
- [x] LTV prediction
- [x] Signal aggregation
- [x] Recommendation engine
- [x] Customer timeline
- [x] Unified profile
- [x] RAG/Knowledge
- [x] Workflow automation

### Expert Services
- [x] Hospitality
- [x] Salon
- [x] Fitness
- [x] Health
- [x] Education
- [x] Travel
- [x] Retail
- [x] Culinary

### Merchant Features
- [x] Merchant communication
- [x] Multi-tenant support
- [x] Merchant portal
- [x] Partner analytics

### Analytics
- [x] CSAT trends
- [x] Category breakdown
- [x] Platform comparison
- [x] Agent leaderboard
- [x] Merchant reports

### Autonomous Actions
- [x] Auto-refund
- [x] Wallet credit
- [x] Loyalty points
- [x] Karma rewards
- [x] Notification trigger
- [x] Campaign trigger
- [x] Retention offer

---

## Mobile SDK

### Client (REZ-Consumer/REZ-App/src/services/support/rezCareClient.ts)

```typescript
const MOBILE_API_PATH = '/api/mobile-sdk';

// Tickets
getTickets()
getTicket(id: string)
createTicket(data: CreateTicketInput)
respondToTicket(id: string, message: string)
resolveTicket(id: string, resolution?: string)

// CSAT
submitCSAT(data: CSATInput)
getPendingCSAT()

// Knowledge
searchKnowledge(query: string)
getArticle(id: string)
getFAQs()

// Chat
startChat(data: StartChatInput)
sendMessage(chatId: string, message: string)
getChatHistory(chatId: string)

// Orders
getSupportOptions(orderId: string)
cancelOrder(orderId: string, reason: string)
requestRefund(orderId: string, reason: string)
```

### Usage Example

```typescript
import { rezCareClient } from '../services/support/rezCareClient';

// Get support options for an order
const options = await rezCareClient.getSupportOptions('order_123');
// { canCancel: true, canRefund: true, canModify: false }

// Submit CSAT
await rezCareClient.submitCSAT({
  ticketId: 'ticket_456',
  rating: 5,
  feedback: 'Great service!'
});

// Search knowledge base
const results = await rezCareClient.searchKnowledge('refund policy');
```

---

## WebSocket Events

### Client → Server

```typescript
// Subscribe to alerts
socket.emit('subscribe', { room: 'alerts', id: alertId });

// Identify as agent
socket.emit('identify', { userId: 'agent123', name: 'Agent', role: 'support' });
```

### Server → Client

```typescript
// New alert
socket.on('alert:new', (alert) => { ... });

// Alert resolved
socket.on('alert:resolved', (alert) => { ... });

// Ticket update
socket.on('ticket:update', (ticket) => { ... });

// Metrics update (every 30s)
socket.on('metrics:update', (metrics) => { ... });

// Customer context
socket.on('customer:context', (context) => { ... });
```

---

## Deployment

### NPM Scripts

```bash
npm run dev      # Development with hot reload
npm run build    # TypeScript compilation
npm start        # Production server
npm test         # Run tests
```

### Render Blueprint (render.yaml)

```yaml
services:
  - name: rez-care-platform
    port: 4058
    plan: starter
    healthCheckPath: /health

  - name: rez-care-intelligence
    port: 4033
    plan: starter

  - name: rez-care-experts
    port: 3005
    plan: starter
```

### Pre-Deployment Checklist

1. [ ] All new services implemented
2. [ ] All new routes added to index.ts
3. [ ] All imports verified
4. [ ] TypeScript compiles without errors
5. [ ] No console.log or debug code left
6. [ ] Environment variables documented
7. [ ] Ecosystem integrations connected
8. [ ] Mobile SDK client updated
9. [ ] SOT.md updated

### Build & Test

```bash
cd REZ-Intelligence/REZ-care-service
npm run build
```

### Health Check

```bash
# Service health
curl http://localhost:4058/health

# Ecosystem health
curl http://localhost:4058/api/ecosystem/health

# Mobile SDK
curl http://localhost:4058/api/mobile-sdk/tickets
```

---

## Connected Services

### By Category

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| **RABTUL** |
| Auth | 4002 | ✅ | Token verification |
| Wallet | 4004 | ✅ | Reward customers |
| Notifications | 4011 | ✅ | Push, SMS, WhatsApp |
| Profile | 4013 | ✅ | Customer 360 |
| Event Bus | 4025 | ✅ | Publish events |
| **REZ Intelligence** |
| Intent Predictor | 4018 | ✅ | Intent detection |
| Predictive Engine | 4123 | ✅ | Churn, LTV |
| Signal Aggregator | 4121 | ✅ | Behavioral signals |
| Recommendation | 4120 | ✅ | Product upsells |
| **Ecosystem** |
| Memory Layer | 4201 | ✅ | Customer Timeline |
| Unified Profile | 4060 | ✅ | Customer 360 |
| Workflow Builder | 4045 | ✅ | Automation |
| Vector Search | 4127 | ✅ | RAG/Knowledge |
| **WhatsApp** |
| WhatsApp Business API | - | ✅ | Send/receive |

---

## Next Session Checklist

Before starting any work on REZ Care:

1. [ ] Read this SOT.md file
2. [ ] Check INTEGRATION-STATUS.md for current status
3. [ ] Review PRIORITY-ROADMAP.md for future work
4. [ ] Check DEPLOYMENT-CHECKLIST.md before changes
5. [ ] Reference INTEGRATION-MANIFEST.md for complete inventory

### Quick Reference

| Item | Location |
|------|---------|
| All files | `src/` directory |
| Routes | `src/routes/` |
| Services | `src/services/` |
| Integrations | `src/integrations/` |
| Types | `src/types/index.ts` |
| Main entry | `src/index.ts` |
| Mobile SDK | `/api/mobile-sdk/*` |
| Ecosystem | `/api/ecosystem/*` |
| Ecosystem code | `src/integrations/ecosystemServices.ts` |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| May 21, 2026 | 3.0 | Initial release |
| May 22, 2026 | 3.1 | Ecosystem integrations added |
| May 22, 2026 | 3.1 | SOT.md created (consolidated documentation) |

---

**Last Updated:** May 22, 2026
**Version:** 3.1.0
**Maintainer:** REZ-Intelligence Team
