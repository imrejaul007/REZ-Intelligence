# REZ Platform: Ad Pricing & Decision System
## Comprehensive Research & Architecture Document

**Date:** May 15, 2026
**Purpose:** Define how ads are priced and served across all platforms

---

## 1. EXECUTIVE SUMMARY

The REZ platform has a sophisticated multi-layered decision system:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER CONTEXT                                  │
│  Intent Graph ← Identity Graph ← RFM ← Taste Profile ← Behavior   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     DECISION ENGINE                                  │
│  Targeting Engine ← Auction Engine ← Sampling Decision ← Real-time  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      PRICING ENGINE                                  │
│  Dynamic CPM ← Quality Score ← Intent Match ← Competition ← Inventory │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      AD DELIVERY                                     │
│  App Ads | DOOH | WhatsApp | Email | Push | QR | Offline           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. INTELLIGENCE LAYER

### 2.1 REZ Mind (Intent Graph) - `rez-intent-graph`

**Purpose:** Track user purchase intent across all apps

**Key Capabilities:**
- Captures intent signals from behavior
- Detects dormant intents
- Triggers revival nudges
- 8 autonomous AI agents

**Intent Types:**
```typescript
type IntentStatus = 'ACTIVE' | 'DORMANT' | 'FULFILLED' | 'EXPIRED';

interface Intent {
  userId: string;
  category: string;        // 'restaurant', 'hotel', 'retail'
  intentKey: string;      // 'looking_for_food', 'booking_stay'
  confidence: number;     // 0-1
  signals: IntentSignal[]; // Search, click, view events
  embedding?: number[];   // Vector for ML
}
```

**How Intent is Captured:**
1. User searches "best biryani near me" → Intent: `looking_for_biryani`
2. User views hotel 3 times → Intent: `considering_booking`
3. User abandons cart → Intent: `interested_but_hesitant`

### 2.2 Identity Graph - `REZ-identity-graph`

**Purpose:** Link user identities across all apps

**Unified Profile Contains:**
- User ID (cross-app)
- Demographics (age, gender, location)
- Behavior patterns
- Purchase history
- Preferences
- RFM scores

### 2.3 RFM Service - Customer Segmentation

**RFM = Recency, Frequency, Monetary**

| Segment | Description | Marketing Strategy |
|--------|-------------|------------------|
| Champions | Recent, frequent, high spend | VIP treatment, early access |
| Loyal | Frequent buyers | Upsell, loyalty rewards |
| Potential | Recent, some frequency | Nurture campaigns |
| At Risk | Haven't purchased recently | Win-back campaigns |
| Lost | Churned | Reactivation offers |

### 2.4 Taste Profile

User preferences across categories:
- Food preferences (cuisine, diet)
- Travel preferences (luxury vs budget)
- Shopping habits (brand loyal vs deal seekers)
- Entertainment preferences

---

## 3. DECISION ENGINE LAYER

### 3.1 REZ Decision Service - `REZ-decision-service` (Port 4027)

**Purpose:** Real-time ad serving decisions

**Components:**
1. **Sampling Decision Engine** - Who gets coins/nudges
2. **Auction Engine** - Competition between merchants
3. **Attribution Tracker** - Track nudge ROI
4. **Sponsored Ranking** - Organic vs sponsored

### 3.2 Targeting Engine - `REZ-targeting-engine` (Port 3013)

**Purpose:** Match ads to users based on targeting criteria

**Targeting Options:**
- Demographic (age, gender, location)
- Behavioral (RFM, segments)
- Intent-based (current search context)
- Contextual (time, weather, events)

### 3.3 Ad AI - `REZ-ad-ai` (Port 4021)

**Purpose:** AI-powered ad optimization

**Key Features:**
- Intent-based ad selection
- Segment-based targeting
- Creative optimization
- Budget allocation

### 3.4 Auction Flow

```
User visits app
       ↓
Get user context (intent, segments, RFM)
       ↓
Query targeting engine for eligible campaigns
       ↓
Run auction between competing merchants
       ↓
Calculate winning bid with quality score
       ↓
Serve ad with dynamic pricing
       ↓
Track impression → click → conversion
       ↓
Attribution
```

