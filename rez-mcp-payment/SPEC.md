# REZ MCP Payment - SPEC.md

**Version:** 1.1.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** MCP (Model Context Protocol)

---

## Overview

Model Context Protocol (MCP) server for REZ payment debugging. Provides AI agents with tools to query and debug payment-related operations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REZ MCP Payment Server                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  MCP Protocol: Model Context Protocol v0.5.0                              │
│  Purpose: Enable AI agents to debug payment issues                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^0.5.0"
}
```

---

## Status

- [x] MCP foundation
- [ ] Payment debugging tools
- [ ] Transaction queries
- [ ] Error analysis
