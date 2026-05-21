# REZ Service Connectors - SPEC.md

**Version:** 1.0.0
**Type:** SDK/Client Library
**Company:** REZ-Intelligence
**Category:** Integration

---

## Overview

Service connectors SDK for REZ Orchestrator to communicate with backend services. Provides typed clients for payment, wallet, order, booking, notification, and analytics services with automatic retry.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Service Connectors                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Available Connectors:                                                     │
│  ├── Payment      → Payment processing                                    │
│  ├── Wallet       → Wallet operations                                    │
│  ├── Order        → Order management                                      │
│  ├── Booking      → Reservation handling                                  │
│  ├── Notification → Push/SMS/Email                                        │
│  └── Analytics   → Event tracking                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Exports

| Export | Description |
|--------|-------------|
| `payment` | Payment service connector |
| `wallet` | Wallet service connector |
| `order` | Order service connector |
| `booking` | Booking service connector |
| `notification` | Notification service connector |
| `analytics` | Analytics service connector |

---

## Usage

```typescript
import { payment, wallet, order } from '@rez/service-connectors';

// Payment operations
await payment.charge({ userId, amount, method: 'card' });

// Wallet operations
await wallet.getBalance({ userId });
await wallet.addFunds({ userId, amount, source: 'card' });

// Order operations
await order.create({ userId, items: [...] });
await order.status({ orderId });
```

---

## Dependencies

```json
{
  "axios": "^1.6.0",
  "axios-retry": "^4.0.0",
  "zod": "^3.22.0"
}
```

---

## Features

| Feature | Description |
|---------|-------------|
| Typed Requests | Zod schema validation |
| Retry Logic | Automatic retry with backoff |
| Error Handling | Consistent error responses |
| TypeScript | Full type definitions |

---

## Status

- [x] Payment connector
- [x] Wallet connector
- [x] Order connector
- [x] Booking connector
- [x] Notification connector
- [x] Analytics connector
