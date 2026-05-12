# REZ ECOSYSTEM - COMPLETE INVENTORY

**Last Updated:** May 12, 2026  
**Version:** 1.0

---

## EXECUTIVE SUMMARY

The REZ ecosystem is a **hyperlocal commerce platform** with AI-powered intelligence, operating across 9 company entities, 14 apps, and 250+ services.

### The 9 Companies

| Company | Purpose | Products |
|---------|---------|----------|
| **RTNM-Group** | Holdings & Admin | admin.rez.money, merchant.rez.money |
| **RABTUL-Technologies** | Core Infrastructure | Payment, Order, Wallet services |
| **REZ-Intelligence** | AI/ML Platform (THE MOAT) | 60+ AI services |
| **REZ-Media** | Ads & Marketing | AdBazaar, Creator network |
| **REZ-Merchant** | Merchant OS | Merchant app, dashboard |
| **REZ-Consumer** | Consumer Apps | Nuqta, Rendez, do-app |
| **StayOwn-Hospitality** | Hotels & Living | Hotel-OTA |
| **CorpPerks** | Enterprise B2B | Corporate perks platform |
| **RTNM-Digital** | Trust & Ops | Trust verification |

---

## APPS (14 Consumer/Merchant Apps)

### CONSUMER APPS

#### 1. Nuqta (rez-app-consumer)
**Path:** `REZ-Consumer/rez-app-consumer`
**Platform:** React Native
**Purpose:** Main consumer shopping app

**Features:**
- OTP authentication
- Product browsing with AI recommendations
- Cart & checkout
- Multiple payment methods (UPI, Card, Wallet)
- REZ Wallet with cashback
- Referral system
- Push notifications (FCM)
- Order tracking

**Data Produced:**
- Orders, payments, search queries
- User preferences, browsing history
- Wallet transactions
- QR scans

**Data Consumed:**
- Recommendations from REZ Intelligence
- Merchant data, product catalog
- Pricing and offers

**Connects To:**
- REZ Intelligence (intentCapture, recommendations)
- REZ-order-service (orders)
- REZ-payment-service (payments)
- REZ-wallet-service (wallet)

---

#### 2. Rendez (Rendez Dating App)
**Path:** `REZ-Consumer/Rendez`, `REZ-Consumer/rendez-app`
**Platform:** React Native
**Purpose:** Dating & social matching app

**Features:**
- User matching algorithm
- Profile management
- Messaging
- Gift system
- Meetup scheduling
- Premium subscriptions
- AI-powered recommendations

**Data Produced:**
- Matches, messages
- User profiles, preferences
- Meetup events

**Data Consumed:**
- REZ Intelligence (personalization)
- Payment processing

**Connects To:**
- REZ Intelligence (REZMIND client)
- Payment services

---

#### 3. do-app (Activity Booking)
**Path:** `REZ-Consumer/do-app`, `REZ-Consumer/do-backend`
**Platform:** React Native
**Purpose:** Activity & experience booking

**Features:**
- Browse activities (games, tours, workshops)
- Provider listings
- Booking & payment
- Reviews & ratings

**Data Produced:**
- Bookings, activities
- User preferences

**Data Consumed:**
- REZ Intelligence (recommendations)

---

#### 4. Hotel-OTA (StayOwn)
**Path:** `StayOwn-Hospitality/Hotel-OTA`
**Platform:** React Native
**Purpose:** Hotel & stay booking

**Features:**
- Hotel search & booking
- Room service
- Check-in/out
- Guest management
- Payment integration

**Data Produced:**
- Bookings, hotel views
- Room service orders
- Guest profiles

**Data Consumed:**
- REZ Intelligence (cross-app identity)

---

#### 5. Merchant App (rez-app-merchant)
**Path:** `REZ-Merchant/rez-app-merchant`
**Platform:** React Native
**Purpose:** Merchant dashboard & management

**Features:**
- Order management
- Menu management
- Inventory tracking
- Analytics dashboard
- Customer insights
- AI copilot assistant

**Data Produced:**
- Orders, inventory changes
- Merchant analytics

