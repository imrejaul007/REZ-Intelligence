# REZ Notification Debugger MCP Server

A Model Context Protocol (MCP) server for debugging and managing REZ notifications.

## Features

- **List Notifications** - Query notifications with filters (user, channel, status, type)
- **Get Notification Details** - View full notification payload and metadata
- **Check Delivery Status** - Track notification delivery across providers
- **Resend Failed Notifications** - Retry failed/bounced notifications
- **Preview Templates** - Test notification templates with variable substitution
- **Manage Preferences** - View and update user notification preferences

## Available Tools

| Tool | Description |
|------|-------------|
| `list_notifications` | List notifications with optional filters |
| `get_notification` | Get detailed information about a specific notification |
| `get_delivery_status` | Check delivery status including provider details |
| `resend_notification` | Resend a failed or bounced notification |
| `preview_template` | Preview a notification template with variables |
| `get_user_preferences` | Get user notification preferences |
| `update_preferences` | Update user notification preferences |

## Installation

```bash
cd rez-mcp-notification
npm install
npm run build
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build
```

## Usage

### Claude Code Integration

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "rez-notification": {
      "command": "node",
      "args": ["/path/to/rez-mcp-notification/dist/index.js"],
      "env": {
        "NOTIFICATION_SERVICE_URL": "https://rez-notifications-service.onrender.com",
        "INTERNAL_SERVICE_TOKEN": "your-token"
      }
    }
  }
}
```

### Direct Execution

```bash
node dist/index.js
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NOTIFICATION_SERVICE_URL` | No | Base URL for REZ notification service |
| `INTERNAL_SERVICE_TOKEN` | No | Service authentication token |

When `NOTIFICATION_SERVICE_URL` is set, the server will attempt to fetch real data from the notification service. Otherwise, it uses mock data for debugging.

## Notification Types

- `order` - Order confirmations, updates, cancellations
- `payment` - Payment confirmations, failures
- `promotion` - Marketing and promotional messages
- `system` - System alerts and account notifications
- `reminder` - Scheduled reminders
- `alert` - Price alerts, stock alerts

## Notification Channels

- `push` - Mobile push notifications
- `email` - Email notifications
- `sms` - SMS messages
- `whatsapp` - WhatsApp Business messages
- `in_app` - In-application notifications

## Notification Statuses

- `pending` - Queued for delivery
- `sent` - Sent to provider
- `delivered` - Delivered to device/user
- `read` - Read by user
- `failed` - Delivery failed
- `bounced` - Bounced (email/SMS)

## Example Usage

### List all notifications for a user

```
list_notifications(userId: "user_123")
```

### Filter by channel and status

```
list_notifications(channel: "email", status: "failed")
```

### Get notification details

```
get_notification(notificationId: "notif_001")
```

### Check delivery status

```
get_delivery_status(notificationId: "notif_001")
```

### Resend a failed notification

```
resend_notification(notificationId: "notif_003")
```

### Preview a template

```
preview_template(
  templateId: "order_confirmation",
  variables: {
    orderId: "ORD-2024-100",
    amount: "1500.00",
    deliveryEstimate: "2-3 business days"
  }
)
```

### Get user preferences

```
get_user_preferences(userId: "user_123")
```

### Update preferences

```
update_preferences(
  userId: "user_123",
  push: true,
  email: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00"
)
```

## Available Templates

- `order_confirmation` - Order confirmation messages
- `payment_success` - Payment success notifications
- `order_shipped` - Order shipment notifications
- `price_alert` - Price drop alerts
- `reminder` - Generic reminders
- `welcome` - Welcome messages

## License

Internal - RABTUL Technologies
