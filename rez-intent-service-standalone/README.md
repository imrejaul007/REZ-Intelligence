# rez-intent-service

Unified Intelligence Platform - Signal → Intent → Decision → Action → Feedback

## Features

### Signal Capture (8 Event Types)
- search, view, wishlist, cart_add, hold, checkout_start, fulfilled, abandoned

### 8 AI Agents
- Demand Signal Agent (5 min)
- Scarcity Agent (1 min)
- Personalization Agent (1 min)
- Attribution Agent (1 min)
- Adaptive Scoring Agent (1 hour)
- Feedback Loop Agent (1 hour)
- Network Effect Agent (24 hours)
- Revenue Attribution Agent (15 min)

### ML Models
- Sigmoid probability scoring
- Vector similarity
- Collaborative filtering
- Brier score optimization

## API Endpoints

### Signals
- POST /api/signals/capture - Capture intent signal
- GET /api/signals/active/:userId - Get active intents
- GET /api/signals/similar/:userId - Find similar intents

### Dormant
- POST /api/dormant/mark/:intentId - Mark dormant
- GET /api/dormant/score/:intentId - Calculate revival score
- POST /api/dormant/trigger/:intentId - Trigger revival

### Profiles
- GET /api/profiles/:userId - Get profile
- GET /api/profiles/:userId/scores - Calculate scores
- GET /api/profiles/:userId/recommendations - Get recommendations

### Agents
- GET /api/agents/status - Agent status
- POST /api/agents/run/:agent - Run agent manually
- POST /api/agents/stop - Stop all agents

## Run

```bash
npm install
npm run dev
```

## Environment

```env
PORT=4009
MONGODB_URI=mongodb://localhost:27017/intent-service
REDIS_URL=redis://localhost:6379
```
