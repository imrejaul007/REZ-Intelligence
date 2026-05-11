# REZ Intelligence Hub

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
