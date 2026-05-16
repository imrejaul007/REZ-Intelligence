# REZ-Intelligence Service Dependencies

**Created:** May 16, 2026
**Version:** 1.0.0

---

## Service Connection Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONSUMER 360 / UNIFIED PROFILE                          │
│                         REZ-unified-profile (4120)                           │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Location   │  │ Behavioral  │  │   Social    │  │ Competitor  │    │
│  │ Intelligence│  │ Psychology  │  │   Signals   │  │  Detection  │    │
│  │  (4115)    │  │  (4110)    │  │  (4116)     │  │  (4117)    │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└──────────┼────────────────┼────────────────┼────────────────┼─────────────┘
           │                │                │                │
           ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SIGNAL AGGREGATOR                                       │
│                   REZ-signal-aggregator (4121)                             │
│                                                                              │
│  Combines all signals into unified score                                     │
│  Provides segment evaluation in <100ms                                       │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PREDICTIVE    │  │    MERCHANT     │  │   CAMPAIGN      │
│     ENGINE      │  │  INTELLIGENCE  │  │   SERVICES      │
│   (4123)       │  │   (4122)       │  │                 │
│                 │  │                 │  │  QR Campaigns   │
│ - Churn         │  │ - Customer Segs │  │  (4130)        │
│ - LTV           │  │ - Predictions  │  │                 │
│ - Revisit       │  │ - Recommendations│ │  Hyperlocal    │
│ - Conversion     │  │                 │  │  Targeting (4124)
└─────────────────┘  └─────────────────┘  └─────────────────┘
           │                   │
           ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│  COMMERCE       │  │   REALTIME      │
│  CONNECTOR      │  │   SEGMENTS      │
│   (4150)        │  │                 │
│                 │  │  - high_spender │
│ Connects        │  │  - at_risk      │
│ commerce events  │  │  - loyal        │
│ to signals      │  │  - influencer    │
└─────────────────┘  │  - new_customer │
                      └─────────────────┘
```

---

## Dependency Matrix

### Level 1: Core Signal Sources

| Service | Port | Called By | Calls | Database |
|---------|------|-----------|-------|----------|
| **rez-location-intelligence** | 4115 | signal-aggregator, unified-profile | None | MongoDB |
| **rez-behavioral-psychology** | 4110 | signal-aggregator, unified-profile, commerce-connector | None | MongoDB |
| **rez-social-signals** | 4116 | signal-aggregator, unified-profile | None | MongoDB |
| **rez-competitor-detection** | 4117 | signal-aggregator, unified-profile | None | MongoDB |
| **rez-crosschannel-attribution** | - | signal-aggregator | None | MongoDB |

### Level 2: Signal Aggregation

| Service | Port | Called By | Calls | Database |
|---------|------|-----------|-------|----------|
| **REZ-signal-aggregator** | 4121 | unified-profile, predictive-engine, merchant-intelligence | Location, Behavioral, Social, Competitor | MongoDB + Redis |
| **REZ-event-bus** | 4031 | All services | None | Redis |

### Level 3: Intelligence

| Service | Port | Called By | Calls | Database |
|---------|------|-----------|-------|----------|
| **REZ-unified-profile** | 4120 | customer-intelligence-hub, commerce-connector | Signal-aggregator | MongoDB |
| **REZ-predictive-engine** | 4123 | merchant-intelligence, customer-intelligence-hub | Signal-aggregator | MongoDB |
| **REZ-merchant-intelligence** | 4122 | External (Merchants) | Signal-aggregator, Predictive | MongoDB |
| **REZ-realtime-segments** | - | unified-profile, predictive-engine | Unified-profile | MongoDB + Redis |

### Level 4: Connectors & Campaigns

| Service | Port | Called By | Calls | Database |
|---------|------|-----------|-------|----------|
| **REZ-commerce-signal-connector** | 4150 | Commerce services (webhooks) | Unified-profile, Signal-aggregator, Predictive | None |
| **REZ-qr-campaigns** | 4130 | External (QR codes) | None | MongoDB |
| **REZ-hyperlocal-targeting** | 4124 | Campaign services | Location intelligence | MongoDB |

### Level 5: Customer Hubs

| Service | Port | Called By | Calls | Database |
|---------|------|-----------|-------|----------|
| **REZ-customer-intelligence-hub** | 4140 | External | Unified-profile, Predictive, Segments | MongoDB |
| **REZ-inventory-intelligence** | 4141 | External | None | MongoDB |
| **REZ-delivery-intelligence** | 4142 | External | None | MongoDB |

---

## Environment Variables Required

### Signal Services (Level 1)

```bash
# rez-location-intelligence
PORT=4115
MONGODB_URI=mongodb://localhost:27017/rez_location

# rez-behavioral-psychology
PORT=4110
MONGODB_URI=mongodb://localhost:27017/rez_behavioral

# rez-social-signals
PORT=4116
MONGODB_URI=mongodb://localhost:27017/rez_social

# rez-competitor-detection
PORT=4117
MONGODB_URI=mongodb://localhost:27017/rez_competitor
```

### Aggregation Services (Level 2)

```bash
# REZ-signal-aggregator
PORT=4121
MONGODB_URI=mongodb://localhost:27017/rez_signals
REDIS_URL=redis://localhost:6379
LOCATION_SERVICE_URL=http://localhost:4115
BEHAVIORAL_SERVICE_URL=http://localhost:4110
SOCIAL_SERVICE_URL=http://localhost:4116
COMPETITOR_SERVICE_URL=http://localhost:4117

