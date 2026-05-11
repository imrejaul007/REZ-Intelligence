# REZ Action Engine

Decision execution layer for the REZ ecosystem. Handles automated actions, human-in-loop approvals, and integration with procurement systems.

## Overview

The REZ Action Engine is responsible for:

- **Event Processing**: Consumes events from the REZ Event Platform
- **Action Execution**: Evaluates and executes actions based on event triggers
- **Approval Workflows**: Manages human-in-loop approvals for risky actions
- **Integrations**: Connects with NextaBiZ for procurement operations

## Action Levels

Actions are classified into 4 safety levels that determine execution policy:

### Level 1: SAFE
**Auto-execute allowed**. Notifications, recommendations, logging.

| Action | Description |
|--------|-------------|
| `inventory.critical.alert` | Send urgent notification for critical inventory |
| `customer.order.ship_notification` | Send shipping notification |
| `customer.abandoned_cart.reminder` | Send cart reminder |
| `supplier.delivery.delay_notification` | Alert on delivery delays |
| `supplier.quality.issue_report` | Generate quality report |
| `dashboard.daily_report` | Generate daily summary |
| `analytics.trend.alert` | Alert on trend changes |

### Level 2: SEMI_SAFE
**Requires 1-click approval**. Suggestions and recommendations.

| Action | Description |
|--------|-------------|
| `inventory.low.reorder_suggestion` | Suggest reorder to merchant |
| `pricing.optimal_suggestion` | Suggest optimal pricing |
| `customer.high_value.retention_offer` | Create retention offer |
| `finance.invoice.auto_generation` | Auto-generate invoices |

### Level 3: RISKY
**Requires manual review**. Bulk operations, significant changes.

| Action | Description |
|--------|-------------|
| `inventory.out_of_stock.auto_order` | Auto-order out of stock items |
| `pricing.bulk_adjustment` | Apply bulk price changes |
| `finance.payment.failed.retry` | Retry failed payments |

### Level 4: FORBIDDEN
**Never automate**. Critical security operations.

These actions are blocked and cannot be executed through the action engine.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REZ Action Engine                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Event      │───▶│   Action     │───▶│   NextaBiZ   │     │
│  │  Consumer    │    │   Engine     │    │  Integration │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                  │                                   │
│         ▼                  ▼                                   │
│  ┌──────────────┐    ┌──────────────┐                         │
│  │  Event       │    │  Approval    │                         │
│  │  Platform    │    │    Queue     │◀──── Human Review      │
│  └──────────────┘    └──────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Redis 6+
- MongoDB (optional, for persistence)
- TypeScript

### Installation

```bash
cd rez-action-engine
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t rez-action-engine .
docker run -p 4009:4009 \
  -e REDIS_HOST=your-redis-host \
  -e MONGODB_URI=your-mongodb-uri \
  rez-action-engine
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4009` | Service port |
| `NODE_ENV` | `development` | Environment |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password |
| `MONGODB_URI` | `mongodb://localhost:27017/rez-action-engine` | MongoDB URI |
| `EVENT_PLATFORM_HOST` | `localhost` | Event platform host |
| `EVENT_PLATFORM_PORT` | `4001` | Event platform port |
| `EVENT_PLATFORM_API_KEY` | - | Event platform API key |
| `NEXTABIZ_API_URL` | `http://localhost:4002` | NextaBiZ API URL |
| `NEXTABIZ_API_KEY` | - | NextaBiZ API key |
| `LOG_LEVEL` | `info` | Logging level |

## API Reference

### Health Check

```bash
GET /health          # Full health status
GET /health/live    # Liveness probe
GET /health/ready   # Readiness probe
```

### Actions

```bash
# List all available actions
GET /actions

# Get action details
GET /actions/:actionId

# Execute an action
POST /actions/execute
{
  "actionId": "inventory.low.reorder_suggestion",
  "eventId": "evt-123",
  "payload": {
    "itemId": "ITEM-001",
    "currentStock": 5,
    "supplierId": "SUP-001"
  }
}
```

### Approvals

```bash
# List pending approvals
GET /approvals

# Get approval details
GET /approvals/:id

# Approve an action
POST /approvals/:id/approve
{
  "approverId": "user-123"
}

# Reject an action
POST /approvals/:id/reject
{
  "rejectorId": "user-123",
  "reason": "Insufficient stock"
}

# Cancel pending request
POST /approvals/:id/cancel
{
  "cancelledBy": "user-123"
}
```

### Events

```bash
# Submit event (webhook/testing)
POST /events
{
  "id": "evt-123",
  "type": "inventory.low",
  "source": "inventory-service",
  "data": {
    "itemId": "ITEM-001",
    "currentStock": 5
  }
}
```

### Statistics

```bash
GET /stats
```

## Event Triggers

| Event Type | Triggered Actions |
|------------|-------------------|
| `inventory.low` | Create reorder suggestion |
| `inventory.critical` | Send critical alert |
| `inventory.out_of_stock` | Auto order items |
| `order.shipped` | Send shipment notification |
| `cart.abandoned` | Send cart reminder |
| `customer.high_value.risk` | Create retention offer |
| `supplier.delivery.delayed` | Notify merchant of delay |
| `supplier.quality.issue` | Generate quality report |
| `order.completed` | Generate invoice |
| `payment.failed` | Retry payment (requires approval) |
| `schedule.daily` | Generate daily report |
| `analytics.trend.detected` | Alert on trends |

## NextaBiZ Integration

The action engine integrates with NextaBiZ for procurement operations:

- **Draft PO Creation**: Creates draft purchase orders for review
- **PO Submission**: Submits approved purchase orders
- **Supplier Notifications**: Sends delivery updates, quality feedback

## Monitoring

### Metrics to track

- Action execution rate by level
- Approval queue depth
- Execution latency
- Error rates by action type
- Event processing lag

### Logs

All logs are output in JSON format for production:

```json
{
  "level": "info",
  "message": "Action executed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "rez-action-engine",
  "executionId": "exec-123",
  "actionId": "inventory.low.reorder_suggestion"
}
```

## License

MIT