---

## 4. PRICING ENGINE LAYER

### 4.1 REZ Pricing Engine - `REZ-pricing-engine` (Port 4016)

**Purpose:** AI-powered dynamic pricing

**Base Pricing by Ad Type:**
| Ad Type | CPM (₹) | CPC (₹) | CPA (₹) |
|---------|----------|----------|----------|
| Banner | 150 | 5 | 50 |
| Feed | 100 | 3 | 40 |
| Search | 250 | 12 | 80 |
| DOOH | 200 | 8 | 60 |
| QR | 40 | 2 | 20 |
| WhatsApp | 80 | 3 | 25 |
| Push | 30 | 1 | 15 |
| Email | 20 | 0.5 | 10 |

### 4.2 Pricing Factors

**Multipliers Applied:**

| Factor | Range | Description |
|--------|-------|-------------|
| Demand | 0.5-2.0x | Based on inventory availability |
| Competition | 0.8-1.5x | Number of bidders |
| Peak Time | 2.0x | Prime hours (7-9am, 6-9pm) |
| Seasonal | 3.0x | Festival/holiday season |
| City Tier | 1.0-2.5x | Metro vs Tier 2/3 |

### 4.3 Quality Score

Google Ads-style quality score (1-10):
- **Ad Relevance** - How relevant to user intent
- **Landing Page** - User experience after click
- **Expected CTR** - Historical performance

```
Effective Bid = Base Bid × Quality Score / 10
```

---

## 5. DOOH PRICING FRAMEWORK

### 5.1 Screen Inventory Categories

| Category | Environment | Targeting Level | CPM (₹) |
|----------|-------------|-----------------|----------|
| **L1: Personal Device** | User's own device | 1:1 (Full profile) | 200-400 |
| **L2: Captive Private** | Hotel, Cab, Flight, Bus seat | 1:1 (Profile data) | 100-300 |
| **L3: Semi-Captive** | Mall, Office, University | Context + Some data | 60-150 |
| **L4: Public Passive** | Billboard, Shelter, Street | Context only | 10-60 |

### 5.2 Detailed DOOH Screen Pricing

#### L2: Captive Private Spaces (HIGH VALUE)

| Screen | Environment | User Data Available | CPM (₹) |
|--------|------------|-------------------|----------|
| Hotel Smart TV | Guest profile, booking data | Full | 200-400 |
| Cab/Taxi Screen | Commuter profile, location | Full | 150-250 |
| Flight Seat | Passenger profile, destination | Full | 180-300 |
| Bus Seat | Route, time, demographics | Full | 100-180 |
| Uber/Ola Play | User profile, trip context | Full | 120-200 |

**Why L2 is HIGH VALUE:**
1. User is CAPTIVE - can't scroll away
2. Profile data AVAILABLE - we know who they are
3. Extended EXPOSURE - minutes to hours
4. Full ATTENTION - not multitasking

#### L3: Semi-Captive Spaces (MEDIUM)

| Screen | Environment | CPM (₹) |
|--------|------------|----------|
| Mall Kiosk | Shoppers with context | 80-120 |
| Office Lobby | Working professionals | 100-150 |
| University | Students with context | 80-120 |
| Gym Screen | Health-conscious | 70-100 |
| Cinema | Entertainment seekers | 90-130 |
| Restaurant TV | Diners with mood | 60-90 |

#### L4: Public Passive (LOW)

| Screen | Environment | CPM (₹) |
|--------|------------|----------|
| Billboard LED | Everyone passing | 30-60 |
| Bus Shelter | Commuters | 15-30 |
| Street Pole | Pedestrians | 10-20 |
| ATM Screen | Banking customers | 25-40 |

---

## 6. THE DATA FLOW FOR PRICING

### 6.1 Real-time Decision Flow

