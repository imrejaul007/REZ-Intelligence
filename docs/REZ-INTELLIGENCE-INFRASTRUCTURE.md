# REZ INTELLIGENCE INFRASTRUCTURE BLUEPRINT
**Version:** 3.0 | **Date:** May 19, 2026 | **Status:** ACTIVE DEVELOPMENT

---

## Executive Summary

REZ is building **"Real-Time Commerce Intelligence Infrastructure for the Physical World"** - a platform-grade system that combines the power of:

- **Salesforce CDP** (Customer Data Platform)
- **Adobe Experience Cloud** (Intelligence & Activation)
- **Toast POS Intelligence** (Restaurant/Food Commerce)
- **Block/Square Merchant Intelligence** (Merchant Analytics)
- **Meta Ads + Identity Graph** (Attribution & Targeting)
- **Uber Marketplace Orchestration** (Real-time Operations)

Specialized for **hyperlocal commerce** with QR-based discovery, DOOH advertising, multi-company loyalty, and real-time intent.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REZ INTELLIGENCE OS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    EVENT-DRIVEN ARCHITECTURE                        │   │
│  │  ┌───────────────────────────────────────────────────────────────┐  │   │
│  │  │                    REZ EVENT BUS                             │  │   │
│  │  │  • Schema Registry        • Dead Letter Queue              │  │   │
│  │  │  • Correlation IDs        • Event Replay                   │  │   │
│  │  │  • 20+ Event Categories   • Consumer Groups                │  │   │
│  │  └───────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐    │
│  │   CENTRAL       │  │   FEATURE       │  │   DECISION              │    │
│  │   INTENT        │  │   STORE         │  │   ENGINE                │    │
│  │   SERVICE       │  │                 │  │                         │    │
│  │                 │  │  • 50+ Features│  │  • Real-time decisions  │    │
│  │  • Single Truth │  │  • User/Product │  │  • Cashback optimization│    │
│  │  • Unified API  │  │  • Behavioral   │  │  • Fraud detection      │    │
│  │  • Prediction    │  │  • Predictive  │  │  • Dynamic pricing     │    │
│  │                 │  │  • Online/Offln │  │  • Next best action    │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘    │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐    │
│  │   COMMERCE      │  │   REALTIME      │  │   IDENTITY              │    │
│  │   GRAPH         │  │   PROFILE       │  │   GRAPH                 │    │
│  │                 │  │   SERVICE       │  │                         │    │
│  │  • Relationships│  │                 │  │  • Universal identity   │    │
│  │  • Influence    │  │  • < 50ms fetch│  │  • Device linking      │    │
│  │  • Communities  │  │  • TTL-based    │  │  • Cross-company       │    │
│  │  • Path Finding │  │  • Hot paths   │  │  • Household mapping   │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         ACTIVATION LAYER                            │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ │   │
│  │  │ DOOH        │ │ QR          │ │ Loyalty      │ │ Support     │ │   │
│  │  │ Targeting    │ │ Experience   │ │ Engine       │ │ AI          │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Components

### 1. REZ Event Bus
**Location:** `RABTUL-Technologies/REZ-event-bus/src/rezEventBus.ts`

**Purpose:** Nervous system of the ecosystem - real-time event streaming

**Features:**
- 20+ Pre-defined event schemas
- Schema registry with validation
- Dead letter queue for failed events
- Correlation ID tracing
- Event categorization
- Consumer groups
- Event replay capability

**Event Categories:**
```typescript
- commerce.*     // Orders, payments, refunds
- identity.*    // User creation, linking
- loyalty.*     // Points, tiers
- engagement.*  // Page views, QR scans
- intelligence.* // Intent, churn, predictions
- support.*     // Tickets, CSAT
- media.*       // Ad impressions, conversions
- notification.* // Sent, opened
```

**Key Endpoints:**
```typescript
rezEventBus.publishCommerce('order.completed', data, options)
rezEventBus.publishIntelligence('churn.risk', data)
CommerceEvents.orderCompleted(data)
IntelligenceEvents.intentDetected(data)
```

---

### 2. Central Intent Service
**Location:** `REZ-Intelligence/rez-intent-graph/src/centralIntentService.ts`

**Purpose:** Single source of truth for all user intent

**Problem Solved:**
- Fragmented intent tracking
- Duplicate models
- Inconsistent predictions

**Features:**
- Unified intent signal capture
- User intent profile building
- Prediction engine
- Event bus listeners for auto-capture
- Next best action prediction

**Intent Categories:**
```typescript
- food, fitness, travel, shopping
- entertainment, health, education
- hospitality, retail, lifestyle
```

