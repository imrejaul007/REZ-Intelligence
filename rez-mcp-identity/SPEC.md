# REZ MCP Identity - SPEC.md

**Version:** 1.1.0
**Type:** MCP Server
**Company:** REZ-Intelligence
**Category:** AI Tools

---

## Overview

Model Context Protocol (MCP) server for REZ identity resolution. Provides AI agents with tools to look up user identities, resolve cross-platform identities, and manage identity linking.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ MCP Identity Server                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Protocol: MCP (Model Context Protocol)                                    │
│  Transport: Stdio (for CLI integration)                                   │
│  Purpose: Identity resolution and management                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `resolve_identity` | Resolve user by phone/email |
| `get_user_identities` | Get all linked identities |
| `link_identities` | Link two identities |
| `merge_identities` | Merge two user accounts |
| `get_identity_confidence` | Get match confidence score |

---

## Identity Resolution

| Signal Type | Weight | Description |
|-------------|--------|-------------|
| Email | 1.0 | Exact email match |
| Phone | 1.0 | Exact phone match |
| Device | 0.7 | Device fingerprint |
| Behavioral | 0.5 | Behavioral similarity |

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
| `IDENTITY_SERVICE_URL` | Identity service endpoint |
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
- [x] Identity resolution tools
- [x] Identity linking
- [x] Confidence scoring
