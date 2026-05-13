# REZ Fraud Agent

A specialized fraud detection and security agent for the REZ commerce platform. This service provides real-time risk assessment, pattern detection, blacklist management, and fraud case investigation capabilities.

## Features

- Real-time transaction fraud analysis
- Multi-pattern fraud detection
- Risk scoring and assessment
- Blacklist management (IP, device, account, etc.)
- Velocity attack prevention
- Alert generation and management
- Fraud case tracking and investigation

## Fraud Patterns Detected

| Pattern | Description |
|---------|-------------|
| Card Testing | Multiple small-value transactions to test stolen card details |
| Velocity Attack | Excessive transactions in a short time period |
| Account Takeover | Signs of unauthorized account access |
| Impossible Travel | Transactions from impossible-to-reach locations |
| Billing/Shipping Mismatch | Shipping address differs from billing |
| New Device Anomaly | Transaction from previously unseen device |
| Unusual Amount | Transaction amount significantly differs from normal |
| High-Risk Merchant | Transaction with high-risk merchant or category |
| Multiple Failed Attempts | Several failed payment attempts before success |
| Bot-like Behavior | Automated/scripted activity patterns |
| VPN/Proxy Usage | Connection through VPN or proxy service |
| Geographic Anomaly | Transaction location inconsistent with user history |

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+

### Installation

```bash
cd rez-fraud-agent
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:

```env
PORT=3007
MONGODB_URI=mongodb://localhost:27017/rez_fraud_agent
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKENS_JSON={"service-name":"your-token"}
JWT_SECRET=your-jwt-secret
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Fraud Analysis

```
POST /api/fraud/check
```

Analyze a transaction for fraud indicators.

**Request Body:**
```json
{
  "transactionId": "txn_123",
  "userId": "user_456",
  "accountId": "acc_789",
  "amount": 1500.00,
  "currency": "USD",
  "merchantCategory": "electronics",
  "ipAddress": "192.168.1.1",
  "billingCountry": "US",
  "shippingCountry": "US",
  "deviceFingerprint": "fp_abc123",
  "isNewPaymentMethod": true,
  "isVerified": false
}
```

**Response:**
```json
{
  "decision": "CHALLENGE",
  "riskScore": 65,
  "riskLevel": "ELEVATED",
  "detectedPatterns": [
    {
      "type": "NEW_DEVICE_ANOMALY",
      "name": "New Device Anomaly",
      "score": 25
    }
  ],
  "riskFactors": ["Transaction from new device"],
  "message": "Additional verification required. Risk score: 65.",
  "requiresAction": true,
  "processingTimeMs": 45
}
```

### Decision Types

| Decision | Description |
|----------|-------------|
| `ALLOW` | Transaction approved (risk score < 50) |
| `CHALLENGE` | Additional verification required |
| `REVIEW` | Flagged for human review |
| `DENY` | Transaction blocked (risk score >= 95) |

### Blacklist Management

```
POST /api/fraud/blacklist          # Add to blacklist
GET  /api/fraud/blacklist          # List blacklist entries
GET  /api/fraud/blacklist/check/:type/:value  # Check if blacklisted
DELETE /api/fraud/blacklist/:entryId  # Remove from blacklist
GET  /api/fraud/blacklist/stats    # Get blacklist statistics
```

### Fraud Cases

```
GET    /api/fraud/cases            # List fraud cases
GET    /api/fraud/cases/:caseId    # Get case details
PATCH  /api/fraud/cases/:caseId    # Update case status
POST   /api/fraud/cases/:caseId/actions  # Add action to case
GET    /api/fraud/cases/stats/summary   # Get case statistics
```

### Alerts

```
POST   /api/alerts           # Create alert
POST   /api/alerts/from-case/:caseId  # Create from case
GET    /api/alerts           # List alerts
GET    /api/alerts/:alertId  # Get alert details
DELETE /api/alerts/:alertId  # Cancel alert
GET    /api/alerts/stats     # Get alert statistics
```

### Health Checks

```
GET /health   # Basic health check
GET /ready    # Readiness check (includes DB status)
```

## Authentication

Internal services authenticate using the `X-Internal-Token` header:

```bash
curl -X POST http://localhost:3007/api/fraud/check \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-service-token" \
  -d '{"transactionId": "txn_123", "amount": 100}'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REZ Fraud Agent                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐ │
│  │   Express   │───>│   Routes     │───>│    Services      │ │
│  │   Server    │    │              │    │                  │ │
│  │  (Port 3007)│    │  - fraud     │    │  - FraudDetector │ │
│  └─────────────┘    │  - alert     │    │  - RiskScorer    │ │
│                     └──────────────┘    │  - PatternMatcher │ │
│                                        │  - VelocityCheck  │ │
│                                        │  - BlacklistService│
│                                        └──────────────────┘ │
│                                                │            │
│                     ┌──────────────────────────┼───────────┐ │
│                     │                          ▼           │ │
│                     │   ┌─────────────────────────────────┐ │ │
│                     │   │           Models               │ │ │
│                     │   │  - FraudCase                   │ │ │
│                     │   │  - RiskProfile                  │ │ │
│                     │   │  - BlacklistEntry              │ │ │
│                     │   └─────────────────────────────────┘ │ │
│                     │                                      │ │
│                     │   ┌─────────────────────────────────┐ │ │
│                     │   │         Data Stores            │ │ │
│                     │   │  ┌──────────┐  ┌───────────┐   │ │ │
│                     │   │  │ MongoDB  │  │   Redis   │   │ │ │
│                     │   │  └──────────┘  └───────────┘   │ │ │
│                     │   └─────────────────────────────────┘ │ │
│                     └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Risk Score Calculation

The risk score is calculated using weighted components:

| Component | Weight | Description |
|-----------|--------|-------------|
| Pattern Score | 35% | Matched fraud patterns |
| Velocity Score | 25% | Transaction velocity violations |
| Behavioral Score | 15% | Session/behavioral anomalies |
| Historical Score | 15% | User history factors |
| Contextual Score | 10% | Transaction context factors |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/fraud/check` | 100/minute |
| `/api/fraud/blacklist` | 50/minute |
| `/api/alerts` | 100/minute |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3007 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/rez_fraud_agent |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `INTERNAL_SERVICE_TOKENS_JSON` | Service authentication tokens | {} |
| `JWT_SECRET` | JWT signing secret | - |
| `LOG_LEVEL` | Logging level | info |
| `LOG_FORMAT` | Log format (json/simple) | simple |
| `ALERT_WEBHOOK_URL` | Webhook URL for alerts | - |
| `ALERT_SLACK_WEBHOOK` | Slack webhook for alerts | - |

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/fraudDetector.test.ts
```

## Monitoring

The service logs:
- All fraud decisions with risk scores
- Blacklist matches and additions
- Case status changes
- Security events
- Performance metrics

Logs are written to:
- `logs/error.log` (errors only, production)
- `logs/combined.log` (all logs, production)
- `logs/audit.log` (audit trail)
- `logs/security.log` (security events)

## License

MIT