**Signal Types:**
```typescript
search, view, click, add_to_cart, purchase
wishlist, share, compare, review
booking, cancellation, refund
```

---

### 3. Feature Store
**Location:** `REZ-Intelligence/REZ-feature-store/src/`

**Purpose:** Central ML features for all AI/ML models

**Problem Solved:**
- Scattered features
- Inconsistent definitions
- Training/inference inconsistency

**Feature Categories:**

| Category | Features |
|----------|----------|
| **User** | lifetime_value, avg_order_value, order_count, loyalty_tier, preferred_categories |
| **Engagement** | app_open_frequency, avg_session_duration, notification_open_rate |
| **Predictive** | churn_probability, purchase_likelihood, engagement_score, nps_score |
| **Behavioral** | dining_frequency, premium_affinity, discount_sensitivity, wellness_affinity, nightlife_score, travel_affinity |
| **Location** | home_location, work_location, location_frequency |
| **Temporal** | peak_order_hour, peak_order_day, weekend_vs_weekday_ratio |
| **Merchant** | avg_rating, popularity_score, avg_delivery_time |
| **Product** | popularity, conversion_rate, return_rate |

**Serving Modes:**
- Online: < 50ms retrieval (Redis-like)
- Offline: Batch computation for training
- Real-time: Streaming computation

---

### 4. Decision Engine
**Location:** `RABTUL-Technologies/REZ-decision-engine/src/decisionEngine.ts`

**Purpose:** Real-time decision making for commerce operations

**Decision Types:**
```typescript
- offer        // Personalized offers
- cashback     // Dynamic cashback optimization
- personalization // Content personalization
- routing      // Order/delivery routing
- fraud        // Fraud detection decisions
- pricing      // Dynamic pricing
- next_action  // Next best action
- retention    // Retention interventions
```

**Key Capabilities:**
- Rules engine with pre-defined rules
- ML-based predictions
- Hybrid rules + ML approach
- Sub-100ms decision latency

---

### 5. Commerce Graph Service
**Location:** `RABTUL-Technologies/REZ-graph-service/src/commerceGraph.ts`

**Purpose:** Graph database for commerce relationship intelligence

**Node Types:**
```typescript
user, merchant, product, location, campaign
ad, creator, store, brand, category, device, session
```

**Relationship Types:**
```typescript
purchased_from, reviewed, visited
referred, follows, located_at, belongs_to
targeted_by, viewed, contains, associated_with
converted_from, influenced, competed_with
sibling, similar_location, works_at, loyalty_member
household, device_shared, same_ip, same_payment
nearby, frequents, delivered_to, displayed_on
```

**Graph Analytics:**
- Path finding
- Community detection
- Influence scoring
- Degree analysis
- Neighbor queries

---

### 6. Realtime Profile Service
**Location:** `RABTUL-Technologies/REZ-profile-service/src/realtimeProfile.ts`

**Purpose:** Ultra-fast profile serving (< 50ms)

**Profile Types:**
- UserProfile
- MerchantProfile
- SegmentProfile

**Features:**
- Cache-first architecture
- TTL-based expiration
- Hot path optimization
- Bulk operations
- Real-time signal updates

**Use Cases:**
- Feed personalization
- QR experience
- Ad targeting
- Recommendations
- DOOH targeting

---

## Data Flow Architecture

### Real-time Personalization Flow
```
┌──────────┐    Event     ┌──────────┐    Update    ┌─────────────────┐
│   App    │ ──────────▶  │ Event Bus │ ──────────▶  │ Central Intent  │
│  Action  │              │           │              │    Service      │
└──────────┘              └──────────┘              └────────┬────────┘
                                                            │
                                                            │ Update
                                                            ▼
┌──────────┐   Profile    ┌──────────┐              ┌─────────────────┐
│  Feed    │ ◀──────────  │ Realtime │ ◀───────────  │  Feature Store  │
│  Render  │   Request    │ Profile  │   Compute     │                 │
└──────────┘              └──────────┘              └─────────────────┘
       ▲                                                   │
       │                                                   │ Features
       │ Decision                                          ▼
┌──────┴──────┐              ┌─────────────────────────────────────────┐
│  Decision   │ ──────────▶  │           Decision Engine                 │
│   Request   │              │  • Cashback → 8%                        │
└─────────────┘              │  • Recommendation → personalized feed    │
                             └─────────────────────────────────────────┘
```

