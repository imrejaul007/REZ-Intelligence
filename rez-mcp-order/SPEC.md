# REZ MCP Order - SPEC.md

**Version:** 1.0.0
**Type:** MCP Server
**Company:** REZ-Intelligence
**Category:** AI Tools

---

## Overview

Model Context Protocol (MCP) server for REZ order management. Provides AI agents with tools to check order status, update orders, and manage order lifecycle.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ MCP Order Server                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: MCP (Model Context Protocol)                                    │
│  Transport: Stdio (for CLI integration)                                   │
│  Purpose: Order management and debugging                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_order_status` | Check order status |
| `update_order` | Update order details |
| `cancel_order` | Cancel an order |
| `get_order_history` | Get user order history |

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^0.5.0",
  "zod": "^3.22.4"
}
```

---

## Status

- [x] MCP server foundation
- [x] Order status
- [x] Order updates
- [x] Order cancellation
