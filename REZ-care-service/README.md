# REZ Care Service

> **AI Commerce Recovery & Customer Intelligence Platform**
> Version 3.1.0 | Port 4058

---

## Overview

REZ Care is a unified customer support system that provides AI-powered assistance, proactive issue detection, self-service tools, and complete customer intelligence.

### Key Features

- **Customer 360** - Unified view from all data sources
- **CSAT + Sentiment** - Track and improve satisfaction
- **Proactive Detection** - Catch problems before customers complain
- **Self-Service Recovery** - Let customers fix issues themselves
- **Auto-Ticket Generation** - Automatically create tickets for issues
- **Cross-Platform Memory** - Track issues across all touchpoints
- **Agent Management** - Routing, performance, team management
- **Escalation Engine** - Smart escalation rules
- **WhatsApp Integration** - Send/receive via WhatsApp Business API
- **Reports & Analytics** - CSAT trends, categories, leaderboards
- **Ecosystem Integration** - Timeline, Profile, Workflows, RAG/Knowledge

---

## Quick Start

```bash
# Install dependencies
cd REZ-Intelligence/REZ-care-service
npm install

# Development
npm run dev

# Production
npm run build && npm start
```

---

## API Reference

### Health Check

```
GET /health
```

### Mobile SDK (`/api/mobile-sdk/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tickets` | GET | List tickets |
| `/tickets/:id` | GET | Get ticket |
| `/tickets` | POST | Create ticket |
| `/tickets/:id/respond` | POST | Reply to ticket |
| `/tickets/:id/resolve` | POST | Resolve ticket |
| `/csat` | POST | Submit CSAT |
| `/csat/pending` | GET | Pending surveys |
| `/knowledge/search` | GET | Search KB |
| `/knowledge/:id` | GET | Get article |
| `/faqs` | GET | List FAQs |
| `/chat/start` | POST | Start chat |
| `/chat/send` | POST | Send message |
| `/chat/:id/history` | GET | Chat history |
| `/orders/:id/support-options` | GET | Support options |
| `/orders/:id/cancel` | POST | Cancel order |
| `/orders/:id/refund` | POST | Request refund |

### Ecosystem (`/api/ecosystem/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | All services health |
| `/customer/:id` | GET | Enriched context |
| `/timeline` | POST | Add timeline event |
| `/timeline/:id` | GET | Get timeline |
| `/timeline/:id/summary` | GET | Timeline summary |
| `/timeline/:id/patterns` | GET | Detect patterns |
| `/profile/:id` | GET | Get profile |
| `/profile/:id/segments` | GET | Get segments |
| `/workflows/trigger` | POST | Trigger workflow |
| `/knowledge/search` | POST | Semantic search |
| `/knowledge/rag` | POST | RAG context |
| `/ai/suggest` | POST | AI suggestion |

### Self-Service (`/api/mobile/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/actions` | GET | Available actions |
| `/execute` | POST | Execute action |
| `/retry-payment` | POST | Retry payment |
| `/sync-wallet` | POST | Sync wallet |
| `/history` | GET | Issue history |
| `/similar-issues` | GET | Similar issues |
| `/predictions` | GET | Issue predictions |
| `/report-issue` | POST | Report issue |
| `/rate` | POST | Rate experience |
| `/refund-status/:id` | GET | Refund status |

### Support (`/api/support/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tickets` | POST | Create ticket |
| `/tickets` | GET | List tickets |
| `/tickets/:id` | GET | Get ticket |
| `/tickets/:id` | PATCH | Update ticket |
| `/tickets/:id/messages` | POST | Add message |
| `/tickets/:id/history` | GET | Get history |

### WhatsApp (`/api/whatsapp/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook` | GET | Verify webhook |
| `/webhook` | POST | Receive message |
| `/send` | POST | Send text |
| `/menu` | POST | Send buttons |
| `/list` | POST | Send list |
| `/templates` | GET | List templates |

### Agents (`/api/agents/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | Create agent |
| `/` | GET | List agents |
| `/:id` | GET | Get agent |
| `/:id` | PATCH | Update agent |
| `/:id/status` | POST | Set status |
| `/assign` | POST | Auto-assign |
| `/:id/assign` | POST | Manual assign |
| `/:id/escalate` | POST | Escalate |
| `/:id/performance` | GET | Performance |
| `/team/performance` | GET | Team performance |

