# REZ Care - Complete Integration Manifest
# This document tracks EVERYTHING that exists

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| May 21, 2026 | 3.0 | Initial release |
| May 22, 2026 | 3.1 | Ecosystem integrations added |

---

## Architecture Overview

```
REZ CARE ECOSYSTEM (3 Core Domains)
│
├── REZ Care Platform (4058)
│   ├── Ticketing System
│   ├── CSAT Surveys
│   ├── Live Chat
│   ├── WhatsApp Integration
│   ├── Agent Management
│   ├── Escalation Engine
│   ├── Self-Service
│   ├── Reports & Analytics
│   └── Ecosystem Integration ✅
│       ├── REZ-memory-layer (4201)
│       ├── REZ-unified-profile (4060)
│       ├── REZ-workflow-builder (4045)
│       └── Vector Search (4127)
│
├── REZ Care Intelligence (4033)
│   ├── Intent Detection
│   ├── Sentiment Analysis
│   ├── AI Routing
│   ├── Cross-Platform Memory
│   └── Prediction (Churn/LTV)
│
└── REZ Care Experts (3005)
    ├── Hospitality Expert
    ├── Salon Expert
    ├── Fitness Expert
    ├── Health Expert
    ├── Education Expert
    ├── Travel Expert
    ├── Retail Expert
    └── Culinary Expert
```

---

## Complete File Inventory

### Source Files (`src/`)

| File | Lines | Purpose | Last Updated |
|------|-------|---------|--------------|
| `index.ts` | 960+ | Main entry point, all routes mounted | May 22, 2026 |
| `rabtul.ts` | 160 | RABTUL platform integration | May 21, 2026 |

### Routes (`src/routes/`)

| File | Lines | Mounted At | Endpoints |
|------|-------|------------|-----------|
| `mobileRoutes.ts` | 400+ | `/api/mobile-sdk` | 18+ |
| `whatsappRoutes.ts` | 365 | `/api/whatsapp` | 8 |
| `supportRoutes.ts` | 15K+ | `/api/support` | 20+ |
| `selfServiceRoutes.ts` | 440 | `/api/mobile` | 15+ |
| `ecosystemRoutes.ts` | 350+ | `/api/ecosystem` | 15+ |
| `emailRoutes.ts` | 9.5K | `/api/email` | 10+ |
| `clientRoutes.ts` | 11K | `/api/clients` | 8+ |
| `merchantRoutes.ts` | 12K | `/api/merchant` | 15+ |
| `upsellRoutes.ts` | 4.6K | `/api/upsell` | 5+ |
| `smartUpsellRoutes.ts` | 6.2K | `/api/smart-upsell` | 8+ |

### Services (`src/services/`)

| File | Lines | Purpose |
|------|-------|---------|
| `agentManagementService.ts` | 16K | Agent routing, performance |
| `autoTicketService.ts` | 17K | Auto-ticket creation |
| `crossPlatformIssueMemory.ts` | 24K | Issue tracking |
| `csatService.ts` | 15K | CSAT surveys |
| `proactiveDetectionService.ts` | 18K | Issue detection |
| `selfServiceService.ts` | 15K | Self-service recovery |
| `escalationEngine.ts` | 16K | Escalation logic |
| `merchantCommunicationService.ts` | 18K | Merchant messaging |
| `reportsService.ts` | 11K | Analytics |
| `whatsappService.ts` | 11K | WhatsApp API |
| `whatsappSupportService.ts` | 14K | WhatsApp support |
| `websocketServer.ts` | 8.7K | Real-time updates |
| `expertRouter.ts` | 8.5K | Expert routing |
| `expertServices.ts` | 300+ | Consolidated experts |
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

### Integrations (`src/integrations/`)

| File | Lines | Connects To | Port |
|------|-------|-------------|------|
| `ecosystemServices.ts` | 600+ | Memory, Profile, Workflow, Vector | 4201, 4060, 4045, 4127 |
| `rezIntelligence.ts` | 150+ | Intent, Predictive, Signals | 4018, 4123, 4121 |

### Middleware (`src/middleware/`)

| File | Purpose |
|------|---------|
| `errorHandler.ts` | Error handling, validation |

### Utils (`src/utils/`)

| File | Purpose |
|------|---------|
| `logger.ts` | Structured logging |

### Database (`src/database/`)

| File | Purpose |
|------|---------|
| `index.ts` | Database connection |
| `indexes.ts` | MongoDB indexes |

### Types (`src/types/`)

| File | Purpose |
|------|---------|
| `index.ts` | TypeScript interfaces |

---

## All API Endpoints

### Mobile SDK (`/api/mobile-sdk/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tickets` | List tickets |
| GET | `/tickets/:id` | Get ticket |
| POST | `/tickets` | Create ticket |
| POST | `/tickets/:id/respond` | Reply |
| POST | `/tickets/:id/resolve` | Resolve |
| POST | `/csat` | Submit CSAT |
| GET | `/csat/pending` | Pending surveys |
| GET | `/knowledge/search` | Search KB |
| GET | `/knowledge/:id` | Get article |
| GET | `/faqs` | List FAQs |
| POST | `/chat/start` | Start chat |
| POST | `/chat/send` | Send message |
| GET | `/chat/:id/history` | Chat history |
| GET | `/orders/:id/support-options` | Order options |
| POST | `/orders/:id/cancel` | Cancel order |
| POST | `/orders/:id/refund` | Request refund |

