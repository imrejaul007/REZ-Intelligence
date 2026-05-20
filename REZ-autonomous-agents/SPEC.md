# REZ Autonomous Agents - SPEC.md

**Version:** 1.0.0
**Port:** 4062
**Company:** REZ-Intelligence
**Category:** AI Agents

---

## Overview

8 AI agents for commerce intelligence that autonomously analyze data, generate insights, and create actions. Agents run on schedules and can be triggered manually.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ Autonomous Agents (4062)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  8 AI Agents:                                                               │
│  ├── DemandSignalAgent     → Demand patterns                               │
│  ├── ScarcityAgent         → Supply/demand alerts                          │
│  ├── PersonalizationAgent  → A/B test analysis                            │
│  ├── AttributionAgent      → Multi-touch conversion                       │
│  ├── AdaptiveScoringAgent  → ML model retraining                          │
│  ├── FeedbackLoopAgent    → Closed-loop optimization                      │
│  ├── NetworkEffectAgent    → Collaborative filtering                      │
│  └── RevenueAttributionAgent → GMV and ROI tracking                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Models: AgentRun, Insight, Action                                         │
│  Schedules: Cron-based autonomous execution                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## AI Agents

### 1. Demand Signal Agent

**Schedule:** `*/5 * * * *` (every 5 minutes)

Analyzes demand patterns across categories.

**Outputs:**
- Total demand by category
- Trend detection (up/stable/down)
- Velocity calculations
- Opportunity insights

**Example Output:**
```json
{
  "totalDemand": 850,
  "byCategory": { "restaurant": 500, "hotel": 200, "retail": 150 },
  "trends": [
    { "category": "biryani", "trend": "up", "velocity": 0.8 }
  ]
}
```

### 2. Scarcity Agent

**Schedule:** `*/1 * * * *` (every minute)

Monitors supply/demand ratios and creates alerts.

**Outputs:**
- High demand, low supply alerts
- Severity levels (critical/high)
- Scarcity insights

**Example Output:**
```json
{
  "alerts": [
    {
      "type": "high_demand_low_supply",
      "item": "Premium Biryani",
      "severity": "critical",
      "demand": 150,
      "supply": 50,
      "ratio": 3.0
    }
  ]
}
```

### 3. Personalization Agent

**Schedule:** Manual trigger

Analyzes A/B test results and identifies winning variants.

**Outputs:**
- Test performance by variant
- Winning variants with lift
- Campaign update actions

### 4. Attribution Agent

**Schedule:** Manual trigger

Multi-touch conversion attribution across channels.

**Outputs:**
- Channel touchpoints
- Channel ROI
- Best channel identification

### 5. Adaptive Scoring Agent

**Schedule:** `0 * * * *` (hourly)

Retrains ML models and tracks accuracy.

**Outputs:**
- Model accuracy metrics
- Feature importance
- Improvement suggestions

### 6. Feedback Loop Agent

**Schedule:** Manual trigger

Closed-loop optimization and drift detection.

**Outputs:**
- Drift detection (PSI > 0.2)
- Automatic corrections
- Anomaly insights

### 7. Network Effect Agent

**Schedule:** `0 0 * * *` (daily)

Collaborative filtering and user clustering.

**Outputs:**
- User clusters by behavior
- Similarity computations
- Cluster insights

### 8. Revenue Attribution Agent

**Schedule:** `*/15 * * * *` (every 15 minutes)

GMV tracking and ROI analysis.

**Outputs:**
- GMV by source
- Campaign ROI
- Top-performing agents

---

## API Endpoints

### GET /health

Health check.

### GET /api/agents/status

Get status of all agents.

**Response:**
```json
{
  "success": true,
  "agents": {
    "demand_signal": {
      "status": "idle",
      "lastRun": "2026-05-20T10:25:00Z",
      "schedule": "*/5 * * * *"
    }
  }
}
```

### POST /api/agents/:agentType/run

Run specific agent.

**Endpoint:** `POST /api/agents/demand_signal/run`

**Response:**
```json
{
  "success": true,
  "agentType": "demand_signal",
  "result": {
    "totalDemand": 850,
    "byCategory": { ... },
    "trends": [ ... ]
  }
}
```

### POST /api/agents/run

Run all agents.

**Response:**
```json
{
  "success": true,
  "results": {
    "demand_signal": { ... },
    "scarcity": { ... }
  }
}
```

### GET /api/insights

Get generated insights.

