# REZ Agent Orchestrator

**Central Intelligence Layer for REZ Ecosystem**

> The orchestrator converts "many tools" into "one intelligent operating system."

---

## Overview

REZ Agent Orchestrator is the central nervous system that coordinates all AI agents across the REZ ecosystem. It enables:

- Task coordination across 38+ agents
- Real-time event-driven architecture
- Unified consumer identity
- Autonomous decision-making

---

## Core Components

### 1. Agent Orchestrator

Coordinates all agents:

```typescript
// Create task
const task = orchestrator.createTask(
  'Detect churn risk for high-value customers',
  { merchantId: 'merchant-123' },
  'high'
);

// Assign to best agent
orchestrator.assignTask(task.id);

// Execute
await orchestrator.executeTask(task.id, executor);
```

### 2. Event Bus

Real-time event infrastructure:

```typescript
// Subscribe to events
eventBus.subscribe('customer.churn_risk', async (event) => {
  // Trigger retention campaign
});

// Publish events
await events.weatherChanged('mumbai', 'rainy', 25);
```

### 3. Consumer Identity Graph

Unified customer view:

```typescript
// Create/merge profiles
const profile = identityGraph.createProfile('merchant', {
  phone: '+91-9876543210',
  name: 'Rahul',
  lifetimeValue: 50000,
});

// Get cross-app journey
const journey = identityGraph.getCrossAppJourney(profile.id);
```

---

## Connected Agents

| Agent | Capabilities |
|-------|--------------|
| demand-signal-agent | demand_signal, trend_detector |
| churn-risk-agent | churn_risk, ltv_predictor |
| price-optimizer-agent | price_optimizer |
| inventory-agent | inventory_alert |
| personalization-agent | personalization, recommendation |
| retention-agent | retention, winback |
| competitor-agent | competitor_monitor |
| campaign-agent | campaign_optimize |
| attribution-agent | attribution |

---

## Event Types

### Commerce Events
- `order.created` - New order placed
- `inventory.low` - Stock running low
- `inventory.depleted` - Out of stock

### Customer Events
- `customer.churn_risk` - High-value customer at risk
- `customer.inactive` - Customer not engaged
- `customer.ltv_changed` - Lifetime value update

### Market Events
- `weather.changed` - Weather update
- `weather.rain_detected` - Rain detected
- `event.detected` - Local event (IPL, festival)
- `competitor.discount_detected` - Competitor offer

### System Events
- `demand.spike` - Sudden demand increase
- `demand.drop` - Demand decrease
- `anomaly.detected` - Unusual pattern

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AGENT ORCHESTRATOR                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Agent Registry  │  │  Task Queue     │  │ Goal Manager│ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Event Bus       │  │ Identity Graph  │  │ Conflict    │ │
│  │ (Real-time)    │  │ (Consumer)      │  │ Resolution  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ REZ-Commerce    │  │ REZ-Media      │  │ RABTUL         │
│ Agents          │  │ Agents          │  │ Services       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## How It Works

### 1. Event Detection
```
Weather changes → Event Bus publishes 'weather.rain_detected'
```

### 2. Agent Notification
```
Event Bus → demand-signal-agent → business-ai → retention-agent
```

### 3. Task Creation
```
demand-signal-agent → Creates task: "Launch rainy day campaign"
```

### 4. Orchestration
```
Task → Priority check → Best agent assignment → Execution
```

### 5. Consumer Action
```
Campaign → Notification → Offer → Conversion
```

### 6. Learning
```
Result → Identity Graph → Memory Layer → Future optimization
```

---

## Integration Points

### With REZ Business AI
- Goals from Business AI → Orchestrator
- Actions from Orchestrator → Business AI execution
- Events from Orchestrator → Business AI monitoring

### With Industry Mind Services
- Demand signals → Industry Mind analysis
- Recommendations → Orchestrator queue

### With REZ-Agent-OS
- 38 agents connected via orchestrator
- Central coordination layer

---

## Port

**Port: 4040** (planned)

---

## Related Services

| Service | Purpose |
|---------|---------|
| REZ Business AI | Execution layer |
| REZ-Agent-OS | Agent definitions |
| Industry Mind | Domain expertise |
| Intent Graph | Consumer intelligence |

---

*Version: 1.0.0*
