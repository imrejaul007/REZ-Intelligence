# MERCHANT GROWTH OS - ECOSYSTEM INTEGRATION

**Version:** 1.0  
**Date:** June 4, 2026  

---

## OVERVIEW

The Merchant Growth OS services are designed to integrate with the entire REZ ecosystem. This document describes all integration points.

---

## INTEGRATION ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    MERCHANT GROWTH OS                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │   Budget     │ │   Growth    │ │   Health    │         │
│  │   Optimizer  │ │   Playbook  │ │   Score     │         │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘         │
│         │                  │                  │                 │
│  ┌──────┴────────────────┴──────────────────┴───────┐         │
│  │           ECOSYSTEM INTEGRATION LAYER             │         │
│  └──────┬────────────────┬──────────────────┬───────┘         │
└─────────┼────────────────┼──────────────────┼─────────────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      RABTUL-TECHNOLOGIES                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │  Wallet  │  │ Payment  │  │  Catalog │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                         HOJAI-AI                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Enterprise │  │  Identity │  │Dashboard │  │  Billing  │  │
│  │   Brain   │  │           │  │          │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    REZ-INTELLIGENCE                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Mind   │  │ Intent   │  │  Agent   │  │   MCP    │  │
│  │          │  │  Graph   │  │Orchestrat│  │  Layer   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## SERVICE INTEGRATIONS

### 1. REZ Budget Optimizer (Port 4290)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Verify merchant identity |
| **Wallet** | RABTUL Wallet | Check balance, deduct/refund |
| **HOJAI** | Enterprise Brain | AI recommendations |
| **REZ** | Campaign Service | Sync budget allocation |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
HOJAI_BRAIN_URL=http://localhost:4600
CAMPAIGN_SERVICE_URL=http://localhost:4301
```

---

### 2. REZ Growth Playbook (Port 4291)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Verify merchant |
| **HOJAI** | Enterprise Brain | AI playbook recommendations |
| **REZ** | Campaign Service | Create campaigns from playbooks |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
HOJAI_BRAIN_URL=http://localhost:4600
CAMPAIGN_SERVICE_URL=http://localhost:4301
```

---

### 3. REZ Merchant Health Score (Port 4293)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Merchant profile data |
| **Wallet** | RABTUL Wallet | Transaction history |
| **Loyalty** | RABTUL Loyalty | Loyalty metrics |
| **HOJAI** | Enterprise Brain | AI recommendations |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
LOYALTY_SERVICE_URL=http://localhost:4305
HOJAI_BRAIN_URL=http://localhost:4600
```

---

### 4. REZ Offline Attribution (Port 4294)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Customer lookup |
| **Wallet** | RABTUL Wallet | Award cashback |
| **QR** | REZ QR Service | QR code data |
| **HOJAI** | Enterprise Brain | Attribution analytics |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
QR_SERVICE_URL=http://localhost:4306
HOJAI_BRAIN_URL=http://localhost:4600
```

---

### 5. REZ Competitor Alerts (Port 4295)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Subscription check |
| **HOJAI** | Enterprise Brain | AI strategy recommendations |
| **REZ** | Campaign Service | Counter-campaigns |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
HOJAI_BRAIN_URL=http://localhost:4600
CAMPAIGN_SERVICE_URL=http://localhost:4301
```

---

### 6. REZ Review Response Engine (Port 4296)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Merchant settings |
| **HOJAI** | Enterprise Brain | AI response generation |
| **Notification** | RABTUL Notification | Alert merchant |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
HOJAI_BRAIN_URL=http://localhost:4600
NOTIFICATION_SERVICE_URL=http://localhost:4307
```

---

### 7. REZ Unified Offer Brain (Port 4297)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Customer segments |
| **Wallet** | RABTUL Wallet | Customer LTV, offer awards |
| **HOJAI** | Enterprise Brain | AI optimization |
| **REZ** | Campaign Service | Create offer campaigns |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
HOJAI_BRAIN_URL=http://localhost:4600
CAMPAIGN_SERVICE_URL=http://localhost:4301
```

---

### 8. REZ Revenue Forecast (Port 4213)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Merchant info |
| **Wallet** | RABTUL Wallet | Historical revenue |
| **POS** | REZ POS Service | Order data |
| **HOJAI** | Enterprise Brain | Weather, events, AI prediction |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
POS_SERVICE_URL=http://localhost:4308
HOJAI_BRAIN_URL=http://localhost:4600
```

---

### 9. REZ Prompt Studio (Port 4299)

| Integration | Service | Purpose |
|------------|---------|---------|
| **HOJAI** | Enterprise Brain | AI capabilities, testing |
| **Auth** | RABTUL Auth | User permissions |

**Environment Variables:**
```bash
HOJAI_BRAIN_URL=http://localhost:4600
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
```

---

### 10. REZ Neighborhood Analytics (Port 4214)

| Integration | Service | Purpose |
|------------|---------|---------|
| **Auth** | RABTUL Auth | Merchant location |
| **HOJAI** | Enterprise Brain | Weather, events, demographics |
| **REZ** | Campaign Service | Hyperlocal campaigns |

**Environment Variables:**
```bash
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
HOJAI_BRAIN_URL=http://localhost:4600
CAMPAIGN_SERVICE_URL=http://localhost:4301
```

---

## SHARED INFRASTRUCTURE

### MongoDB

All services share the same MongoDB instance for data consistency:

```
MongoDB: mongodb://mongodb:27017
Databases:
- rez_budget_optimizer
- rez_growth_playbook
- rez_merchant_health
- rez_offline_attribution
- rez_competitor_alerts
- rez_review_engine
- rez_offer_brain
- rez_revenue_forecast
- rez_prompt_studio
- rez_pricing_tracker
- rez_neighborhood_analytics
```

### Redis

For caching and session management:

```
Redis: redis://redis:6379
```

### Internal Service Token

All services use the same internal token for inter-service communication:

```
INTERNAL_SERVICE_TOKEN=your-secure-token
```

---

## SERVICE DISCOVERY

Services discover each other via environment variables. Each service should:

1. Check for local URL first (for docker networking)
2. Fall back to cloud URLs
3. Use health checks before making requests

---

## DOCKER COMPOSE INTEGRATION

The docker-compose includes:

```yaml
services:
  # Existing ecosystem services should be added here
  rez-auth-service:
    # ...

  rez-wallet-service:
    # ...

  hojai-enterprise-brain:
    # ...

  # New Merchant Growth OS services
  rez-budget-optimizer:
    environment:
      - AUTH_SERVICE_URL=http://rez-auth-service:3001
      - WALLET_SERVICE_URL=http://rez-wallet-service:3002
      - HOJAI_BRAIN_URL=http://hojai-enterprise-brain:4600
```

---

## SECURITY

### Authentication Flow

1. External request → RABTUL Auth
2. Auth validates and issues token
3. Token used for all subsequent calls
4. Internal calls use `X-Internal-Token` header

### Data Isolation

- Each merchant's data is isolated by `merchantId`
- Multi-tenant MongoDB with collection-level access control
- No cross-merchant data access

---

**Document Version:** 1.0  
**Last Updated:** June 4, 2026
