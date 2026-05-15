# REZ Identity Resolution MCP Server

MCP (Model Context Protocol) server for identity resolution across the REZ platform ecosystem.

## Features

- **Identity Resolution**: Resolve users by email, phone, or device ID
- **Unified Profiles**: Get consolidated user profiles across all REZ apps
- **Identity Linking**: Link multiple identities to a single user
- **Identity Graph**: View the complete linkage graph for a user
- **Related Users**: Find related users (same device, family members, etc.)

## Available Tools

### `resolve_identity`
Resolve a user identity by email, phone, or device ID.

**Parameters:**
- `identifier` (required): Email, phone number, or device ID
- `type` (optional): "email" | "phone" | "device"

### `get_unified_profile`
Get a unified user profile across all REZ applications.

**Parameters:**
- `userId` (required): The unified user ID

### `link_identities`
Link multiple identities to a single user.

**Parameters:**
- `userId` (required): Target user ID
- `identities` (required): Array of identities to link

### `get_identity_graph`
Get the complete identity linkage graph for a user.

**Parameters:**
- `userId` (required): The unified user ID

### `find_related_users`
Find users related to the given user (same device, family, etc.).

**Parameters:**
- `userId` (required): The unified user ID
- `relationshipType` (optional): "device" | "family" | "household" | "all"

## Installation

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Client (Claude)                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              REZ Identity Resolution MCP                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Tool Handlers (resolve, link, graph, etc.)    │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Identity Resolution Engine              │   │
│  │  - Deterministic matching (email, phone)         │   │
│  │  - Probabilistic matching (device, behavior)     │   │
│  │  - Graph traversal for relationships             │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Mock Identity Data Store              │   │
│  │  - Users, Identities, Links, Devices            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Identity Matching Strategies

1. **Deterministic Matching**: Exact matches on email, phone, device ID
2. **Probabilistic Matching**: Similar names, addresses, behavioral patterns
3. **Graph-based Matching**: Traverse identity graph for related users

## License

Internal - RABTUL Technologies
