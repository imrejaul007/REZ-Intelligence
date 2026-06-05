# REZ Tenant Adapter

**Type:** Express.js + TypeScript  
**Status:** ✅ Production Ready  
**Company:** REZ-Intelligence

---

## Overview

Multi-tenant adapter layer handling 3 client types with strict isolation, JWT auth, and Express.

```
┌─────────────────────────────────────────────────────────────┐
│                    REZ TENANT ADAPTER                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Multi-tenant ──▶ Isolation ──▶ JWT Auth ──▶ Services     │
│                                                             │
│  Enterprise | SMB | Startup                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Client Types

| Type | Isolation | Features |
|------|-----------|----------|
| **Enterprise** | Full | Dedicated resources |
| **SMB** | Shared | Cost-optimized |
| **Startup** | Shared | Growth tier |

---

## Features

| Feature | Description |
|---------|-------------|
| **Tenant Isolation** | Strict data separation |
| **JWT Auth** | Secure authentication |
| **Multi-tenant** | 3 client types |
| **API Gateway** | Central entry point |

---

## Quick Start

```bash
cd REZ-Intelligence/REZ-tenant-adapter
npm install
npm run dev
```

---

## License

Internal REZ Service - All Rights Reserved
