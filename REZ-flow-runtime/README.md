# REZ Flow Runtime

**Port 4200** | Workflow execution engine for automation

## Features

- Visual workflow execution
- 15+ node types
- Retry with exponential backoff
- Dead letter queue
- Checkpointing
- Real-time status

## Quick Start

```bash
npm install
npm start
```

## API

```bash
# Create execution
curl -X POST http://localhost:4200/api/executions \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev-token" \
  -d '{"workflowId": "welcome", "trigger": {"type": "manual"}, "variables": {}}'

# Check status
curl http://localhost:4200/api/executions/exec_xxx \
  -H "X-Internal-Token: dev-token"
```

## Node Types

| Category | Types |
|----------|-------|
| **Actions** | send_email, send_sms, send_whatsapp, add_coins, create_order |
| **Conditions** | if_user_segment, if_time, if_location |
| **Delays** | wait_minutes, wait_hours, wait_days |

## Architecture

```
User → API → BullMQ → Worker → Nodes → DLQ → Complete
```

## Health

```bash
curl http://localhost:4200/health
```

## Environment

```bash
PORT=4200
MONGODB_URI=mongodb://localhost:27017/rez-flow-runtime
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKEN=dev-token
WORKER_CONCURRENCY=5
```
