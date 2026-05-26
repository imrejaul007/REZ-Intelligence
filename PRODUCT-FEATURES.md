# REZ Intelligence - Feature Deep Dive

**Technical documentation for AI/ML capabilities**

---

## 1. Intent Prediction Engine

### Overview
The Intent Prediction Engine analyzes user context signals to predict what the user is likely to do next. It's the foundation of personalization.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTEXT SIGNALS                          │
├─────────────────────────────────────────────────────────────┤
│  Location     │  Time     │  Search   │  History  │ Device │
│  12.97, 77   │  7:30 PM  │  biryani  │  3x/week │ mobile │
└───────┬───────┴────┬──────┴─────┬──────┴────┬────┴────────┘
        │            │            │           │
        └────────────┴────────────┴───────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │         FEATURE EXTRACTION          │
        │  • Location embeddings             │
        │  • Time-of-day encoding            │
        │  • Search intent vectors           │
        │  • Behavioral patterns             │
        └────────────────┬────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │          ML ENSEMBLE                 │
        │  • Neural network (primary)         │
        │  • Gradient boosting (secondary)     │
        │  • Rule-based (fallback)            │
        └────────────────┬────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │       INTENT PREDICTION             │
        │  {                                 │
        │    "intent": "food_ordering",      │
        │    "confidence": 0.89,             │
        │    "urgency": "high"               │
        │  }                                 │
        └─────────────────────────────────────┘
```

### Input Schema
```typescript
interface IntentInput {
  userId: string;
  context: {
    location?: {
      lat: number;
      lng: number;
      city?: string;
    };
    time?: {
      hour: number;       // 0-23
      dayOfWeek: string;  // "monday" - "sunday"
      isWeekend?: boolean;
    };
    device?: 'mobile' | 'desktop' | 'tablet';
    recentSearches?: string[];
    recentCategories?: string[];
  };
}
```

### Output Schema
```typescript
interface IntentPrediction {
  userId: string;
  primaryIntent: {
    intent: string;           // "food_ordering", "travel_booking", etc.
    confidence: number;      // 0.0 - 1.0
    category: IntentCategory;  // COMMERCE, LIFESTYLE, FOOD, etc.
    urgency: 'low' | 'medium' | 'high';
    estimatedBudget?: {
      min: number;
      max: number;
    };
  };
  secondaryIntents: Array<{
    intent: string;
    confidence: number;
  }>;
  contextFactors: Array<{
    factor: string;
    influence: 'positive' | 'negative' | 'neutral';
    value: string;
  }>;
}
```

### Intent Categories
| Category | Example Intents |
|----------|-----------------|
| **FOOD** | food_ordering, restaurant_search, cuisine_exploration |
| **TRAVEL** | flight_booking, hotel_search, trip_planning |
| **HEALTH** | appointment_booking, prescription_refill, lab_test |
| **RETAIL** | product_search, price_comparison, wishlist |
| **LIFESTYLE** | salon_booking, spa_appointment, fitness_class |

### Model Training
- **Algorithm:** Transformer + XGBoost ensemble
- **Training Data:** 50M+ anonymized user interactions
- **Update Frequency:** Weekly incremental training
- **Latency:** < 50ms P99

---

## 2. Predictive Analytics Engine

### Churn Prediction

Predicts which customers are likely to stop engaging.

```typescript
interface ChurnPrediction {
  userId: string;
  churnRisk: {
    probability: number;  // 0.0 - 1.0
    level: 'low' | 'medium' | 'high';
    factors: Array<{
      name: string;
      contribution: number;
      direction: 'positive' | 'negative';
    }>;
  };
  recommendedActions: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    expectedLift: number;
  }>;
}
```

**Risk Levels:**
| Level | Probability | Action |
|-------|-------------|--------|
| Low | 0-30% | Nurture campaigns |
| Medium | 31-60% | Retention offers |
| High | 61-100% | Urgent win-back |

### Lifetime Value (LTV) Prediction

Projects total revenue from a customer over their lifetime.

```typescript
interface LTVPrediction {
  userId: string;
  ltv: number;              // Projected total revenue
  confidence: number;       // 0.0 - 1.0
  breakdown: {
    historical: number;      // Revenue so far
    predicted: number;       // Projected future
  };
  timeHorizon: string;      // "12 months"
}
```

**Calculation Factors:**
- Historical order frequency
- Average order value
- Category diversity
- Seasonality patterns
- Retention rate

### Revisit Probability

Predicts when a customer will return.

```typescript
interface RevisitPrediction {
  userId: string;
  probability: number;
  estimatedDays: number;
  confidence: number;
  factors: Array<{
    name: string;
    impact: number;
  }>;
}
```

---

## 3. Recommendation Engine

### "For You Today" Feed

Personalized daily recommendations based on:
- User's taste profile
- Recent browsing/searching
- Time and location context
- Similar user behavior

```typescript
interface RecommendationRequest {
  userId: string;
  limit?: number;           // Default: 20
  categories?: string[];
  exclude?: string[];       // IDs to exclude
  context?: {
    lat?: number;
    lng?: number;
  };
}

