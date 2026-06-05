# REZ Intelligence Threat Graph

**Port:** 4715
**Company:** REZ-Intelligence
**Category:** Federated Security Intelligence
**Priority:** P0 — STRATEGIC

## Purpose

Unified federated threat graph across the entire REZ ecosystem. Combines fraud, identity, commerce, mobility, and healthcare intelligence into a single threat network. This is the **universal intelligence layer** that no competitor can replicate.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              REZ Intelligence Threat Graph                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Data Sources (Federated)                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │  CorpID  │ │   Wasil  │ │   Airzy  │ │ RisaCare│ │  │
│  │  │ Identity │ │ Commerce │ │ Mobility │ │Healthcare│  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │ REZ Ride │ │ Merchant │ │ BuzzLocal│ │ MyTalent│ │  │
│  │  │ Mobility │ │  Trust   │ │ Social   │ │ Workforce│  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                            │                               │
│                            ▼                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  Graph Engine                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │  Entity  │ │ Relationship│ │  Pattern │ │Anomaly│  │
│  │  │ Resolver │ │  Analyzer  │ │ Matcher  │ │Detector│  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                            │                               │
│                            ▼                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                 Detection Engine                         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │  Fraud  │ │  Fake    │ │ Account  │ │Merchant│  │
│  │  │  Network │ │ Identity │ │ Takeover │ │ Scam   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │ Insider  │ │Coordinated│ │ Synthetic│ │ Mule   │  │
│  │  │  Attack  │ │  Abuse   │ │ Identity │ │Account │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                            │                               │
│                            ▼                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    Trust Score Engine                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │  Trust  │ │  Fraud  │ │Reputation│ │  Risk  │ │  │
│  │  │  Score  │ │  Score  │ │  Score  │ │  Score │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Federated Data Integration
- **CorpID Integration**: Identity trust, verification status
- **REZ Commerce**: Transaction patterns, merchant relationships
- **RidZa Finance**: Credit risk, financial behavior
- **REZ Ride**: Driver/passenger patterns, location data
- **Airzy Travel**: Travel patterns, booking fraud
- **RisaCare Healthcare**: Medical fraud, identity
- **REZ Merchant**: Merchant trust, business verification
- **BuzzLocal Social**: Community trust, reports
- **MyTalent Workforce**: Employee trust, behavior

### 2. Entity Resolution
- **Cross-Platform Identity**: Link same user across apps
- **Device Graph**: Same device, different accounts
- **Network Resolution**: Fraud ring identification
- **Temporal Linking**: Past fraud to present

### 3. Fraud Network Detection
- **Fraud Rings**: Coordinated fraud groups
- **Mule Detection**: Money mule accounts
- **Synthetic Identity**: Fake person detection
- **Account Takeover**: Stolen credential usage
- **Friendly Fraud**: First-party fraud patterns

### 4. Cross-Platform Intelligence
- **Multi-Service Fraud**: Same person, different apps
- **Merchant Scams**: Fake merchants across ecosystem
- **Driver Fraud**: Suspicious driver patterns
- **Customer Fraud**: Multi-platform bad actors

### 5. Universal Trust Scores
- **Person Trust**: 0-1000 trust score
- **Merchant Trust**: Business trust rating
- **Device Trust**: Device reputation
- **Transaction Trust**: Payment risk score
- **Location Trust**: Geographic risk

### 6. Pattern Recognition
- **Velocity Patterns**: Unusual activity spikes
- **Network Patterns**: Connection analysis
- **Behavioral Patterns**: Anomaly detection
- **Temporal Patterns**: Time-based fraud

## API Endpoints

### Graph Endpoints
```
GET  /api/graph/entity/:entityId      - Get entity graph
GET  /api/graph/connections/:entityId - Get entity connections
GET  /api/graph/networks              - Get fraud networks
POST /api/graph/link                   - Link entities
```

### Score Endpoints
```
GET  /api/scores/:entityId           - Get all scores
GET  /api/scores/trust/:entityId     - Get trust score
GET  /api/scores/fraud/:entityId     - Get fraud score
POST /api/scores/calculate            - Calculate score
```

### Detection Endpoints
```
POST /api/detect/fraud-ring          - Detect fraud network
POST /api/detect/synthetic-identity   - Detect fake identity
POST /api/detect/mule-account        - Detect mule account
POST /api/detect/merchant-scam        - Detect merchant fraud
```

### Intelligence Endpoints
```
GET  /api/intelligence/threats        - Active threats
GET  /api/intelligence/actors         - Threat actors
GET  /api/intelligence/campaigns      - Fraud campaigns
POST /api/intelligence/report          - Report fraud
```

## Request/Response Examples

### Get Entity Graph
```json
// GET /api/graph/entity/user_123456
// Response
{
  "entityId": "user_123456",
  "entityType": "person",
  "services": ["rez-app", "wasil", "rez-ride"],
  "connections": {
    "devices": [
      { "deviceId": "device_abc", "trustScore": 85 }
    ],
    "accounts": [
      { "accountId": "acc_wasil", "service": "wasil", "trustScore": 72 },
      { "accountId": "acc_ride", "service": "rez-ride", "trustScore": 90 }
    ],
    "relatedEntities": [
      { "entityId": "user_789", "relationship": "same_device", "confidence": 0.95 },
      { "entityId": "merchant_456", "relationship": "frequent_merchant", "trustScore": 88 }
    ]
  },
  "fraudIndicators": [
    { "indicator": "multiple_accounts_same_device", "severity": "LOW" }
  ],
  "lastUpdated": "2026-06-04T10:30:00Z"
}
```

