# REZ Flow Runtime API Reference
**Base URL:** `http://localhost:4200`
**Auth:** `X-Internal-Token` header required

---

## Quick Start

```bash
# Create workflow
curl -X POST http://localhost:4200/api/workflows \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev-token" \
  -d '{
    "name": "Welcome Flow",
    "nodes": [...],
    "edges": [...]
  }'

# Trigger execution
curl -X POST http://localhost:4200/api/executions \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev-token" \
  -d '{
    "workflowId": "welcome_flow",
    "trigger": { "type": "manual" },
    "variables": { "userId": "user_123" }
  }'
```

---

## Workflows

### Create Workflow
```http
POST /api/workflows
```
**Body:**
```json
{
  "name": "welcome_flow",
  "description": "Welcome new users",
  "entryNodeId": "node_1",
  "nodes": [
    {
      "id": "node_1",
      "type": "action_send_email",
      "config": {
        "actionType": "send_email",
        "params": { "template": "welcome" }
      }
    }
  ],
  "edges": [
    { "from": "node_1", "to": "node_2", "condition": null }
  ]
}
```

### Node Types

| Type | Description | Config |
|------|-------------|---------|
| `action_send_email` | Send email | `{ to, subject, template }` |
| `action_send_sms` | Send SMS | `{ to, message }` |
| `action_send_whatsapp` | Send WhatsApp | `{ to, template }` |
| `action_send_push` | Push notification | `{ userId, title, body }` |
| `action_add_coins` | Add wallet coins | `{ userId, amount }` |
| `action_create_order` | Create order | `{ userId, items }` |
| `condition_if_time` | Time-based branch | `{ hour, dayOfWeek }` |
| `condition_if_user_segment` | Segment branch | `{ segment }` |
| `delay_wait_hours` | Delay execution | `{ hours }` |

---

## Executions

### Create Execution
```http
POST /api/executions
```
**Body:**
```json
{
  "workflowId": "welcome_flow",
  "trigger": {
    "type": "manual",
    "source": "api"
  },
  "variables": {
    "userId": "user_123",
    "email": "user@example.com"
  }
}
```

### Get Execution
```http
GET /api/executions/:id
```
**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_xxx",
    "workflowId": "welcome_flow",
    "status": "running",
    "progress": 0.65,
    "currentNode": "node_3",
    "startedAt": "2026-05-23T10:00:00Z",
    "estimatedCompletion": "2026-05-23T10:05:00Z"
  }
}
```

### Status Values
- `pending` - Created, waiting for worker
- `running` - Executing nodes
- `completed` - Finished successfully
- `failed` - Error occurred
- `cancelled` - Manually stopped
- `paused` - Waiting for delay/webhook

---

## DLQ (Dead Letter Queue)

### List Failed
```http
GET /api/dlq
```

### Retry Item
```http
POST /api/dlq/:id/retry
```

### Purge Item
```http
DELETE /api/dlq/:id
```

---

## Monitoring

### Health
```http
GET /health
```

### Metrics
```http
GET /metrics
```

### Stats
```http
GET /api/stats
```
**Response:**
```json
{
  "workflows": { "active": 12, "total": 156 },
  "executions": { "running": 5, "completed": 1247 },
  "dlq": { "pending": 3 }
}
```

---

## Errors

| Code | Meaning |
|------|---------|
| `WORKFLOW_NOT_FOUND` | Workflow ID invalid |
| `EXECUTION_FAILED` | Node execution error |
| `RETRY_EXHAUSTED` | Max retries reached |
| `CIRCUIT_OPEN` | External service down |
| `INVALID_NODE_CONFIG` | Node config malformed |