**Query:** `?agentType=demand_signal&priority=high&limit=50`

**Response:**
```json
{
  "success": true,
  "insights": [
    {
      "insightId": "ins_abc123",
      "agentType": "demand_signal",
      "type": "opportunity",
      "title": "biryani demand up",
      "description": "+80% demand change (150 orders)",
      "priority": "high",
      "confidence": 0.85,
      "status": "new",
      "createdAt": "2026-05-20T10:30:00Z"
    }
  ],
  "count": 1
}
```

### GET /api/actions

Get pending/executed actions.

**Query:** `?agentType=scarcity&status=pending`

**Response:**
```json
{
  "success": true,
  "actions": [
    {
      "actionId": "act_xyz789",
      "agentType": "scarcity",
      "type": "restock_alert",
      "target": { "item": "Premium Biryani" },
      "status": "pending",
      "priority": "high",
      "autoExecute": false
    }
  ],
  "count": 1
}
```

### PATCH /api/actions/:actionId

Approve/reject/execute action.

**Request:**
```json
{
  "status": "approved",
  "approvedBy": "admin_123"
}
```

### PATCH /api/insights/:insightId

Update insight status.

**Request:**
```json
{
  "status": "actioned"
}
```

### GET /api/agents/:agentType/history

Get agent run history.

**Query:** `?limit=20`

### GET /api/analytics

Get platform analytics.

**Response:**
```json
{
  "success": true,
  "insights": [
    { "_id": "opportunity", "count": 45 },
    { "_id": "risk", "count": 12 }
  ],
  "actions": [
    { "_id": "pending", "count": 5 },
    { "_id": "executed", "count": 23 }
  ],
  "agents": [
    {
      "_id": "demand_signal",
      "runs": 120,
      "avgDuration": 2500,
      "errors": 2
    }
  ]
}
```

---

## Insight Types

| Type | Description | Priority |
|------|-------------|----------|
| `trend` | Behavioral trend detected | low/medium |
| `anomaly` | Unusual pattern | high/critical |
| `opportunity` | Revenue opportunity | medium/high |
| `risk` | Potential risk | high/critical |
| `prediction` | ML prediction | medium |

---

## Action Types

| Status | Description |
|--------|-------------|
| `pending` | Awaiting approval |
| `approved` | Approved, awaiting execution |
| `rejected` | Rejected |
| `executed` | Successfully executed |
| `failed` | Execution failed |

---

## Data Models

### AgentRun

```typescript
interface AgentRun {
  agentId: string;
  agentType: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  errors: string[];
  metrics: {
    recordsProcessed?: number;
    insightsGenerated?: number;
    actionsTaken?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Insight

```typescript
interface Insight {
  insightId: string;
  agentType: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk' | 'prediction';
  title: string;
  description: string;
  data: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  sourceRun?: string;
  status: 'new' | 'reviewing' | 'actioned' | 'dismissed';
  actionedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Action

```typescript
interface Action {
  actionId: string;
  agentType: string;
  type: string;
  target: Record<string, any>;
  payload: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  autoExecute: boolean;
  approvedBy?: string;
  executedAt?: Date;
  result?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.21.0",
  "mongoose": "^8.5.0",
  "node-cron": "^3.0.3",
  "uuid": "^10.0.0",
  "zod": "^3.23.8"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Service port (default: 4062) |
| `MONGODB_URI` | MongoDB connection |
| `REDIS_URL` | Redis cache |
| `INTERNAL_SERVICE_TOKEN` | Service authentication |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Order Service | Read | Order analytics |
| Product Service | Read | Inventory analysis |
| Campaign Service | Write | Campaign updates |
| Notification Service | Trigger | Alerts |

---

## Schedules

| Agent | Schedule | Frequency |
|-------|----------|-----------|
| DemandSignalAgent | `*/5 * * * *` | 5 minutes |
| ScarcityAgent | `*/1 * * * *` | 1 minute |
| AdaptiveScoringAgent | `0 * * * *` | Hourly |
| NetworkEffectAgent | `0 0 * * *` | Daily |
| RevenueAttributionAgent | `*/15 * * * *` | 15 minutes |

---

## Status

- [x] All 8 agents implemented
- [x] Scheduled execution
- [x] Manual trigger
- [x] Insight generation
- [x] Action management
- [x] Run history
- [x] Analytics
- [x] Priority-based actions
- [ ] Auto-execution framework
- [ ] Webhook notifications
