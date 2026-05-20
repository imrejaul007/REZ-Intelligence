# REZ Enterprise Gateway - SPEC.md

**Version:** 1.0.0
**Port:** 4102
**Company:** REZ-Intelligence
**Category:** Enterprise Integration

---

## Overview

Enterprise Gateway service for CorpPerks + RABTUL integration. Provides corporate account management, employee benefits administration, and cross-company loyalty integration.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Enterprise Gateway                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Corporate Accounts   → Company registration, SSO setup               │
│  ├── Employee Management  → Add employees, set benefits                   │
│  ├── Corporate Payments   → Budget management via RABTUL                 │
│  ├── Benefits Issuance    → Meal vouchers, transport, health              │
│  └── Loyalty Integration  → Cross-company rewards                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| POST | `/api/corporate/register` | Register corporate account |
| GET | `/api/corporate/:domain` | Get corporate account |
| POST | `/api/employees` | Add employee to corporate |
| POST | `/api/employees/:id/benefits` | Set employee benefits |
| POST | `/api/corporate/pay` | Corporate payment via RABTUL |
| POST | `/api/benefits/issue` | Issue employee benefits |
| POST | `/api/loyalty/earn` | Earn cross-company loyalty |
| GET | `/api/corporate/:domain/analytics` | Corporate analytics |
| GET | `/api/services/health` | Connected services health |

---

## Data Models

### CorporateAccount
```typescript
interface CorporateAccount {
  id: string;
  companyName: string;
  domain: string;
  employees: string[];
  budget: number;
  spent: number;
  benefits: string[];
  integratedServices: string[];
  createdAt: Date;
}
```

### Employee
```typescript
interface Employee {
  id: string;
  corporateId: string;
  email: string;
  department: string;
  walletBalance: number;
  benefits: string[];
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| RABTUL-auth | Read | SSO configuration |
| RABTUL-payment | Write | Corporate payments |
| RABTUL-wallet | Write | Benefit issuance |
| REZ-cross-company-loyalty | Write | Cross-company rewards |

---

## Status

- [x] Service foundation
- [ ] Corporate registration
- [ ] Employee management
- [ ] RABTUL payment integration
- [ ] Benefits issuance
- [ ] Corporate analytics