```
1. USER CONTEXT
   ↓
   GET user_intent FROM rez-intent-graph
   GET user_profile FROM identity-graph
   GET rfm_segment FROM rfm-service
   GET taste_profile FROM taste-profile
   ↓
2. TARGETING MATCH
   ↓
   Match campaign targeting → User segments
   Calculate intent_match_score (0-100)
   Calculate audience_relevance_score (0-100)
   ↓
3. AUCTION
   ↓
   Multiple merchants bid for same user
   Run second-price auction
   Calculate winning_bid WITH quality_score
   ↓
4. PRICING CALCULATION
   ↓
   base_cpm = Ad type base rate
   demand_multiplier = Current demand
   time_multiplier = Peak vs off-peak
   location_multiplier = City tier
   quality_score = Ad relevance / 10
   intent_bonus = Intent match × 1.2
   ↓
5. FINAL PRICE
   ↓
   final_cpm = base_cpm × multipliers × quality_score
```

### 6.2 Example: DOOH in Hotel

**Scenario:** Hotel Smart TV showing ads to guest

```
USER: Business traveler, booked via app
INTENT: "looking_for_dinner_options"
RFM: Champions (frequent, high value)
LOCATION: Mumbai, 5-star hotel

BASE CPM (DOOH): ₹200

MULTIPLIERS:
- Hotel TV (Captive L2): 1.5x
- City Tier (Metro): 2.5x
- Time (Evening 7pm): 2.0x
- Intent Match (High): 1.2x

QUALITY SCORE:
- Ad Relevance: 9/10
- Landing Page: 8/10
- Expected CTR: 7/10
- Avg Quality: 8/10

FINAL CPM = 200 × 1.5 × 2.5 × 2.0 × 1.2 × (8/10)
         = ₹720 per 1000 impressions
```

---

## 7. CAMPAIGN OBJECTIVES & PRICING

### 7.1 Objective-Based Pricing

| Objective | Bid Strategy | Base CPM | Notes |
|-----------|-------------|----------|-------|
| **Awareness** | CPM | 50-200 | Brand visibility |
| **Traffic** | CPC | 3-15 | Website visits |
| **Engagement** | CPE | 5-25 | Interactions |
| **Lead Gen** | CPL | 15-80 | Form submissions |
| **Sales** | CPA | 30-150 | Purchases |
| **Footfall** | CPV | 5-20 | Store visits |

### 7.2 Bidding Strategies

1. **Manual Bidding** - Set max CPC/CPM
2. **Auto Bidding** - AI optimizes for goal
3. **Target CPA** - AI bids to achieve target cost per acquisition
4. **Target ROAS** - Bid for return on ad spend

---

## 8. SERVICE INVENTORY FOR PRICING & DECISIONS

| Service | Port | Purpose |
|---------|------|---------|
| `REZ-intent-graph` | 3001 | User intent tracking |
| `REZ-identity-graph` | 4050 | Cross-app identity |
| `REZ-rfm-service` | 4055 | RFM segmentation |
| `REZ-taste-profile` | 4041 | User preferences |
| `REZ-decision-service` | 4027 | Real-time decisions |
| `REZ-targeting-engine` | 3013 | Targeting logic |
| `REZ-ad-ai` | 4021 | AI ad optimization |
| `REZ-pricing-engine` | 4016 | Dynamic pricing |
| `REZ-economic-engine` | 4016 | Coin economics |
| `REZ-ads-service` | 4007 | Ad campaign management |
| `REZ-dooh-service` | 4018 | DOOH inventory |

---

## 9. GAPS & RECOMMENDATIONS

### 9.1 Current Gaps

1. **DOOH Screen Data** - No real-time audience data from screens
2. **Screen-to-User Link** - No integration between screen type and user profile
3. **Captivity Scoring** - No explicit scoring for captive vs passive
4. **Dynamic Floor Pricing** - No real-time floor based on demand
5. **Cross-Platform Attribution** - Hard to track DOOH → App conversion

### 9.2 Recommendations

#### A. Create Screen-Audience Matching Layer

```
SCREEN TYPE + USER PROFILE → MATCH SCORE → PRICING ADJUSTMENT
```

