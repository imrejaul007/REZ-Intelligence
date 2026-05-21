# REZ Flow Runtime - SPEC.md

**Version:** 1.0.0
**Port:** 4200
**Company:** REZ-Intelligence
**Category:** Infrastructure

---

## Overview

Workflow execution engine for REZ-workflow-builder. Executes visual workflows with support for nodes, branching, loops, and error handling. Powers automation across the REZ platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REZ Flow Runtime                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Workflow Registry   → Published workflow storage                      │
│  ├── Execution Engine   → Node-by-node execution                          │
│  ├── Execution Worker   → BullMQ async processing                         │
│  ├── DLQ Service        → Dead letter queue handling                      │
│  └── Webhook Triggers   → External event triggers                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List workflows |
| GET | `/api/workflows/:id` | Get workflow |
| POST | `/api/workflows` | Create workflow |
| PUT | `/api/workflows/:id` | Update workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |
| POST | `/api/workflows/:id/publish` | Publish workflow |

### Executions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/executions` | List executions |
| GET | `/api/executions/:id` | Get execution |
| POST | `/api/executions` | Trigger execution |
| POST | `/api/executions/:id/cancel` | Cancel execution |
| POST | `/api/executions/:id/retry` | Retry failed execution |

### Triggers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/triggers/webhook/:workflowId` | Webhook trigger |

### Dead Letter Queue
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dlq` | List DLQ messages |
| POST | `/api/dlq/:jobId/retry` | Retry DLQ message |
| DELETE | `/api/dlq/:jobId` | Discard DLQ message |

### Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Execution statistics |
| GET | `/health` | Health check |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |

---

## Data Models

### Workflow
```
{
  workflowId: string
  name: string
  version: number
  status: 'draft' | 'published' | 'archived'
  nodes: WorkflowNode[]
  connections: Connection[]
  variables: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

### Execution
```
{
  executionId: string
  workflowId: ObjectId
  workflowVersion: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  triggerType: 'manual' | 'scheduled' | 'webhook' | 'event'
  triggerData: Record<string, any>
  context: { variables: Record<string, any> }
  nodeResults: NodeResult[]
  executionPath: string[]
  stats: { totalNodes, completedNodes, failedNodes, skippedNodes, totalRetries }
  logs: LogEntry[]
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.2.0",
  "ioredis": "^5.3.2",
  "bullmq": "^5.1.0",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.2.0",
  "axios": "^1.6.7"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-workflow-builder | Read | Workflow definitions |
| REZ-event-bus | Read | Event triggers |
| REZ-scheduler-service | Write | Scheduled triggers |
| All Services | Write | Node action execution |

---

## Status

- [x] Service foundation
- [x] Workflow CRUD
- [x] Execution engine
- [x] Execution worker
- [x] DLQ management
- [x] Webhook triggers
- [x] Statistics endpoint
