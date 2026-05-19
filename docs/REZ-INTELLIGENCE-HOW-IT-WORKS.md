# REZ Intelligence - How It Works

## What is REZ Intelligence?

**REZ Intelligence** is the brain of the entire REZ ecosystem. It connects every company, service, and user to create a unified intelligence layer.

---

## The Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REZ INTELLIGENCE - HOW IT WORKS                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    EVENT BUS (The Nervous System)                  │   │
│   │                                                                     │   │
│   │   Every action in the ecosystem creates an EVENT:                   │   │
│   │                                                                     │   │
│   │   User scans QR          → commerce.qr.scanned                     │   │
│   │   User places order     → commerce.order.created                  │   │
│   │   User makes payment    → commerce.payment.completed               │   │
│   │   User views product    → engagement.product.viewed                │   │
│   │   User earns points     → loyalty.points.earned                   │   │
│   │   User clicks ad        → media.ad.clicked                         │   │
│   │                                                                     │   │
│   │   These events flow into the Event Bus                            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    INTELLIGENCE LAYER                              │   │
│   │                                                                     │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │   │
│   │   │ CENTRAL     │  │  FEATURE   │  │  DECISION ENGINE      │    │   │
│   │   │  INTENT      │  │   STORE     │  │                        │    │   │
│   │   │             │  │             │  │  • Cashback decisions  │    │   │
│   │   │ What does   │  │  50+ ML    │  │  • Fraud detection     │    │   │
│   │   │ user want?  │  │  Features   │  │  • Ad selection       │    │   │
│   │   │             │  │             │  │  • Recommendations     │    │   │
│   │   └─────────────┘  └─────────────┘  └─────────────────────────┘    │   │
│   │                                                                     │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │   │
│   │   │ COMMERCE    │  │   REALTIME  │  │   GRAPH SERVICE        │    │   │
│   │   │   GRAPH     │  │   PROFILE   │  │                        │    │   │
│   │   │             │  │             │  │  Who is connected      │    │   │
│   │   │ User-Merchant│  │  < 50ms     │  │  to whom?             │    │   │
│   │   │ Relationships│  │  profile    │  │                       │    │   │
│   │   │             │  │  fetch      │  │  Influence scores     │    │   │
│   │   └─────────────┘  └─────────────┘  └─────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    ACTIVATION (Actions)                             │   │
│   │                                                                     │   │
│   │   Decision Engine sends commands:                                   │   │
│   │                                                                     │   │
│   │   • "Give 8% cashback" → RABTUL Wallet                           │   │
│   │   • "Show this ad" → DOOH Screen / App                          │   │
│   │   • "Send notification" → RABTUL Notifications                 │   │
│   │   • "Update recommendations" → ReZ App / ReZ Now               │   │
│   │   • "Flag fraud" → RABTUL Payment                               │   │
│   │   • "Create support ticket" → REZ Care Service                  │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How Companies Connect to REZ Intelligence

### 1. REZ-Consumer (ReZ App, ReZ Now)

