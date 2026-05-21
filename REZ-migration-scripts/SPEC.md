# REZ Migration Scripts - SPEC.md

**Version:** 1.0.0
**Type:** Migration Tool
**Company:** REZ-Intelligence
**Category:** Infrastructure

---

## Overview

Database migration utilities for REZ Intelligence services. Provides migration scripts for MongoDB schema changes and data migrations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  REZ Migration Scripts                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                               │
│  ├── Up Migration    → Apply schema changes                              │
│  ├── Down Migration → Rollback changes                                    │
│  └── Seed Data      → Initialize reference data                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Migrate | `npm run migrate` | Apply all pending migrations |
| Rollback | `npm run rollback` | Rollback last migration |

---

## Dependencies

```json
{
  "mongoose": "^8.0.0",
  "dotenv": "^16.3.1"
}
```

---

## Usage

```bash
# Run migrations
npm run migrate

# Rollback last migration
npm run rollback
```

---

## Status

- [x] Migration foundation
- [x] Up migrations
- [x] Rollback support