| Screen Type | Best User Profile | Match Bonus |
|-------------|-------------------|-------------|
| Hotel TV | Traveler, business | +30% |
| Cab Screen | Commuter, regular | +25% |
| Mall Kiosk | Shopper, deal seeker | +20% |
| Gym Screen | Health-conscious | +15% |

#### B. Implement Captivity Index

```typescript
interface CaptivityIndex {
  screenType: string;
  captiveLevel: 1 | 2 | 3 | 4; // 1=can't escape, 4=can ignore
  avgDwellTime: number; // minutes
  dataAvailability: 'full' | 'partial' | 'none';
  attentionLevel: number; // 0-1
}
```

#### C. Real-time Demand Pricing

```typescript
interface DemandSignal {
  inventoryAvailable: number; // % available
  activeBidders: number;
  historicalFillRate: number;
  timeOfDay: 'peak' | 'normal' | 'off';
  dayOfWeek: 'weekend' | 'weekday';
  seasonalFactor: number;
}

function calculateDemandMultiplier(signal: DemandSignal): number {
  // Low inventory + high bidders = surge pricing
  const baseMultiplier = (100 - signal.inventoryAvailable) / 50;
  const bidderMultiplier = signal.activeBidders / 10;
  return Math.min(3.0, baseMultiplier * bidderMultiplier);
}
```

---

## 10. PROPOSED PRICING MATRIX

### 10.1 Final Comprehensive Pricing Table

| Platform | Targeting Level | Base CPM | With Metro | With Peak Time |
|----------|---------------|----------|------------|----------------|
| **App Feed** | 1:1 (Full profile) | 200 | 500 | 750 |
| **App Search** | 1:1 (Intent) | 300 | 750 | 1125 |
| **WhatsApp** | 1:1 (Personal) | 250 | 625 | 937 |
| **Hotel TV** | L2 (Captive) | 180 | 450 | 675 |
| **Cab Screen** | L2 (Captive) | 150 | 375 | 562 |
| **Flight Seat** | L2 (Captive) | 180 | 450 | 675 |
| **Bus Seat** | L2 (Captive) | 100 | 250 | 375 |
| **Mall Kiosk** | L3 (Context) | 80 | 200 | 300 |
| **Office Lobby** | L3 (Context) | 100 | 250 | 375 |
| **University** | L3 (Context) | 80 | 200 | 300 |
| **Billboard** | L4 (Public) | 40 | 100 | 150 |
| **Bus Shelter** | L4 (Public) | 20 | 50 | 75 |

---

## 11. ACTION ITEMS

### Phase 1: Data Integration (This Week)
- [ ] Connect DOOH service to Identity Graph
- [ ] Implement screen-audience matching API
- [ ] Add captvity index to screen types

### Phase 2: Pricing Updates (Next Sprint)
- [ ] Update pricing engine with new targeting levels
- [ ] Implement demand-based floor pricing
- [ ] Add quality score to all DOOH placements

### Phase 3: AI Optimization (Next Month)
- [ ] Train ML model for demand prediction
- [ ] Implement real-time price adjustment
- [ ] Build attribution tracking for DOOH

---

## APPENDIX: Key Code Locations

| Feature | File | Service |
|---------|------|---------|
| Intent Capture | `src/models/Intent.ts` | REZ-intent-graph |
| User Profile | `src/index.ts` | REZ-identity-graph |
| RFM Segmentation | `src/services/segmentService.ts` | REZ-rfm-service |
| Sampling Decision | `src/engines/sampling/samplingDecision.ts` | REZ-decision-service |
| Auction Engine | `src/engines/sampling/auctionEngine.ts` | REZ-decision-service |
| Targeting | `src/services/targeting.ts` | REZ-targeting-engine |
| Intent Targeting | `src/intent-targeting.ts` | REZ-ad-ai |
| Dynamic Pricing | `src/services/pricingEngine.ts` | REZ-pricing-engine |
| Coin Economics | `src/services/economicFlow.ts` | REZ-economic-engine |