**Data Consumed:**
- REZ Intelligence (insights, reorder predictions)
- Order data, customer data

---

### WEB PRODUCTS

#### 6. rez.money (Consumer Web)
**Path:** `RTNM-Group/rez.money`
**Platform:** Next.js/React
**Purpose:** Consumer web portal

**Features:**
- Web ordering
- Account management
- Order history
- Wallet access

---

#### 7. merchant.rez.money (Merchant Portal)
**Path:** `RTNM-Group/merchant.rez.money`
**Platform:** Next.js
**Purpose:** Merchant web dashboard

**Features:**
- Business analytics
- Order management
- Menu configuration
- Financial reports
- AI recommendations

---

#### 8. admin.rez.money (Admin Panel)
**Path:** `RTNM-Group/admin.rez.money`
**Platform:** Next.js
**Purpose:** Internal admin operations

**Features:**
- User management
- Merchant onboarding
- Order monitoring
- Content moderation
- Financial controls

---

#### 9. AdBazaar
**Path:** `REZ-Media/adBazaar`, `REZ-Media/adBazaar-creator`
**Platform:** React/Node.js
**Purpose:** Self-serve advertising platform

**Features:**
- Campaign creation
- Budget management
- Ad targeting
- Creator marketplace
- Performance analytics

**Data Produced:**
- Ad impressions, clicks
- Campaign performance
- Creator metrics

**Data Consumed:**
- REZ Intelligence (targeting AI)

---

#### 10. REZ Dashboard (Merchant Dashboard)
**Path:** `REZ-Merchant/REZ-dashboard`
**Platform:** React
**Purpose:** Comprehensive merchant analytics

**Features:**
- Real-time metrics
- Revenue tracking
- Customer insights
- AI recommendations

---

---

## BACKEND SERVICES (170+)

### CORE INFRASTRUCTURE (RABTUL-Technologies)

#### Payment Services
| Service | Port | Purpose |
|---------|------|---------|
| `rez-payment-service` | 4001 | Payment processing (Razorpay) |
| `rez-refund-service` | - | Refund handling |
| `rez-payment-gateway` | - | Payment routing |

#### Order Services
| Service | Port | Purpose |
|---------|------|---------|
| `rez-order-service` | 4003 | Order lifecycle management |
| `rez-order-tracking` | - | Real-time order tracking |
| `rez-cart-service` | - | Cart management |

#### Wallet Services
| Service | Port | Purpose |
|---------|------|---------|
| `rez-wallet-service` | 4004 | Wallet balance & transactions |
| `rez-cashback-service` | - | Cashback management |
| `rez-points-service` | - | Loyalty points |

#### Other Core
| Service | Port | Purpose |
|---------|------|---------|
| `rez-auth-service` | 4000 | Authentication (JWT/OTP) |
| `rez-notification-service` | 4005 | Push/email/SMS |
| `rez-scheduler-service` | - | Background jobs |
| `rez-file-service` | - | File uploads/storage |

---

## REZ INTELLIGENCE (THE MOAT) - 60+ Services

### Phase 1: Repeat Commerce Wedge
| Port | Service | Purpose |
|------|---------|---------|
| 4040 | REZ-reorder-engine | Predict reorder probability |
| 4041 | REZ-taste-profile | Consumer preferences |
| 4042 | REZ-demand-forecast | Demand prediction |
| 4043 | REZ-price-predictor | Dynamic pricing |

### Phase 2: Data Network
| Port | Service | Purpose |
|------|---------|---------|
| 4050 | REZ-identity-graph | Unified user identity |
| 4051 | REZ-memory-engine | AI memory |
| 4052 | REZ-ai-router | Multi-provider AI |

### Phase 3: Intelligence Moat
| Port | Service | Purpose |
|------|---------|---------|
| 4060 | REZ-knowledge-graph | Semantic entities |
| 4061 | REZ-merchant-brain | Merchant insights |
| 4062 | REZ-autonomous-agents | 30 AI agents |

