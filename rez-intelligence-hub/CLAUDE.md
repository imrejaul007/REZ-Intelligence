# REZ Intelligence Hub

---

## Service Discovery

This service is registered in REZ-Master/services.json.

To discover related services:
```bash
# From REZ-Master directory
node rez-cli find <service-name>  # Find specific service
node rez-cli list --category <category>  # List by category
node rez-cli stats  # Platform statistics
```

Quick search:
- `node rez-cli list --search payment` - Find payment services
- `node rez-cli list --search auth` - Find auth services
- `node rez-cli list --search kds` - Find KDS services
- `node rez-cli list --search ai` - Find AI services

---



## Deployment Fixes

### Fix 1: tsconfig.json required
This service needs a tsconfig.json for TypeScript build.

### Fix 2: @types in dependencies
Move types from devDependencies to dependencies if build fails.

## Build & Deploy Commands

```bash
npm install && npm run build
node dist/index.js
```

## Port
- Production: 4020
- Health check: /health
