# REZ Orchestrator v2

The main coordinator for all agents in the REZ Intelligence platform. Orchestrates routing, collaboration, and response generation across multiple AI agents.

## Features

- **Agent Health Monitoring** - Continuous health checks with automatic failover
- **Seamless Agent Switching** - Transparent fallback without user indication
- **Multi-Agent Collaboration** - Supports sequential, parallel, and hierarchical collaboration strategies
- **Fallback Routing** - Automatic fallback to secondary agents on failure
- **Response Time Tracking** - Real-time performance metrics and alerting
- **Human Escalation** - Automatic escalation to human agents when needed
- **Rate Limiting** - Sliding window rate limiting per service/IP
- **Authentication** - Internal service token authentication

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     REZ Orchestrator v2                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │   Express   │  │   Routes    │  │    Middleware   │    │
│  │   Server    │──│  /message   │──│  Auth/RateLimit │    │
│  │             │  │  /routing   │  │                 │    │
│  │             │  │  /collab    │  │                 │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
│         │                 │                    │             │
│  ┌──────┴─────────────────┴──────────────────┴──────┐    │
│  │                   Services Layer                    │    │
│  ├────────────┬────────────┬────────────┬────────────┤    │
│  │  Message   │   Expert   │   Agent    │Collab      │    │
│  │  Processor │   Selector │   Switcher │ Manager    │    │
│  └────────────┴────────────┴────────────┴────────────┘    │
│         │                 │                    │             │
│  ┌──────┴─────────────────┴──────────────────┴──────┐    │
│  │              Agent Registry (Redis)                │    │
│  └───────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │   Redis     │  │  Escalation │  │  Response       │    │
│  │   Cache     │  │   Service   │  │  Generator      │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌─────────┐         ┌──────────┐         ┌─────────┐
   │ Agent 1 │         │ Agent 2  │         │ Agent N │
   │(NLP/Chat)│         │(Code Gen)│         │(Special)│
   └─────────┘         └──────────┘         └─────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Redis >= 6.0

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Build
npm run build

# Start
npm start
```

### Development

```bash
# Start with hot reload
npm run dev
```

## API Endpoints

### Message Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/message/process` | Process a single orchestration request |
| POST | `/api/v2/message/process/stream` | Process with streaming response |
| POST | `/api/v2/message/batch` | Process multiple requests in batch |

### Agent Routing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/routing/agents` | List all registered agents |
| GET | `/api/v2/routing/agents/:id` | Get agent details |
| POST | `/api/v2/routing/agents` | Register a new agent |
| DELETE | `/api/v2/routing/agents/:id` | Unregister an agent |
| POST | `/api/v2/routing/agents/:id/status` | Update agent status |
| GET | `/api/v2/routing/recommend` | Get agent recommendation |
| GET | `/api/v2/routing/metrics` | Get routing metrics |

### Collaboration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/collaboration/create` | Create collaboration session |
| POST | `/api/v2/collaboration/process` | Execute collaboration |
| GET | `/api/v2/collaboration/:id` | Get collaboration status |
| POST | `/api/v2/collaboration/:id/cancel` | Cancel collaboration |
| GET | `/api/v2/collaboration/strategies` | List collaboration strategies |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |

## Configuration

Configuration is managed via environment variables. See `.env.example` for all available options.

### Key Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4006` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `AGENT_HEALTH_CHECK_INTERVAL_MS` | Health check interval | `30000` |
| `AGENT_MAX_RESPONSE_TIME_MS` | Max agent response time | `30000` |
| `COLLABORATION_MAX_AGENTS` | Max agents in collaboration | `5` |
| `COLLABORATION_TIMEOUT_MS` | Collaboration timeout | `60000` |
| `ESCALATION_ENABLED` | Enable human escalation | `true` |
| `RESPONSE_TIME_THRESHOLD_MS` | Response time warning threshold | `5000` |

## Request Example

```bash
curl -X POST http://localhost:4006/api/v2/message/process \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev-token-orchestrator" \
  -d '{
    "message": "Write a function to calculate fibonacci numbers",
    "routingHints": {
      "preferredAgents": ["code-gen-agent"],
      "requiredCapabilities": ["code_generation"]
    },
    "context": {
      "userId": "user123",
      "sessionId": "session456"
    }
  }'
```

## Response Example

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "primaryResponse": {
    "content": "function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}",
    "format": "text"
  },
  "attribution": [
    {
      "agentId": "agent-123",
      "agentName": "Code Generator",
      "capabilities": ["code_generation", "natural_language"],
      "confidence": 1.0,
      "processingTimeMs": 245
    }
  ],
  "collaboration": {
    "agentsInvolved": 1,
    "strategy": "single"
  },
  "timing": {
    "totalProcessingTimeMs": 312,
    "agentSelectionTimeMs": 15,
    "responseGenerationTimeMs": 52
  }
}
```

## Collaboration Strategies

### Sequential
Agents work one after another, passing results to the next agent. Best for complex multi-step tasks with dependencies.

### Parallel
Multiple agents work simultaneously on independent subtasks. Best for speed-critical applications with independent work.

### Hierarchical
A coordinator agent orchestrates specialist agents and synthesizes results. Best for complex coordination requiring expert-level analysis.

## Error Handling

The orchestrator implements automatic retry with fallback:

1. **Primary Agent Fails** - Automatically routes to fallback agent
2. **Fallback Fails** - Retries up to `maxRetries` times
3. **All Retries Fail** - Escalates to human agent (if enabled)

## Monitoring

### Health Checks
- `/health` - Returns service health and dependency status
- `/ready` - Returns readiness for load balancers

### Metrics
- Agent success rates
- Response time distributions
- Collaboration success rates
- Escalation counts

## Security

- All API endpoints require `X-Internal-Token` header
- Rate limiting prevents abuse
- Input validation with Zod schemas
- Helmet security headers

## License

Proprietary - REZ Commerce Platform
