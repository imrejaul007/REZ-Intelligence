# REZ-Intelligence Complete Service Registry

**Updated:** May 16, 2026
**Version:** 2.0.0

---

## Service Summary

| Category | Count | Services |
|----------|-------|----------|
| **Signal Sources** | 5 | Location, Behavioral, Social, Competitor, Attribution |
| **Intelligence** | 4 | Unified Profile, Signal Aggregator, Predictive, Realtime Segments |
| **Merchants** | 1 | Merchant Intelligence |
| **Campaigns** | 2 | QR Campaigns, Hyperlocal Targeting |
| **Commerce** | 1 | Commerce Signal Connector |
| **Hubs** | 3 | Customer Hub, Inventory, Delivery |
| **AI/ML** | 8 | Intent, Recommendation, Personalization, etc. |
| **Identity** | 2 | Identity Graph, Unified Identity |
| **Events** | 2 | Event Bus, Event Connector |
| **Experts** | 10+ | Fitness, Health, Retail, etc. |
| **Total** | **100+** | |

---

## SIGNAL INFRASTRUCTURE

### Signal Sources (Level 1)

| Service | Port | Purpose | Database |
|---------|------|---------|----------|
| `rez-location-intelligence` | 4115 | Location patterns, geofencing | MongoDB |
| `rez-behavioral-psychology` | 4110 | Buyer psychology, spending patterns | MongoDB |
| `rez-social-signals` | 4116 | Sharing, influence, referrals | MongoDB |
| `rez-competitor-detection` | 4117 | Competitor switching, win-back | MongoDB |
| `rez-crosschannel-attribution` | - | Multi-touch attribution | MongoDB |

### Signal Aggregation (Level 2)

| Service | Port | Purpose | Database | Dependencies |
|---------|------|---------|----------|-------------|
| `REZ-signal-aggregator` | 4121 | Combine all signals | MongoDB + Redis | Location, Behavioral, Social, Competitor |
| `REZ-event-bus` | 4031 | Event streaming | Redis | All services |

### Intelligence (Level 3)

| Service | Port | Purpose | Database | Dependencies |
|---------|------|---------|----------|-------------|
| `REZ-unified-profile` | 4120 | Single user profile | MongoDB | Signal Aggregator |
| `REZ-predictive-engine` | 4123 | Churn, LTV, Revisit | MongoDB | Signal Aggregator |
| `REZ-realtime-segments` | 4126 | Real-time segment eval | MongoDB + Redis | Unified Profile |

### Merchants (Level 4)

| Service | Port | Purpose | Database | Dependencies |
|---------|------|---------|----------|-------------|
| `REZ-merchant-intelligence` | 4122 | Merchant dashboard | MongoDB | Signal Aggregator, Predictive |

### Campaigns (Level 4)

| Service | Port | Purpose | Database | Dependencies |
|---------|------|---------|----------|-------------|
| `REZ-qr-campaigns` | 4130 | QR-triggered campaigns | MongoDB | None |
| `REZ-hyperlocal-targeting` | 4124 | Geofence targeting | MongoDB | Location Intelligence |

### Commerce Connectors (Level 4)

| Service | Port | Purpose | Dependencies |
|---------|------|---------|-------------|
| `REZ-commerce-signal-connector` | 4150 | Emit signals from commerce | Unified Profile, Signal Aggregator, Predictive |

### Customer Hubs (Level 5)

| Service | Port | Purpose | Database | Dependencies |
|---------|------|---------|----------|-------------|
| `REZ-customer-intelligence-hub` | 4140 | Customer overview | MongoDB | Unified Profile, Predictive, Segments |
| `REZ-inventory-intelligence` | 4141 | Inventory insights | MongoDB | None |
| `REZ-delivery-intelligence` | 4142 | Delivery optimization | MongoDB | None |

---

## SEGMENTS AVAILABLE

