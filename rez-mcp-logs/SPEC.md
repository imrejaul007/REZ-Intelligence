# REZ MCP Logs - SPEC.md

**Version:** 1.0.0
**Type:** MCP Server
**Company:** REZ-Intelligence
**Category:** AI Tools

---

## Overview

Model Context Protocol (MCP) server for REZ log aggregation and analysis. Provides AI agents with tools to query, analyze, and debug application logs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ MCP Logs Server                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: MCP (Model Context Protocol)                                    │
│  Transport: Stdio (for CLI integration)                                   │
│  Purpose: Log analysis and debugging                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `query_logs` | Search logs by pattern |
| `get_error_summary` | Get error aggregations |
| `trace_request` | Trace request across services |
| `get_service_health` | Check service log health |

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^0.5.0"
}
```

---

## Status

- [x] MCP server foundation
- [x] Log querying
- [x] Error analysis
- [x] Request tracing