interface Recommendation {
  id: string;
  type: 'product' | 'restaurant' | 'service' | 'content' | 'offer';
  name: string;
  description?: string;
  imageUrl?: string;
  score: number;            // Relevance score
  reason?: string;          // Why recommended
  metadata?: Record<string, unknown>;
}
```

### Ranking Algorithm

```
Score = α × Relevance + β × Popularity + γ × Freshness + δ × Diversity

Where:
  α = 0.45  (relevance to user)
  β = 0.20  (popularity)
  γ = 0.15  (recency)
  δ = 0.20  (diversity)
```

---

## 4. Workflow Engine

### Overview
Visual workflow builder for automating actions based on AI predictions.

### Node Types

#### Action Nodes
| Node | Description | Parameters |
|------|-------------|------------|
| `send_email` | Send email | to, subject, template, body |
| `send_sms` | Send SMS | to, message |
| `send_whatsapp` | Send WhatsApp | to, template, variables |
| `send_push` | Push notification | userId, title, body, data |
| `add_coins` | Add wallet coins | userId, amount, reason |
| `deduct_coins` | Deduct coins | userId, amount, reason |
| `create_order` | Create order | userId, items, total |

#### Logic Nodes
| Node | Description | Parameters |
|------|-------------|------------|
| `if_condition` | Conditional branch | field, operator, value |
| `if_segment` | Segment check | segment_name |
| `if_churn_risk` | Churn check | threshold |
| `if_time` | Time check | hour, dayOfWeek |
| `if_location` | Location check | lat, lng, radius |

#### AI Nodes
| Node | Description | Parameters |
|------|-------------|------------|
| `ai_predict_intent` | Predict intent | context |
| `ai_sentiment` | Analyze sentiment | text |
| `ai_generate` | Generate content | prompt, style |

#### Utility Nodes
| Node | Description | Parameters |
|------|-------------|------------|
| `delay` | Wait duration | hours, minutes |
| `http_request` | External API call | url, method, headers |
| `transform` | Data transformation | mapping |

### Workflow Example: Win-Back Campaign

```json
{
  "name": "Win-Back Campaign",
  "trigger": {
    "type": "scheduled",
    "cron": "0 10 * * *"
  },
  "nodes": [
    {
      "id": "check_churn",
      "type": "ai_check_churn",
      "config": { "threshold": 0.6 }
    },
    {
      "id": "segment_check",
      "type": "if_segment",
      "config": { "segment": "high_value" }
    },
    {
      "id": "send_offer",
      "type": "send_whatsapp",
      "config": {
        "template": "winback_offer",
        "variables": {
          "discount": "{{user.loyalty_tier == 'gold' ? 20 : 10}}",
          "expires_in": "48 hours"
        }
      }
    },
    {
      "id": "add_bonus",
      "type": "add_coins",
      "config": {
        "amount": 100,
        "reason": "winback_incentive"
      }
    },
    {
      "id": "delay",
      "type": "delay",
      "config": { "hours": 24 }
    },
    {
      "id": "check_conversion",
      "type": "if_condition",
      "config": {
        "field": "order_placed",
        "operator": "equals",
        "value": true
      }
    },
    {
      "id": "follow_up",
      "type": "send_sms",
      "config": {
        "message": "Your offer expires in 24 hours!"
      }
    }
  ],
  "edges": [
    { "from": "check_churn", "to": "segment_check" },
    { "from": "segment_check", "to": "send_offer", "condition": "segment == 'high_value'" },
    { "from": "send_offer", "to": "add_bonus" },
    { "from": "add_bonus", "to": "delay" },
    { "from": "delay", "to": "check_conversion" },
    { "from": "check_conversion", "to": "follow_up", "condition": "order_placed == false" }
  ]
}
```

---

## 5. Customer 360

Unified view of each customer across all touchpoints.

```typescript
interface Customer360 {
  userId: string;
  profile: {
    demographics: {
      age?: number;
      gender?: string;
      location?: string;
    };
    preferences: {
      cuisine?: string[];
      priceRange?: string;
      brands?: string[];
    };
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    memberSince: string;
  };
  engagement: {
    level: 'dormant' | 'low' | 'medium' | 'high' | 'super';
    score: number;
    lastActive: string;
  };
  lifecycle: {
    stage: 'acquisition' | 'onboarding' | 'engagement' | 'retention' | 'churn_risk';
    healthScore: number;
  };
  predictions: {
    churnRisk: number;
    ltv: number;
    nextVisit: string;
  };
  recentActivity: Array<{
    type: string;
    timestamp: string;
    details: Record<string, unknown>;
  }>;
  openTickets: number;
  csat: {
    score: number;
    responses: number;
  };
}
```

---

## 6. Expert Agents

Domain-specific AI agents for different industries.

### Restaurant Expert
```
Input: Customer query, order history, preferences
Output: Personalized menu recommendations, upsell suggestions
```

### Travel Expert
```
Input: Search parameters, past trips, travel patterns
Output: Destination recommendations, booking optimization
```

### Health Expert
```
Input: Symptoms, medical history, location
Output: Appointment scheduling, health tips, reminders
```

### Fitness Expert
```
Input: Goals, workout history, schedule
Output: Personalized workout plans, class recommendations
```

---

## 7. Event Tracking

### Supported Events
| Category | Events |
|----------|--------|
| **Commerce** | `order.placed`, `order.completed`, `order.cancelled`, `payment.failed` |
| **Engagement** | `page.view`, `search.query`, `item.viewed`, `item.added_to_cart` |
| **Loyalty** | `points.earned`, `points.redeemed`, `tier.upgraded` |
| **Support** | `ticket.created`, `ticket.resolved`, `chat.started` |
| **Location** | `location.entered`, `location.exited`, `nearby.search` |

### Event Schema
```typescript
interface TrackEventRequest {
  event: string;           // Event name
  userId: string;
  properties?: Record<string, unknown>;
  timestamp?: string;     // ISO 8601, defaults to now
  context?: {
    device?: string;
    location?: { lat: number; lng: number };
    referrer?: string;
  };
}
```

---

## 8. Data Privacy & Isolation

### Tenant Isolation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REZ INTELLIGENCE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Tenant A   │  │  Tenant B   │  │  Tenant C   │       │
│  │  (REZ)     │  │  (External) │  │  (SaaS)    │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                 │                 │               │
│         └────────────────┼─────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│                 ┌─────────────────┐                        │
│                 │ Tenant Adapter  │                        │
│                 │                 │                        │
│                 │ • Auth          │                        │
│                 │ • Isolation     │                        │
│                 │ • Privacy       │                        │
│                 └────────┬────────┘                        │
│                          │                                   │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
                 ┌─────────────────┐
                 │  Shared AI      │
                 │  Infrastructure  │
                 │  (Anonymized)   │
                 └─────────────────┘
```