```
┌─────────────────────────────────────────────────────────────────┐
│  REZ-Consumer                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ReZ App User Action                                            │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────┐                                           │
│  │ Integration:    │                                           │
│  │ eventConnector  │────────────┐                              │
│  │.orderCompleted()│            │                              │
│  └─────────────────┘            │                              │
│                                ▼                                │
│  ┌─────────────────┐    EVENT BUS    ┌─────────────────────┐    │
│  │ Profile:        │ ◄──────────── │ REZ Intelligence    │    │
│  │ getUserProfile()│                │                    │    │
│  └─────────────────┘                │ • Updates intent   │    │
│                                     │ • Updates features  │    │
│  ┌─────────────────┐                │ • Records graph    │    │
│  │ Recommendations:│                │ • Computes churn   │    │
│  │ getRecs()      │                └────────┬────────────┘    │
│  └─────────────────┘                         │                  │
│                                             ▼                  │
│                                     ┌─────────────────────┐    │
│                                     │ Decision Engine:   │    │
│                                     │ "What should we   │    │
│                                     │  show this user?"  │    │
│                                     └────────┬────────────┘    │
│                                              │                  │
│       ┌─────────────────────────────────────┘                  │
│       ▼                                                        │
│  ┌─────────────────┐                                           │
│  │ Personalized    │ ← Feed, Recommendations, Offers        │
│  │ Content         │                                           │
│  └─────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. REZ-Media (DOOH, Ads, Karma)

```
┌─────────────────────────────────────────────────────────────────┐
│  REZ-Media                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DOOH Screen                                                     │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                             │
│  │ Screen detects  │                                             │
│  │ nearby user     │                                             │
│  └────────┬────────┘                                             │
│           ▼                                                        │
│  ┌─────────────────┐     ┌────────────────────────────┐           │
│  │ Intelligence:   │────►│ REZ Intelligence:         │           │
│  │ getDOOHTargeting│     │                           │           │
│  └─────────────────┘     │ • Get user segments       │           │
│                          │ • Get behavioral signals   │           │
│  ┌─────────────────┐     │ • Get location context     │           │
│  │ Decision:       │     └────────────┬───────────────┘           │
│  │ getAdDecision() │                      │                         │
│  └────────┬────────┘                      ▼                         │
│           │              ┌────────────────────────────────┐           │
│           └─────────────►│ Decision Engine:              │           │
│                          │                               │           │
│                          │ "What ad to show this user   │           │
│                          │  at this location, at this    │           │
│                          │  time, with this intent?"    │           │
│                          └────────────┬─────────────────┘           │
│                                         │                          │
│                                         ▼                          │
│                              ┌─────────────────────────┐          │
│                              │ DOOH Screen:            │          │
│                              │ "₹100 off at Pizza      │          │
│                              │  Palace - 200m away"   │          │
│                              └─────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. REZ-Merchant (NexTaBizz, KDS)

```
┌─────────────────────────────────────────────────────────────────┐
│  REZ-Merchant                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Merchant Dashboard                                               │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                            │
│  │ Analytics:       │                                            │
│  │ • Customer insights                                            │
│  │ • Peak hours     │                                            │
│  │ • Popular items  │                                            │
│  └────────┬────────┘                                            │
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────┐     ┌────────────────────────────┐          │
│  │ Intelligence:   │────►│ REZ Intelligence:         │          │
│  │ getMerchantInsights                                       │     │
│  └─────────────────┘     │                            │          │
│                         │ • Customer segments         │          │
│  ┌─────────────────┐     │ • Purchase patterns        │          │
│  │ Bootstrap:      │     │ • Competitive analysis    │          │
│  │ getLaunchConfig│     │ • Growth recommendations  │          │
│  └─────────────────┘     └────────────┬───────────────┘          │
│                                        │                           │
│                                        ▼                           │
│                             ┌─────────────────────────┐           │
│                             │ Merchant Launch:        │           │
│                             │                         │           │
│                             │ "Set cashback to 8%    │           │
│                             │  Add combo meal offer  │           │
│                             │  Peak hours: 7-9 PM"   │           │
│                             └─────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. StayOwn-Hospitality (Hotels)

```
┌─────────────────────────────────────────────────────────────────┐
│  StayOwn-Hospitality                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Hotel Guest Journey                                             │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────┐                                            │
│  │ Pre-arrival:    │                                            │
│  │ Guest preferences│                                            │
│  └────────┬────────┘                                            │
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────┐     ┌────────────────────────────┐           │
│  │ Intelligence:   │────►│ REZ Intelligence:         │           │
│  │ getGuestProfile │     │                           │           │
│  └─────────────────┘     │ • Travel preferences      │           │
│                         │ • Dining habits           │           │
│  ┌─────────────────┐     │ • Loyalty tier           │           │
│  │ Recommendations:│     │ • Price sensitivity      │           │
│  │ getUpsells()   │     └────────────┬───────────────┘           │
│  └─────────────────┘                      │                         │
│                                           ▼                         │
│                              ┌─────────────────────────┐          │
│                              │ Decision Engine:         │          │
│                              │                         │          │
│                              │ "Room upgrade: +₹500   │          │
│                              │  Spa package: +₹800    │          │
│                              │  Restaurant: 10% off"    │          │
│                              └─────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Example: User Orders Pizza

### Step 1: Event is Created