# REZ-event-bus
PORT=4031
REDIS_URL=redis://localhost:6379
```

### Intelligence Services (Level 3)

```bash
# REZ-unified-profile
PORT=4120
MONGODB_URI=mongodb://localhost:27017/rez_unified_profile
SIGNAL_AGGREGATOR_URL=http://localhost:4121

# REZ-predictive-engine
PORT=4123
MONGODB_URI=mongodb://localhost:27017/rez_predictive
SIGNAL_AGGREGATOR_URL=http://localhost:4121

# REZ-merchant-intelligence
PORT=4122
MONGODB_URI=mongodb://localhost:27017/rez_merchant_intel
SIGNAL_AGGREGATOR_URL=http://localhost:4121
PREDICTIVE_ENGINE_URL=http://localhost:4123

# REZ-realtime-segments
PORT=4126
MONGODB_URI=mongodb://localhost:27017/rez_segments
REDIS_URL=redis://localhost:6379
UNIFIED_PROFILE_URL=http://localhost:4120
```

### Connector Services (Level 4)

```bash
# REZ-commerce-signal-connector
PORT=4150
UNIFIED_PROFILE_URL=http://localhost:4120
SIGNAL_AGGREGATOR_URL=http://localhost:4121
PREDICTIVE_ENGINE_URL=http://localhost:4123
BEHAVIORAL_SERVICE_URL=http://localhost:4110

# REZ-qr-campaigns
PORT=4130
MONGODB_URI=mongodb://localhost:27017/rez_qr_campaigns
BASE_URL=https://rezapp.com

# REZ-hyperlocal-targeting
PORT=4124
MONGODB_URI=mongodb://localhost:27017/rez_hyperlocal
LOCATION_SERVICE_URL=http://localhost:4115
```

### Customer Hubs (Level 5)

```bash
# REZ-customer-intelligence-hub
PORT=4140
MONGODB_URI=mongodb://localhost:27017/rez_customer_hub
UNIFIED_PROFILE_URL=http://localhost:4120
PREDICTIVE_ENGINE_URL=http://localhost:4123
SEGMENTS_URL=http://localhost:4126

# REZ-inventory-intelligence
PORT=4141
MONGODB_URI=mongodb://localhost:27017/rez_inventory

# REZ-delivery-intelligence
PORT=4142
MONGODB_URI=mongodb://localhost:27017/rez_delivery
```

---

## Connection Rules

### DO NOT BREAK

1. **Commerce Connector → Signal Services**
   - Must maintain connection to unified-profile, signal-aggregator, predictive-engine

2. **Unified Profile → Signal Aggregator**
   - Profile enrichment depends on aggregated signals

3. **Merchant Intelligence → Signal Aggregator + Predictive**
   - Dashboard needs real-time signal data

4. **Customer Hub → Unified Profile + Predictive**
   - Hub aggregates from core services

### CAN Deprecate (No dependencies)

These services have NO other services depending on them:

- `REZ-cdp-service` - In-memory, no dependencies
- `REZ-identity-bridge` - Not called by any service
- `REZ-merchant-brain` - Not called by any service
- `REZ-unified-recommendations` - Not called by any service
- `REZ-intent-predictor` - Not called by any service

### Port Assignments Summary

| Port | Service | Category |
|------|---------|----------|
| 4110 | rez-behavioral-psychology | Signal Source |
| 4115 | rez-location-intelligence | Signal Source |
| 4116 | rez-social-signals | Signal Source |
| 4117 | rez-competitor-detection | Signal Source |
| 4120 | REZ-unified-profile | Intelligence |
| 4121 | REZ-signal-aggregator | Intelligence |
| 4122 | REZ-merchant-intelligence | Intelligence |
| 4123 | REZ-predictive-engine | Intelligence |
| 4124 | REZ-hyperlocal-targeting | Campaign |
| 4126 | REZ-realtime-segments | Intelligence |
| 4130 | REZ-qr-campaigns | Campaign |
| 4140 | REZ-customer-intelligence-hub | Hub |
| 4141 | REZ-inventory-intelligence | Hub |
| 4142 | REZ-delivery-intelligence | Hub |
| 4150 | REZ-commerce-signal-connector | Connector |

---

## Database Collections

### MongoDB

| Database | Collections | Services |
|----------|-------------|----------|
| `rez_location` | location_visits, user_profiles, zones | rez-location-intelligence |
| `rez_behavioral` | user_psychology, events | rez-behavioral-psychology |
| `rez_social` | user_social, shares, referrals | rez-social-signals |
| `rez_competitor` | profiles, switch_signals | rez-competitor-detection |
| `rez_signals` | unified_signals, segments | REZ-signal-aggregator |
| `rez_unified_profile` | profiles, activities | REZ-unified-profile |
| `rez_predictive` | predictions, caches | REZ-predictive-engine |
| `rez_segments` | definitions, memberships | REZ-realtime-segments |
| `rez_qr_campaigns` | campaigns, scans, redemptions | REZ-qr-campaigns |

### Redis

| Key Pattern | Services | Purpose |
|-------------|----------|---------|
| `signals:{userId}` | signal-aggregator | Signal cache |
| `segments:{userId}` | realtime-segments | Segment cache |
| `predictions:{userId}` | predictive-engine | Prediction cache |
| `event:*` | event-bus | Event streams |

---

## Status: NO DUPLICATES NEED MERGE

**Finding:** All services have clear dependencies. No services are called by multiple services doing the same thing.

**Recommendation:** Do NOT merge services. Each serves a specific purpose in the dependency chain.

**Safe to deprecate:** Services that are not called by anything (listed above).
