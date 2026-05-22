# REZ Care - Complete Deployment Checklist
# Run this before every deployment to ensure nothing is missed

---

## Pre-Deployment Checklist

### 1. Code Changes Verified ✅

- [ ] All new services implemented
- [ ] All new routes added to index.ts
- [ ] All imports verified
- [ ] TypeScript compiles without errors
- [ ] No console.log or debug code left
- [ ] Environment variables documented

### 2. Integration Checklist

- [ ] Connected to RABTUL services
  - [ ] Auth Service (4002)
  - [ ] Wallet Service (4004)
  - [ ] Notifications (4011)
  - [ ] Profile Service (4013)
  - [ ] Event Bus (4025)

- [ ] Connected to REZ Intelligence
  - [ ] Intent Predictor (4018)
  - [ ] Predictive Engine (4123)
  - [ ] Signal Aggregator (4121)
  - [ ] Recommendation (4120)

- [ ] Connected to Ecosystem
  - [ ] REZ-memory-layer (4201)
  - [ ] REZ-unified-profile (4060)
  - [ ] REZ-workflow-builder (4045)
  - [ ] Vector Search (4127)

- [ ] Connected to WhatsApp
  - [ ] WhatsApp Business API
  - [ ] Webhook verification
  - [ ] Message templates

### 3. Files Checklist

#### Routes (add to index.ts)
- [ ] `import routeFile from './routes/routeFile'`
- [ ] `app.use('/api/route', routeFile)`

#### Services (add to index.ts)
- [ ] `import { ServiceClass } from './services/serviceFile'`
- [ ] `const service = new ServiceClass()`
- [ ] Initialize in startup function

#### Integrations (create new file)
- [ ] `src/integrations/serviceName.ts`
- [ ] Add service URLs from env vars
- [ ] Add type definitions
- [ ] Add error handling
- [ ] Add logging
- [ ] Add health check

### 4. Documentation Checklist

- [ ] SOT.md updated
  - [ ] Architecture diagram
  - [ ] New files listed
  - [ ] New API endpoints
  - [ ] Integration status
  - [ ] Environment variables

- [ ] README.md updated (if exists)
- [ ] PRIORITY-ROADMAP.md updated
- [ ] INTEGRATION-STATUS.md updated
- [ ] DEPLOYMENT-CHECKLIST.md updated

### 5. Mobile SDK Checklist (if applicable)

- [ ] `REZ-Consumer/REZ-App/src/services/support/rezCareClient.ts` updated
- [ ] New methods added
- [ ] API paths correct (`/api/mobile-sdk/...`)
- [ ] Types exported
- [ ] SupportScreen.tsx updated (if UI changes)

### 6. Build & Test

```bash
# Always run before deployment
cd REZ-Intelligence/REZ-care-service
npm run build
```

- [ ] TypeScript compiles
- [ ] No new warnings
- [ ] No breaking changes

---

## Integration Template

When adding a new service integration, use this template:

```typescript
// src/integrations/[SERVICE-NAME].ts

/**
 * [Service Name] Integration
 * 
 * Purpose: What does this service do?
 * Port: XXXX
 * Docs: URL to documentation
 */

// ============================================
// CONFIGURATION
// ============================================

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:XXXX';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

// ============================================
// TYPES
// ============================================

interface ServiceType {
  // Define types here
}

// ============================================
// CLIENT
// ============================================

class ServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: SERVICE_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
    });
  }

  async methodName(params): Promise<Result> {
    try {
      const response = await this.client.post('/api/endpoint', params);
      logger.info('[Service] Method succeeded', { params });
      return response.data;
    } catch (error: any) {
      logger.error('[Service] Method failed', { error: error.message });
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data?.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export const serviceClient = new ServiceClient();
export default serviceClient;
```

---

## Route Template

```typescript
// src/routes/[ROUTE-NAME].ts

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { serviceClient } from '../integrations/serviceClient';

const router = express.Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createSchema = z.object({
  // Define schema
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/route/health
 * Health check for this route's dependencies
 */
router.get('/health', async (req: Request, res: Response) => {
  const healthy = await serviceClient.healthCheck();
  res.json({ 
    success: true, 
    status: healthy ? 'healthy' : 'degraded' 
  });
});

/**
 * POST /api/route/action
 * Description
 */
router.post('/action', async (req: Request, res: Response) => {
  try {
    const parseResult = createSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed' 
      });
    }

    const result = await serviceClient.methodName(parseResult.data);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[Route] Action failed', error);
    res.status(500).json({ success: false, error: 'Action failed' });
  }
});

export default router;
```

