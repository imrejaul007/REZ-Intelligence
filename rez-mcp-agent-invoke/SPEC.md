# REZ MCP Agent Invoke - SPEC.md

**Version:** 1.0.0
**Type:** MCP Server
**Company:** REZ-Intelligence
**Category:** AI Tools

---

## Overview

Model Context Protocol (MCP) server for invoking and testing REZ AI agents. Provides tools to call agent endpoints, debug responses, and test agent behavior.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                REZ MCP Agent Invoke Server                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: MCP (Model Context Protocol)                                    │
│  Transport: Stdio (for CLI integration)                                   │
│  Purpose: Agent invocation and testing                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `invoke_agent` | Call an AI agent |
| `test_intent` | Test intent resolution |
| `get_agent_status` | Check agent health |
| `trace_conversation` | Trace conversation flow |

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

## Status

- [x] MCP server foundation
- [x] Agent invocation
- [x] Intent testing
- [x] Status checking