### Phase 4: Ecosystem
| Port | Service | Purpose |
|------|---------|---------|
| 4070 | REZ-payments-brain | Fraud detection |
| 4071 | REZ-inventory-sync | POS sync |
| 4072 | REZ-creator-network | Creator intelligence |
| 4073 | REZ-merchant-os | Merchant SaaS |

### Integration Services
| Port | Service | Purpose |
|------|---------|---------|
| 4085 | REZ-feedback-collector | Conversion tracking |
| 4090 | REZ-unified-recommendations | All recommendations |
| 4091 | REZ-integration-sdk | Unified SDK |
| 4092 | REZ-identity-bridge | Cross-app identity |
| 4093 | REZ-notification-router | Push/SMS/Email |
| 4094 | REZ-realtime-gateway | WebSocket |
| 4095 | REZ-health-monitor | Service monitoring |
| 4096 | REZ-api-keys | API key management |

### Existing AI Services
| Port | Service | Purpose |
|------|---------|---------|
| 3005 | REZ-cdp-service | Customer Data Platform |
| 4008 | REZ-event-platform | Event publishing |
| 4009 | REZ-action-engine | Decision execution |
| 4015 | REZ-recommendation-engine | Recommendations |
| 4017 | REZ-personalization-engine | Personalization |
| 4020 | REZ-intelligence-hub | Central hub |
| 4031 | REZ-event-bus | Event bus |
| 4033 | REZ-support-copilot | Support AI |

---

## 30 AUTONOMOUS AI AGENTS

### Commerce Agents (15)
1. DemandSignalAgent - Aggregate demand signals
2. ScarcityAgent - Supply/demand monitoring
3. PriceElasticityAgent - Price sensitivity
4. ReorderPredictorAgent - Reorder probability
5. TasteEvolutionAgent - Preference changes
6. ChurnRiskAgent - Churn prediction
7. LTVPredictorAgent - Lifetime value
8. InventoryAlertAgent - Low stock alerts
9. DemandForecastAgent - 7-day forecast
10. CompetitorMonitorAgent - Price tracking
11. TrendDetectorAgent - Trend identification
12. PriceOptimizerAgent - Optimal pricing
13. OfferMatcherAgent - Offer matching
14. CrossSellAgent - Cross-sell products
15. UrgencyTriggerAgent - Urgency signals

### User Agents (15)
1. PersonalizationAgent - User profiles
2. SegmentClassifierAgent - User segments
3. RecommendationQualityAgent - Rec quality
4. EngagementScoreAgent - Engagement scoring
5. SessionAnalyzerAgent - Session analysis
6. SearchIntentAgent - Search intent
7. BrowsePatternAgent - Browse tracking
8. PurchasePredictorAgent - Purchase intent
9. AbandonmentDetectorAgent - Cart abandonment
10. RetentionTriggerAgent - Retention offers
11. WinBackAgent - Win-back campaigns
12. ReferralPotentialAgent - Referral scoring
13. SurveyTriggerAgent - NPS optimization
14. FeedbackAnalyzerAgent - Feedback analysis
15. NPSPredictorAgent - NPS prediction

---

## INTEGRATION ARCHITECTURE

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CONSUMER APPS │
│ │
│ Nuqta ───► QR Scans ───► Orders ───► Payments ───► Wallet │
│ │ │ │ │
│ │ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
│ │ │
│ Rendez ───► Matches ───► Messages ───► Meetups │
│ │ │ │
│ │ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
│ │ │
│ do-app ───► Activities ───► Bookings │
│ │ │
│ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
│ │
│ Hotel-OTA ───► Bookings ───► Room Service │
│ │ │
│ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ MERCHANT APPS │
│ │
│ Merchant App ───► Orders ───► Inventory ───► Analytics │
│ │ │ │ │
│ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
│ │
│ Merchant Dashboard ───► Business Insights ───► AI Recommendations │
│ │ │
│ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ADVERTISING │
│ │
│ AdBazaar ───► Campaigns ───► Impressions ───► Conversions │
│ │ │ │ │
│ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
│ │
│ Creator Network ───► Content ───► Engagement ───► Revenue │
│ │ │
│ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ADMIN & OPERATIONS │
│ │
│ admin.rez.money ───► User Management ───► Moderation ───► Analytics │
│ │ │ │
│ └──────► REZ INTELLIGENCE ◄──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Unified Identity Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CROSS-APP IDENTITY │
│ │
│ Same User Across All Apps │
│ │ │
│ phone: +91 98765 43210 │
│ │ │
│ ├─► Nuqta (consumer_user_123) │
│ ├─► Rendez (dating_user_456) │
│ ├─► do-app (activity_user_789) │
│ ├─► Hotel-OTA (hotel_user_012) │
│ ├─► Merchant App (merchant_staff) │
│ └─► CorpPerks (corp_user_345) │
│ │
│ ▼ │
│ REZ-IDENTITY-GRAPH (unifiedId: uid_abc123) │
│ │
│ Benefits: │
│ • Unified taste profile │
│ • Cross-app recommendations │
│ • Single loyalty program │
│ • Better targeting │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ML MODELS

