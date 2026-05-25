# REZ Flow Runtime - Architecture

## Overview
Workflow execution engine with state machine, retry logic, and event-driven architecture.

## Components

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Express)                     │
├─────────────────────────────────────────────────────────┤
│  POST /api/executions    - Create workflow execution    │
│  GET  /api/executions/:id - Get execution status      │
│  POST /api/executions/:id/cancel - Cancel execution   │
│  POST /api/triggers/webhook - Webhook trigger        │
└─────────────────────────────────────────────────────┘
                              │
┌───────────────────────────────▼─────────────────────────┐
│                  Service Layer                            │
├───────────────────────────────────────────────────┤
│  WorkflowExecutor    - Executes workflow nodes     │
│  NodeHandlers       - 15+ node type handlers   │
│  DLQService        - Dead letter queue         │
│  CheckpointService - State persistence         │
└───────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ MongoDB  │          │  Redis  │          │ BullMQ  │
   │ (State) │          │ (Cache) │          │ (Queue) │
   └─────────┘          └─────────┘          └─────────┘
```

## Node Types

| Category | Types |
|----------|-------|
| **Triggers** | event, schedule, manual, webhook, api |
| **Actions** | send_email, send_sms, send_whatsapp, send_push, add_coins, create_order |
| **Conditions** | if_user_segment, if_time, if_location |
| **Delays** | wait_minutes, wait_hours, wait_days |
| **Flow** | split, merge, fork, join |

## Execution Flow

```
1. API receives execution request
2. Validate workflow exists
3. Create Execution record
4. Add to BullMQ queue
5. Worker picks up job
6. Parse workflow nodes
7. Execute nodes in order
8. Save checkpoints periodically
9. On failure: retry with backoff
10. On max retries: add to DLQ
11. Update execution status
```

## State Machine

```
PENDING → RUNNING → COMPLETED
              ↓
            FAILED → DLQ
              ↓
          CANCELLED
```

## Environment Variables

```bash
PORT=4200
MONGODB_URI=mongodb://localhost:27017/rez-flow-runtime
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKEN=change-me
WORKER_CONCURRENCY=5
DLQ_MAX_RETRIES=5
CHECKPOINT_INTERVAL=10
```