### DOOH Targeting Flow
```
┌──────────┐    Nearby     ┌──────────┐    Query     ┌─────────────────┐
│   DOOH   │ ──────────▶  │ Event Bus │ ──────────▶  │  Realtime       │
│  Screen  │              │           │              │  Profile        │
└──────────┘              └──────────┘              └────────┬────────┘
                                                            │
                                                            │ Profile + Segments
                                                            ▼
┌──────────┐   Targeting   ┌──────────┐              ┌─────────────────┐
│   Ad     │ ◀──────────   │ Decision │ ◀───────────  │  Commerce       │
│  Select  │   Decision    │ Engine   │   Influence   │  Graph          │
└──────────┘              └──────────┘              └─────────────────┘
```

---

## API Standards

### Response Envelope
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId: string;
    latencyMs?: number;
  };
}
```

### Event Schema Standard
```typescript
interface REZEvent {
  id: string;
  correlationId?: string;
  type: string;                    // e.g., "commerce.order.completed"
  category: EventCategory;
  priority: EventPriority;
  version: string;
  source: string;
  timestamp: string;
  userId?: string;
  merchantId?: string;
  data: Record<string, any>;
}
```

### Profile Schema Standard
```typescript
interface UserProfile {
  userId: string;
  identity: Identity;
  commerce: CommerceData;
  loyalty: LoyaltyData;
  engagement: EngagementData;
  location: LocationData;
  behavioral: BehavioralData;
  predictive: PredictiveData;
  signals: RealTimeSignals;
  version: string;
  lastUpdated: string;
}
```

---

## Performance Targets

| Metric | Target | Critical For |
|--------|--------|--------------|
| Profile fetch latency | < 50ms p99 | QR, Feed, DOOH |
| Decision latency | < 100ms p95 | Cashback, Fraud |
| Event processing | < 50ms p99 | Real-time actions |
| Intent prediction | < 200ms p95 | Recommendations |
| Graph query | < 100ms p99 | Path finding, Influence |
| Cache hit rate | > 95% | Cost efficiency |
| Feature freshness | < 1 hour | Prediction accuracy |

---

## Integration Points

### RABTUL Core Services → Intelligence
```typescript
// Auth → Intent, Fraud
// Payment → Fraud, Attribution
// Wallet → Loyalty, Engagement
// Order → Commerce events, Intent
// Catalog → Product features
// Notifications → Engagement signals
// Search → Intent capture
```

### Apps → Intelligence
```typescript
// ReZ App → All intelligence
// ReZ Now → Personalization, Recommendations
// Safe QR → Intent capture, Targeting
// Merchant App → Merchant intelligence
// DOOH Screen → Targeting, Attribution
```

---

## Strategic Position

### REZ Intelligence OS = Commerce Intelligence Infrastructure for the Real World

**Competitive Positioning:**

| Traditional | REZ Intelligence OS |
|-------------|---------------------|
| Super App | Commerce Infrastructure |
| Point Solutions | Unified Platform |
| Scattered Events | Event Mesh |
| Duplicate Models | Central Intent |
| Batch Processing | Real-time Decisions |
| Siloed Identity | Universal Graph |
| Static Profiles | Real-time Profiles |

---

## Roadmap

### Phase 1: Foundation (COMPLETED)
- [x] Event Bus architecture
- [x] Central Intent Service
- [x] Feature Store design
- [x] Decision Engine
- [x] Commerce Graph
- [x] Realtime Profile Service
- [x] API Governance

### Phase 2: Integration (IN PROGRESS)
- [ ] Event Bus deployment
- [ ] Intent Service migration
- [ ] Feature Store population
- [ ] Decision Engine rollout

### Phase 3: Intelligence
- [ ] ML model training on Feature Store
- [ ] Real-time segmentation
- [ ] Advanced graph analytics
- [ ] Anomaly detection

### Phase 4: Activation
- [ ] DOOH targeting optimization
- [ ] Dynamic cashback deployment
- [ ] AI journey orchestration
- [ ] Attribution engine

---

## Key Files Reference

| Component | File | Company |
|-----------|------|---------|
| Event Bus | `RABTUL-Technologies/REZ-event-bus/src/rezEventBus.ts` | RABTUL |
| Central Intent | `REZ-Intelligence/rez-intent-graph/src/centralIntentService.ts` | Intelligence |
| Feature Store | `REZ-Intelligence/REZ-feature-store/src/featureStore.ts` | Intelligence |
| Decision Engine | `RABTUL-Technologies/REZ-decision-engine/src/decisionEngine.ts` | RABTUL |
| Commerce Graph | `RABTUL-Technologies/REZ-graph-service/src/commerceGraph.ts` | RABTUL |
| Realtime Profile | `RABTUL-Technologies/REZ-profile-service/src/realtimeProfile.ts` | RABTUL |
| API Governance | `docs/API-GOVERNANCE.md` | Documentation |

---

**Document Owner:** Platform Team
**Last Updated:** May 19, 2026
**Version:** 3.0
