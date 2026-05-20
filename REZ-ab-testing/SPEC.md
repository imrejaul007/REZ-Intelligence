# REZ A/B Testing - SPEC.md

**Version:** 1.0.0
**Port:** 4130
**Company:** REZ-Intelligence
**Category:** Experimentation

---

## Overview

A/B testing platform for REZ ecosystem. Provides experiment management, variant assignment, conversion tracking, and statistical analysis with automatic significance detection.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ A/B Testing (4130)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                            │
│  ├── Experiment Management → Create/manage experiments                   │
│  ├── Variant Assignment    → Consistent user bucketing                  │
│  ├── Conversion Tracking   → Event-based conversion tracking             │
│  └── Statistical Analysis  → Uplift, p-value, confidence               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/experiments, /api/assignments, /api/conversions             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Experiment States

| Status | Description |
|--------|-------------|
| `draft` | Created but not started |
| `running` | Actively assigning variants |
| `paused` | Temporarily stopped |
| `completed` | Reached end date or sample size |
| `archived` | Archived for reference |

---

## API Endpoints

### Experiments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/experiments` | POST | Create experiment |
| `/api/experiments` | GET | List experiments |
| `/api/experiments/:id` | GET | Get experiment |
| `/api/experiments/:id` | PUT | Update experiment |
| `/api/experiments/:id/start` | POST | Start experiment |
| `/api/experiments/:id/pause` | POST | Pause experiment |
| `/api/experiments/:id/resume` | POST | Resume experiment |
| `/api/experiments/:id/complete` | POST | Complete experiment |

### Assignments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/assignments` | POST | Get variant assignment |
| `/api/assignments/:id` | GET | Get assignment details |
| `/api/assignments/batch` | POST | Batch get assignments |

### Conversions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversions` | POST | Record conversion |
| `/api/conversions/batch` | POST | Batch record conversions |

### Results

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/experiments/:id/results` | GET | Get experiment results |

---

## Data Models

### Experiment

```typescript
interface Experiment {
  experimentId: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  hypothesis: string;

  variants: Variant[];
  target: {
    metric: string;
    goal?: string;
    minimumDetectableEffect?: number;
  };
  audience: {
    userSegments: string[];
    apps: string[];
    percentage: number;  // 0-100
  };

  stats: {
    startDate?: Date;
    endDate?: Date;
    sampleSize?: number;
    confidence: number;  // 0-1
  };

  results?: ExperimentResults;

  createdAt: Date;
  updatedAt: Date;
}

interface Variant {
  variantId: string;
  name: string;
  weight: number;  // 0-100
  config: Record<string, any>;
}

interface ExperimentResults {
  control: {
    conversions: number;
    users: number;
    rate: number;
  };
  variants: VariantResult[];
}

interface VariantResult {
  variantId: string;
  conversions: number;
  users: number;
  rate: number;
  uplift: number;  // % change vs control
  pValue: number;
  significant: boolean;
}
```

### Assignment

```typescript
interface Assignment {
  assignmentId: string;
  experimentId: string;
  userId: string;
  variantId: string;
  assignedAt: Date;
  converted: boolean;
  convertedAt?: Date;
  metadata?: Record<string, any>;
}
```

---

## Example Usage

### Create Experiment

**Request:**
```json
{
  "name": "Checkout Button Color Test",
  "description": "Testing green vs blue checkout button",
  "hypothesis": "Green buttons increase conversions by 5%",
  "variants": [
    { "variantId": "control", "name": "Blue Button", "weight": 50 },
    { "variantId": "treatment", "name": "Green Button", "weight": 50 }
  ],
  "target": {
    "metric": "checkout_completed",
    "minimumDetectableEffect": 0.05
  },
  "audience": {
    "userSegments": ["all"],
    "apps": ["rez-app"],
    "percentage": 100
  },
  "stats": {
    "confidence": 0.95,
    "sampleSize": 10000
  }
}
```

**Response:**
```json
{
  "success": true,
  "experimentId": "exp_abc123",
  "experiment": {
    "experimentId": "exp_abc123",
    "name": "Checkout Button Color Test",
    "status": "draft"
  }
}
```

### Get Assignment

**Request:**
```json
{
  "experimentId": "exp_abc123",
  "userId": "user_123"
}
```

**Response:**
```json
{
  "success": true,
  "assignment": {
    "assignmentId": "assign_xyz789",
    "experimentId": "exp_abc123",
    "userId": "user_123",
    "variantId": "treatment",
    "assignedAt": "2026-05-20T10:30:00Z"
  }
}
```

### Record Conversion

**Request:**
```json
{
  "assignmentId": "assign_xyz789",
  "value": 499,
  "metadata": {
    "orderId": "order_123"
  }
}
```

### Get Results

**Response:**
```json
{
  "success": true,
  "experiment": {
    "experimentId": "exp_abc123",
    "status": "running",
    "results": {
      "control": {
        "conversions": 450,
        "users": 5000,
        "rate": 0.09
      },
      "variants": [
        {
          "variantId": "treatment",
          "conversions": 520,
          "users": 5000,
          "rate": 0.104,
          "uplift": 15.6,
          "pValue": 0.023,
          "significant": true
        }
      ]
    }
  }
}
```

---

## Statistical Analysis

### Uplift Calculation

```
uplift = ((treatment_rate - control_rate) / control_rate) × 100
```

### Significance Testing

- Uses chi-squared test for conversion rate comparison
- p-value < 0.05 considered statistically significant
- 95% confidence level default

### Sample Size Calculator

```javascript
// Minimum sample size per variant
function calculateSampleSize(baseRate, mde, alpha = 0.05, power = 0.8) {
  const zAlpha = 1.96;  // 95% confidence
  const zBeta = 0.84;    // 80% power
  const p1 = baseRate;
  const p2 = baseRate * (1 + mde);
  const n = Math.pow(zAlpha * Math.sqrt(2 * p1 * (1 - p1)) + 
             zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) / 
             Math.pow(p2 - p1, 2);
  return Math.ceil(n);
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "uuid": "^9.0.0",
  "zod": "^3.22.4"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Service port (default: 4130) |
| `MONGODB_URI` | MongoDB connection |
| `INTERNAL_SERVICE_TOKEN` | Service authentication |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| Recommendation Engine | Write | Feature flags |
| Creative Engine | Read | Variant content |
| Analytics | Write | Track events |

---

## Status

- [x] Experiment creation
- [x] Variant assignment
- [x] Conversion tracking
- [x] Statistical analysis
- [x] Significance testing
- [x] Results dashboard
- [x] Sample size calculation
- [ ] Multi-armed bandits
- [ ] Sequential testing
- [ ] Integration with targeting engine
