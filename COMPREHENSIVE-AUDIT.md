# REZ Ecosystem Comprehensive Audit

**Date:** May 16, 2026
**Repositories:** REZ-Intelligence, REZ-Commerce, REZ-Media

---

## EXECUTIVE SUMMARY

| Category | Services | Maturity | Gaps |
|----------|----------|----------|------|
| **REZ-Intelligence** | 128+ | 75% | Missing unified profile, ML models |
| **REZ-Commerce** | 64 | 76% | Missing signals integration |
| **REZ-Media** | 50+ | 80% | Missing hyperlocal targeting |
| **Consumer 360/CDP** | 5 overlapping | 60% | Duplicate services, in-memory only |

---

## 1. CONSUMER 360 / CDP SERVICES

### Services Found (DUPLICATES)

| Service | Port | Storage | Status |
|---------|------|---------|--------|
| REZ-cdp-service | 3005 | **In-memory** | ⚠️ DATA LOST ON RESTART |
| REZ-identity-graph | 4050 | MongoDB | ✓ Production |
| REZ-profile-aggregator | ? | MongoDB | ✓ Production |
| rez-profile-service | ? | MongoDB | ✓ |
| rez-customer-service | ? | ? | ? |

### Critical Issue: IN-MEMORY STORAGE
`REZ-cdp-service` uses in-memory Maps - **ALL DATA IS LOST ON RESTART**

### Recommendation: MERGE INTO REZ-identity-graph

---

## 2. REZ-INTELLIGENCE GAPS

### Missing Services to Build

| # | Service | Purpose | Priority |
|---|---------|---------|----------|
| 1 | **REZ-unified-profile** | Single source of truth for user profile | CRITICAL |
| 2 | **REZ-signal-aggregator** | Combine all signals into unified score | HIGH |
| 3 | **REZ-predictive-engine** | AI predictions (churn, LTV, revisit) | HIGH |
| 4 | **REZ-merchant-intelligence** | Merchant-facing insights dashboard | HIGH |
| 5 | **REZ-real-time-segments** | Real-time segment evaluation | MEDIUM |

### Duplicate Services (Need Consolidation)

| Duplicate | Keep | Deprecate |
|----------|------|-----------|
| REZ-recommendation-engine | ✓ | REZ-unified-recommendations |
| REZ-personalization-engine | ✓ | - |
| REZ-intent-predictor | - | Merge into REZ-signal-aggregator |
| REZ-behavioral-psychology | ✓ | - |

---

## 3. REZ-COMMERCE GAPS

### Missing Signal Collection

| Gap | Impact | Solution |
|-----|--------|----------|
| No location signals | HIGH | Connect to rez-location-intelligence |
| No behavioral signals | HIGH | Connect to rez-behavioral-psychology |
| No competitor signals | MEDIUM | Connect to rez-competitor-detection |
| No social signals | MEDIUM | Connect to rez-social-signals |

### Missing Services

| # | Service | Purpose |
|---|---------|---------|
| 1 | **Customer Intelligence Hub** | Aggregate all customer data |
| 2 | **Real-time Inventory Sync** | Live stock across platforms |
| 3 | **Unified Order Dashboard** | Cross-channel order management |

---

## 4. REZ-MEDIA GAPS

### Missing Services

| # | Service | Purpose | Priority |
|---|---------|---------|----------|
| 1 | **REZ-hyperlocal-targeting** | Geofence-based ad targeting | CRITICAL |
| 2 | **REZ-qr-campaigns** | QR-triggered campaign management | HIGH |
| 3 | **REZ-receipt-ads** | Ads on digital receipts | MEDIUM |
| 4 | **REZ-booking-ads** | Ads based on booking intent | MEDIUM |

### DOOH Attribution Gaps

- No real-time footfall attribution
- No QR-to-DOOH tracking
- No cross-channel attribution

---

## 5. SERVICES TO BUILD

### CRITICAL (Build Now)

#### 1. REZ-unified-profile
```
Purpose: Single source of truth for user profile
Port: 4120
Data: Combine REZ-identity-graph + REZ-cdp-service + all signals
Storage: MongoDB (persistent)
APIs:
  - GET /profile/:userId
  - GET /profile/:userId/signals
  - GET /profile/:userId/segments
  - POST /profile/:userId/enrich
```

