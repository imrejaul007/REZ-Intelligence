# REZ Priority Engine v3

Intelligent request prioritization and routing engine for the REZ Agent OS platform. The Priority Hierarchy Engine analyzes incoming requests, classifies their intent, and routes them to the appropriate queue with the correct priority tier.

## Features

- **Priority Matrix**: 7-tier priority hierarchy from EMERGENCY (1) to ANALYTICS (7)
- **Intent Classification**: Automatic detection of emergency, payment, fraud, support, sales, loyalty, and analytics intents
- **Rule Engine**: Configurable rules with conditions, operators, and actions
- **Domain Routing**: Specialized routing for Hotel OTA, AdBazaar, Rendez, Rental, and Flight domains
- **SLA Management**: Automatic SLA deadline calculation based on priority tier
- **Redis Caching**: Fast decision caching with configurable TTL
- **Health Checks**: Comprehensive health and readiness endpoints

## Priority Tiers

| Tier | Name | Score Range | Response SLA | Description |
|------|------|-------------|--------------|-------------|
| 1 | EMERGENCY | 95-100 | 30s-60s | Critical incidents requiring immediate intervention |
| 2 | PAYMENT/FRAUD | 80-94 | 60s-5min | Payment issues and fraud detection |
| 3 | SUPPORT | 60-79 | 5min-15min | Customer support requests |
| 4 | DOMAIN EXPERT | 45-59 | 10min-30min | Specialized domain knowledge |
| 5 | SALES | 30-44 | 30min-60min | Sales inquiries and leads |
| 6 | LOYALTY | 15-29 | 1hr-4hr | Loyalty program activities |
| 7 | ANALYTICS | 0-14 | 2hr-8hr | Internal analytics requests |

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 6.0
- Redis >= 6.0

### Installation

```bash
cd REZ-Intelligence/rez-priority-engine
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Running

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## API Endpoints

### Priority Resolution

```bash
# Resolve priority for a request
POST /api/v1/resolve
Content-Type: application/json
X-Internal-Token: your-service-token

{
  "intent": "I need help with my hotel booking cancellation",
  "context": {
    "userId": "user-123",
    "domain": "hotel-ota",
    "customerTier": 5
  }
}
```

### Rules Management

```bash
# Create a new rule
POST /api/v1/rules

# List all rules
GET /api/v1/rules

# Get specific rule
GET /api/v1/rules/:id

# Update rule
PUT /api/v1/rules/:id

# Delete rule
DELETE /api/v1/rules/:id
```

### Decision Tracking

```bash
# Get decision by request ID
GET /api/v1/decision/:requestId

# List decisions
GET /api/v1/decisions?page=1&limit=20

# Get decisions by tier
GET /api/v1/decisions/by-tier/2
```

### Utility Endpoints

```bash
# View priority matrix
GET /api/v1/matrix

# Classify intent without routing
GET /api/v1/classify?intent=your%20request

# Clear caches
POST /api/v1/cache/clear

# Health check
GET /health

# Readiness check
GET /ready
```

## Rule Conditions

Supported operators for rule conditions:

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `field: "status", value: "active"` |
| `neq` | Not equal | `field: "status", value: "deleted"` |
| `gt` | Greater than | `field: "amount", value: 100` |
| `gte` | Greater than or equal | `field: "priority", value: 5` |
| `lt` | Less than | `field: "age", value: 18` |
| `lte` | Less than or equal | `field: "tier", value: 3` |
| `contains` | String contains | `field: "intent", value: "refund"` |
| `startsWith` | String starts with | `field: "email", value: "admin"` |
| `endsWith` | String ends with | `field: "email", value: "@company.com"` |
| `in` | Value in array | `field: "status", value: ["active", "pending"]` |
| `nin` | Value not in array | `field: "role", value: ["banned"]` |
| `regex` | Regex match | `field: "intent", value: "\\b(help|support)\\b"` |

## Rule Actions

Rules can specify the following actions:

- `routeTo`: Target queue or agent pool
- `escalate`: Auto-escalate to supervisor
- `notify`: List of notification channels
- `tags`: Tags for categorization
- `slaMinutes`: Custom SLA deadline in minutes

## Emergency Detection

The engine automatically detects emergency situations:

- Mental health crisis patterns
- Security/fraud indicators
- Medical emergencies
- Safety threats
- Critical infrastructure issues

## Service-to-Service Auth

Internal services authenticate using the `X-Internal-Token` header. Configure service tokens in `INTERNAL_SERVICE_TOKENS_JSON`:

```json
{
  "payment-service": "secret-token-1",
  "wallet-service": "secret-token-2",
  "order-service": "secret-token-3"
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Priority Engine                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Express   │───>│   Router    │───>│   Routes    │  │
│  │   Server    │    │             │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                                               │            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                   Services Layer                     │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │  │
│  │  │   Intent     │ │    Rule      │ │  Priority  │  │  │
│  │  │ Classifier   │ │   Engine     │ │  Resolver  │  │  │
│  │  └──────────────┘ └──────────────┘ └────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                       │                                     │
│  ┌───────────────────┴───────────────────────────────┐   │
│  │                    Rules Layer                      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │   │
│  │  │Emergency│ │ Payment │ │  Domain │ │ Matrix  │ │   │
│  │  │  Rules  │ │  Rules  │ │  Rules  │ │         │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └────────┘ │   │
│  └───────────────────────────────────────────────────┘   │
│                       │                                     │
│  ┌───────────────────┴───────────────────────────────┐   │
│  │                 Data Layer                          │   │
│  │  ┌──────────────┐            ┌──────────────┐    │   │
│  │  │   MongoDB    │            │    Redis      │    │   │
│  │  │ (Persistence) │            │   (Cache)    │    │   │
│  │  └──────────────┘            └──────────────┘    │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `4080` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017/rez-priority-engine` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | `development-secret` |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON map of service tokens | `{}` |
| `LOG_LEVEL` | Logging level | `info` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `CACHE_TTL_SECONDS` | Cache TTL | `300` |

## Testing

```bash
npm test
```

## License

MIT
