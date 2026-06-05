# REZ Agent OS - API Documentation

## Overview

The REZ API Gateway provides a unified entry point for all REZ services with built-in authentication, rate limiting, and service discovery.

**Base URL**: `https://api.rez.io`

## Authentication

### JWT Token

```bash
curl -H "Authorization: Bearer <your-jwt-token>" https://api.rez.io/health
```

### API Key

```bash
curl -H "X-API-Key: <your-api-key>" https://api.rez.io/health
```

## Rate Limiting

| Plan | Requests/Minute | Burst |
|------|-----------------|-------|
| Free | 60 | 10 |
| Pro | 1,000 | 100 |
| Enterprise | 10,000 | 1,000 |

## Endpoints

### Health & Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health status |
| GET | `/metrics` | Prometheus metrics |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id` | Get agent by ID |
| POST | `/api/agents` | Register new agent |
| PUT | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |

#### List Agents

```bash
curl -X GET "https://api.rez.io/api/agents?skip=0&limit=20" \
  -H "X-API-Key: your-api-key"
```

**Response:**
```json
{
  "agents": [
    {
      "id": "fraud-agent",
      "name": "Fraud Detection Agent",
      "type": "fraud",
      "status": "active",
      "capabilities": ["detection", "analysis", "reporting"]
    }
  ],
  "total": 17,
  "skip": 0,
  "limit": 20
}
```

#### Register Agent

```bash
curl -X POST "https://api.rez.io/api/agents" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "sales-bot",
    "type": "sales",
    "capabilities": ["lead_scoring", "product_recommendation"]
  }'
```

### AutoML

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automl/models` | List models |
| GET | `/api/automl/models/:id` | Get model |
| POST | `/api/automl/train` | Train model |
| POST | `/api/automl/predict/:id` | Make prediction |
| DELETE | `/api/automl/models/:id` | Delete model |

#### Train Model

```bash
curl -X POST "https://api.rez.io/api/automl/train" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "fraud-detector-v1",
    "task_type": "classification",
    "training_data": {
      "features": [
        {"amount": 100, "frequency": 5},
        {"amount": 5000, "frequency": 1}
      ],
      "target": [0, 1]
    },
    "features": ["amount", "frequency"],
    "target": "is_fraud"
  }'
```

**Response:**
```json
{
  "id": "model-123",
  "name": "fraud-detector-v1",
  "status": "completed",
  "metrics": {
    "accuracy": 0.95,
    "f1_score": 0.93
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Invoice

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoice/create` | Create invoice |
| GET | `/api/invoice/:id` | Get invoice |
| GET | `/api/invoice/list` | List invoices |
| POST | `/api/invoice/validate/:id` | Validate invoice |

#### Create Invoice

```bash
curl -X POST "https://api.rez.io/api/invoice/create" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "client_name": "Acme Corp",
    "client_email": "billing@acme.com",
    "line_items": [
      {
        "description": "Web Development",
        "quantity": 40,
        "unit_price": 150,
        "total": 6000
      }
    ],
    "tax_rate": 0.1,
    "due_date": "2024-12-31"
  }'
```

### Contracts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contracts/generate` | Generate contract |
| GET | `/api/contracts/:id` | Get contract |
| POST | `/api/contracts/analyze/:id` | Analyze contract |

#### Generate Contract

```bash
curl -X POST "https://api.rez.io/api/contracts/generate" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "contract_type": "nda",
    "title": "Mutual Non-Disclosure Agreement",
    "parties": ["Acme Corp", "Partner Inc"],
    "terms": {
      "duration": "2 years",
      "jurisdiction": "Delaware"
    }
  }'
```

### Legal

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/legal/research` | Legal research |
| POST | `/api/legal/analyze` | Analyze document |
| POST | `/api/legal/compliance` | Compliance check |

### Digital Twin

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/twin/create` | Create twin |
| GET | `/api/twin/:id` | Get twin |
| POST | `/api/twin/:id/state` | Update state |
| GET | `/api/twin/:id/state` | Get state |
| POST | `/api/twin/:id/sync` | Sync twin |

#### Create Digital Twin

```bash
curl -X POST "https://api.rez.io/api/twin/create" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "Factory-001",
    "entity_type": "factory",
    "initial_state": {
      "temperature": 72.5,
      "pressure": 14.7,
      "output_rate": 1000
    }
  }'
```

### Ranking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ranking/score` | Score entities |
| POST | `/api/ranking/top-k` | Get top K entities |

#### Score Entities

```bash
curl -X POST "https://api.rez.io/api/ranking/score" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "entities": [
      {"id": "prod-1", "sales": 1000, "rating": 4.5},
      {"id": "prod-2", "sales": 5000, "rating": 4.0}
    ],
    "ranking_config": {
      "algorithm": "weighted",
      "weights": {"sales": 0.5, "rating": 0.5}
    }
  }'
```

### GraphQL

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/graphql` | Execute GraphQL query |

#### GraphQL Query

```bash
curl -X POST "https://api.rez.io/graphql" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "query { agents(skip: 0, limit: 10) { id name type } }"
  }'
```

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request |
| 401 | `UNAUTHORIZED` | Authentication failed |
| 404 | `NOT_FOUND` | Resource not found |
| 422 | `UNPROCESSABLE` | Validation failed |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error |

**Error Format:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Agent not found",
    "details": {}
  }
}
```

## SDK Examples

### TypeScript

```typescript
import { REZClient } from '@rez/sdk';

const client = new REZClient({
  baseUrl: 'https://api.rez.io',
  apiKey: 'your-api-key'
});

const agents = await client.agents.list();
console.log(agents);
```

### Python

```python
from rez_sdk import REZClient

async def main():
    async with REZClient(base_url="https://api.rez.io", api_key="your-key") as client:
        agents = await client.agents.list_agents()
        print(f"Found {agents.total} agents")

asyncio.run(main())
```

### Go

```go
package main

import (
    "github.com/rez-io/rez-go"
)

func main() {
    client := rez.NewClient("https://api.rez.io", "your-api-key")
    
    agents, err := client.Agents.List()
    if err != nil {
        panic(err)
    }
    fmt.Printf("Found %d agents\n", agents.Total)
}
```

## Webhooks

Configure webhooks to receive real-time notifications:

```bash
curl -X POST "https://api.rez.io/api/webhooks" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["agent.created", "invoice.paid"],
    "secret": "your-webhook-secret"
  }'
```

## Pagination

All list endpoints support pagination:

```
GET /api/agents?skip=0&limit=20
GET /api/agents?skip=20&limit=20
GET /api/agents?skip=40&limit=20
```

**Response includes:**
- `total` - Total count
- `skip` - Current offset
- `limit` - Page size

## Filtering

Some endpoints support filtering:

```bash
# Filter by agent type
GET /api/agents?type=fraud

# Filter by status
GET /api/invoice/list?status=paid
```

## Versioning

API versioning via URL path:

- Current: `/api/v1/agents`
- Deprecated: `/api/v0/agents`

## SDK Documentation

- [TypeScript SDK](../rez-sdk/README.md)
- [Python SDK](../rez-python-sdk/README.md)
- [Go SDK](../rez-go-sdk/README.md)

## Support

- Documentation: https://docs.rez.io
- API Status: https://status.rez.io
- Support: support@rez.io