### Reports (`/api/reports/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/overview` | GET | Overview |
| `/csat-trends` | GET | CSAT trends |
| `/categories` | GET | Category breakdown |
| `/platforms` | GET | Platform comparison |
| `/leaderboard` | GET | Agent leaderboard |
| `/merchants` | GET | Merchant issues |

### CSAT (`/api/csat/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/respond` | POST | Submit response |
| `/metrics` | GET | Get metrics |
| `/send` | POST | Send survey |

### Alerts (`/api/alerts/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/active` | GET | Get active |
| `/` | POST | Create alert |

### Cross-Platform Memory (`/api/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/issues/record` | POST | Record issue |
| `/customers/:id/issue-history` | GET | Issue history |
| `/issues/similar` | GET | Similar issues |
| `/merchant/:id/issue-profile` | GET | Merchant profile |
| `/issues/platform-wide` | GET | Platform-wide issues |
| `/customers/:id/predict-issues` | GET | Predict issues |

---

## WebSocket Events

```javascript
// Client → Server
socket.emit('subscribe', { room: 'alerts', id: alertId });
socket.emit('identify', { userId: 'agent123', role: 'support' });

// Server → Client
socket.on('alert:new', (alert) => { ... });
socket.on('alert:resolved', (alert) => { ... });
socket.on('ticket:update', (ticket) => { ... });
socket.on('metrics:update', (metrics) => { ... });
```

---

## Environment Variables

```bash
# Core
PORT=4058
MONGODB_URI=mongodb://...
INTERNAL_SERVICE_TOKEN=

# RABTUL
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
NOTIFICATIONS_SERVICE_URL=https://rez-notifications.onrender.com
PROFILE_SERVICE_URL=https://rez-profile-service.onrender.com

# REZ Intelligence
INTENT_SERVICE_URL=https://rez-intent-predictor.onrender.com
PREDICTIVE_ENGINE_URL=https://REZ-predictive-engine.onrender.com
SIGNAL_AGGREGATOR_URL=https://REZ-signal-aggregator.onrender.com

# Ecosystem
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

## Architecture

```
REZ CARE (4058)
├── Mobile SDK (/api/mobile-sdk)
├── Self-Service (/api/mobile)
├── WhatsApp (/api/whatsapp)
├── Support (/api/support)
├── Ecosystem (/api/ecosystem) ← NEW
│   ├── Memory Layer (4201)
│   ├── Unified Profile (4060)
│   ├── Workflow Builder (4045)
│   └── Vector Search (4127)
├── CSAT (/api/csat)
├── Agents (/api/agents)
├── Escalation (/api/escalation)
├── Reports (/api/reports)
├── Email (/api/email)
├── Clients (/api/clients)
├── Merchant (/api/merchant)
├── Upsell (/api/upsell, /api/smart-upsell)
└── WebSocket (real-time)
```

---

## Connected Services

| Service | Port | Purpose |
|---------|------|---------|
| **RABTUL** |
| Auth | 4002 | Token verification |
| Wallet | 4004 | Rewards |
| Notifications | 4011 | Push, SMS |
| Profile | 4013 | Customer data |
| **REZ Intelligence** |
| Intent | 4018 | Intent detection |
| Predictive | 4123 | Churn/LTV |
| Signals | 4121 | Behavioral signals |
| **Ecosystem** |
| Memory Layer | 4201 | Timeline |
| Unified Profile | 4060 | Customer 360 |
| Workflow Builder | 4045 | Automation |
| Vector Search | 4127 | RAG/Knowledge |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [SOT.md](SOT.md) | **Complete Source of Truth** |
| [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) | Pre-deployment checklist |
| [INTEGRATION-MANIFEST.md](INTEGRATION-MANIFEST.md) | Complete inventory |
| [INTEGRATION-STATUS.md](INTEGRATION-STATUS.md) | Current status |
| [PRIORITY-ROADMAP.md](PRIORITY-ROADMAP.md) | Future roadmap |

---

## License

Internal use only - RABTUL Technologies
