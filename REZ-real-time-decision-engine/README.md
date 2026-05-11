# REZ Real-Time Decision Engine

The brainstem of the REZ platform - handles all real-time decisions with sub-100ms latency.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REZ Real-Time Decision Engine                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────────────────────────────┐    │
│  │   Request   │───▶│         Decision Router               │    │
│  │   Ingress   │    │  (Central coordinator, sub-100ms)     │    │
│  └─────────────┘    └──────────────┬────────────────────────┘    │
│                                    │                             │
│         ┌──────────────────────────┼────────────────────────┐   │
│         │                          │                        │   │
│         ▼                          ▼                        ▼   │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐│
│  │   Offer     │         │   Fraud     │         │Recommendation││
│  │ Eligibility │         │   Block     │         │   Router    ││
│  └─────────────┘         └─────────────┘         └─────────────┘│
│                                                              │   │
│         ┌──────────────────────────┬────────────────────────┘   │
│         │                          │                             │
│         ▼                          ▼                             │
│  ┌─────────────┐         ┌─────────────┐                         │
│  │   Loyalty   │         │Personaliz- │                         │
│  │   Triggers  │         │   ation    │                         │
│  └─────────────┘         └─────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### 1. Decision Router (`src/decision/decision-router.ts`)
Central coordinator that routes all decisions to the appropriate handler:
- Offer decisions
- Fraud decisions
- Recommendation decisions
- Loyalty decisions
- Personalization decisions

**Features:**
- Request type routing
- Timeout handling (100ms default)
- Custom handler registration
- Batch decision support
- Structured logging with request IDs

### 2. Offer Eligibility (`src/offers/eligibility.ts`)
Determines user eligibility for offers:
- Tier-based eligibility
- Account age requirements
- KYC verification levels
- Exclusion flag handling
- Dynamic offer modifiers
- Alternative offer suggestions

**Scoring Factors:**
- User tier (bronze/silver/gold/platinum)
- Account age
- Verification status
- Engagement recency
- Payment method

### 3. Real-Time Fraud Block (`src/fraud/real-time-block.ts`)
Machine learning-powered fraud detection:
- Velocity checks
- Amount anomaly detection
- Device fingerprinting
- Location analysis
- Proxy/VPN/TOR detection
- Behavioral analysis
- Chargeback history

**Risk Levels:**
- `low`: Normal processing
- `medium`: Challenge required
- `high`: Block transaction
- `critical`: Immediate block + investigation

### 4. Recommendation Routing (`src/recommend/routing.ts`)
Multi-strategy recommendation engine:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `personalized` | User-specific recommendations | Homepage |
| `trending` | Currently popular items | Discovery |
| `similar` | Similar to viewed items | Product pages |
| `frequently_bought_together` | Bundle suggestions | Cart |
| `new_arrivals` | Recently added items | Category pages |
| `cross_sell` | Complementary products | Checkout |
| `upsell` | Premium alternatives | Product pages |
| `contextual` | Time/location-based | Dynamic |

### 5. Loyalty Triggers (`src/loyalty/triggers.ts`)
Automated loyalty program management:
- Points calculation with tier multipliers
- Tier progression tracking
- Cooldown management
- Milestone celebrations
- Dormancy re-engagement
- Birthday/anniversary bonuses

**Trigger Types:**
- Purchase events
- Referral completions
- Review submissions
- Social shares
- Engagement milestones
- Dormancy recovery

### 6. Real-Time Personalization (`src/personalization/realtime.ts`)
Dynamic content personalization:
- Time-based content
- Device-optimized layouts
- Weather-based recommendations
- Location-specific content
- Tier-based experiences
- Behavioral targeting

## API Endpoints

### Core Decision Endpoint
```bash
POST /api/v1/decide
Content-Type: application/json

{
  "userId": "user_123",
  "requestType": "offer|fraud|recommendation|loyalty|personalization",
  "context": { ... }
}
```

### Offer Eligibility
```bash
POST /api/v1/offers/eligibility
Content-Type: application/json

{
  "userId": "user_123",
  "offerId": "offer_456",
  "context": {
    "amount": 99.99,
    "paymentMethod": "credit_card"
  }
}
```

### Fraud Check
```bash
POST /api/v1/fraud/check
Content-Type: application/json

{
  "userId": "user_123",
  "transactionId": "txn_789",
  "amount": 150.00,
  "context": "purchase"
}
```

### Recommendations
```bash
POST /api/v1/recommend
Content-Type: application/json

{
  "userId": "user_123",
  "sessionId": "sess_abc",
  "context": {
    "currentPage": "home",
    "deviceType": "mobile"
  },
  "strategy": "personalized",
  "limit": 10
}
```

### Loyalty Trigger
```bash
POST /api/v1/loyalty/trigger
Content-Type: application/json

{
  "userId": "user_123",
  "triggerType": "purchase",
  "context": {
    "transactionId": "txn_789",
    "amount": 99.99
  },
  "currentTier": "gold",
  "currentPoints": 15000
}
```

### Personalization
```bash
POST /api/v1/personalize
Content-Type: application/json

{
  "userId": "user_123",
  "sessionId": "sess_abc",
  "contentType": "hero_banner",
  "context": {
    "deviceType": "mobile",
    "timeOfDay": "evening",
    "location": { "country": "US", "city": "New York" }
  }
}
```

### Batch Decisions
```bash
POST /api/v1/decide/batch
Content-Type: application/json

{
  "decisions": [
    { "userId": "user_1", "requestType": "offer", ... },
    { "userId": "user_2", "requestType": "fraud", ... }
  ]
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `LOG_LEVEL` | Logging level | info |
| `ALLOWED_ORIGINS` | CORS origins | * |
| `REDIS_URL` | Redis connection | - |
| `ML_MODEL_SERVICE_URL` | ML service endpoint | - |

## Performance

- **Target Latency**: <100ms p99
- **Throughput**: 10,000 requests/second
- **Availability**: 99.9%

## Deployment

### Render.com
```bash
# Apply blueprint
render-blueprints apply render.yaml

# Or deploy manually
npm install
npm run build
npm start
```

### Local Development
```bash
# Install dependencies
npm install

# Start with hot reload
npm run dev

# Run tests
npm test
```

## Health Checks

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (verifies dependencies)

## License

Internal - REZ Platform
