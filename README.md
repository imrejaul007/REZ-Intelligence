# REZ Intelligence Platform

**THE MOAT** - AI-powered commerce intelligence for the REZ ecosystem.

---

## Overview

REZ Intelligence provides:
- **Repeat Commerce Intelligence** - Reorder predictions, taste profiling
- **Cross-App Identity** - Unified user profiles across all apps
- **Autonomous Agents** - 30 AI agents continuously learning
- **Real-time Personalization** - Recommendations for every user
- **Conversion Attribution** - Track nudge ROI

---

## Services (60+)

### Infrastructure
| Port | Service | Purpose |
|------|---------|---------|
| 4091 | Integration SDK | Unified SDK for all apps |
| 4092 | Identity Bridge | Cross-app user identity |
| 4008 | Event Platform | Event publishing |
| 4031 | Event Bus | Event distribution |

### Intelligence (Phase 1-4)
| Port | Service | Purpose |
|------|---------|---------|
| 4040 | Reorder Engine | Predict reorders |
| 4041 | Taste Profile | User preferences |
| 4050 | Identity Graph | Unified identity |
| 4062 | Autonomous Agents | 30 AI agents |

### Integration
| Port | Service | Purpose |
|------|---------|---------|
| 4085 | Feedback Collector | Conversion tracking |
| 4090 | Unified Recommendations | All recommendations |
| 4093 | Notification Router | Push/SMS/Email |
| 4094 | Realtime Gateway | WebSocket events |

### Operations
| Port | Service | Purpose |
|------|---------|---------|
| 4095 | Health Monitor | Service monitoring |
| 4100 | Validation Dashboard | KPI tracking |
| 4101 | Flywheel MVP | Demo loop |

---

## Quick Start

```bash
# Start all services
./start.sh

# Check status
./start.sh status

# Health check
curl http://localhost:4095/health/all
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ ALL APPS │
│ Hotel-OTA │ Rendez │ AdBazaar │ Consumer │ Merchant │
└─────────────────────────────────────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────┐
│ REZ-INTEGRATION-SDK │
│ One SDK for all │
└─────────────────────────────────────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────┐
│ DATA FLOW │
│ │
│ Events ──► Identity ──► Intelligence ──► Recommendations │
│ │ │ │ │
│ │ │ └─► Feedback ──► Analytics │ │
│ │ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
 │
 ▼
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT │
│ │
│ Notifications ──► Users ──► Conversions │
└─────────────────────────────────────────────────────────────────┘
```

---

## App Connectors

### Hotel-OTA
```javascript
const { REZHotelConnector } = require('./services/REZConnector');
const rez = new REZHotelConnector();
await rez.init(user);
await rez.trackBookingConfirmed(booking);
```

### Rendez
```javascript
const { REZRendezConnector } = require('./services/REZConnector');
const rez = new REZRendezConnector();
await rez.init(user);
await rez.trackMatch(match);
```

### AdBazaar
```javascript
const { REZAdBazaarConnector } = require('./services/REZConnector');
const rez = new REZAdBazaarConnector();
await rez.init(merchant);
await rez.trackAdImpression(impression);
```

---

## 30 Autonomous Agents

### Commerce (15)
1. DemandSignalAgent - Aggregate demand
2. ScarcityAgent - Supply/demand ratios
3. PriceElasticityAgent - Price sensitivity
4. ReorderPredictorAgent - Reorder probability
5. TasteEvolutionAgent - Preference changes
6. ChurnRiskAgent - Churn prediction
7. LTVPredictorAgent - Lifetime value
8. InventoryAlertAgent - Low stock
9. DemandForecastAgent - 7-day prediction
10. CompetitorMonitorAgent - Price tracking
11. TrendDetectorAgent - Trend detection
12. PriceOptimizerAgent - Optimal pricing
13. OfferMatcherAgent - Offer matching
14. CrossSellAgent - Cross-sell products
15. UrgencyTriggerAgent - Urgency signals

### User (15)
1. PersonalizationAgent - User profiles
2. SegmentClassifierAgent - User segments
3. RecommendationQualityAgent - Rec quality
4. EngagementScoreAgent - Engagement
5. SessionAnalyzerAgent - Session analysis
6. SearchIntentAgent - Search intent
7. BrowsePatternAgent - Browse tracking
8. PurchasePredictorAgent - Purchase intent
9. AbandonmentDetectorAgent - Cart abandonment
10. RetentionTriggerAgent - Retention offers
11. WinBackAgent - Win-back candidates
12. ReferralPotentialAgent - Referral scoring
13. SurveyTriggerAgent - NPS timing
14. FeedbackAnalyzerAgent - Feedback analysis
15. NPSPredictorAgent - NPS prediction

---

## Data Flow

```
QR Scan ──► Event ──► Identity ──► Intelligence
 │ │ │ │
 │ │ └─► Memory ──► Copilot │ │
 │ └─────────────────────────────┘ │
 └─► Reorder Engine ──► Nudge ──► Conversion
```

---

## Deploy

### Local
```bash
./start.sh start
```

### Render
Each service has `render.yaml` - connect GitHub repo.

---

## Documentation

- [Integration Guide](docs/INTEGRATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Flywheel](docs/FLYWHEEL.md)

---

## Stats

- **60+ Services**
- **30 AI Agents**
- **125K+ Lines of Code**
- **8 App Connectors**

---

## Support

For issues, contact the REZ Intelligence team.