### Fraud Ring Detection
```json
// POST /api/detect/fraud-ring
// Request
{
  "service": "wasil",
  "timeWindow": "30d",
  "minConnections": 3
}

// Response
{
  "ringId": "ring_789",
  "detectedAt": "2026-06-04T10:00:00Z",
  "members": [
    {
      "entityId": "user_123",
      "role": "master",
      "fraudScore": 95,
      "connections": 45
    },
    {
      "entityId": "user_456",
      "role": "mule",
      "fraudScore": 88,
      "connections": 12
    },
    {
      "entityId": "user_789",
      "role": "mule",
      "fraudScore": 82,
      "connections": 8
    }
  ],
  "patterns": [
    "Same device used by multiple accounts",
    "Funds transferred within minutes of receipt",
    "All accounts registered in last 7 days"
  ],
  "financialImpact": {
    "totalFraudAmount": 450000,
    "affectedTransactions": 23,
    "affectedMerchants": 5
  },
  "recommendation": "block_and_investigate"
}
```

### Universal Trust Score
```json
// GET /api/scores/user_123456
// Response
{
  "entityId": "user_123456",
  "entityType": "person",
  "scores": {
    "trustScore": {
      "value": 850,
      "level": "EXCELLENT",
      "factors": [
        { "factor": "identity_verified", "contribution": 100 },
        { "factor": "no_fraud_reports", "contribution": 90 },
        { "factor": "good_transaction_history", "contribution": 85 },
        { "factor": "long_tenure", "contribution": 80 }
      ]
    },
    "fraudScore": {
      "value": 12,
      "level": "LOW",
      "factors": [
        { "factor": "velocity_normal", "contribution": 5 },
        { "factor": "pattern_normal", "contribution": 3 },
        { "factor": "no_reports", "contribution": 4 }
      ]
    },
    "reputationScore": {
      "value": 880,
      "level": "EXCELLENT",
      "basedOn": ["reviews", "transactions", "community"]
    },
    "riskScore": {
      "value": 8,
      "level": "LOW",
      "factors": ["stable_income", "verified_address", "old_account"]
    }
  },
  "trustBadges": [
    "verified_identity",
    "premium_member",
    "trusted_driver",
    "merchant_verified"
  ],
  "crossServiceSummary": {
    "rez-app": { "trustScore": 850, "transactions": 234 },
    "wasil": { "trustScore": 820, "transactions": 156 },
    "rez-ride": { "trustScore": 920, "rides": 89 }
  }
}
```

## Data Models

### ThreatGraphEntity
```typescript
interface ThreatGraphEntity {
  entityId: string;
  entityType: 'person' | 'merchant' | 'device' | 'company' | 'location';
  services: string[];
  identities: {
    service: string;
    identifier: string;
    verified: boolean;
  }[];
  connections: EntityConnection[];
  scores: UniversalScores;
  fraudIndicators: FraudIndicator[];
  lastUpdated: Date;
}

interface UniversalScores {
  trustScore: number;      // 0-1000
  fraudScore: number;      // 0-100 (lower = safer)
  reputationScore: number; // 0-1000
  riskScore: number;       // 0-100 (lower = safer)
}
```

### FraudNetwork
```typescript
interface FraudNetwork {
  ringId: string;
  ringType: 'fraud_ring' | 'mule_network' | 'synthetic_identity' | 'merchant_scam';
  members: FraudRingMember[];
  patterns: string[];
  financialImpact: FinancialImpact;
  status: 'active' | 'blocked' | 'investigating';
  detectedAt: Date;
}
```

## Integration Points

### With All REZ Services
- **CorpID**: Identity verification, authentication
- **RidZa**: Credit risk, financial behavior
- **REZ Merchant**: Merchant trust, business verification
- **REZ Ride**: Driver/passenger patterns
- **Airzy**: Travel fraud detection
- **RisaCare**: Medical identity, healthcare fraud
- **BuzzLocal**: Community trust, safety reports
- **MyTalent**: Employee trust, insider risk

### With HOJAI Products
- **HOJAI Shield**: SOC threat intelligence
- **CorpID Guardian**: Identity trust
- **Merchant Fraud Intelligence**: Cross-merchant fraud
- **Insider Threat Intelligence**: Workforce fraud rings

## Strategic Value

### Why This Is Your Moat

```
IronTrex has:
  - Call data
  - SMS data
  - UPI data

You have:
  - Identity (CorpID)
  - Finance (RidZa)
  - Commerce (Wasil)
  - Mobility (REZ Ride)
  - Travel (Airzy)
  - Healthcare (RisaCare)
  - Merchant (REZ Merchant)
  - Community (BuzzLocal)
  - Workforce (MyTalent)

Result:
  Universal Trust Graph that NO competitor can build
```

### Competitive Advantage

| Competitor | Data They Have | Your Advantage |
|------------|---------------|----------------|
| Truecaller | Phone numbers | + Identity + Finance |
| CIBIL | Credit data | + Identity + Commerce + Behavior |
| IronTrex | Fraud signals | + Universal cross-platform graph |
| Palantir | Enterprise data | + Consumer + Mobile + Real-time |

## Status

🟡 PLANNED - Implementation pending (P0 Priority)