### WhatsApp (`/api/whatsapp/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhook` | Verify webhook |
| POST | `/webhook` | Receive message |
| POST | `/send` | Send text |
| POST | `/menu` | Send buttons |
| POST | `/list` | Send list |
| GET | `/templates` | List templates |

### Ecosystem (`/api/ecosystem/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | All services health |
| GET | `/customer/:id` | Enriched context |
| POST | `/timeline` | Add event |
| GET | `/timeline/:id` | Get timeline |
| GET | `/timeline/:id/summary` | Timeline summary |
| GET | `/timeline/:id/patterns` | Detect patterns |
| GET | `/profile/:id` | Get profile |
| GET | `/profile/:id/segments` | Get segments |
| GET | `/profile/:id/signals` | Get signals |
| POST | `/workflows/trigger` | Trigger workflow |
| GET | `/workflows/:id` | Workflow status |
| POST | `/knowledge/search` | Semantic search |
| POST | `/knowledge/rag` | RAG context |
| POST | `/knowledge/index` | Index document |
| POST | `/ai/suggest` | AI suggestion |
| POST | `/record` | Record interaction |

### Self-Service (`/api/mobile/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/actions` | Available actions |
| POST | `/execute` | Execute action |
| POST | `/retry-payment` | Retry payment |
| POST | `/sync-wallet` | Sync wallet |
| GET | `/history` | Issue history |
| GET | `/similar-issues` | Similar issues |
| GET | `/predictions` | Issue predictions |
| POST | `/report-issue` | Report issue |
| POST | `/rate` | Rate experience |
| GET | `/refund-status/:id` | Refund status |
| GET | `/help-topics` | Help topics |
| GET | `/help-articles/:id` | Get article |

### Support (`/api/support/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tickets` | Create ticket |
| GET | `/tickets` | List tickets |
| GET | `/tickets/:id` | Get ticket |
| PATCH | `/tickets/:id` | Update ticket |
| POST | `/tickets/:id/messages` | Add message |
| GET | `/tickets/:id/history` | Get history |

### Additional Routes

| Mount | File | Purpose |
|-------|------|---------|
| `/api/email` | emailRoutes.ts | Email support |
| `/api/clients` | clientRoutes.ts | Multi-tenant |
| `/api/merchant` | merchantRoutes.ts | Merchant portal |
| `/api/upsell` | upsellRoutes.ts | Upsells |
| `/api/smart-upsell` | smartUpsellRoutes.ts | Smart upsells |

---

## All Environment Variables

### Required

```bash
# Core
PORT=4058
NODE_ENV=production
MONGODB_URI=mongodb+srv://...

# Security
INTERNAL_SERVICE_TOKEN=

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
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

### Internal Services

```bash
SUPPORT_COPILOT_URL=https://rez-support-copilot.onrender.com
```

---

## All Connected Services

### By Category

| Service | Port | Status | Last Connected |
|---------|------|--------|----------------|
| **RABTUL** |
| Auth | 4002 | ✅ | Original |
| Wallet | 4004 | ✅ | Original |
| Notifications | 4011 | ✅ | Original |
| Profile | 4013 | ✅ | Original |
| Event Bus | 4025 | ✅ | Original |
| **REZ Intelligence** |
| Intent Predictor | 4018 | ✅ | Original |
| Predictive Engine | 4123 | ✅ | Original |
| Signal Aggregator | 4121 | ✅ | Original |
| Recommendation | 4120 | ✅ | Original |
| **Ecosystem** |
| Memory Layer | 4201 | ✅ | May 22, 2026 |
| Unified Profile | 4060 | ✅ | May 22, 2026 |
| Workflow Builder | 4045 | ✅ | May 22, 2026 |
| Vector Search | 4127 | ✅ | May 22, 2026 |

---

## All NPM Scripts

```bash
npm run dev      # Development with hot reload
npm run build    # TypeScript compilation
npm start        # Production server
npm test         # Run tests
```

---

## All Render Services (Blueprint)

| Service | Port | Plan | Instances |
|---------|------|------|-----------|
| rez-care-platform | 4058 | starter | 1 |
| rez-care-intelligence | 4033 | starter | 1 |
| rez-care-experts | 3005 | starter | 1 |

---

## All Features by Category

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

## Documentation Files

| File | Purpose |
|------|---------|
| `DEPLOYMENT-CHECKLIST.md` | Pre-deployment checklist |
| `INTEGRATION-STATUS.md` | Integration status tracker |
| `PRIORITY-ROADMAP.md` | Future roadmap |
| `SOT.md` | Source of truth (ecosystem) |

---

## Next Time Checklist

Before starting any work on REZ Care:

1. [ ] Read this manifest
2. [ ] Check current integration status in `INTEGRATION-STATUS.md`
3. [ ] Review roadmap in `PRIORITY-ROADMAP.md`
4. [ ] Check deployment checklist `DEPLOYMENT-CHECKLIST.md`
5. [ ] Review SOT.md for context

---

Last Updated: May 22, 2026
