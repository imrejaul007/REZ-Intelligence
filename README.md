# REZ Intelligence Platform

**AI-powered platform for local commerce with 3 client types, tenant isolation, and 170+ ML services.**

---

## Quick Start

```bash
# Start all services
cd REZ-Intelligence && docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REZ INTELLIGENCE PLATFORM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                 │
│  │   REZ App   │     │  Merchant   │     │  Partner    │                 │
│  │  (Consumer) │     │    App      │     │  Systems    │                 │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                 │
│         │                   │                   │                         │
│         └───────────────────┼───────────────────┘                         │
│                             ▼                                               │
│                   ┌─────────────────┐                                       │
│                   │  REZ API        │  Port 4300                          │
│                   │  Gateway        │  - Rate limiting                     │
│                   │                 │  - Tenant isolation                   │
│                   └────────┬────────┘  - Auth                           │
│                            │                                              │
│         ┌──────────────────┼──────────────────┐                           │
│         ▼                  ▼                  ▼                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                     │
│  │   Intent    │   │ Predictive  │   │    Flow     │                     │
│  │  Predictor  │   │   Engine   │   │   Runtime   │                     │
│  │  Port 4018  │   │  Port 4141 │   │  Port 4200 │                     │
│  └─────────────┘   └─────────────┘   └─────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3 Client Types

| Client Type | API Prefix | Intelligence Level | Data Isolation |
|-------------|------------|-------------------|----------------|
| **REZ_ECOSYSTEM** | `rez_*` | Full | Shared |
| **NON_REZ** | `ext_*` | Isolated | Strict |
| **RABTUL_SAAS** | `saas_*` | Full | White-label |

---

## Services (42 total)

### Gateway Services (Ports 4200-4300)
| Service | Port | Description |
|---------|------|-------------|
| `rez-api-gateway` | 4300 | Unified entry point with tenant isolation |
| `rez-tenant-adapter` | 4210 | Multi-tenant adapter layer |
| `rez-saas-runtime` | 4220 | Onboarding, billing, lifecycle |
| `rez-monitoring` | 4250 | Health check aggregator |

### Memory & Workflow (Ports 4200-4202)
| Service | Port | Description |
|---------|------|-------------|
| `rez-flow-runtime` | 4200 | Workflow execution engine |
| `rez-memory-layer` | 4201 | Customer timeline |
| `rez-whatsapp` | 4202 | WhatsApp integration |

### AI/ML Services (Ports 4018-4141)
| Service | Port | Description |
|---------|------|-------------|
| `rez-intent-predictor` | 4018 | Intent prediction |
| `rez-predictive-engine` | 4141 | Churn, LTV, Revisit |
| `rez-knowledge-graph` | 4060 | Knowledge relationships |
| `rez-care-service` | 4058 | Customer support intelligence |

### Expert Agents (Ports 3003-3010)
| Service | Port | Domain |
|---------|------|--------|
| `rez-travel-expert` | 3003 | Travel |
| `rez-hospitality-expert` | 3004 | Hotels |
| `rez-retail-expert` | 3005 | Retail |
| `rez-health-expert` | 3006 | Health |
| `rez-fitness-expert` | 3007 | Fitness |
| `rez-salon-expert` | 3008 | Salon |
| `rez-culinary-expert` | 3009 | Food |
| `rez-education-expert` | 3010 | Education |

---

## API Reference

### Health Check
```bash
curl http://localhost:4300/health
```

### Predict Intent
```bash
curl -X POST http://localhost:4300/api/intent/predict \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rez_your_tenant_123" \
  -d '{
    "userId": "user_abc123",
    "context": {
      "location": { "lat": 12.9716, "lng": 77.5946 },
      "time": { "hour": 19, "dayOfWeek": "friday" }
    }
  }'
```

### Create Tenant (Admin)
```bash
curl -X POST http://localhost:4210/api/tenants \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-internal-token" \
  -d '{
    "clientType": "REZ_ECOSYSTEM",
    "displayName": "Acme Corp",
    "industry": "retail",
    "email": "admin@acme.com"
  }'
```

---

## SDK Usage

### TypeScript
```typescript
import { REZIntelligenceClient, ClientType } from '@rez/intelligence-sdk';

const client = new REZIntelligenceClient({
  baseUrl: 'http://localhost:4300',
  apiKey: 'rez_your_tenant_123',
});

// Predict intent
const prediction = await client.predictIntent({
  userId: 'user_123',
  context: {
    location: { lat: 12.97, lng: 77.59 },
    time: { hour: 12, dayOfWeek: 'monday' }
  }
});

// Create workflow
const workflow = await client.createWorkflow({
  name: 'Welcome Flow',
  nodes: [...],
  edges: [...]
});
```

### Python
```python
from rez_intelligence import REZIntelligence

client = REZIntelligence(api_key="your-api-key")

# Predict intent
prediction = client.intent.predict(
    user_id="user_123",
    context={"location": {"lat": 12.97, "lng": 77.59}}
)
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [PRODUCT.md](PRODUCT.md) | Product overview & positioning |
| [PRODUCT-FEATURES.md](PRODUCT-FEATURES.md) | Feature deep dive |
| [PRICING.md](PRICING.md) | Pricing & plans |
| [docs/API-REFERENCE.md](docs/API-REFERENCE.md) | Complete API documentation |
| [DOCKER-DEPLOY.md](DOCKER-DEPLOY.md) | Docker deployment guide |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Production launch checklist |
| [MASTER-SERVICE-INDEX.md](MASTER-SERVICE-INDEX.md) | 170+ AI/ML services index |
| [TECHNICAL-ROADMAP.md](TECHNICAL-ROADMAP.md) | Gap analysis & priorities |

---

## Monitoring

**Dashboard:** http://localhost:4250/dashboard

```bash
# Check all services
curl http://localhost:4250/api/health

# Check specific service
curl http://localhost:4250/api/health/rez-api-gateway
```

---

## Environment Variables

```bash
# Core
INTERNAL_SERVICE_TOKEN=your-token
ALLOWED_ORIGINS=http://localhost:3000,https://rez.money

# RABTUL Services
AUTH_SERVICE_URL=http://localhost:4002
PAYMENT_SERVICE_URL=http://localhost:4001
WALLET_SERVICE_URL=http://localhost:4004

# REZ Intelligence (internal)
REZ_MEMORY_URL=http://rez-memory-layer:4201
REZ_FLOW_URL=http://rez-flow-runtime:4200
REZ_INTENT_URL=http://rez-intent-predictor:4018
```

---

## Testing

```bash
# Run integration tests
npm test

# Check service health
curl http://localhost:4250/api/health/summary
```

---

## License

MIT - REZ Engineering
