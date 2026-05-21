# REZ Unified Agent SDK - SPEC.md

**Version:** 1.0.0
**Type:** SDK/Library
**Company:** REZ-Intelligence
**Category:** SDK

---

## Overview

Unified SDK for REZ AI agents to connect to commerce services. Provides standardized connectors for payment, wallet, order, and event handling with built-in retry and circuit breaker patterns.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Unified Agent SDK                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Submodules:                                                              │
│  ├── Connectors   → Payment, wallet, order                              │
│  └── Events       → Event emission and handling                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Exports

| Export | Description |
|--------|-------------|
| `AgentClient` | Base agent client |
| `connectors/*` | Service connectors |
| `events/*` | Event utilities |

---

## Connectors

| Connector | Description |
|-----------|-------------|
| `payment` | Payment service client |
| `wallet` | Wallet service client |
| `order` | Order service client |
| `booking` | Booking service client |

---

## Features

| Feature | Description |
|---------|-------------|
| Circuit Breaker | Fault tolerance with Opossum |
| Retry Logic | Automatic retries |
| Event Emission | Built-in event system |
| TypeScript | Full type definitions |

---

## Dependencies

```json
{
  "axios": "^1.6.0",
  "eventemitter3": "^5.0.0",
  "opossum": "^8.1.0",
  "retry": "^0.13.1",
  "winston": "^3.11.0",
  "zod": "^3.22.0"
}
```

---

## Usage

```typescript
import { AgentClient, connectors, events } from '@rez/unified-agent-sdk';

// Initialize
const agent = new AgentClient({ apiKey: '...' });

// Use connectors
const payment = await agent.connectors.payment.charge({ ... });

// Emit events
events.emit('order:created', { orderId: '...' });
```

---

## Status

- [x] SDK foundation
- [x] Payment connector
- [x] Wallet connector
- [x] Order connector
- [x] Event system
- [x] Circuit breaker
