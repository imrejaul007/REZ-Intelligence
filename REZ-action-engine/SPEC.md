# REZ Action Engine - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Workflow Automation

---

## Overview

Decision execution layer for automated and approval-based actions. Handles action execution based on events, human-in-loop approvals, and event consumption from the REZ event platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Action Engine                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Action Execution  → Automated action triggers                        │
│  ├── Approval Queue    → Human-in-loop workflows                          │
│  ├── Event Consumer    → Listen to event platform                        │
│  └── Action Registry   → Centralized action definitions                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /actions/*, /approvals/*                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Action Levels

| Level | Description | Approval Required |
|-------|-------------|------------------|
| `SAFE` | Low-risk, auto-execute | No |
| `REVIEW` | Medium-risk, review | Yes |
| `RISKY` | High-risk, approve | Yes |
| `CRITICAL` | Critical, multi-approve | Multiple |

---

## API Endpoints

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/health/live` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe |

### Actions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/actions` | GET | List all actions |
| `/actions/:actionId` | GET | Get action info |
| `/actions/execute` | POST | Execute an action |

### Approvals

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/approvals` | GET | List approvals |
| `/approvals/:id` | GET | Get approval details |
| `/approvals/:id/approve` | POST | Approve request |
| `/approvals/:id/reject` | POST | Reject request |
| `/approvals/:id/cancel` | POST | Cancel request |

### Events

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events` | POST | Submit event for processing |

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/action/notification` | POST | Action notifications |

### Statistics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/stats` | GET | Action engine statistics |

---

## Data Models

### ActionRequest

```typescript
interface ActionRequest {
  actionId: string;
  userId: string;
  data: Record<string, unknown>;
  riskLevel: 'SAFE' | 'REVIEW' | 'RISKY' | 'CRITICAL';
  callbackUrl?: string;
}
```

### Approval

```typescript
interface Approval {
  id: string;
  actionId: string;
  request: ActionRequest;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvers: Approver[];
  createdAt: Date;
  expiresAt?: Date;
}
```

### Approver

```typescript
interface Approver {
  approverId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
  timestamp: Date;
}
```

---

## Event Handlers

| Event | Handler | Action |
|-------|---------|--------|
| `user.became_dormant` | `handleDormantFinanceUser` | Re-engagement |
| `loan.emi_due_soon` | `handleEMIDueReminder` | Payment reminder |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.2",
  "bullmq": "^5.1.0",
  "axios": "^1.15.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Service port |
| `CORS_ORIGINS` | Allowed CORS origins |
| `MONGODB_URI` | MongoDB connection |
| `REDIS_URL` | Redis connection |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ Event Platform | Read | Event consumption |
| REZ Support Copilot | Write | Action notifications |
| Finance Services | Read | Finance event handlers |

---

## Approval Workflow

```
Action Request → Risk Assessment → [SAFE] → Auto-Execute
                                    ↓
                              [REVIEW/RISKY] → Approval Queue
                                    ↓
                              Human Review → Approved/Rejected
                                    ↓
                              Execute/Cancel
```

---

## Status

- [x] Action execution framework
- [x] Approval queue
- [x] Event consumption
- [x] Finance event handlers
- [x] Action registry
- [x] CORS security
- [ ] More action handlers
- [ ] Action scheduling
- [ ] Retry logic
- [ ] SLA monitoring
