# REZ Flow Runtime

**Workflow execution engine for REZ-workflow-builder**

Port: **4200**

## Overview

REZ Flow Runtime is a production-ready workflow execution engine that executes workflows defined in REZ-workflow-builder. It provides:

- **Visual workflow execution** - Execute workflows with nodes, edges, triggers, actions, conditions, and delays
- **Async processing** - BullMQ-based job queue for reliable execution
- **State management** - MongoDB-backed execution state and history
- **Error handling** - Retry logic, DLQ (Dead Letter Queue), and error recovery
- **Rate limiting** - Protection against abuse
- **Authentication** - Internal service token and API key authentication

## Architecture

```
Workflow JSON → Parser → Execution Planner → Node Executor → State Machine → DLQ
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Start the server
npm run dev

# Start the worker (in separate terminal)
npm run worker

# Run tests
npm test
```

## API Endpoints

### Health
- `GET /health` - Full health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

### Workflows
- `POST /api/workflows/register` - Register workflow from builder
- `GET /api/workflows/:id` - Get workflow details
- `POST /api/workflows/:id/publish` - Publish workflow
- `POST /api/workflows/:id/archive` - Archive workflow
- `GET /api/workflows` - List workflows
- `DELETE /api/workflows/:id` - Delete workflow
- `GET /api/workflows/:id/versions` - Get workflow versions
- `POST /api/workflows/:id/validate` - Validate workflow

### Executions
- `POST /api/executions` - Create execution
- `GET /api/executions/:id` - Get execution status
- `POST /api/executions/:id/cancel` - Cancel execution
- `POST /api/executions/:id/retry` - Retry failed execution
- `GET /api/executions` - List executions
- `GET /api/executions/:id/logs` - Get execution logs
- `GET /api/executions/stats` - Get execution statistics

### DLQ
- `GET /api/dlq` - List DLQ messages
- `POST /api/dlq/:jobId/retry` - Retry DLQ message
- `DELETE /api/dlq/:jobId` - Discard DLQ message

### Triggers
- `POST /api/triggers/webhook/:workflowId` - Webhook trigger

## Node Types

### Triggers
- `trigger_event` - Triggered by events
- `trigger_schedule` - Scheduled execution
- `trigger_manual` - Manual trigger
- `trigger_webhook` - Webhook trigger
- `trigger_api` - API trigger

### Actions
- `action_send_email` - Send email
- `action_send_sms` - Send SMS
- `action_send_whatsapp` - Send WhatsApp message
- `action_send_push` - Send push notification
- `action_update_user` - Update user profile
- `action_create_order` - Create order
- `action_webhook_call` - Call external webhook

### Conditions
- `condition_if_user_segment` - Check user segment
- `condition_if_time` - Check time
- `condition_if_purchase_history` - Check purchase history
- `condition_if_location` - Check location

### Delays
- `delay_minutes` - Wait minutes
- `delay_hours` - Wait hours
- `delay_days` - Wait days
- `delay_until` - Wait until specific time

### Flow Control
- `split_fan_out` - Parallel execution
- `merge_wait_all` - Wait for all branches

## Authentication

### Internal Token
```bash
curl -X POST http://localhost:4200/api/executions \
  -H "X-Internal-Token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "my-workflow", "triggerType": "manual"}'
```

### API Key
```bash
curl -X POST http://localhost:4200/api/workflows/register \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"workflow": {...}}'
```

## Example Workflow

```json
{
  "id": "welcome-flow",
  "name": "Welcome Flow",
  "version": 1,
  "status": "published",
  "entryNodeId": "trigger-1",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger_manual",
      "data": { "label": "Start" }
    },
    {
      "id": "email-1",
      "type": "action_send_email",
      "data": {
        "label": "Send Welcome Email",
        "config": {
          "actionType": "send_email",
          "params": {
            "subject": "Welcome!",
            "body": "Thanks for joining!"
          }
        }
      }
    },
    {
      "id": "delay-1",
      "type": "delay_hours",
      "data": {
        "label": "Wait 24 Hours",
        "config": {
          "delayType": "hours",
          "value": 24
        }
      }
    },
    {
      "id": "push-1",
      "type": "action_send_push",
      "data": {
        "label": "Send Push",
        "config": {
          "actionType": "send_push",
          "params": {
            "title": "Check us out!",
            "body": "Explore our features"
          }
        }
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger-1", "target": "email-1" },
    { "id": "e2", "source": "email-1", "target": "delay-1" },
    { "id": "e3", "source": "delay-1", "target": "push-1" }
  ]
}
```

## Error Handling

### Retry Policy
Each node can have a retry policy:
```json
{
  "retryPolicy": {
    "maxRetries": 3,
    "retryDelay": 1000,
    "backoffMultiplier": 2
  }
}
```

### Error Handling Options
- `continue` - Continue to next node on error
- `stop` - Stop execution on error
- `retry` - Retry the node
- `dlq` - Send to Dead Letter Queue

## Monitoring

### Logs
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs

### Metrics
- Execution success/failure rate
- Node execution times
- DLQ message count
- Active executions

## Production Checklist

- [ ] Set secure `INTERNAL_SERVICE_TOKEN`
- [ ] Configure `VALID_API_KEYS`
- [ ] Set up MongoDB replica set for production
- [ ] Configure Redis cluster for production
- [ ] Set `NODE_ENV=production`
- [ ] Configure log rotation
- [ ] Set up monitoring/alerting
- [ ] Configure backup for MongoDB
- [ ] Set appropriate rate limits
- [ ] Configure retention policies
