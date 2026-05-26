# REZ Intelligence Docker Deployment

Complete local development environment for REZ Intelligence AI services.

## Quick Start

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

## Services (41 total)

### Infrastructure
| Service | Port | Description |
|---------|------|-------------|
| mongodb | 27017 | MongoDB 7 |
| redis | 6379 | Redis 7 |

### Core Platform
| Service | Port | Description |
|---------|------|-------------|
| rez-agent-registry | 4011 | Agent heartbeat & health tracking |
| rez-orchestrator-v2 | 4015 | Workflow orchestration |
| rez-whatsapp-orchestrator-bridge | 4010 | WhatsApp integration |

### REZ Intelligence Gateway (NEW)
| Service | Port | Description |
|---------|------|-------------|
| **rez-api-gateway** | **4300** | **Unified API entry with tenant isolation** |
| **rez-tenant-adapter** | **4210** | **Multi-tenant adapter (3 client types)** |

### Memory & Workflow
| Service | Port | Description |
|---------|------|-------------|
| **rez-whatsapp** | **4202** | Unified WhatsApp layer |
| **rez-memory-layer** | **4201** | Customer timeline |
| **rez-flow-runtime** | **4200** | Workflow execution engine |
| rez-memory-engine | 4051 | Memory engine |

### AI/ML Services
| Service | Port | Description |
|---------|------|-------------|
| **rez-intent-predictor** | **4018** | Intent prediction |
| **rez-predictive-engine** | **4141** | Churn, LTV, Revisit |
| **rez-care-service** | **4058** | Customer support intelligence |
| **rez-knowledge-graph-service** | **4060** | Knowledge graph |
| rez-identity-graph | 4050 | Identity resolution |
| rez-ai-router | 4052 | AI model routing |

### Wedge Services
| Service | Port | Description |
|---------|------|-------------|
| rez-reorder-engine | 4040 | Reorder predictions |
| rez-taste-profile | 4041 | Taste profiling |
| rez-demand-forecast | 4042 | Demand forecasting |
| rez-price-predictor | 4043 | Price optimization |

### Expert Agents
| Service | Port | Domain |
|---------|------|--------|
| rez-travel-expert | 3003 | Travel |
| rez-hospitality-expert | 3004 | Hotels |
| rez-retail-expert | 3005 | Retail |
| rez-health-expert | 3006 | Health |
| rez-fitness-expert | 3007 | Fitness |
| rez-salon-expert | 3008 | Salon |
| rez-culinary-expert | 3009 | Food |
| rez-education-expert | 3010 | Education |

### Channel Orchestration
| Service | Port | Description |
|---------|------|-------------|
| rez-channel-orchestrator | 4070 | Multi-channel routing |
| rez-sms-bridge | 4085 | SMS integration |
| rez-email-bridge | 4086 | Email integration |
| rez-rcs-bridge | 4087 | RCS integration |
| rez-web-widget | 4088 | Web chat |
| rez-app-bridge | 4089 | Mobile app push |

### Ecosystem Services
| Service | Port | Description |
|---------|------|-------------|
| rez-payments-brain | 4070 | Payment intelligence |
| rez-inventory-sync | 4071 | Inventory sync |
| rez-creator-network | 4072 | Creator management |
| rez-merchant-os | 4073 | Merchant operations |
| rez-merchant-brain | 4061 | Merchant AI |

## 3 Client Types

The REZ Intelligence platform supports 3 client types with strict data isolation:

### 1. REZ_ECOSYSTEM (rez_*)
- Full intelligence sharing
- Access to all REZ AI capabilities
- Shared user graph
- Example API key: `rez_acme_corp_123`

### 2. NON_REZ (ext_*)
- Strict tenant isolation
- Isolated knowledge base
- No cross-tenant data access
- Example API key: `ext_partner_456`

### 3. RABTUL_SAAS (saas_*)
- Plugin-based architecture
- White-label ready
- Subscription billing
- Example API key: `saas_reseller_789`

## Health Checks

All services expose `/health` endpoints:

```bash
# Check all services
curl http://localhost:4300/health

# Check specific service
curl http://localhost:4200/health
curl http://localhost:4210/health
```

## Environment Variables

Create a `.env` file or use the provided `.env.example`:

```bash
cp .env.example .env
# Edit .env with your values
```

Key variables:
- `INTERNAL_SERVICE_TOKEN` - Service-to-service authentication
- `ALLOWED_ORIGINS` - CORS origins
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string

## Scaling

```bash
# Scale a specific service
docker compose up -d --scale rez-flow-runtime=3

# View resource usage
docker stats
```

## Troubleshooting

```bash
# View logs for specific service
docker compose logs -f rez-api-gateway

# Restart a service
docker compose restart rez-tenant-adapter

# Rebuild a service
docker compose up -d --build rez-care-service

# Check service health
docker compose ps
```

## Port Reference

| Range | Purpose |
|-------|---------|
| 3000-3010 | Expert Agents |
| 4000-4100 | RABTUL Core Platform |
| 4010-4020 | Orchestration |
| 4040-4089 | Wedge & Channels |
| 4120-4145 | Intelligence Services |
| 4200-4210 | NEW: Gateway Services |
| 4300 | API Gateway Public |
