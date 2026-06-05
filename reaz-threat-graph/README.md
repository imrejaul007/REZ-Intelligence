# REZ Intelligence Threat Graph

> **Port:** 4715 | **Company:** REZ-Intelligence | **Category:** Threat Intelligence | **Priority:** P0 - STRATEGIC

## Overview

**This is your strategic moat.** The REZ Threat Graph is a federated intelligence system that combines fraud, identity, commerce, mobility, and healthcare data from across the entire REZ ecosystem. No competitor can replicate this.

## Features

### 🌐 Federated Data Sources

| Source | Data |
|--------|------|
| **CorpID** | Identity verification, trust scores |
| **Wasil** | Transaction patterns, merchant behavior |
| **RidZa** | Credit risk, financial behavior |
| **REZ Ride** | Driver/passenger patterns, location |
| **Airzy** | Travel patterns, booking fraud |
| **RisaCare** | Medical fraud, healthcare identity |
| **REZ Merchant** | Business verification, merchant trust |
| **BuzzLocal** | Community trust, reports |
| **MyTalent** | Employee behavior, workforce |

### 📊 Core Capabilities

| Feature | Description |
|---------|-------------|
| **Entity Resolution** | Link same user across platforms |
| **Fraud Network Detection** | Identify fraud rings, mule accounts |
| **Universal Trust Score** | 0-1000 trust score per entity |
| **Cross-Platform Intelligence** | Multi-service fraud detection |
| **Synthetic Identity Detection** | Fake person identification |
| **Merchant Scam Detection** | Fake merchants across ecosystem |

### 🔍 Detection Types

- **Fraud Rings**: Coordinated fraud groups
- **Mule Detection**: Money mule accounts
- **Synthetic Identity**: Fake person creation
- **Account Takeover**: Stolen credential usage
- **Coordinated Abuse**: Multi-platform bad actors

## Quick Start

```bash
# Install dependencies
cd REZ-Intelligence/reaz-threat-graph
npm install

# Start development
npm run dev

# Build
npm run build
```

## Environment Variables

```bash
PORT=4715
NODE_ENV=production

# Neo4j (for graph storage)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Redis (for caching)
REDIS_URL=redis://localhost:6379
```

## API Reference

### Create Entity
```bash
curl -X POST http://localhost:4715/api/entities \
  -H "Content-Type: application/json" \
  -d '{
    "type": "person",
    "primaryService": "corpid",
    "primaryIdentifier": "+919876543210",
    "identifierType": "phone"
  }'
```

### Get Entity Graph
```bash
curl http://localhost:4715/api/graph/entity/person_abc123?depth=2
```

### Get Trust Scores
```bash
curl http://localhost:4715/api/scores/person_abc123
```

**Response:**
```json
{
  "entityId": "person_abc123",
  "scores": {
    "trustScore": 850,
    "fraudScore": 12,
    "reputationScore": 880,
    "riskScore": 8
  },
  "badges": ["verified_identity", "premium_member"],
  "crossServiceSummary": [
    { "service": "wasil", "trustScore": 820, "transactions": 156 },
    { "service": "rez-ride", "trustScore": 920, "rides": 89 }
  ]
}
```

### Detect Fraud Ring
```bash
curl -X POST http://localhost:4715/api/detect/fraud-ring \
  -H "Content-Type: application/json" \
  -d '{
    "service": "wasil",
    "timeWindow": "30d",
    "minConnections": 3
  }'
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/entities` | Create entity |
| GET | `/api/entities/:entityId` | Get entity |
| GET | `/api/graph/entity/:entityId` | Get entity graph |
| POST | `/api/graph/link` | Link entities |
| GET | `/api/scores/:entityId` | Get all scores |
| POST | `/api/scores/calculate` | Calculate scores |
| POST | `/api/detect/fraud-ring` | Detect fraud network |
| POST | `/api/detect/synthetic-identity` | Detect fake identity |
| POST | `/api/detect/mule-account` | Detect mule account |
| POST | `/api/intelligence/report` | Report fraud |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              REZ Intelligence Threat Graph                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Data Sources (Federated)                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │  CorpID  │ │   Wasil  │ │   RidZa  │ │ RisaCare│ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │ REZ Ride │ │ Merchant │ │ BuzzLocal│ │ MyTalent│ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  └─────────────────────────────────────────────────────┘  │
│                            │                               │
│                            ▼                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  Graph Engine                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │  Entity  │ │Relationship│ │  Pattern │ │Anomaly │  │
│  │  │ Resolver │ │  Analyzer  │ │ Matcher  │ │Detector│  │
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

## Why This Is Your Moat

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

Result: Universal Trust Graph that NO competitor can build
```

## Competitive Advantage

| Competitor | Data They Have | Your Advantage |
|------------|---------------|----------------|
| Truecaller | Phone numbers | + Identity + Finance |
| CIBIL | Credit data | + Identity + Commerce + Behavior |
| IronTrex | Fraud signals | + Universal cross-platform graph |
| Palantir | Enterprise data | + Consumer + Mobile + Real-time |

## Integration Points

### With All REZ Services
- CorpID, RidZa, REZ Merchant, REZ Ride, Airzy, RisaCare, BuzzLocal, MyTalent

### With HOJAI Products
- HOJAI Shield: SOC threat intelligence
- CorpID Guardian: Identity trust
- Merchant Fraud Intelligence: Cross-merchant fraud
- Insider Threat Intelligence: Workforce fraud rings

## Files

```
reaz-threat-graph/
├── README.md
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── server.ts
    ├── types/index.ts
    └── services/
        ├── graphEngine.ts       ← Core graph operations
        └── entityResolver.ts     ← Identity resolution
```

## Related Services

- [AgentShield](../hojai-ai/agent-shield/) - Agent Security
- [CorpID Shield](../REZ-Consumer/corpid-shield-app/) - Consumer Fraud
- [HOJAI Shield](../hojai-ai/hojai-security-cloud/) - SOC Dashboard

---

**Version:** 1.0.0 | **Updated:** June 4, 2026
**Strategic Priority:** P0 - Build first, protect ecosystem
