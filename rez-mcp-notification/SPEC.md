# REZ MCP Notification - SPEC.md

**Version:** 1.1.0
**Type:** MCP Server
**Company:** REZ-Intelligence
**Category:** AI Tools

---

## Overview

Model Context Protocol (MCP) server for REZ notification debugging. Provides AI agents with tools to inspect, test, and debug notification delivery across push, SMS, email, and WhatsApp channels.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 REZ MCP Notification Server                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: MCP (Model Context Protocol)                                    │
│  Transport: Stdio (for CLI integration)                                   │
│  Purpose: Notification debugging and testing                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_notification_status` | Check notification delivery status |
| `list_pending_notifications` | List pending notifications |
| `resend_notification` | Retry failed notification |
| `get_channel_stats` | Get delivery statistics by channel |
| `test_notification` | Send test notification |

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^0.5.0",
  "dotenv": "^16.6.1"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NOTIFICATION_SERVICE_URL` | Notification service endpoint |
| `INTERNAL_SERVICE_TOKEN` | Service authentication |

---

## Usage

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

---

## Status

- [x] MCP server foundation
- [x] Notification status tools
- [x] Channel statistics
- [x] Test notification
