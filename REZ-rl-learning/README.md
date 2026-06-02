# REZ RL Learning Service

Reinforcement Learning service for self-improving recommendations using multi-armed bandits.

## Overview

This service implements self-improving recommendations that learn from feedback loops using:
- **Epsilon-Greedy**: Simple exploration/exploitation balancing
- **UCB1**: Upper Confidence Bound algorithm
- **Thompson Sampling**: Bayesian approach with Beta distributions

## Quick Start

```bash
cd REZ-rl-learning
npm install
npm run dev
```

Service starts on port **4136**.

## Architecture

```
src/
├── index.ts              # Main entry point
├── types/
│   └── index.ts          # TypeScript interfaces
├── models/
│   └── banditModel.ts     # Redis-based storage
├── services/
│   ├── banditEngine.ts    # Core bandit logic
│   ├── policyManager.ts   # Policy implementations
│   ├── rewardTracker.ts   # Reward tracking
│   ├── explorationEngine.ts # Exploration/exploitation balancing
│   └── modelUpdater.ts    # Online learning updates
└── routes/
    └── rlRoutes.ts        # API endpoints
```

## API Endpoints

### Bandit Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bandit/select` | Select best action (epsilon-greedy) |
| GET | `/api/bandit/:banditId` | Get bandit state |
| GET | `/api/bandit/:banditId/performance` | Get performance summary |
| POST | `/api/bandit/:banditId/reset` | Reset bandit to initial state |

### Reward Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reward/record` | Record reward feedback |

### Policy Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/policy/:userId` | Get user's current policy |
| POST | `/api/policy/switch` | Switch bandit policy |
| PATCH | `/api/policy/update` | Update policy parameters |

### Exploration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/explore` | Force exploration |

## Usage Examples

### Select an Arm (Bandit Selection)

```typescript
POST /api/bandit/select
{
  "banditId": "recommendation:user123",
  "userId": "user123",
  "arms": [
    { "armId": "product_a", "name": "Product A" },
    { "armId": "product_b", "name": "Product B" },
    { "armId": "product_c", "name": "Product C" }
  ],
  "policy": {
    "type": "epsilon-greedy",
    "epsilon": 0.1
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "banditId": "recommendation:user123",
    "selectedArm": { "armId": "product_b", "name": "Product B" },
    "selectionPolicy": "epsilon-greedy",
    "isExploration": false,
    "confidence": 0.9,
    "timestamp": 1709136000000
  }
}
```

### Record Reward

```typescript
POST /api/reward/record
{
  "banditId": "recommendation:user123",
  "armId": "product_b",
  "userId": "user123",
  "reward": 1.0,
  "rewardType": "purchase"
}
```

### Force Exploration

```typescript
POST /api/explore
{
  "banditId": "recommendation:user123",
  "userId": "user123",
  "excludeArms": ["product_a"]
}
```

## Policies

### Epsilon-Greedy
- **epsilon**: Exploration probability (0-1)
- **decayRate**: Epsilon decay over time (0-1)
- **minEpsilon**: Minimum epsilon floor

### UCB1
- **ucbConfidence**: Confidence bound multiplier (default: 2.0)
- Formula: `avg_reward + sqrt(2 * ln(total_pulls) / arm_pulls)`

### Thompson Sampling
- Uses Beta distribution for Bayesian inference
- Natural balance between exploration and exploitation
- Converges faster than epsilon-greedy

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4136 | Service port |
| REDIS_URL | redis://localhost:6379 | Redis connection URL |
| LOG_LEVEL | info | Logging level |
| RATE_LIMIT | 100 | Requests per minute |
| CACHE_TTL | 86400 | Cache TTL in seconds |
| MAX_REWARDS_PER_ARM | 1000 | Max rewards stored per arm |
| CORS_ORIGIN | localhost:3000,localhost:4000 | Allowed CORS origins |

## Integration with REZ Intelligence

This service integrates with:
- **REZ Event Bus** (4025) - For real-time updates
- **REZ Feature Store** (4127) - For ML features
- **REZ Signal Aggregator** (4121) - For behavioral signals

## Health Checks

```
GET /health  - Overall health status
GET /ready   - Service readiness
```

## License

Proprietary - RABTUL Technologies
