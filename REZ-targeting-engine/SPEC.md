# REZ Targeting Engine - SPEC.md

**Version:** 1.0.0
**Port:** 3013
**Company:** REZ-Intelligence
**Category:** Ad Targeting

---

## Overview

Production-grade ad and notification targeting engine for ReZ. Provides campaign management, audience segmentation, template management, and delivery optimization.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Targeting Engine (3013)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                            │
│  ├── Campaign Management  → Create/manage ad campaigns                    │
│  ├── Audience Targeting  → Segment-based targeting                       │
│  ├── Template Management → Ad/notification templates                       │
│  └── Delivery Optimization → Timezone/frequency optimization              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/v1/*                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Campaigns

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/campaigns` | GET | List campaigns |
| `/api/v1/campaigns` | POST | Create campaign |
| `/api/v1/campaigns/:id` | GET | Get campaign |
| `/api/v1/campaigns/:id` | PUT | Update campaign |
| `/api/v1/campaigns/:id` | DELETE | Delete campaign |
| `/api/v1/campaigns/:id/start` | POST | Start campaign |
| `/api/v1/campaigns/:id/pause` | POST | Pause campaign |
| `/api/v1/campaigns/:id/stats` | GET | Campaign statistics |

### Templates

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/templates` | GET | List templates |
| `/api/v1/templates` | POST | Create template |
| `/api/v1/templates/:id` | GET | Get template |
| `/api/v1/templates/:id` | PUT | Update template |
| `/api/v1/templates/:id` | DELETE | Delete template |

### Segments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/segments` | GET | List segments |
| `/api/v1/segments` | POST | Create segment |
| `/api/v1/segments/:id` | GET | Get segment |
| `/api/v1/segments/:id` | PUT | Update segment |
| `/api/v1/segments/preview` | POST | Preview segment users |

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/health/ready` | GET | Readiness check |

---

## Data Models

### Campaign

```typescript
interface Campaign {
  campaignId: string;
  name: string;
  type: 'ad' | 'notification' | 'email';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  targeting: {
    segmentIds: string[];
    demographics?: {
      age?: { min: number; max: number };
      gender?: string[];
      location?: string[];
    };
    behavior?: {
      minOrders?: number;
      maxOrders?: number;
      categories?: string[];
    };
  };
  budget: {
    daily?: number;
    total?: number;
    spent: number;
  };
  schedule: {
    startDate: Date;
    endDate?: Date;
    timezones?: string[];
  };
  creative: {
    templateId: string;
    variants?: string[];
  };
  results?: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Segment

```typescript
interface Segment {
  segmentId: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  logic: 'AND' | 'OR';
  estimatedSize: number;
  createdAt: Date;
}

interface SegmentRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
  value: any;
}
```

### Template

```typescript
interface Template {
  templateId: string;
  name: string;
  type: 'ad' | 'notification' | 'email';
  content: {
    title?: string;
    body: string;
    image?: string;
    cta?: string;
    deeplink?: string;
  };
  variables: TemplateVariable[];
  status: 'draft' | 'active' | 'archived';
  createdAt: Date;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date';
  required: boolean;
  defaultValue?: any;
}
```

---

## Targeting Rules

### Available Fields

| Field | Type | Operators |
|-------|------|-----------|
| `user.age` | number | eq, gt, lt, between |
| `user.gender` | string | eq, in |
| `user.location.city` | string | eq, in |
| `user.loyaltyTier` | string | eq, in |
| `user.totalOrders` | number | eq, gt, lt |
| `user.totalSpend` | number | eq, gt, lt |
| `user.lastOrderDate` | date | eq, gt, lt, within |
| `product.category` | string | eq, in |
| `product.price` | number | eq, gt, lt |
| `session.device` | string | eq |

### Example Segment Rules

```json
{
  "name": "High Value Electronics Shoppers",
  "logic": "AND",
  "rules": [
    { "field": "user.totalSpend", "operator": "gt", "value": 10000 },
    { "field": "user.totalOrders", "operator": "gt", "value": 5 },
    { "field": "product.category", "operator": "in", "value": ["electronics", "gadgets"] }
  ]
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.23.1",
  "date-fns": "^2.30.0",
  "zod": "^3.23.8",
  "uuid": "^9.0.1"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3013 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-targeting | MongoDB |
| `CORS_ORIGIN` | * | CORS origins |
| `RATE_LIMIT_WINDOW_MS` | 900000 | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per window |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Creative Engine | Read | Ad templates |
| Signal Aggregator | Read | User segments |
| Notification Service | Trigger | Send notifications |
| Analytics | Write | Track impressions |

---

## Status

- [x] Campaign management
- [x] Audience segmentation
- [x] Template management
- [x] Delivery optimization
- [x] Budget control
- [x] Scheduling
- [ ] Real-time bidding
- [ ] Frequency capping
- [ ] A/B testing integration