#### 2. REZ-signal-aggregator
```
Purpose: Aggregate all signal services into unified scoring
Port: 4121
Data: Location + Behavioral + Social + Competitor + Event signals
Output: UnifiedSignalScore
APIs:
  - GET /signals/:userId
  - GET /signals/:userId/summary
  - GET /signals/segments/:segment
```

#### 3. REZ-merchant-intelligence
```
Purpose: Merchant-facing customer insights dashboard
Port: 4122
Data: Customer segments, predictions, recommendations
APIs:
  - GET /merchant/:merchantId/customers
  - GET /merchant/:merchantId/segments
  - GET /merchant/:merchantId/predictions
  - GET /merchant/:merchantId/recommendations
```

### HIGH PRIORITY (Build Soon)

#### 4. REZ-predictive-engine
```
Purpose: AI predictions (churn, LTV, revisit, conversion)
Port: 4123
Models: Churn prediction, LTV prediction, Next order prediction
APIs:
  - GET /predict/:userId/churn
  - GET /predict/:userId/ltv
  - GET /predict/:userId/revisit
  - GET /predict/:userId/next-order
```

#### 5. REZ-hyperlocal-targeting
```
Purpose: Geofence-based ad targeting
Port: 4124
Data: Location zones, footfall, dwell time
APIs:
  - POST /target/geofence
  - GET /zones/:zoneId/audience
  - GET /zones/:zoneId/footfall
```

#### 6. REZ-qr-campaigns
```
Purpose: QR-triggered campaign management
Port: 4125
Data: QR scans, conversions, attribution
APIs:
  - POST /campaigns
  - GET /campaigns/:id/stats
  - GET /campaigns/:id/attribution
```

---

## 6. ARCHITECTURE RECOMMENDATION

```
┌─────────────────────────────────────────────────────────────┐
│                    CONSUMER 360 PROFILE                      │
│                  (REZ-unified-profile)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Location │  │Behavioral│  │  Social  │  │Competitor│ │
│  │   Intel │  │Psychology│  │ Signals  │  │Detection │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │              │              │              │        │
│       └──────────────┼──────────────┼──────────────┘        │
│                      ▼                                      │
│              ┌──────────────┐                              │
│              │Signal       │                              │
│              │Aggregator   │                              │
│              └──────┬───────┘                              │
│                     │                                      │
│       ┌─────────────┼─────────────┐                        │
│       ▼             ▼             ▼                        │
│  ┌─────────┐  ┌───────────┐  ┌───────────┐                │
│  │Predictive│  │Merchants  │  │ Campaigns │                │
│  │ Engine  │  │Intelligence│  │(Hyperlocal)│               │
│  └─────────┘  └───────────┘  └───────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. IMPLEMENTATION PRIORITY

### Phase 1: Core Profile (Week 1)
1. Build REZ-unified-profile (merge CDP + Identity)
2. Build REZ-signal-aggregator
3. Deprecate REZ-cdp-service (in-memory)

### Phase 2: Intelligence (Week 2)
4. Build REZ-predictive-engine
5. Build REZ-merchant-intelligence
6. Connect Commerce services to signals

### Phase 3: Targeting (Week 3)
7. Build REZ-hyperlocal-targeting
8. Build REZ-qr-campaigns
9. Enhance DOOH attribution

---

## 8. FILES TO CREATE

| Service | Files |
|---------|-------|
| REZ-unified-profile | 15 files |
| REZ-signal-aggregator | 12 files |
| REZ-predictive-engine | 14 files |
| REZ-merchant-intelligence | 12 files |
| REZ-hyperlocal-targeting | 10 files |
| REZ-qr-campaigns | 10 files |

**Total: 73 files**

---

## 9. DEPRECATION LIST

Services to deprecate/merge:
1. `REZ-cdp-service` → Merge into REZ-identity-graph
2. `REZ-unified-recommendations` → Merge into REZ-recommendation-engine
3. `REZ-intent-predictor` → Merge into REZ-signal-aggregator

---

**Status:** Ready for implementation
