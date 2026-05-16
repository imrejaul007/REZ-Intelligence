# REZ Unified CRM Hub

**⚠️ INTERNAL USE ONLY - For REZ Platform Team Only ⚠️**

**The most advanced CRM intelligence system combining HubSpot + Klaviyo + Toast + Shopify CRM**

---

## ⚠️ IMPORTANT: Data Classification

**This system contains INTERNAL INTELLIGENCE DATA that is NOT for external access.**

### 🔒 INTERNAL Only (REZ Platform Team)

| Data Type | Description |
|-----------|-------------|
| **Customer 360** | Complete customer profile with all intelligence |
| **AI Predictions** | Churn probability, LTV, conversion scores |
| **Intent Signals** | Browsing behavior, purchase intent, brand affinity |
| **Behavioral Analysis** | Raw visit patterns, session data, device patterns |
| **Engagement Scores** | Internal scoring algorithms, channel preferences |
| **Smart Tags (AI)** | Auto-generated tags with confidence scores |
| **Visit Patterns** | Detailed timing, frequency, location |
| **Model Outputs** | AI model versions, confidence scores, predictions |

### 👁️ Merchant-Facing (Safe to Show)

| Data Type | Description |
|-----------|-------------|
| **Customer Name** | Display name only |
| **Contact (if allowed)** | Phone if customer permits |
| **Order History** | What they ordered, when, total |
| **Basic Segment** | VIP, New, Regular (no internal scoring) |
| **Last Visit** | Date of last order |
| **Total Spend** | Lifetime value in rupees |

**RULE: NO internal intelligence data (AI predictions, intent, engagement scores, raw behavioral data) should ever be exposed to merchants or customers.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTERNAL CRM INTELLIGENCE                                │
│                    (REZ Platform Team Only)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATA SOURCES:                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ REZ NOW     │ │ REZ MEDIA    │ │ CorpPerks    │ │ External     │    │
│  │ Consumer     │ │ Ads/Engage   │ │ Enterprise   │ │ CRM (HubSpot │    │
│  │ Orders/CRM  │ │ Campaigns    │ │ Sales        │ │  Zoho)      │    │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘    │
│         │                  │                  │                  │              │
│         ▼                  ▼                  ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │              REZ INTELLIGENCE LAYER                       │            │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │            │
│  │  │ Identity    │ │ Predictive  │ │ Intent Graph    │   │            │
│  │  │ Graph       │ │ Engine      │ │ (Internal)      │   │            │
│  │  │ (4050)     │ │ (4059)     │ │ (4070)         │   │            │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘   │            │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │            │
│  │  │ RFM Engine  │ │ Engagement  │ │ Behavioral      │   │            │
│  │  │ (4055)     │ │ Scorer      │ │ Analysis        │   │            │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘   │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                               │                                            │
│                               ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │              UNIFIED CRM HUB (Port 4100)                    │            │
│  │  🔒 INTERNAL USE ONLY - DO NOT EXPOSE TO MERCHANTS        │            │
│  │  • Customer 360 (Full Intelligence)                        │            │
│  │  • AI Predictions (Churn, LTV, Intent)                   │            │
│  │  • Smart Tags (AI-Generated)                             │            │
│  │  • Engagement Scoring                                     │            │
│  │  • Intent Signals                                        │            │
│  │  • Behavioral Analysis                                    │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    │ (Data is sanitized before passing)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MERCHANT-FACING CRM                                    │
│                    (Safe Data Only)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │              MERCHANT API (Port 4101)                      │            │
│  │  👁️ SANITIZED DATA - SAFE FOR MERCHANTS                 │            │
│  │  • Customer Name                                         │            │
│  │  • Basic Segment (VIP, New, Regular)                     │            │
│  │  • Order History                                        │            │
│  │  • Last Visit Date                                      │            │
│  │  • Total Spend                                          │            │
│  │  • Basic Tags (useful for service)                      │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │              MERCHANT DASHBOARD                             │            │
│  │  • Customer List (Names, Orders, Spend)                   │            │
│  │  • Basic Analytics                                      │            │
│  │  • Campaign Management                                  │            │
│  │  • Loyalty Stats                                       │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 🔒 Internal API (Port 4100)

**Requires: `X-Internal-Token` header**

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Dashboard** | | |
| GET | `/api/v1/internal/dashboard/overview` | Full dashboard with internal metrics |
| **Customers** | | |
| GET | `/api/v1/internal/customers` | List all customers with intelligence |
| GET | `/api/v1/internal/customers/:id` | Customer 360 (full profile) |
| GET | `/api/v1/internal/customers/:id/predictions` | AI predictions (churn, LTV) |
| GET | `/api/v1/internal/customers/:id/intent` | Intent signals |
| GET | `/api/v1/internal/customers/:id/engagement` | Engagement scoring |
| GET | `/api/v1/internal/customers/:id/behavior` | Behavioral analysis |
| **Smart Tags** | | |
| GET | `/api/v1/internal/tags` | All AI-generated tags |
| GET | `/api/v1/internal/tags/:id/customers` | Customers by tag |
| **Segments** | | |
| GET | `/api/v1/internal/segments` | All internal segments |
| GET | `/api/v1/internal/segments/:id/analysis` | Segment analysis |

