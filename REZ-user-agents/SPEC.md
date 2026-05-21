# REZ User Agents - SPEC.md

**Version:** 1.0.0
**Port:** 4030
**Company:** REZ-Intelligence
**Category:** AI Agents

---

## Overview

15 autonomous AI agents for user intelligence in the REZ platform. Each agent runs on a defined schedule and produces actionable insights stored in MongoDB.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REZ User Agents                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Agents:                                                                   │
│  ├── PersonalizationAgent  → Update user preferences                      │
│  ├── SegmentClassifierAgent → Classify users into segments                 │
│  ├── RecommendationQualityAgent → Score recommendations                  │
│  ├── EngagementScoreAgent  → RFM analysis                               │
│  ├── SessionAnalyzerAgent  → Session pattern analysis                     │
│  ├── SearchIntentAgent    → Real-time search intent                     │
│  ├── BrowsePatternAgent   → Browse behavior tracking                     │
│  ├── PurchasePredictorAgent → Purchase probability                      │
│  ├── AbandonmentDetectorAgent → Cart abandonment detection               │
│  ├── RetentionTriggerAgent  → Create retention offers                   │
│  ├── WinBackAgent         → Identify win-back candidates                │
│  ├── ReferralPotentialAgent → Score referral potential                  │
│  ├── SurveyTriggerAgent   → Optimize survey timing                      │
│  ├── FeedbackAnalyzerAgent → Analyze feedback sentiment                 │
│  └── NPSPredictorAgent   → Predict NPS scores                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Schedules

| Agent | Schedule | Purpose |
|-------|----------|---------|
| PersonalizationAgent | Hourly | Update user profiles |
| SegmentClassifierAgent | Daily | Classify user segments |
| RecommendationQualityAgent | Hourly | Score recommendations |
| EngagementScoreAgent | Daily | RFM analysis |
| SessionAnalyzerAgent | Hourly | Session analysis |
| SearchIntentAgent | Every 5 min | Real-time intent |
| BrowsePatternAgent | Every 15 min | Browse tracking |
| PurchasePredictorAgent | Hourly | Purchase prediction |
| AbandonmentDetectorAgent | Every 10 min | Abandonment detection |
| RetentionTriggerAgent | Daily | Retention offers |
| WinBackAgent | Weekly | Win-back candidates |
| ReferralPotentialAgent | Daily | Referral scoring |
| SurveyTriggerAgent | Daily | Survey optimization |
| FeedbackAnalyzerAgent | Hourly | Sentiment analysis |
| NPSPredictorAgent | Daily | NPS prediction |

---

## API Endpoints

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents/:name/run` | Run agent manually |

### Insights
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/insights` | Query agent insights |

### Demo
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/seed` | Seed mock data |

---

## Data Models

### AgentInsight
```typescript
{
  agentId: string
  agentName: string
  userId: string
  insightType: string
  data: Record<string, any>
  confidence: number (0-1)
  action: string
  timestamp: Date
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "express-rate-limit": "^7.1.5",
  "jsonwebtoken": "^9.0.2"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4030 | Server port |
| MONGODB_URI | mongodb://localhost:27017/rez_user_agents | MongoDB connection |
| LOG_LEVEL | info | Winston log level |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Signal Aggregator | Read | Behavioral signals |
| REZ Unified Profile | Write | Profile updates |
| REZ Care Service | Write | Retention triggers |

---

## Status

- [x] 15 AI agents
- [x] Cron scheduling
- [x] Insight storage
- [x] REST API
- [x] Mock data seeding
