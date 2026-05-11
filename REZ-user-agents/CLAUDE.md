# REZ User Agents

## Overview

15 autonomous AI agents for user intelligence in the REZ platform. Each agent runs on a defined schedule and produces actionable insights stored in MongoDB.

## Agents

| Agent | Schedule | Purpose |
|-------|----------|---------|
| PersonalizationAgent | Hourly | Update user profiles with latest preferences |
| SegmentClassifierAgent | Daily | Classify users into segments (VIP, HIGH_VALUE, AT_RISK, etc.) |
| RecommendationQualityAgent | Hourly | Score recommendation effectiveness |
| EngagementScoreAgent | Daily | Calculate engagement scores (RFM analysis) |
| SessionAnalyzerAgent | Hourly | Analyze session patterns and quality |
| SearchIntentAgent | Every 5 min | Parse search intent in real-time |
| BrowsePatternAgent | Every 15 min | Track browse behavior patterns |
| PurchasePredictorAgent | Hourly | Predict purchase probability |
| AbandonmentDetectorAgent | Every 10 min | Detect cart abandonment in real-time |
| RetentionTriggerAgent | Daily | Create retention offers for at-risk users |
| WinBackAgent | Weekly | Identify win-back candidates |
| ReferralPotentialAgent | Daily | Score referral potential |
| SurveyTriggerAgent | Daily | Optimize NPS survey timing |
| FeedbackAnalyzerAgent | Hourly | Analyze feedback sentiment |
| NPSPredictorAgent | Daily | Predict NPS scores |

## Setup

```bash
npm install
```

## Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

## Running

```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|--------|-------------|
| PORT | 4030 | Server port |
| MONGODB_URI | mongodb://localhost:27017/rez_user_agents | MongoDB connection |
| LOG_LEVEL | info | Winston log level |

## API Endpoints

- `GET /health` - Health check
- `GET /api/agents` - List all agents
- `POST /api/agents/:name/run` - Run agent manually
- `GET /api/insights` - Query agent insights
- `POST /api/seed` - Seed mock data (demo)

## Data Models

### AgentInsight
Stores all agent outputs with:
- agentId, agentName, userId
- insightType (e.g., 'engagement_score', 'abandonment_detected')
- data (structured JSON)
- confidence (0-1)
- action (recommended action)

### Supporting Models
- UserProfile - User preferences and segments
- UserSession - Session tracking
- BrowseEvent, SearchEvent, CartEvent, Purchase - Behavioral data
- Feedback - NPS and survey responses
- WinBackCandidate - Dormant user tracking
- ReferralPotential - Referral scoring
- UserEngagement - RFM scores

## Cron Schedules

Uses node-cron with standard cron syntax:
- `0 * * * *` = Every hour at minute 0
- `*/5 * * * *` = Every 5 minutes
- `0 0 * * *` = Daily at midnight
- `0 3 * * 0` = Weekly on Sunday

## Testing

```bash
npm test
```

## Architecture

```
agents.js
├── Configuration (env, logger)
├── MongoDB Models (9 models)
├── Mock Data Generators
├── 15 Agent Implementations
│   ├── PersonalizationAgent
│   ├── SegmentClassifierAgent
│   ├── RecommendationQualityAgent
│   ├── EngagementScoreAgent
│   ├── SessionAnalyzerAgent
│   ├── SearchIntentAgent
│   ├── BrowsePatternAgent
│   ├── PurchasePredictorAgent
│   ├── AbandonmentDetectorAgent
│   ├── RetentionTriggerAgent
│   ├── WinBackAgent
│   ├── ReferralPotentialAgent
│   ├── SurveyTriggerAgent
│   ├── FeedbackAnalyzerAgent
│   └── NPSPredictorAgent
├── Agent Registry & Scheduler
└── Express Server
```