```
User taps "Order" in ReZ App

┌─────────────────────────────────────────────────────────────────┐
│  Event Created:                                                   │
│  {                                                              │
│    type: "commerce.order.created",                              │
│    userId: "user_12345",                                        │
│    merchantId: "merchant_pizza_palace",                         │
│    data: {                                                      │
│      orderId: "order_789",                                      │
│      items: [{"pizza": 349}, {"coke": 49}],                    │
│      total: 398,                                                │
│      paymentMethod: "UPI"                                       │
│    },                                                           │
│    timestamp: "2026-05-19T14:30:00Z"                           │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Event Bus Routes to Intelligence

```
Event Bus receives the event

     ┌──────────────┐
     │ EVENT BUS    │
     └──────┬───────┘
            │
            ├──► Central Intent Service
            │    └─► Updates user intent: "pizza → purchase ✓"
            │
            ├──► Feature Store
            │    └─► Updates: order_count +1, total_spend +398
            │
            ├──► Commerce Graph
            │    └─► Creates: user_123 → purchased_from → pizza_palace
            │
            ├──► Realtime Profile
            │    └─► Updates: lastOrderAt, favoriteCategories
            │
            └──► ML Observability
                 └─► Logs prediction quality
```

### Step 3: Intelligence Computes

```
After event processing:

INTENT:         "pizza lover, high frequency, premium affinity"
FEATURES:        order_count: 16, avg_order: 425, churn_risk: 0.12
GRAPH:          friends: 3, favorite_merchant: pizza_palace
PROFILE:        tier: gold, points: 2500, last_order: today
```

### Step 4: Decision Engine Takes Action

```
Based on the order event, Decision Engine:

┌─────────────────────────────────────────────────────────────────┐
│  DECISION: Cashback                                             │
│  ────────────────────────────────────────────────────────────   │
│  User Tier: GOLD                                                │
│  Order Value: ₹398                                              │
│  Merchant: Pizza Palace                                          │
│  Category: pizza                                                 │
│                                                                  │
│  Decision: Give 8% cashback = ₹31.84                           │
│  Reason: "Gold tier, high-value order, repeat merchant"        │
│                                                                  │
│  → Triggers: RABTUL Wallet.credit(user_123, 31.84)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DECISION: Next Best Action                                      │
│  ────────────────────────────────────────────────────────────   │
│  Predicted Intent: "will order again in 2-3 days"              │
│                                                                  │
│  Recommendations:                                               │
│  1. "Order again? Extra cheese pizza at 15% off"               │
│  2. "Try our new pasta range"                                   │
│  3. "Refer friend - both get ₹100"                             │
│                                                                  │
│  → Triggers: RABTUL Notifications.push(user_123, ...)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  DECISION: Loyalty                                              │
│  ────────────────────────────────────────────────────────────   │
│  Points to earn: 398                                            │
│  Lifetime points: 2898                                           │
│  Progress to Platinum: 2898/5000 = 58%                        │
│                                                                  │
│  → Triggers: RABTUL Wallet.addPoints(user_123, 398)           │
│  → Triggers: "You're 58% to Platinum! Order ₹2100 more..."     │
└─────────────────────────────────────────────────────────────────┘
```

---

## How Services Connect

### Using Event Connectors

```typescript
// In ANY existing service, add event emission:

// 1. Install connector
import { commerceEvents, identityEvents } from '@rez/intelligence-connectors';

// 2. Emit events when actions happen

// Order Service
commerceEvents.orderCompleted({
  orderId: 'order_123',
  userId: 'user_456',
  total: 598
});

// Auth Service
identityEvents.userLoggedIn({
  userId: 'user_123',
  deviceId: 'device_abc'
});

// Payment Service
commerceEvents.paymentCompleted({
  paymentId: 'pay_789',
  orderId: 'order_123',
  amount: 598
});

// 3. That's it! REZ Intelligence handles the rest
```

### Using the Intelligence Client

```typescript
// In ANY service that needs intelligence:

import { getIntelligenceClient } from 'shared/rez-intelligence-client';

const rez = getIntelligenceClient({ apiKey: 'your-key' });

// Get user profile
const profile = await rez.profiles.getUserProfile('user_123');

// Get predictions
const intent = await rez.intent.predict('user_123');

// Get personalized recommendations
const recs = await rez.profiles.getRecommendations('user_123', 'home_feed');

// Make a decision
const cashback = await rez.decisions.decideCashback('user_123', 500);

