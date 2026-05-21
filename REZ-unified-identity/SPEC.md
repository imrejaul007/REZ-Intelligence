# REZ Unified Identity - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Identity

---

## Overview

Cross-company unified customer identity service for the REZ ecosystem. Provides identity resolution, consent management, and GDPR/DPDP compliance across all REZ companies.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Unified Identity                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                           │
│  ├── Identity Resolution → Link user across companies                    │
│  ├── Consent Management  → GDPR/DPDP compliance                           │
│  ├── Profile Unification → Single view of user                         │
│  └── Cross-company Linking → Multi-company identity                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Customer
```typescript
{
  customerId: string;
  source: string;
  identifiers: {
    type: string;
    value: string;
    verified: boolean;
  }[];
  profile: {
    name?: string;
    email?: string;
    phone?: string;
  };
  consent: {
    marketing: boolean;
    dataProcessing: boolean;
    thirdParty: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Link
```typescript
{
  linkId: string;
  customerId: string;
  companyId: string;
  localUserId: string;
  createdAt: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.2.0",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "crypto-js": "^4.2.0",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.2.0"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| MONGODB_URI | MongoDB connection |
| REDIS_URL | Redis connection |
| PORT | Service port |
| ENCRYPTION_KEY | Customer data encryption |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| All REZ Companies | Read/Write | Identity linking |
| REZ-identity-graph | Read | Identity resolution |
| REZ-data-governance | Write | Compliance reports |

---

## Status

- [x] Service foundation
- [x] Identity resolution
- [x] Consent management
- [ ] Profile unification
- [ ] Cross-company linking
- [ ] Right to erasure
- [ ] Data export