---

## Adding to index.ts

```typescript
// 1. Add import
import routeNameRoutes from './routes/routeName';
import { serviceClient } from './integrations/serviceName';

// 2. Add service initialization (after imports)
const serviceClient = new ServiceClient();

// 3. Add route mounting (find the section)
// MOBILE SELF-SERVICE ROUTES section
app.use('/api/route', routeNameRoutes);

// 4. Add to health check (optional)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'REZ Care Service',
    version: '3.x.x',  // Update version
    integrates: [
      // Add new integration to list
    ],
  });
});
```

---

## Environment Variables Checklist

```bash
# RABTUL Services
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service.onrender.com
NOTIFICATIONS_SERVICE_URL=https://rez-notifications.onrender.com
PROFILE_SERVICE_URL=https://rez-profile-service.onrender.com

# REZ Intelligence
INTENT_SERVICE_URL=https://rez-intent-predictor.onrender.com
PREDICTIVE_ENGINE_URL=https://REZ-predictive-engine.onrender.com
SIGNAL_AGGREGATOR_URL=https://REZ-signal-aggregator.onrender.com
RECOMMENDATION_ENGINE_URL=https://REZ-recommendation-engine.onrender.com

# Ecosystem Services
REZ_MEMORY_URL=https://rez-memory-layer.onrender.com
REZ_UNIFIED_PROFILE_URL=https://rez-unified-profile.onrender.com
REZ_WORKFLOW_URL=https://rez-workflow-builder.onrender.com
VECTOR_SEARCH_URL=https://rez-vector-search.onrender.com

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# Security
INTERNAL_SERVICE_TOKEN=  # Generate with: openssl rand -hex 32

# Database
MONGODB_URI=mongodb+srv://...
```

---

## SOT.md Update Template

```markdown
### [Feature Name]

| Component | Status | Location |
|-----------|--------|----------|
| Service | ✅ Done | `src/services/serviceName.ts` |
| Routes | ✅ Done | `src/routes/routeName.ts` |
| Integration | ✅ Done | `src/integrations/integrationName.ts` |

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feature/health` | Health check |
| POST | `/api/feature/action` | Do action |

#### Usage

```typescript
import { client } from '../integrations/integrationName';

// Example usage
const result = await client.methodName(params);
```
```

---

## Render Blueprint Update

When adding new services to render.yaml:

```yaml
# ============================================
# NEW SERVICE
# ============================================
  - type: web
    name: rez-care-new-service
    env: node
    region: singapore
    plan: starter
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: XXXX
      - key: MONGODB_URI
        sync: false
      - key: INTERNAL_SERVICE_TOKEN
        generateValue: true
      - key: SERVICE_URL
        value: https://service.onrender.com
```

---

## Testing Checklist

### Local Testing
```bash
# Start service
npm run dev

# Test health
curl http://localhost:4058/health

# Test new endpoint
curl http://localhost:4058/api/route/action \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Test integration
curl http://localhost:XXXX/health
```

### Pre-Commit
- [ ] Build passes
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Tests pass (if exist)

---

## Deployment Checklist

1. [ ] All boxes checked in this document
2. [ ] SOT.md updated
3. [ ] npm run build succeeds
4. [ ] render.yaml updated (if needed)
5. [ ] Environment variables set in Render
6. [ ] Deploy via `render blueprint create`
7. [ ] Verify health endpoint after deploy
8. [ ] Test critical endpoints

---

## Post-Deployment Verification

```bash
# Check health
curl https://rez-care-service.onrender.com/health

# Check ecosystem health
curl https://rez-care-service.onrender.com/api/ecosystem/health

# Test ticket creation
curl https://rez-care-service.onrender.com/api/mobile-sdk/tickets \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "category": "test", "subject": "Test", "message": "Test"}'
```

---

Last Updated: May 22, 2026
