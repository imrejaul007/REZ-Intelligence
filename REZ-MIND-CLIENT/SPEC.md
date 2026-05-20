# REZ Mind Client - SPEC.md

**Version:** 1.0.0
**Port:** N/A (Client SDK)
**Company:** REZ-Intelligence
**Category:** AI Client SDK

---

## Overview

Client SDK for REZ Mind AI. Provides programmatic access to REZ Mind AI capabilities including intent prediction, conversational AI, and agent orchestration.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REZ Mind Client SDK                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Intent Prediction → Predict user intent from text/query              │
│  ├── Conversation API  → Connect to REZ Mind conversational AI          │
│  ├── Agent Orchestration → Trigger AI agent workflows                    │
│  └── Response Parsing  → Standardized response handling                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Usage Example

```typescript
import { ReZMindClient } from '@rez/mind-client';

const client = new ReZMindClient({
  apiKey: process.env.REZ_MIND_API_KEY,
  baseUrl: 'https://rezmind.rezapp.com'
});

// Predict intent
const intent = await client.predictIntent('I want to order food');
console.log(intent.intent); // 'food_order'

// Chat with agent
const response = await client.chat({
  message: 'Book a table for 2',
  userId: 'user_123'
});
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
- [ ] Intent prediction
- [ ] Conversation API
- [ ] Agent orchestration
- [ ] Response parsing
