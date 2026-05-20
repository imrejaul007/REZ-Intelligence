# REZ Real-Time Decision Engine - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Decision Making

---

## Overview

Real-time decision engine serving as the brainstem for all time-sensitive decisions across the REZ platform. Provides sub-millisecond decision making for pricing, offers, fraud, and personalization.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REZ Real-Time Decision Engine                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Decision Types:                                                         │
│  ├── Pricing         → Dynamic pricing decisions                      │
│  ├── Offers         → Real-time offer selection                      │
│  ├── Fraud          → Transaction risk scoring                       │
│  ├── Personalization → Content and product ranking                  │
│  └── Routing        → Service and fulfillment routing               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/decide/*                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Categories

| Category | Latency Target | Use Cases |
|----------|---------------|-----------|
| Pricing | < 10ms | Dynamic pricing, discounts |
| Offers | < 20ms | Real-time offers, coupons |
| Fraud | < 50ms | Transaction scoring |
| Personalization | < 30ms | Ranking, recommendations |
| Routing | < 15ms | Fulfillment, delivery |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "pino": "^8.17.2"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-feature-store | Read | Feature data |
| REZ-predictive-engine | Read | ML predictions |
| REZ-identity-graph | Read | User context |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| P99 Latency | < 100ms |
| P95 Latency | < 50ms |
| Availability | 99.99% |
| Throughput | 10,000 req/sec |

---

## Status

- [x] Service foundation
- [ ] Decision rules engine
- [ ] ML model serving
- [ ] Feature caching
- [ ] Decision logging
- [ ] A/B testing support
