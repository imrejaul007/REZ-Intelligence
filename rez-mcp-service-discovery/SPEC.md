# REZ MCP Service Discovery - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** MCP (Model Context Protocol)

---

## Overview

Model Context Protocol (MCP) server for REZ service discovery, health monitoring, and debugging. Enables AI agents to discover and interact with REZ services.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REZ MCP Service Discovery Server                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  MCP Protocol: Model Context Protocol v0.5.0                              │
│  Features:                                                                │
│  ├── Service Discovery  → Find services by capability                   │
│  ├── Health Monitoring → Check service status                           │
│  └── Debugging Tools   → Inspect service internals                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `discover_service` | Find services by name or capability |
| `check_health` | Check service health status |
| `get_service_info` | Get service metadata |
| `list_services` | List all registered services |

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

- [x] MCP foundation
- [ ] Service discovery tools
- [ ] Health monitoring
- [ ] Debugging capabilities