// Record a purchase (updates graph)
await rez.graph.recordPurchase('user_123', 'merchant_456', {
  orderId: 'order_789',
  total: 598
});
```

---

## Service to Service Communication

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVICE CONNECTIONS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  RABTUL Core Services                                               │
│  ────────────────────                                                │
│                                                                      │
│  Auth (4002) ──────────────► Intelligence                           │
│  │                                    • Identity events              │
│  │                                    • Login patterns              │
│  │                                    • Device linking              │
│  │                                                                  │
│  Payment (4001) ────────────► Intelligence                          │
│  │                                    • Transaction events            │
│  │                                    • Fraud signals                │
│  │                                    • Payment method               │
│  │                                                                  │
│  Wallet (4004) ─────────────► Intelligence                         │
│  │                                    • Points/coins events          │
│  │                                    • Balance changes              │
│  │                                    • Redemption patterns          │
│  │                                                                  │
│  Order (4006) ──────────────► Intelligence                         │
│  │                                    • Order events                 │
│  │                                    • Cart abandonment             │
│  │                                    • Product preferences         │
│  │                                                                  │
│  Notifications (4011) ◄─────── Intelligence                        │
│                               • Send notifications based on         │
│                                 decisions                           │
│                                                                      │
│  ────────────────────────────────────────────────────────────────── │
│                                                                      │
│  REZ Intelligence Services                                           │
│  ───────────────────────                                             │
│                                                                      │
│  Event Bus (4025) ◄───────── All Services                         │
│  │                        • Route events to intelligence            │
│  │                                                                     │
│  Intent Service (4018) ────────► Decision Engine                   │
│  │                            • User intent predictions              │
│  │                                                                     │
│  Feature Store (4127) ────────► Decision Engine                   │
│  │                            • ML features                         │
│  │                                                                     │
│  Decision Engine (4128) ───────► All Services                      │
│  │                            • "Give cashback"                    │
│  │                            • "Flag fraud"                       │
│  │                            • "Show ad"                          │
│  │                                                                     │
│  ────────────────────────────────────────────────────────────────── │
│                                                                      │
│  Company Services                                                   │
│  ────────────────                                                   │
│                                                                      │
│  REZ-Consumer ─────────────► Intelligence                          │
│  │                       • App events                               │
│  │                       • QR scans                                 │
│  │                       • Engagement                               │
│  │                                                                     │
│  REZ-Media ◄─────────────────► Intelligence                        │
│  │                       • DOOH targeting                          │
│  │                       • Ad events                                │
│  │                       • Attribution                              │
│  │                                                                     │
│  REZ-Merchant ◄───────────────► Intelligence                       │
│  │                        • Merchant insights                       │
│  │                        • Bootstrap config                        │
│  │                                                                     │
│  StayOwn ◄──────────────────────► Intelligence                     │
│                          • Guest preferences                       │
│                          • Booking patterns                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature Summary

### REZ Intelligence Provides:

| Feature | Description | Used By |
|---------|-------------|---------|
| **Intent Prediction** | What does the user want? | ReZ App, ReZ Now, DOOH |
| **Churn Prediction** | Who will churn? | Support, Marketing |
| **LTV Prediction** | What's user's lifetime value? | Marketing, Sales |
| **Purchase Likelihood** | Will they buy? | DOOH, Ads |
| **Recommendations** | What to show? | All apps |
| **Cashback Optimization** | How much to give? | Wallet, Merchant |
| **Fraud Detection** | Is this fraud? | Payment |
| **Segmentation** | Who are similar users? | All |
| **Attribution** | What drove the purchase? | Ads, Marketing |
| **DOOH Targeting** | Which ad for whom? | DOOH Screens |
| **Bootstrap AI** | Cold-start for new users | All |
| **Governance** | Consent, privacy | All (compliance) |

---

## Port Reference

| Service | Port | Purpose |
|---------|------|---------|
| REZ Event Bus | 4025 | Event streaming |
| Central Intent | 4018 | Intent prediction |
| Feature Store | 4127 | ML features |
| Decision Engine | 4128 | Real-time decisions |
| Commerce Graph | 4129 | Relationships |
| Realtime Profile | 4013 | Fast profiles |
| Intelligence Hub | 4131 | Integration |
| ML Observability | 4130 | Monitoring |
