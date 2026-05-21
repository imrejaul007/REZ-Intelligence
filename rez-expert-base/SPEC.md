# REZ Expert Base - SPEC.md

**Version:** 1.0.0
**Type:** Base Class/Template
**Company:** REZ-Intelligence
**Category:** AI Infrastructure

---

## Overview

Base class template for all REZ industry expert agents. Provides common infrastructure including Claude AI integration, rate limiting, Redis caching, and structured response handling.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Expert Base                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Base Components:                                                        │
│  ├── AI Provider (Claude) → Anthropic integration                        │
│  ├── Rate Limiter         → Request throttling                          │
│  ├── Redis Cache          → Response caching                            │
│  ├── System Prompt        → Domain-specific prompts                      │
│  └── Structured Output    → JSON response schema                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Base Features

| Feature | Description |
|---------|-------------|
| Claude Integration | Anthropic AI for responses |
| Rate Limiting | Token bucket rate limiting |
| Response Caching | Redis-backed cache |
| Structured Output | Zod schema validation |
| Request Logging | Morgan + Winston |

---

## Expert Types (Templates)

| Expert | Description |
|--------|-------------|
| Health Expert | Health & wellness guidance |
| Retail Expert | Shopping assistance |
| Travel Expert | Travel recommendations |
| Education Expert | Learning guidance |
| Culinary Expert | Food & recipes |

---

## Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.24.0",
  "@rez/shared-types": "file:../rez-shared-types",
  "express": "^4.19.2",
  "ioredis": "^5.4.1",
  "helmet": "^7.1.0",
  "zod": "^3.23.8",
  "winston": "^3.13.0"
}
```

---

## Usage

```typescript
import { ExpertBase } from '@rez/expert-base';

class MyExpert extends ExpertBase {
  constructor() {
    super({
      name: 'my-expert',
      systemPrompt: 'You are a domain expert...',
      outputSchema: MyOutputSchema
    });
  }
}
```

---

## Status

- [x] Base foundation
- [x] Claude integration
- [x] Rate limiting
- [x] Redis caching
- [x] Structured output
