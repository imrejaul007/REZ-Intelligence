# REZ Integration SDK - SPEC.md

**Version:** 1.0.0
**Port:** N/A (Client SDK)
**Company:** REZ-Intelligence
**Category:** Integration SDK

---

## Overview

Unified SDK for all REZ apps to connect with REZ Intelligence services. Provides standardized API client with authentication, retry logic, and error handling.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Integration SDK                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                               │
│  ├── API Client    → Unified API access                                  │
│  ├── Auth Handler → Token management                                     │
│  ├── Retry Logic  → Automatic retries with backoff                       │
│  └── Type Safety  → Full TypeScript definitions                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Usage Example

```typescript
import { createRezClient } from '@rez/integration-sdk';

const client = createRezClient({
  apiKey: process.env.REZ_API_KEY,
  baseUrl: 'https://api.rezapp.com'
});

// Use services
const prediction = await client.predictions.getChurnScore('user_123');
const recommendations = await client.recommendations.getForUser('user_123');
```

---

## Dependencies

```json
{
  "axios": "^1.6.0"
}
```

---

## Status

- [x] SDK foundation
- [ ] API client
- [ ] Authentication
- [ ] Retry logic
- [ ] Type definitions