### 👁️ Merchant API (Port 4101)

**Requires: Merchant authentication**

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Customers** | | |
| GET | `/api/v1/merchant/customers` | Merchant-safe customer list |
| GET | `/api/v1/merchant/customers/:id` | Customer detail (sanitized) |
| GET | `/api/v1/merchant/customers/:id/orders` | Order history |
| GET | `/api/v1/merchant/customers/:id/reviews` | Customer reviews |
| **Segments** | | |
| GET | `/api/v1/merchant/segments` | Basic segments |
| **Inbox** | | |
| GET | `/api/v1/merchant/inbox/messages` | Unified messages |
| POST | `/api/v1/merchant/inbox/messages/:id/reply` | Reply to message |

---

## What This System Does

### For REZ Platform Team (Internal)

1. **Customer 360 Intelligence**
   - Complete customer profile with all data sources
   - AI-powered predictions (churn, LTV, conversion)
   - Intent signal tracking
   - Behavioral analysis
   - Engagement scoring

2. **Smart Tags Engine**
   - AI auto-generates customer tags
   - Order pattern analysis
   - Category affinity scoring
   - Lifestyle inference
   - Confidence scores

3. **Intent Graph**
   - Browsing signals
   - Purchase intent scoring
   - Brand affinity
   - Competitor interest
   - Life events

4. **Predictive Analytics**
   - Churn prediction
   - Next purchase prediction
   - LTV forecasting
   - Cross-sell opportunities

### For Merchants (Safe Data Only)

1. **Customer List**
   - Names, contact (if allowed)
   - Order history
   - Basic segments (VIP, New, Regular)
   - Last visit, total spend

2. **Basic Analytics**
   - Sales, orders, AOV
   - Retention metrics
   - Basic segment performance

3. **Campaign Management**
   - Send offers to segments
   - Track campaign performance

4. **Inbox**
   - WhatsApp, SMS, etc.
   - Message history
   - Quick replies

---

## Data Sources Connected

### REZ Intelligence

| Service | Port | Internal Data |
|---------|------|---------------|
| Identity Graph | 4050 | User identity resolution |
| Predictive Engine | 4059 | Churn, LTV, conversion predictions |
| RFM Service | 4055 | Recency, Frequency, Monetary |
| Intent Graph | 4070 | Browsing, intent signals |
| Engagement Scorer | 4065 | Engagement scoring |
| Unified Profile | 4060 | Full customer profile |

### REZ Media

| Service | Data |
|---------|------|
| Engagement Platform | Loyalty, points, tiers |
| Campaign Builder | Campaign performance |
| Attribution System | Ad attribution |
| DOOH Intelligence | Screen engagement |

### REZ Consumer

| Service | Data |
|---------|------|
| REZ NOW | Orders, customers, CRM |
| rez-now CRM | Segments, analytics |

### External

| Source | Data |
|--------|------|
| HubSpot | CRM contacts, deals |
| Zoho CRM | CRM contacts, deals |
| Shopify | E-commerce data (future) |
| WooCommerce | E-commerce data (future) |

---

## Quick Start

```bash
# Install dependencies
cd REZ-Intelligence/REZ-unified-crm-hub
npm install

# Copy environment
cp .env.example .env

# Run development
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

---

## Environment Variables

```bash
# Service
PORT=4100
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/rez-unified-crm-hub

# Redis
REDIS_URL=redis://localhost:6379

# Internal Service Token (REQUIRED)
INTERNAL_SERVICE_TOKEN=your-secure-token-here

# REZ Intelligence Services
IDENTITY_GRAPH_URL=http://localhost:4050
PREDICTIVE_ENGINE_URL=http://localhost:4059
RFM_SERVICE_URL=http://localhost:4055
INTENT_GRAPH_URL=http://localhost:4070
ENGAGEMENT_SCORER_URL=http://localhost:4065
UNIFIED_PROFILE_URL=http://localhost:4060
CUSTOMER_INTELLIGENCE_URL=http://localhost:4140

# REZ Consumer Services
REZ_NOW_URL=http://localhost:3000
MERCHANT_SERVICE_URL=http://localhost:4005

# REZ Media Services
ENGAGEMENT_PLATFORM_URL=http://localhost:4017
CAMPAIGN_BUILDER_URL=http://localhost:4009

# External CRM
CRM_HUB_URL=http://localhost:4056
```

---

## Security Rules

1. **NEVER expose internal intelligence to merchants**
   - No AI predictions in merchant API
   - No engagement scores in merchant API
   - No intent signals in merchant API
   - No raw behavioral data in merchant API

2. **ALWAYS sanitize data for merchant API**
   - Only show: name, orders, basic segments
   - Remove: scores, predictions, patterns

3. **Use separate ports**
   - Internal API: Port 4100
   - Merchant API: Port 4101

4. **Require authentication on all endpoints**
   - Internal: Service token
   - Merchant: Merchant JWT

---

## License

Proprietary - RABTUL Technologies