| Segment | Description | Used By |
|---------|-------------|---------|
| `high_spender` | Lifetime spend > ₹10,000 | Merchant Intelligence |
| `at_risk` | Low engagement + competitor risk | Predictive Engine |
| `loyal_customer` | 10+ orders + high loyalty score | All |
| `power_user` | 180+ days tenure + 80+ engagement | All |
| `discount_sensitive` | Cashback + deal seeking >70% | Campaign Targeting |
| `luxury_buyer` | Luxury affinity >70% + AOV >₹2000 | Campaign Targeting |
| `influencer` | Social influence tier micro/mid/macro | Social Signals |
| `new_customer` | Tenure ≤30 days | Onboarding |
| `dormant` | No orders in 30 days + had orders before | Win-back |
| `frequent_visitor` | 8+ visits/month + food enthusiast | Location Intelligence |

---

## PREDICTIONS AVAILABLE

| Prediction | Description | Endpoint |
|-----------|-------------|----------|
| Churn Risk | 0-100 churn probability | `GET /predict/:userId/churn` |
| LTV Prediction | 30/90/365 day LTV | `GET /predict/:userId/ltv` |
| Revisit Prediction | Days until next order | `GET /predict/:userId/revisit` |
| Conversion | Propensity to convert | `GET /predict/:userId/conversion` |

---

## API REFERENCE

### Getting User Signals

```bash
# 1. Get unified profile
curl http://localhost:4120/profile/{userId}

# 2. Get signal scores
curl http://localhost:4121/signals/{userId}

# 3. Get predictions
curl http://localhost:4123/predict/{userId}/all

# 4. Get segments
curl http://localhost:4126/segments/evaluate/{userId}
```

### Webhook Endpoints

```bash
# Commerce Connector
POST http://localhost:4150/webhook/order
POST http://localhost:4150/webhook/payment
POST http://localhost:4150/webhook/cart
POST http://localhost:4150/webhook/review

# QR Campaigns
POST http://localhost:4130/scan
POST http://localhost:4130/redeem
```

---

## ENVIRONMENT VARIABLES

### Required for All Services

```bash
MONGODB_URI=mongodb://localhost:27017/{database_name}
PORT={assigned_port}
```

### Service-Specific

```bash
# Signal Aggregator
LOCATION_SERVICE_URL=http://localhost:4115
BEHAVIORAL_SERVICE_URL=http://localhost:4110
SOCIAL_SERVICE_URL=http://localhost:4116
COMPETITOR_SERVICE_URL=http://localhost:4117

# Commerce Connector
UNIFIED_PROFILE_URL=http://localhost:4120
SIGNAL_AGGREGATOR_URL=http://localhost:4121
PREDICTIVE_ENGINE_URL=http://localhost:4123

# Merchant Intelligence
SIGNAL_AGGREGATOR_URL=http://localhost:4121
PREDICTIVE_ENGINE_URL=http://localhost:4123
```

---

## DEPLOYMENT ORDER

Services must be started in dependency order:

```
1. Signal Sources (parallel)
   ├── rez-location-intelligence (4115)
   ├── rez-behavioral-psychology (4110)
   ├── rez-social-signals (4116)
   └── rez-competitor-detection (4117)

2. Signal Aggregation
   ├── REZ-event-bus (4031)
   └── REZ-signal-aggregator (4121)

3. Core Intelligence
   ├── REZ-unified-profile (4120)
   ├── REZ-predictive-engine (4123)
   └── REZ-realtime-segments (4126)

4. Merchant & Campaign
   ├── REZ-merchant-intelligence (4122)
   ├── REZ-qr-campaigns (4130)
   └── REZ-hyperlocal-targeting (4124)

5. Connectors & Hubs
   ├── REZ-commerce-signal-connector (4150)
   ├── REZ-customer-intelligence-hub (4140)
   ├── REZ-inventory-intelligence (4141)
   └── REZ-delivery-intelligence (4142)
```

---

## STATUS

| Service | Status | Notes |
|---------|--------|-------|
| All Signal Sources | Ready | Production ready |
| Signal Aggregator | Ready | Production ready |
| Unified Profile | Ready | Production ready |
| Predictive Engine | Ready | ML models included |
| Realtime Segments | Ready | 10 segments defined |
| Merchant Intelligence | Ready | Production ready |
| QR Campaigns | Ready | Production ready |
| Hyperlocal Targeting | Ready | Production ready |
| Commerce Connector | Ready | Webhooks configured |
| Customer Hub | Ready | Production ready |
| Inventory Intelligence | Ready | Production ready |
| Delivery Intelligence | Ready | Production ready |
