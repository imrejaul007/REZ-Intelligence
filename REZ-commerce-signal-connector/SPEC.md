# REZ Commerce Signal Connector - SPEC.md

**Version:** 1.0.0
**Port:** 4150
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

Bridges commerce events to REZ signal services. Listens to order, payment, and review webhooks and emits signals to downstream intelligence services for real-time enrichment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REZ Commerce Signal Connector                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Input Webhooks:                                                          │
│  ├── /webhook/order    → Order completed                                  │
│  ├── /webhook/payment  → Payment completed                                │
│  ├── /webhook/review   → Review submitted                                │
│  └── /webhook/cart     → Cart abandoned                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Output (Signal Services):                                                │
│  ├── Unified Profile → Enrich with order/payment data                     │
│  ├── Signal Aggregator → Trigger signal recomputation                     │
│  ├── Predictive Engine → Update churn/LTV models                          │
│  └── Behavioral Service → Record psychology events                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/order` | Order completed |
| POST | `/webhook/payment` | Payment completed |
| POST | `/webhook/review` | Review submitted |
| POST | `/webhook/cart` | Cart abandoned |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Webhook Schemas

### Order Webhook
```json
{
  "userId": "string",
  "orderId": "string",
  "merchantId": "string",
  "total": "number",
  "items": [{ "category": "string", "value": "number" }],
  "paymentMethod": "string",
  "timestamp": "ISO8601 string"
}
```

### Payment Webhook
```json
{
  "userId": "string",
  "transactionId": "string",
  "amount": "number",
  "method": "string",
  "status": "string"
}
```

### Review Webhook
```json
{
  "userId": "string",
  "merchantId": "string",
  "rating": "number",
  "comment": "string (optional)"
}
```

### Cart Webhook
```json
{
  "userId": "string",
  "cartValue": "number",
  "items": "array (optional)"
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "axios": "^1.6.0",
  "zod": "^3.22.4"
}
```

---

## Target Services

| Service | Port | Endpoint |
|---------|------|----------|
| Unified Profile | 4120 | `/api/profile/enrich` |
| Signal Aggregator | 4121 | `/signals/compute` |
| Predictive Engine | 4123 | `/predict/recompute` |
| Behavioral Service | 4110 | `/api/psychology/event` |
| Competitor Service | 4117 | - |
| Social Service | 4116 | `/api/social/event` |
| Location Service | 4115 | - |

---

## Status

- [x] Order webhook
- [x] Payment webhook
- [x] Review webhook
- [x] Cart webhook
- [x] Multi-service emission
