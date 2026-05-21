# REZ Shared Types - SPEC.md

**Version:** 1.0.0
**Type:** TypeScript Types
**Company:** REZ-Intelligence
**Category:** Shared

---

## Overview

Shared TypeScript type definitions for the REZ Intelligence Platform. Provides canonical type definitions used across all services for consistency.

---

## Exports

| Export | Description |
|--------|-------------|
| `User` | User type definitions |
| `Merchant` | Merchant type definitions |
| `Order` | Order type definitions |
| `Payment` | Payment type definitions |
| `Intent` | Intent signal types |
| `Agent` | Agent types |

---

## Usage

```typescript
import { User, Order, Intent } from '@rez/shared-types';

const user: User = { userId: '...', name: '...' };
```

---

## Dependencies

```json
{
  "typescript": "^5.3.3"
}
```

---

## Status

- [x] Type definitions
- [x] User types
- [x] Merchant types
- [x] Order types
- [x] Intent types