### 1. Reorder Predictor
**Path:** `REZ-ml-models/reorder_predictor/`
**Algorithm:** Gradient Boosting Classifier
**Features:** 14 features (recency, frequency, monetary, context)
**Output:** Reorder probability, recommended action

### 2. Taste Profiler
**Path:** `REZ-ml-models/taste_profiler/`
**Algorithm:** Similarity-based clustering
**Features:** Cuisine, price range, dietary preferences
**Output:** User taste profile, similar users

### 3. Demand Forecaster
**Path:** `REZ-ml-models/demand_forecast/`
**Algorithm:** Gradient Boosting Regressor
**Features:** 12 features (day, lags, trend, seasonal)
**Output:** 7-day demand forecast, staffing recommendations

---

## EXTERNAL INTEGRATIONS

### Payment
- Razorpay (primary payment gateway)

### Notifications
- Firebase Cloud Messaging (FCM) - Push
- Twilio - SMS
- SendGrid - Email

### AI Providers
- OpenAI (GPT-4)
- Anthropic (Claude)
- Google AI (Gemini)

### Infrastructure
- MongoDB Atlas - Primary database
- Redis Cloud - Cache & sessions
- AWS S3 - File storage
- Cloudflare - CDN & security

### Analytics
- Google Analytics
- Mixpanel (event tracking)

---

## DATABASE STRUCTURE

### MongoDB Databases

| Database | Purpose | Collections |
|----------|---------|-------------|
| `rez_users` | User profiles | users, profiles, sessions |
| `rez_orders` | Orders | orders, order_items, payments |
| `rez_merchants` | Merchant data | merchants, menus, inventory |
| `rez_events` | Event tracking | events, sessions |
| `rez_intelligence` | AI data | recommendations, predictions, insights |
| `rez_logs` | System logs | logs, audit |
| `rez_ads` | Advertising | campaigns, creatives, analytics |

---

## ENVIRONMENT VARIABLES

### Required for All Services
```bash
# MongoDB
MONGODB_URI=mongodb+srv://...

# Redis
REDIS_URL=redis://...

# Authentication
JWT_SECRET=...
INTERNAL_SERVICE_TOKEN=...

# AI Providers
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

### Service-Specific
```bash
# Payments
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

# Notifications
FCM_SERVER_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=...
```

---

## QUICK REFERENCE

### Service Ports
| Port | Service |
|------|---------|
| 4000 | Auth Service |
| 4001 | Payment Service |
| 4003 | Order Service |
| 4004 | Wallet Service |
| 4005 | Notification Service |
| 4040-4043 | Phase 1 Intelligence |
| 4050-4052 | Phase 2 Intelligence |
| 4060-4062 | Phase 3 Intelligence |
| 4070-4073 | Phase 4 Intelligence |
| 4085-4096 | Integration Services |

### API Key Permissions
- `events:read` - Read events
- `events:write` - Write events
- `recommendations:read` - Get recommendations
- `recommendations:write` - Update recommendations
- `identity:read` - Read identity
- `identity:write` - Write identity
- `*` - Full access

---

## SUPPORT

For technical questions, contact the REZ Intelligence team.

---

*This document is updated automatically as the ecosystem evolves.*
