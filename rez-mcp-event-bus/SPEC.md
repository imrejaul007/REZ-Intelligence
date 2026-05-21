# REZ MCP Event Bus - SPEC.md

**Version:** 1.0.0
**Type:** MCP Server
**Company:** REZ-Intelligence
**Category:** AI Tools

---

## Overview

Model Context Protocol (MCP) server for REZ event bus debugging and event management. Provides AI agents with tools to query events, check DLQ, and debug event flow.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ MCP Event Bus Server                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: MCP (Model Context Protocol)                                    │
│  Transport: Stdio (for CLI integration)                                   │
│  Purpose: Event debugging and management                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `query_events` | Search events by type/channel |
| `get_event` | Get specific event |
| `get_dlq` | List dead letter queue |
| `retry_event` | Retry failed event |
| `get_event_stats` | Get event statistics |

---

## Event Types

| Category | Events |
|----------|--------|
| User | created, updated, deleted |
| Order | created, updated, completed, cancelled |
| Payment | initiated, completed, failed |
| Reorder | triggered, nudge_sent, nudge_clicked, nudge_converted |
| Notification | sent, failed |

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^0.5.0",
  "express": "^4.18.2",
  "axios": "^1.6.0"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EVENT_BUS_URL` | `http://localhost:4031` | Event bus endpoint |
| `USE_REAL_EVENT_BUS` | `false` | Use real vs mock |

---

## Status

- [x] MCP server foundation
- [x] Event querying
- [x] DLQ management
- [x] Event statistics
