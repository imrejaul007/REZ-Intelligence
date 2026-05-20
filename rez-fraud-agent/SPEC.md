# REZ Fraud Agent - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Security

---

## Overview

Fraud detection agent specialized in risk detection and security. Provides real-time fraud scoring, pattern detection, and security recommendations for transactions and user activities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Fraud Agent                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Detection Types:                                                          │
│  ├── Transaction Fraud  → Payment fraud, card testing                     │
│  ├── Account Fraud     → Fake accounts, account takeover                  │
│  ├── Behavioral Fraud  → Unusual patterns, bot detection                  │
│  └── Velocity Fraud    → Rapid-fire transactions, wash trading            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Risk Levels:                                                              │
│  ├── Low (0-0.3)      → Auto-approve                                     │
│  ├── Medium (0.3-0.6) → Review recommended                               │
│  ├── High (0.6-0.8)    → Manual review required                           │
│  └── Critical (0.8+)  → Block and investigate                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Fraud Signals

| Signal | Weight | Description |
|--------|--------|-------------|
| New device | 0.15 | First-time device |
| Unusual location | 0.2 | Geographic anomaly |
| Velocity spike | 0.25 | Rapid transactions |
| Amount anomaly | 0.2 | Outlier transaction |
| Behavioral change | 0.15 | Pattern deviation |
| Blacklist match | 0.5 | Known fraudster |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "redis": "^4.6.12",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.1",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.5",
  "axios": "^1.6.2"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-payment-service | Read | Transaction data |
| REZ-identity-graph | Read | User identity |
| REZ-wallet | Read/Write | Fraud actions |

---

## Status

- [x] Service foundation
- [ ] Transaction fraud detection
- [ ] Account fraud detection
- [ ] Behavioral analysis
- [ ] Velocity monitoring
- [ ] Risk scoring
- [ ] Block/review actions
