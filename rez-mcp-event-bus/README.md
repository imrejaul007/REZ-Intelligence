# REZ Event Bus MCP

MCP server for debugging and managing REZ event bus events.

## Tools

- `list_event_types` - List all event types
- `get_events` - Query events with filters
- `publish_event` - Publish a new event
- `get_event_flow` - Get complete event flow for an entity
- `get_dlq_events` - Get failed events from DLQ
- `retry_dlq_event` - Retry a failed event
- `get_event_stats` - Get event processing statistics

## Usage

```bash
npm install
npm run build
npm start
```

## Configuration

No additional configuration required. The server runs on stdio for MCP protocol communication.

## Event Types

The following event types are supported:

| Category | Events |
|----------|--------|
| User | user.created, user.updated, user.deleted |
| Order | order.created, order.updated, order.completed, order.cancelled |
| Payment | payment.initiated, payment.completed, payment.failed |
| Reorder | reorder.triggered, reorder.nudge_sent, reorder.nudge_clicked, reorder.nudge_converted |
| Notification | notification.sent, notification.failed |