### Privacy Levels

| Client Type | Data Sharing | PII Access | Cross-tenant |
|------------|-------------|------------|--------------|
| REZ_ECOSYSTEM | Full | Yes | Allowed |
| NON_REZ | Anonymized | No | Denied |
| RABTUL_SAAS | Configurable | Per-tenant | Denied |

---

## 9. SDK Reference

### Installation
```bash
npm install @rez/intelligence-sdk
# or
pip install rez-intelligence
```

### Quick Start
```typescript
import { REZIntelligenceClient, ClientType } from '@rez/intelligence-sdk';

const client = new REZIntelligenceClient({
  apiKey: 'ext_your_tenant_123',
  baseUrl: 'https://api.rez.money'
});

// Predict intent
const intent = await client.predictIntent({
  userId: 'user_123',
  context: {
    location: { lat: 12.97, lng: 77.59 },
    time: { hour: 19, dayOfWeek: 'friday' }
  }
});

// Get recommendations
const recs = await client.getRecommendations({
  userId: 'user_123',
  limit: 10
});

// Trigger workflow
await client.triggerExecution({
  workflowId: 'winback_campaign',
  variables: { userId: 'user_123' }
});
```

### All Methods

| Method | Description |
|--------|-------------|
| `predictIntent()` | Predict user intent |
| `batchPredictIntent()` | Batch predict intents |
| `predictChurn()` | Churn probability |
| `predictLTV()` | Lifetime value |
| `getRecommendations()` | Personalized recs |
| `getForYouFeed()` | Daily feed |
| `getUserProfile()` | Customer profile |
| `createWorkflow()` | Create workflow |
| `triggerExecution()` | Run workflow |
| `trackEvent()` | Track event |
| `addTimelineEvent()` | Add to timeline |
| `searchKnowledge()` | Search knowledge base |

---

*For more details, see [API-REFERENCE.md](API-REFERENCE.md)*
