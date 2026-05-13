# REZ Confidence Scorer

Confidence Scoring System for REZ Agent OS v3. Calculates agent confidence scores based on intent matching, context relevance, historical accuracy, and load factors.

## Features

- **Multi-factor Scoring**: Combines 4 weighted factors for comprehensive agent evaluation
- **Caching**: Redis-based caching for fast repeated queries
- **History Tracking**: MongoDB-stored scoring history for trend analysis
- **Load Balancing**: Real-time load factor calculation for optimal task routing
- **Agent Management**: Full CRUD operations for agent registration and updates
- **Rate Limiting**: Built-in protection against abuse

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REZ Confidence Scorer                       │
├─────────────────────────────────────────────────────────────────┤
│  Express Server (Port 4081)                                      │
│  ├── /health, /ready                                            │
│  └── /api/v1                                                    │
│      ├── /scoring                                               │
│      │   ├── POST /score           - Calculate score            │
│      │   ├── POST /batch           - Batch score agents         │
│      │   ├── POST /top-agent       - Find best agent            │
│      │   ├── POST /record-outcome  - Record task outcome        │
│      │   ├── GET /history/:id      - Get scoring history        │
│      │   ├── GET /top-agents/:intent - Get top agents          │
│      │   └── GET /average/:id      - Get average score          │
│      └── /agents                                              │
│          ├── POST /                    - Register agent          │
│          ├── GET /                    - List agents             │
│          ├── GET /:id                 - Get agent               │
│          ├── PUT /:id                 - Update agent            │
│          ├── DELETE /:id              - Deactivate agent        │
│          ├── POST /:id/load           - Update load             │
│          ├── GET /:id/performance    - Get performance         │
│          ├── GET /:id/load-factor    - Get load factor         │
│          ├── GET /distribution/load  - Get load distribution    │
│          └── GET /:id/availability   - Check availability      │
├─────────────────────────────────────────────────────────────────┤
│  Services Layer                                                 │
│  ├── ScoringEngine     - Orchestrates scoring calculation       │
│  ├── IntentMatcher     - Matches intent to agent capabilities   │
│  ├── ContextAnalyzer   - Analyzes context relevance             │
│  ├── HistoryTracker   - Tracks historical accuracy              │
│  └── LoadBalancer     - Calculates load factors                │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                     │
│  ├── MongoDB           - Scores, agent metrics, history          │
│  └── Redis             - Caching, rate limiting                │
└─────────────────────────────────────────────────────────────────┘
```

## Confidence Weights

| Factor | Weight | Description |
|--------|--------|-------------|
| Intent Match | 35% | How well agent capabilities match the task intent |
| Context Relevance | 30% | Alignment with domain, urgency, and session context |
| History Accuracy | 25% | Past success rate and performance trends |
| Load Factor | 10% | Current capacity and availability |

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB
- Redis

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# At minimum, set:
# - MONGODB_URI
# - REDIS_URL
# - INTERNAL_SERVICE_TOKENS_JSON

# Build
npm run build

# Start server
npm start
```

### Development

```bash
# Start with hot reload
npm run dev
```

## API Usage

### Calculate Confidence Score

```bash
curl -X POST http://localhost:4081/api/v1/scoring/score \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "agentId": "agent-001",
    "intent": "process_payment",
    "context": {
      "domain": "payment",
      "urgency": "high"
    },
    "taskComplexity": 0.5,
    "requiredCapabilities": ["payment_processing"]
  }'
```

### Response

```json
{
  "success": true,
  "data": {
    "overallScore": 0.82,
    "agentId": "agent-001",
    "intent": "process_payment",
    "components": {
      "intentMatch": {
        "score": 0.85,
        "weight": 0.35,
        "weightedScore": 0.2975,
        "details": { ... }
      },
      "contextRelevance": { ... },
      "historyAccuracy": { ... },
      "loadFactor": { ... }
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "metadata": {
      "processingTimeMs": 45,
      "cacheHit": false,
      "version": "1.0.0"
    }
  },
  "breakdown": {
    "overall": "82.0% confidence - High confidence",
    "components": [ ... ],
    "recommendations": [ ... ]
  }
}
```

### Batch Score Agents

```bash
curl -X POST http://localhost:4081/api/v1/scoring/batch \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "agentIds": ["agent-001", "agent-002", "agent-003"],
    "intent": "process_payment",
    "context": { "domain": "payment" }
  }'
```

### Register an Agent

```bash
curl -X POST http://localhost:4081/api/v1/agents \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "agentId": "agent-001",
    "capabilities": {
      "domains": ["payment", "billing"],
      "maxConcurrentTasks": 10,
      "specializations": ["credit_card", "upi", "netbanking"],
      "supportedLanguages": ["en", "hi"]
    }
  }'
```

### Record Task Outcome

```bash
curl -X POST http://localhost:4081/api/v1/scoring/record-outcome \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{
    "agentId": "agent-001",
    "intent": "process_payment",
    "success": true,
    "confidenceScore": 0.82,
    "responseTimeMs": 150
  }'
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4081 | Server port |
| `MONGODB_URI` | - | MongoDB connection URI (required) |
| `REDIS_URL` | - | Redis connection URL (required) |
| `INTERNAL_SERVICE_TOKENS_JSON` | - | Service auth tokens (required) |
| `WEIGHT_INTENT_MATCH` | 0.35 | Intent match weight |
| `WEIGHT_CONTEXT_RELEVANCE` | 0.30 | Context relevance weight |
| `WEIGHT_HISTORY_ACCURACY` | 0.25 | History accuracy weight |
| `WEIGHT_LOAD_FACTOR` | 0.10 | Load factor weight |
| `CACHE_ENABLED` | true | Enable Redis caching |
| `CACHE_TTL_SECONDS` | 300 | Cache TTL (5 minutes) |

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- scoringEngine.test.ts
```

## Project Structure

```
src/
├── index.ts              # Application entry point
├── config/
│   └── index.ts          # Configuration management
├── models/
│   ├── ConfidenceScore.ts # Score history model
│   └── AgentMetrics.ts    # Agent metrics model
├── services/
│   ├── scoringEngine.ts   # Main scoring orchestrator
│   ├── intentMatcher.ts   # Intent matching logic
│   ├── contextAnalyzer.ts  # Context analysis
│   ├── historyTracker.ts   # Historical tracking
│   └── loadBalancer.ts     # Load factor calculation
├── routes/
│   ├── scoring.routes.ts  # Scoring API routes
│   └── agents.routes.ts   # Agent API routes
├── middleware/
│   ├── auth.ts            # Authentication
│   ├── errorHandler.ts    # Error handling
│   └── requestLogger.ts   # Request logging
├── types/
│   └── index.ts           # TypeScript types
└── utils/
    ├── logger.ts          # Winston logger
    └── redis.ts           # Redis client
```

## Health Checks

```bash
# Health check
curl http://localhost:4081/health

# Readiness check
curl http://localhost:4081/ready
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `INVALID_TOKEN` | 401 | Invalid auth token |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_KEY` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SERVICE_UNAVAILABLE` | 503 | Dependency unavailable |

## License

MIT
