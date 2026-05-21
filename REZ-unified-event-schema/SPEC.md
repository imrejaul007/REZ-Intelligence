# REZ Unified Event Schema - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Event Infrastructure

---

## Overview

Central schema registry for all events in the REZ ecosystem. Provides validation, versioning, and documentation for event schemas across all services.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Unified Event Schema                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Schema Categories:                                                      │
│  ├── Commerce Events  → Orders, payments, refunds                       │
│  ├── Identity Events → User actions, auth events                       │
│  ├── Engagement Events → Page views, clicks, searches                  │
│  └── Intelligence Events → Predictions, scores                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Schema Structure

```typescript
interface REZEvent {
  id: string;
  type: string;
  version: string;
  timestamp: string;
  source: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  payload: Record<string, unknown>;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "zod": "^3.22.4"
}
```

---

## Status

- [x] Schema registry foundation
- [ ] Commerce schemas
- [ ] Identity schemas
- [ ] Engagement schemas
- [ ] Intelligence schemas
- [ ] Schema validation
- [ ] Version management
