# REZ-Intelligence - Complete Feature Inventory

> **Version:** 1.0.0
> **Last Updated:** 2026-05-13
> **Total Services:** 26

---

## Table of Contents

1. [REZ-reorder-engine (4040)](#1-rez-reorder-engine-port-4040)
2. [REZ-taste-profile (4041)](#2-rez-taste-profile-port-4041)
3. [REZ-demand-forecast (4042)](#3-rez-demand-forecast-port-4042)
4. [REZ-price-predictor (4043)](#4-rez-price-predictor-port-4043)
5. [REZ-identity-graph (4050)](#5-rez-identity-graph-port-4050)
6. [REZ-memory-engine (4051)](#6-rez-memory-engine-port-4051)
7. [REZ-ai-router (4052)](#7-rez-ai-router-port-4052)
8. [REZ-knowledge-graph (4060)](#8-rez-knowledge-graph-port-4060)
9. [REZ-merchant-brain (4061)](#9-rez-merchant-brain-port-4061)
10. [REZ-autonomous-agents (4062)](#10-rez-autonomous-agents-port-4062)
11. [REZ-payments-brain (4070)](#11-rez-payments-brain-port-4070)
12. [REZ-inventory-sync (4071)](#12-rez-inventory-sync-port-4071)
13. [REZ-creator-network (4072)](#13-rez-creator-network-port-4072)
14. [REZ-merchant-os (4073)](#14-rez-merchant-os-port-4073)
15. [REZ-event-bus (4031)](#15-rez-event-bus-port-4031)
16. [REZ-integration-sdk (4091)](#16-rez-integration-sdk-port-4091)
17. [REZ-identity-bridge (4092)](#17-rez-identity-bridge-port-4092)
18. [REZ-feedback-collector (4085)](#18-rez-feedback-collector-port-4085)
19. [REZ-unified-recommendations (4090)](#19-rez-unified-recommendations-port-4090)
20. [REZ-notification-router (4093)](#20-rez-notification-router-port-4093)
21. [REZ-realtime-gateway (4094)](#21-rez-realtime-gateway-port-4094)
22. [REZ-event-platform (4008)](#22-rez-event-platform-port-4008)
23. [REZ-health-monitor (4095)](#23-rez-health-monitor-port-4095)
24. [REZ-copilot-service](#24-rez-copilot-service)
25. [REZ-decision-service](#25-rez-decision-service)
26. [REZ-ad-platform](#26-rez-ad-platform)

---

## 1. REZ-reorder-engine (Port 4040)

### Purpose
Manages reorder predictions and nudge campaigns for user-merchant relationships.

### Database
MongoDB: `rez_reorder`

### Models

#### ReorderProfile Schema
```javascript
{
  userId: String,
  merchantId: String,
  orderHistory: [{
    orderId: String,
    orderDate: Date,
    totalAmount: Number,
    itemCount: Number,
    items: [{ itemId, itemName, quantity, price }],
    deliveryAddress: String
  }],
  reorderScore: Number,        // 0-100
  lastOrderDate: Date,
  nextPredictedOrder: Date,
  avgOrderInterval: Number,    // days
  predictedItems: [{
    itemId: String,
    itemName: String,
    probability: Number,      // 0-1
    avgQuantity: Number
  }],
  nudges: [{
    nudgeId: String,
    sentAt: Date,
    clickedAt: Date,
    convertedAt: Date,
    channel: String,
    contentVariant: String
  }],
  preferences: {
    favoriteItems: [String],
    preferredTime: String,
    preferredAddress: String
  },
  status: 'active' | 'dormant' | 'churned',
  lastNudgeSentAt: Date,
  nudgeHistory: [Object]
}
```

#### NudgeQueue Schema
```javascript
{
  nudgeId: String (unique),
  userId: String,
  merchantId: String,
  itemId: String,
  content: {
    title: String,
    body: String,
    imageUrl: String,
    ctaText: String
  },
  channel: 'push' | 'sms' | 'email' | 'in_app',
  scheduledAt: Date,
  sentAt: Date,
  expiresAt: Date,
  priority: 'low' | 'medium' | 'high' | 'urgent',
  targetSegment: String,
  personalizationContext: Object,
  status: 'scheduled' | 'sent' | 'clicked' | 'converted' | 'expired' | 'cancelled'
}
```

#### Order Schema
```javascript
{
  orderId: String (unique),
  userId: String,
  merchantId: String,
  items: [{ itemId, itemName, quantity, price }],
  subtotal: Number,
  deliveryFee: Number,
  tax: Number,
  totalAmount: Number,
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled',
  deliveryAddress: Object,
  scheduledAt: Date,
  source: 'direct' | 'reorder_nudge' | 'personalized_search',
  createdAt: Date,
  updatedAt: Date
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reorder/profile` | Create/update reorder profile |
| GET | `/api/reorder/user/:userId` | Get user reorder recommendations |
| GET | `/api/reorder/homepage/:userId` | Get homepage reorder suggestions |
| POST | `/api/reorder/nudge/:nudgeId/click` | Track nudge click |
| POST | `/api/reorder/nudge/:nudgeId/convert` | Track conversion |
| GET | `/api/reorder/analytics` | Get analytics by merchant/category |
| GET | `/api/reorder/segments` | Get user segments |
| POST | `/api/reorder/segments/create` | Create segment |
| GET | `/api/reorder/segments/:id/users` | Get users in segment |

### Features

#### 1.1 Reorder Score Calculation
- **Frequency Factor**: How often user orders from merchant
- **Recency Factor**: Time since last order
- **Conversion Factor**: How often user acts on nudges
- **Seasonality**: Day of week, time of day patterns
- **Trend**: Increasing/decreasing order frequency

#### 1.2 Prediction Engine
- **Item-level predictions**: Which items user will reorder
- **Timing predictions**: When user likely to reorder
- **Quantity predictions**: How much user will order
- **Price sensitivity**: Price elasticity per user

#### 1.3 Nudge System
- **Channel routing**: Push, SMS, Email, In-app
- **Content personalization**: Dynamic content based on user preferences
- **Timing optimization**: Best time to send
- **A/B testing**: Multiple content variants
- **Frequency capping**: Max nudges per user/day
- **Do-not-disturb**: Quiet hours support

#### 1.4 User Segments
- **High Value Loyal**: Frequent, high spend, responsive
- **At-Risk**: Decreasing frequency, needs reactivation
- **Dormant**: No orders in 30+ days
- **New**: First-time buyers
- **Occasional**: Random ordering behavior

#### 1.5 Commerce Categories
- Restaurant/Food delivery
- Hotel/Hospitality
- Retail/E-commerce
- Booking/Reservations
- Services (salon, repairs, etc.)
- Fintech/Financial services

---

## 2. REZ-taste-profile (Port 4041)

### Purpose
Consumer taste and preference intelligence tracking.

### Database
MongoDB: `rez_taste`

### Models

#### TasteProfile Schema
```javascript
{
  userId: String,
  categoryProfiles: {
    'restaurant': {
      cuisinePreferences: [{ cuisine, score, orderCount }],
      dietaryRestrictions: [String],
      spiceTolerance: Number,
      avgOrderValue: Number,
      preferredPriceRange: { min, max }
    },
    'retail': { ... },
    'hotel': { ... }
  },
  brandAffinity: [{ brand, score, lastOrdered }],
  priceElasticity: Number,
  featurePreferences: [String],
  colorPreferences: [String],
  sizePreferences: Object,
  embedding: [Number],  // For ML similarity
  lastUpdated: Date
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/taste/profile` | Create/update taste profile |
| GET | `/api/taste/user/:userId` | Get taste profile |
| GET | `/api/taste/recommendations/:userId` | Get taste-based recommendations |
| POST | `/api/taste/infer` | Infer preferences from behavior |
| GET | `/api/taste/segments` | Get taste segments |
| POST | `/api/taste/feedback` | Record preference feedback |

### Features

#### 2.1 Multi-Dimensional Preferences
- **Cuisine preferences** (restaurant)
- **Dietary restrictions** (vegan, gluten-free, halal, kosher)
- **Spice tolerance** (1-5 scale)
- **Price range preferences**
- **Brand affinities**
- **Feature preferences** (color, size, material)
- **Service preferences** (delivery time, ambiance)

#### 2.2 Preference Inference
- **Explicit feedback**: User ratings, reviews
- **Implicit signals**: Clicks, dwell time, add-to-cart
- **Behavioral patterns**: Time of day, location, device
- **Context awareness**: Occasion, weather, season

#### 2.3 Taste Embedding
- **Vector representation** of user preferences
- **Cosine similarity** for recommendations
- **Clustering** for user segments
- **Dimensionality reduction** for visualization

#### 2.4 Commerce Categories
- Restaurant/Food
- Retail/Products
- Hotel/Stay
- Services
- Entertainment
- Health/Fitness
- Education
- Travel
- Groceries

---

## 3. REZ-demand-forecast (Port 4042)

### Purpose
7-day demand prediction for inventory optimization.

### Database
MongoDB: `rez_forecast`

### Models

#### Forecast Schema
```javascript
{
  merchantId: String,
  itemId: String,
  date: Date,
  predictedDemand: Number,
  confidence: Number,
  factors: {
    historical: Number,
    trend: Number,
    seasonality: Number,
    weather: Number,
    events: Number,
    promotions: Number
  },
  actualDemand: Number,
  accuracy: Number,
  createdAt: Date
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/forecast/demand` | Get demand forecast |
| GET | `/api/forecast/merchant/:merchantId` | Get merchant forecasts |
| GET | `/api/forecast/item/:itemId` | Get item forecast |
| POST | `/api/forecast/batch` | Batch forecast multiple items |
| GET | `/api/forecast/accuracy` | Get forecast accuracy metrics |

### Features

#### 3.1 Time-Series Forecasting
- **Moving average** baseline
- **Exponential smoothing** (Holt-Winters)
- **ARIMA models** for seasonality
- **Prophet** for holiday/events
- **LSTM neural networks** for complex patterns

#### 3.2 Demand Factors
- **Historical demand** (7, 14, 30, 90 days)
- **Trend component** (increasing/decreasing)
- **Seasonality** (day of week, month, holidays)
- **Weather impact** (rain, temperature, humidity)
- **Events** (festivals, sales, local events)
- **Promotions** (discounts, offers)

#### 3.3 Accuracy Metrics
- **MAPE** (Mean Absolute Percentage Error)
- **RMSE** (Root Mean Square Error)
- **Bias detection** (systematic over/under forecasting)

#### 3.4 Granular Forecasting
- **By item**: Individual SKUs
- **By category**: Aggregate categories
- **By time**: Hour, day, week
- **By location**: Branch/store specific

---

## 4. REZ-price-predictor (Port 4043)

### Purpose
Dynamic pricing optimization based on demand, competition, and margins.

### Database
MongoDB: `rez_pricing`

### Models

#### PriceHistory Schema
```javascript
{
  itemId: String,
  merchantId: String,
  price: Number,
  cost: Number,
  margin: Number,
  demandLevel: 'low' | 'medium' | 'high',
  competitorAvg: Number,
  optimalPrice: Number,
  confidence: Number,
  effectiveFrom: Date,
  effectiveTo: Date
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/price/predict` | Predict optimal price |
| GET | `/api/price/merchant/:merchantId` | Get merchant pricing |
| GET | `/api/price/item/:itemId` | Get item pricing |
| POST | `/api/price/competitor` | Update competitor prices |
| GET | `/api/price/optimize` | Bulk price optimization |

### Features

#### 4.1 Price Optimization
- **Demand-based**: Higher price when demand is high
- **Competition-based**: Match or undercut competitors
- **Margin protection**: Floor and ceiling prices
- **Elasticity modeling**: Price sensitivity per item
- **Dynamic updates**: Real-time price adjustments

#### 4.2 Competitive Intelligence
- **Competitor price tracking**
- **Price gap monitoring**
- **Market positioning** (premium, mid, economy)
- **Competitor alerts**: Significant price changes

#### 4.3 Profitability Optimization
- **Cost-plus pricing** floor
- **Target margin** achievement
- **Promotional pricing** with clear ROI
- **Bundle pricing** optimization

---

## 5. REZ-identity-graph (Port 4050)

### Purpose
Unified user identity resolution across apps and platforms.

### Database
MongoDB: `rez_identity`

### Models

#### Identity Schema
```javascript
{
  identityId: String (unique),
  type: String,           // app_user, whatsapp, web, qr, device, wallet
  hashIdentifier: String,  // SHA256(identifier + salt)
  clusterId: String,
  status: 'active' | 'inactive' | 'deleted',
  metadata: {
    source: String,        // App name
    platform: String,      // ios, android, web
    appVersion: String,
    deviceFingerprint: String,
    ipAddress: String,
    userAgent: String
  },
  traits: {
    location: { lat, lng, city, country },
    language: String,
    timezone: String
  },
  privacySettings: {
    trackingEnabled: Boolean,
    marketingConsent: Boolean,
    dataRetentionDays: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Cluster Schema
```javascript
{
  clusterId: String (unique),
  primaryIdentityId: String,
  status: 'active' | 'merged' | 'flagged',
  identityCount: Number,
  confidence: 'high' | 'medium' | 'low',
  lastActivity: Date,
  riskScore: Number,
  createdAt: Date
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/identity/resolve` | Resolve identity by identifier |
| POST | `/api/identity/link` | Link multiple identities |
| GET | `/api/identity/:id` | Get identity details |
| POST | `/api/identity/fingerprint` | Create device fingerprint |
| GET | `/api/identity/cluster/:clusterId` | Get cluster info |
| POST | `/api/identity/merge` | Merge two identities |
| GET | `/api/identity/search` | Search identities |
| POST | `/api/identity/verify` | Verify identity |

### Features

#### 5.1 Identity Resolution
- **Phone number** matching (normalized)
- **Email** matching (case-insensitive)
- **Device fingerprint** matching
- **Cross-app** resolution (same person across apps)
- **Confidence scoring** (high/medium/low)

#### 5.2 Identity Types
- `app_user`: Native app user
- `whatsapp`: WhatsApp user
- `web`: Web browser user
- `qr`: QR code scanner
- `device`: Device-only (no account)
- `wallet`: Wallet user
- `phone`: Phone number (anonymous)
- `email`: Email (anonymous)

#### 5.3 Privacy Features
- **Opt-out** mechanisms
- **Data minimization**
- **Consent tracking**
- **GDPR right to deletion**
- **Anonymization** options

#### 5.4 Fraud Detection
- **Device spoofing** detection
- **VPN/proxy** detection
- **Velocity checks** (too many in short time)
- **Pattern matching** (bot behavior)

---

## 6. REZ-memory-engine (Port 4051)

### Purpose
Agent memory storage and retrieval for AI agents.

### Database
MongoDB: `rez_memory`

### Models

#### Memory Schema
```javascript
{
  memoryId: String,
  agentId: String,
  userId: String,
  type: 'short_term' | 'long_term' | 'episodic' | 'semantic',
  content: Object,
  embedding: [Number],
  importance: Number,
  accessCount: Number,
  lastAccessed: Date,
  expiresAt: Date,
  metadata: {
    source: String,
    context: String
  },
  createdAt: Date
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/memory/store` | Store memory |
| GET | `/api/memory/retrieve` | Retrieve memories |
| POST | `/api/memory/search` | Semantic search |
| DELETE | `/api/memory/clear` | Clear memories |
| GET | `/api/memory/stats` | Memory statistics |

### Features

#### 6.1 Memory Types
- **Short-term**: Current conversation context
- **Long-term**: Persistent user preferences
- **Episodic**: Specific events/experiences
- **Semantic**: Facts and knowledge

#### 6.2 Memory Management
- **Importance scoring**: Auto-importance based on usage
- **Forgetting**: Automatic decay/archival
- **Consolidation**: Move short-term to long-term
- **Retrieval**: Contextual and semantic search

#### 6.3 Agent Support
- **Session memory**: Per-conversation context
- **User memory**: Cross-session persistence
- **Agent memory**: Learning from interactions

---

## 7. REZ-ai-router (Port 4052)

### Purpose
AI model routing with cost and latency optimization.

### Features

#### 7.1 Model Selection
- **GPT-4**: Complex reasoning, high accuracy
- **GPT-3.5-turbo**: Fast, cost-effective
- **Claude**: Long context, nuanced
- **Custom models**: Domain-specific fine-tunes

#### 7.2 Routing Strategies
- **Cost optimization**: Cheapest model that meets quality
- **Latency optimization**: Fastest response
- **Accuracy optimization**: Best quality for task
- **Fallback**: Model redundancy

#### 7.3 Load Balancing
- **Round-robin** across model instances
- **Weighted routing** based on capacity
- **Rate limiting** per model
- **Circuit breaker** for model failures

---

## 8. REZ-knowledge-graph (Port 4060)

### Purpose
Knowledge base with entity extraction and relationships.

### Database
MongoDB: `rez_knowledge`

### Models

#### Entity Schema
```javascript
{
  entityId: String,
  type: 'product' | 'merchant' | 'category' | 'brand' | 'user',
  name: String,
  properties: Object,
  embedding: [Number],
  relatedEntities: [{
    entityId: String,
    relationship: String,
    strength: Number
  }],
  source: String,
  confidence: Number,
  createdAt: Date
}
```

#### Relationship Schema
```javascript
{
  fromEntity: String,
  toEntity: String,
  relationship: String,  // 'is_a', 'part_of', 'similar_to', etc.
  strength: Number,
  bidirectional: Boolean
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/knowledge/query` | Query knowledge graph |
| POST | `/api/knowledge/entity` | Extract entities |
| GET | `/api/knowledge/related/:entityId` | Get related entities |
| POST | `/api/knowledge/relationship` | Add relationship |
| GET | `/api/knowledge/path/:from/:to` | Find path between entities |

### Features

#### 8.1 Entity Types
- **Products**: Items, variants, bundles
- **Merchants**: Restaurants, stores, services
- **Categories**: Hierarchical taxonomy
- **Brands**: Brand information
- **Users**: User entities (anonymized)

#### 8.2 Relationship Types
- `is_a`: Category hierarchy (iPhone → Smartphone → Electronics)
- `part_of`: Product bundles
- `similar_to`: Related products
- `bought_together`: Frequently bought
- `viewed_together`: Co-viewed
- `replaces`: Alternative products

#### 8.3 Knowledge Operations
- **Entity extraction** from text
- **Relationship inference** from behavior
- **Knowledge completion** (fill gaps)
- **Conflict resolution** for duplicates

---

## 9. REZ-merchant-brain (Port 4061)

### Purpose
Merchant intelligence and business insights.

### Database
MongoDB: `rez_merchant_brain`

### Features

#### 9.1 Performance Analytics
- **Sales metrics**: Revenue, orders, AOV
- **Customer metrics**: New, returning, churn
- **Operational metrics**: Prep time, delivery time
- **Financial metrics**: Margins, costs, profits

#### 9.2 Growth Recommendations
- **Pricing suggestions**: Optimize for revenue/margin
- **Inventory alerts**: Low stock, excess inventory
- **Marketing suggestions**: Promotions, campaigns
- **Operational improvements**: Peak hour optimization

#### 9.3 Competitive Analysis
- **Market share** tracking
- **Competitor monitoring**
- **Pricing benchmarks**
- **Feature comparison**

#### 9.4 Customer Insights
- **Customer segments**: High-value, at-risk, new
- **Loyalty metrics**: Repeat rate, CLV
- **Feedback analysis**: Sentiment from reviews
- **Churn prediction**: Risk scores

---

## 10. REZ-autonomous-agents (Port 4062)

### Purpose
30+ AI agents for various business functions.

### Agent Categories

#### Customer Service (5 agents)
| Agent | Function |
|-------|----------|
| OrderTracker | Real-time order status updates |
| RefundAgent | Process refund requests |
| ComplaintResolver | Handle complaints, escalate |
| FAQAgent | Answer common questions |
| ReturnAgent | Manage returns process |

#### Sales (4 agents)
| Agent | Function |
|-------|----------|
| UpsellAgent | Suggest complementary products |
| CrossSellAgent | Suggest related products |
| LeadQualAgent | Qualify sales leads |
| FollowUpAgent | Nurture leads |

#### Operations (6 agents)
| Agent | Function |
|-------|----------|
| InventoryAlertAgent | Low stock notifications |
| SchedulingAgent | Optimize staff schedules |
| DispatchAgent | Route delivery drivers |
| QualityAgent | Monitor service quality |
| MaintenanceAgent | Schedule equipment maintenance |
| ComplianceAgent | Ensure regulatory compliance |

#### Marketing (5 agents)
| Agent | Function |
|-------|----------|
| CampaignAgent | Create marketing campaigns |
| SegmentationAgent | Define customer segments |
| ABTestAgent | Run A/B tests |
| ContentAgent | Generate marketing content |
| SocialAgent | Manage social media |

#### Finance (4 agents)
| Agent | Function |
|-------|----------|
| InvoiceAgent | Generate invoices |
| CollectionsAgent | Follow up on payments |
| ExpenseAgent | Categorize expenses |
| ReportAgent | Generate financial reports |

#### Analytics (6 agents)
| Agent | Function |
|-------|----------|
| DashboardAgent | Create custom dashboards |
| ForecastAgent | Generate forecasts |
| AnomalyAgent | Detect unusual patterns |
| InsightAgent | Generate business insights |
| TrendAgent | Identify trends |
| ReportAgent | Generate reports |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents/:agentId/invoke` | Invoke specific agent |
| GET | `/api/agents/:agentId/history` | Conversation history |
| GET | `/api/agents` | List all agents |
| POST | `/api/agents/workflow` | Multi-agent workflow |

---

## 11. REZ-payments-brain (Port 4070)

### Purpose
Payment intelligence with fraud detection.

### Database
MongoDB: `rez_payments_brain`

### Features

#### 11.1 Fraud Detection
- **Velocity checks**: Too many transactions
- **Amount anomalies**: Unusual transaction sizes
- **Geographic anomalies**: Impossible travel
- **Device fingerprinting**: Device linking
- **Behavioral patterns**: Bot detection

#### 11.2 Payment Optimization
- **Gateway routing**: Best success rate
- **Retry logic**: When and how to retry
- **Fallback methods**: Alternative payment options
- **Success rate prediction**: Pre-transaction scoring

#### 11.3 Revenue Forecasting
- **Daily/weekly/monthly** projections
- **Cash flow** predictions
- **Chargeback risk** scoring
- **Payment method trends**

---

## 12. REZ-inventory-sync (Port 4071)

### Purpose
Real-time inventory synchronization.

### Database
MongoDB: `rez_inventory`

### Models

#### Inventory Schema
```javascript
{
  itemId: String,
  merchantId: String,
  location: String,
  quantity: Number,
  reserved: Number,       // In cart, not confirmed
  available: Number,      // quantity - reserved
  lowStockThreshold: Number,
  reorderPoint: Number,
  maxStock: Number,
  lastSync: Date,
  syncStatus: 'synced' | 'pending' | 'error'
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory/:merchantId` | Get merchant inventory |
| POST | `/api/inventory/update` | Update stock level |
| POST | `/api/inventory/batch` | Batch update |
| GET | `/api/inventory/alerts` | Get stock alerts |
| POST | `/api/inventory/sync` | Trigger sync |

### Features

#### 12.1 Stock Management
- **Real-time tracking** across locations
- **Reserved stock** (cart hold)
- **Multi-location** inventory
- **Batch processing** for bulk updates

#### 12.2 Alerts
- **Low stock** warnings
- **Out of stock** notifications
- **Reorder suggestions**
- **Excess inventory** alerts

#### 12.3 Sync
- **Real-time sync** to POS/ERP
- **Scheduled sync** for periodic updates
- **Conflict resolution** for concurrent updates
- **Offline queue** for connectivity issues

---

## 13. REZ-creator-network (Port 4072)

### Purpose
Creator marketplace and campaign management.

### Database
MongoDB: `rez_creators`

### Models

#### Creator Schema
```javascript
{
  creatorId: String,
  name: String,
  platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter',
  handle: String,
  followers: Number,
  engagement: Number,      // Average engagement rate
  categories: [String],
  location: String,
  demographics: {
    ageRange: { min, max },
    genderSplit: Object,
    topCountries: [String]
  },
  rates: {
    story: Number,
    post: Number,
    video: Number,
    live: Number
  },
  status: 'active' | 'paused' | 'suspended',
  verifiedAt: Date
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/creators` | List creators |
| GET | `/api/creators/:id` | Creator details |
| POST | `/api/creators/apply` | Creator application |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/:id` | Campaign details |
| POST | `/api/campaigns/:id/performance` | Get performance |

### Features

#### 13.1 Creator Discovery
- **Category search**: By niche
- **Audience matching**: Demographics alignment
- **Engagement analysis**: Quality metrics
- **Cost filtering**: Budget matching
- **Platform filtering**: Multi-platform support

#### 13.2 Campaign Management
- **Brief submission**: Campaign requirements
- **Creator matching**: AI-powered matching
- **Outreach automation**: Contact creators
- **Negotiation**: Rate discussions
- **Deliverable tracking**: Posts, stories, videos

#### 13.3 Performance Tracking
- **Impressions**, **reach**, **engagement**
- **Clicks** and **conversions**
- **ROI calculation**: Cost per result
- **Creator comparison**: Side-by-side metrics

---

## 14. REZ-merchant-os (Port 4073)

### Purpose
Comprehensive merchant operating system.

### Database
MongoDB: `rez_merchant_os`

### Features

#### 14.1 Dashboard
- **Sales overview**: Today's revenue, orders, AOV
- **Customer metrics**: New, returning, CLV
- **Inventory alerts**: Low stock items
- **Pending actions**: Orders to prepare, refunds

#### 14.2 Analytics
- **Sales analytics**: By hour, day, week, month
- **Customer analytics**: Acquisition, retention, churn
- **Product analytics**: Top sellers, slow movers
- **Marketing analytics**: Campaign performance

#### 14.3 Customer Management
- **Customer profiles**: Purchase history, preferences
- **Segmentation**: By behavior, value, engagement
- **Communication**: Email, SMS, push
- **Loyalty program**: Points, rewards

#### 14.4 Marketing Tools
- **Promotion builder**: Discounts, offers, coupons
- **Campaign manager**: Run campaigns
- **Social posting**: Schedule posts
- **Review management**: Respond to reviews

#### 14.5 Operations
- **Order management**: Process, track, fulfill
- **Inventory management**: Stock levels, reorders
- **Staff management**: Shifts, tasks
- **Financial reports**: P&L, taxes

---

## 15. REZ-event-bus (Port 4031)

### Purpose
Central event routing and pub/sub.

### Database
Redis (primary), MongoDB (persistence)

### Features

#### 15.1 Event Publishing
- **Fire-and-forget**: Async event publishing
- **Guaranteed delivery**: With acknowledgment
- **Batch publishing**: Multiple events
- **Event versioning**: Schema evolution

#### 15.2 Event Subscriptions
- **Pattern matching**: `events.order.*`
- **Queue-based**: Pull-based consumption
- **Webhook**: HTTP callback delivery
- **Stream**: Kafka-like stream processing

#### 15.3 Event Types
```javascript
events.payment.*     // Payment events
events.identity.*    // Identity events
events.order.*       // Order lifecycle
events.user.*        // User actions
events.inventory.*   // Stock changes
events.fraud.*        // Fraud alerts
```

#### 15.4 Persistence
- **Event replay**: Re-process historical events
- **Event history**: Query past events
- **Dead letter queue**: Failed event handling

---

## 16. REZ-integration-sdk (Port 4091)

### Purpose
Unified SDK for all apps.

### Features

#### 16.1 Multi-Platform Support
- **JavaScript/TypeScript**: Web, Node.js
- **React hooks**: React integration
- **React Native**: Mobile apps
- **Python**: Data science integrations

#### 16.2 REST + WebSocket
```javascript
import { Client } from '@rez/sdk';

// REST
const client = new Client({ apiKey: 'xxx' });
const orders = await client.orders.list();

// WebSocket
client.on('order.created', (order) => {
  console.log('New order:', order);
});
```

#### 16.3 TypeScript Types
- Full type coverage
- Auto-completion
- Runtime validation (Zod)

---

## 17. REZ-identity-bridge (Port 4092)

### Purpose
Cross-app user identity resolution.

### Features

#### 17.1 Multi-Source Resolution
- **Query multiple services** in parallel
- **Merge results** into unified profile
- **Conflict resolution**: Which data wins

#### 17.2 Profile Aggregation
- **Identity graph**: Link identities
- **Behavior aggregation**: Combined history
- **Preference merging**: Unified preferences

---

## 18. REZ-feedback-collector (Port 4085)

### Purpose
User feedback and sentiment analysis.

### Database
MongoDB: `rez_feedback`

### Features

#### 18.1 Feedback Channels
- **In-app surveys**: Post-purchase, post-interaction
- **NPS surveys**: 0-10 rating
- **Reviews**: Star ratings with text
- **Support tickets**: Issue feedback

#### 18.2 Sentiment Analysis
- **Positive/negative/neutral** classification
- **Aspect-based**: Price, quality, service
- **Keyword extraction**: Key topics
- **Trend analysis**: Sentiment over time

---

## 19. REZ-unified-recommendations (Port 4090)

### Purpose
Centralized recommendation engine.

### Features

#### 19.1 Recommendation Types
- **Collaborative filtering**: "Users like you also bought"
- **Content-based**: "Similar to items you liked"
- **Hybrid**: Combine both approaches
- **Contextual**: Based on current session

#### 19.2 Recommendation Slots
- **Homepage**: Personalized for you
- **Product page**: Frequently bought together
- **Cart**: Complete your order
- **Post-purchase**: What's next

#### 19.3 Ranking
- **Relevance score**: Match to user preferences
- **Diversity**: Avoid repetitive items
- **Novelty**: Surprise with new items
- **Explanations**: Why this recommendation

---

## 20. REZ-notification-router (Port 4093)

### Purpose
Multi-channel notification delivery.

### Features

#### 20.1 Channels
- **Push notifications**: Mobile, web
- **SMS**: Text messages
- **Email**: HTML emails
- **In-app**: Real-time alerts

#### 20.2 Smart Routing
- **User preference**: Preferred channel
- **Urgency level**: Immediate vs. batched
- **Time zones**: Send at local time
- **Frequency capping**: Max notifications/day

#### 20.3 Templates
- **Personalization**: Dynamic content
- **A/B testing**: Template variants
- **Localization**: Multi-language
- **Compliance**: Opt-out handling

---

## 21. REZ-realtime-gateway (Port 4094)

### Purpose
WebSocket gateway for real-time updates.

### Features

#### 21.1 Connection Management
- **WebSocket** connections
- **Authentication**: Token-based
- **Heartbeat**: Connection health
- **Reconnection**: Auto-reconnect logic

#### 21.2 Channels
- **Private**: User-specific updates
- **Public**: Broadcast messages
- **Presence**: Online/offline status

#### 21.3 Events
- **Order updates**: Status changes
- **Messages**: Chat notifications
- **Alerts**: Important updates
- **Presence**: Who's online

---

## 22. REZ-event-platform (Port 4008)

### Purpose
Event sourcing and CQRS support.

### Features

#### 22.1 Event Sourcing
- **Append-only log**: Immutable event history
- **Event replay**: Rebuild state from events
- **Snapshots**: Periodic state snapshots

#### 22.2 CQRS
- **Separate read/write models**
- **Eventual consistency**
- **Projection management**

---

## 23. REZ-health-monitor (Port 4095)

### Purpose
System health monitoring and alerting.

### Features

#### 23.1 Service Monitoring
- **Health endpoints**: /health, /ready
- **Uptime tracking**: SLA calculation
- **Latency monitoring**: P50, P95, P99

#### 23.2 Alerting
- **Threshold alerts**: CPU > 80%
- **Anomaly alerts**: Unusual patterns
- **Dependency alerts**: Downstream failures

#### 23.3 Dashboards
- **Service health**: Overall status
- **Metrics trends**: Over time
- **Incident history**: Past issues

---

## 24. REZ-copilot-service

### Purpose
AI copilot assistant for merchants.

### Features

#### 24.1 Chat Interface
- **Natural language** queries
- **Context awareness**: Current page, user
- **Multi-turn conversations**

#### 24.2 Capabilities
- **Analytics queries**: "Show me sales this week"
- **Task automation**: "Create a discount for loyal customers"
- **Recommendations**: "What should I improve?"
- **Help & support**: "How do I process returns?"

---

## 25. REZ-decision-service

### Purpose
Centralized decision engine.

### Features

#### 25.1 Decision Types
- **Rule-based**: If-then rules
- **ML-based**: Predictive decisions
- **Hybrid**: Combine rules and ML

#### 25.2 Use Cases
- **Pricing decisions**: Dynamic pricing
- **Fraud decisions**: Accept/reject transactions
- **Eligibility**: User/merchant qualification
- **Recommendations**: What to show users

#### 25.3 A/B Testing
- **Experiment management**
- **Variant allocation**
- **Statistical significance**

---

## 26. REZ-ad-platform

### Purpose
Advertising platform for merchants.

### Features

#### 26.1 Ad Types
- **Search ads**: Keyword-based
- **Display ads**: Banner ads
- **Video ads**: Pre-roll, in-stream
- **Native ads**: Content-matched

#### 26.2 Targeting
- **Demographic**: Age, gender, location
- **Behavioral**: Interests, intents
- **Retargeting**: Previous visitors
- **Lookalike**: Similar audiences

#### 26.3 Campaign Management
- **Budget**: Daily, lifetime
- **Bidding**: CPC, CPM, CPA
- **Scheduling**: Dayparting
- **Geo-targeting**: Location radius

#### 26.4 Analytics
- **Impressions**, **clicks**, **conversions**
- **ROI tracking**: Revenue from ads
- **Attribution**: Multi-touch models

---

## Summary Statistics

| Category | Count |
|-----------|-------|
| Total Services | 26 |
| Total API Endpoints | 150+ |
| Total Database Models | 40+ |
| Total Agent Types | 30+ |
| Total Commerce Categories | 9 |
| Total Identity Types | 8 |

---

**Document Owner:** REZ-Intelligence Team
**Last Updated:** 2026-05-13
