# REZ-Intelligence 10/10 Quality Plan

**Target:** Achieve 10/10 score across all categories
**Current Score:** 5.6/10 overall
**Timeline:** 12 weeks (Quarter)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 1: Critical Security Fixes (Week 1-2)](#phase-1-critical-security-fixes-week-1-2)
3. [Phase 2: TypeScript 100% Adoption (Week 3-5)](#phase-2-typescript-100-adoption-week-3-5)
4. [Phase 3: Testing Coverage 100% (Week 5-7)](#phase-3-testing-coverage-100-week-5-7)
5. [Phase 4: Code Quality Refinement (Week 7-9)](#phase-4-code-quality-refinement-week-7-9)
6. [Phase 5: Documentation Complete (Week 9-10)](#phase-5-documentation-complete-week-9-10)
7. [Phase 6: Polish & Automation (Week 10-12)](#phase-6-polish--automation-week-10-12)
8. [Score Tracking Dashboard](#score-tracking-dashboard)

---

## Executive Summary

### Current State vs Target

| Category | Current | Target | Gap |
|----------|---------|--------|-----|
| Code Quality | 6/10 | 10/10 | -4 |
| TypeScript Adoption | 5/10 | 10/10 | -5 |
| Security | 5/10 | 10/10 | -5 |
| Testing | 3/10 | 10/10 | -7 |
| Documentation | 7/10 | 10/10 | -3 |
| Error Handling | 6/10 | 10/10 | -4 |
| Input Validation | 6/10 | 10/10 | -4 |
| Configuration | 7/10 | 10/10 | -3 |

### Services by Priority

| Priority | Services | Count | Actions Required |
|----------|---------|-------|------------------|
| **CRITICAL** | `REZ-flywheel-mvp`, `REZ-api-keys`, `REZ-identity-bridge`, `REZ-autonomous-agents` | 4 | Immediate TypeScript + Tests |
| **HIGH** | `REZ-ai-router`, `REZ-error-intelligence`, `REZ-creative-engine`, `REZ-flywheel-mvp` | 4 | TypeScript + Validation |
| **MEDIUM** | All other TypeScript services | ~52 | Polish, Tests, Docs |

### Resource Requirements

| Resource | Quantity | Allocation |
|----------|----------|------------|
| Engineers | 3 | Full-time for 12 weeks |
| Reviewers | 1 | Part-time |
| DevOps | 0.5 | Part-time |

---

## Phase 1: Critical Security Fixes (Week 1-2)

**Goal:** Security score 5 → 9/10
**Owner:** Security Team + Backend Engineers

### 1.1 Remove Exposed Secrets (CRITICAL)

#### Step 1.1.1: Identify All .env Files
```bash
find REZ-Intelligence -name ".env" -type f 2>/dev/null
```

**Found:** 11 files with exposed secrets

#### Step 1.1.2: Immediate Actions

| File | Action | Priority |
|------|--------|----------|
| `REZ-recommendation-engine/.env` | DELETE + ROTATE MongoDB creds | CRITICAL |
| `rez-orchestrator-v2/.env` | DELETE + ROTATE | CRITICAL |
| `rez-channel-orchestrator/.env` | DELETE + ROTATE | CRITICAL |
| `REZ-support-copilot/.env` | DELETE + ROTATE | CRITICAL |
| `rez-web-widget/.env` | DELETE + ROTATE | HIGH |
| `rez-hospitality-expert/.env` | DELETE + ROTATE | HIGH |
| `rez-core-brain/.env` | DELETE + ROTATE | HIGH |
| `rez-app-bridge/.env` | DELETE + ROTATE | HIGH |
| `rez-intent-predictor/.env` | DELETE + ROTATE | HIGH |
| `rez-rcs-bridge/.env` | DELETE + ROTATE | MEDIUM |
| `REZ-sms-bridge/.env` | DELETE + ROTATE | MEDIUM |

#### Step 1.1.3: Git History Cleanup
```bash
# WARNING: Destructive operation - backup first
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch REZ-*/.env' \
  --prune-empty --tag-name-filter cat -- --all
```

#### Step 1.1.4: Add to .gitignore
```bash
# Create/update root .gitignore
cat >> REZ-Intelligence/.gitignore << 'EOF'
# Environment files
.env
.env.local
.env.*.local
.env.production
.env.staging

# Never commit .env files
**/.env
**/.env.local
**/.env.*.local

# Credential files
**/credentials.json
**/service-account.json
**/*.pem
**/*.key

# Secrets
**/secrets.yml
**/secrets.yaml
EOF
```

### 1.2 Implement Secrets Manager

#### Step 1.2.1: Choose Solution

| Option | Pros | Cons | Recommendation |
|--------|------|------|-----------------|
| AWS Secrets Manager | Managed, IAM integration | Vendor lock-in | For AWS deployments |
| HashiCorp Vault | Self-hosted, flexible | Operational overhead | For multi-cloud |
| Doppler | Developer-friendly, GitOps | Subscription cost | For development |
| Environment variables | Simple | Manual rotation | Temporary |

**Recommendation:** HashiCorp Vault for production, Doppler for development

#### Step 1.2.2: Vault Configuration
```bash
# Install Vault
brew install vault

# Start dev server
vault server -dev

# Configure secrets engine
vault secrets enable -path=rez-intelligence kv-v2

# Add secrets
vault kv put rez-intelligence/dev/mongodb \
  uri="mongodb+srv://user:pass@cluster.mongodb.net"

vault kv put rez-intelligence/prod/mongodb \
  uri="mongodb+srv://user:prod@cluster.mongodb.net"
```

#### Step 1.2.3: Service Integration
```typescript
// src/config/vault.ts
import Vault from 'node-vault';

interface VaultConfig {
  endpoint: string;
  token: string;
  prefix: string;
}

class VaultManager {
  private client: Vault.client;
  private cache: Map<string, { value: string; expiry: number }>;

  constructor(config: VaultConfig) {
    this.client = Vault({ endpoint: config.endpoint, token: config.token });
    this.cache = new Map();
  }

  async get(secret: string, key: string): Promise<string> {
    const cacheKey = `${secret}/${key}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    const result = await this.client.kv.read(`${this['prefix']}/${secret}`);
    const value = result.data.data[key];

    // Cache for 5 minutes
    this.cache.set(cacheKey, { value, expiry: Date.now() + 300000 });

    return value;
  }

  async getAll(secret: string): Promise<Record<string, string>> {
    const result = await this.client.kv.read(`${this['prefix']}/${secret}`);
    return result.data.data;
  }
}

export const vault = new VaultManager({
  endpoint: process.env.VAULT_ADDR!,
  token: process.env.VAULT_TOKEN!,
  prefix: 'rez-intelligence/dev'
});
```

### 1.3 Fix CORS Configuration

#### Step 1.3.1: Identify All CORS Issues
```bash
grep -r "origin.*\*" REZ-Intelligence --include="*.ts" --include="*.js"
```

#### Step 1.3.2: Fix All CORS Configurations
```typescript
// src/config/cors.ts - Standardized CORS configuration
import { z } from 'zod';

const CorsConfigSchema = z.object({
  allowedOrigins: z.array(z.string().url()).min(1),
  allowedMethods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  allowedHeaders: z.array(z.string()).default(['Content-Type', 'Authorization', 'X-Internal-Token']),
  exposedHeaders: z.array(z.string()).default(['X-Request-Id', 'X-RateLimit-Remaining']),
  credentials: z.boolean().default(true),
  maxAge: z.number().default(86400),
});

type CorsConfig = z.infer<typeof CorsConfigSchema>;

export function createCorsMiddleware(config: CorsConfig) {
  const validatedConfig = CorsConfigSchema.parse(config);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (!origin) {
      return next();
    }

    // Validate origin against whitelist
    const isAllowed = validatedConfig.allowedOrigins.some(allowedOrigin => {
      // Support wildcard subdomains
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin
          .replace('.', '\\.')
          .replace('*', '[^.]+');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return origin === allowedOrigin;
    });

    if (!isAllowed) {
      return res.status(403).json({
        error: 'CORS policy violation',
        message: `Origin ${origin} not allowed`
      });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', validatedConfig.allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', validatedConfig.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', validatedConfig.exposedHeaders.join(', '));
    res.setHeader('Access-Control-Allow-Credentials', String(validatedConfig.credentials));
    res.setHeader('Access-Control-Max-Age', String(validatedConfig.maxAge));

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  };
}
```

#### Step 1.3.3: Service-Specific Fixes

**REZ-research-opportunity-agent:**
```typescript
// BEFORE (DANGEROUS)
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));

// AFTER (SECURE)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true
}));
```

### 1.4 Implement Authentication Middleware

#### Step 1.4.1: Standardized Auth Middleware
```typescript
// packages/rez-security-middleware/src/index.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface AuthConfig {
  tokenHeader: string;
  requiredEnvVars: string[];
  allowPublicRoutes?: RegExp[];
}

export class AuthMiddleware {
  private config: Required<AuthConfig>;

  constructor(config: AuthConfig) {
    this.config = {
      ...config,
      requiredEnvVars: config.requiredEnvVars,
      allowPublicRoutes: config.allowPublicRoutes || []
    };

    this.validateEnvVars();
  }

  private validateEnvVars(): void {
    const missing = this.config.requiredEnvVars.filter(
      env => !process.env[env]
    );

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    try {
      return crypto.timingSafeEqual(
        Buffer.from(a),
        Buffer.from(b)
      );
    } catch {
      return false;
    }
  }

  private isPublicRoute(path: string): boolean {
    return this.config.allowPublicRoutes.some(pattern => pattern.test(path));
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Skip public routes
      if (this.isPublicRoute(req.path)) {
        return next();
      }

      const token = req.headers[this.config.tokenHeader.toLowerCase()] as string;

      if (!token) {
        res.status(401).json({
          error: 'Unauthorized',
          message: `${this.config.tokenHeader} header required`
        });
        return;
      }

      const validToken = process.env.INTERNAL_SERVICE_TOKEN!;

      if (!this.timingSafeEqual(token, validToken)) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token'
        });
        return;
      }

      next();
    };
  }
}

// Factory function for quick setup
export function createAuthMiddleware(options?: Partial<AuthConfig>) {
  return new AuthMiddleware({
    tokenHeader: 'x-internal-token',
    requiredEnvVars: ['INTERNAL_SERVICE_TOKEN'],
    allowPublicRoutes: [/^\/health$/, /^\/ready$/, /^\/metrics$/],
    ...options
  }).middleware();
}
```

#### Step 1.4.2: Update All Services
```typescript
// Apply to each service's index.ts
import { createAuthMiddleware } from '@rez/security-middleware';

const auth = createAuthMiddleware();

app.use('/api', auth);
app.use('/admin', auth);
```

### 1.5 Security Checklist

| Check | Status | Target |
|-------|--------|--------|
| All .env files removed from repo | ❌ | ✅ |
| Secrets rotated | ❌ | ✅ |
| .gitignore updated | ❌ | ✅ |
| CORS properly configured | ❌ | ✅ |
| Auth middleware standardized | ❌ | ✅ |
| Rate limiting enabled | ⚠️ | ✅ |
| Helmet.js configured | ⚠️ | ✅ |
| Input validation on all endpoints | ⚠️ | ✅ |
| Security headers set | ⚠️ | ✅ |
| Audit logging enabled | ❌ | ✅ |

---

## Phase 2: TypeScript 100% Adoption (Week 3-5)

**Goal:** TypeScript score 5 → 10/10
**Owner:** Backend Team

### 2.1 JavaScript Services Inventory

| Service | Files | Complexity | Migration Effort |
|---------|-------|------------|------------------|
| `REZ-flywheel-mvp` | 1 | Low | 1 day |
| `REZ-api-keys` | 1 | Medium | 2 days |
| `REZ-identity-bridge` | 1 | Medium | 2 days |
| `REZ-autonomous-agents` | 1 | High | 3 days |
| `REZ-error-intelligence` | 1 | Medium | 2 days |
| `REZ-ai-router` | 1 | High | 3 days |
| `REZ-creative-engine` | 5 | High | 5 days |
| `REZ-flywheel-mvp` | 1 | Low | 1 day |
| `REZ-error-intelligence` | 1 | Medium | 2 days |

**Total Effort:** ~21 person-days

### 2.2 Migration Template

#### Step 2.2.1: Create TypeScript Base Configuration
```json
// packages/REZ-service-template/tsconfig.json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

#### Step 2.2.2: Create Package Template
```json
// packages/REZ-service-template/package.json
{
  "name": "@rez/[service-name]",
  "version": "1.0.0",
  "description": "REZ [Service Description]",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/**/*.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "zod": "^3.22.4",
    "mongoose": "^8.0.0",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.10.0",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.3",
    "tsx": "^4.6.0",
    "vitest": "^1.1.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "eslint": "^8.54.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 2.3 Service Migration Examples

#### Example 1: REZ-api-keys Migration

**BEFORE (JavaScript):**
```javascript
// src/index.js
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const Schema = mongoose.Schema;
const ApiKeySchema = new Schema({
  key: String,
  name: String,
  permissions: [String],
  rateLimit: Number,
  createdAt: Date,
  lastUsed: Date
});

const ApiKey = mongoose.model('ApiKey', ApiKeySchema);

app.post('/api/keys', async (req, res) => {
  const { name, permissions, rateLimit } = req.body;
  const key = 'rez_' + crypto.randomBytes(16).toString('hex');
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = new ApiKey({
    key: hashedKey,
    name,
    permissions,
    rateLimit: rateLimit || 100,
    createdAt: new Date()
  });

  await apiKey.save();
  res.json({ key, id: apiKey._id });
});

mongoose.connect(process.env.MONGODB_URI);
app.listen(4096);
```

**AFTER (TypeScript):**
```typescript
// src/index.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';
import { z } from 'zod';
import helmet from 'helmet';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';
import { createAuthMiddleware } from '@rez/security-middleware';

// ============================================
// Types
// ============================================

interface IApiKey extends Document {
  keyHash: string;
  keyPrefix: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  createdAt: Date;
  lastUsed: Date | null;
  isActive: boolean;
}

interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  rateLimit?: number;
}

interface CreateApiKeyResponse {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  rateLimit: number;
  createdAt: Date;
}

// ============================================
// Validation Schemas
// ============================================

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string().min(1)).min(1),
  rateLimit: z.number().int().positive().max(10000).optional().default(100),
});

const ApiKeySchema = new Schema<IApiKey>({
  keyHash: { type: String, required: true, unique: true, index: true },
  keyPrefix: { type: String, required: true },
  name: { type: String, required: true },
  permissions: { type: [String], required: true },
  rateLimit: { type: Number, required: true, default: 100 },
  createdAt: { type: Date, required: true, default: Date.now },
  lastUsed: { type: Date, default: null },
  isActive: { type: Boolean, required: true, default: true },
});

// ============================================
// Model
// ============================================

const ApiKeyModel: Model<IApiKey> = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

// ============================================
// Service
// ============================================

class ApiKeyService {
  async createKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    const validated = CreateApiKeySchema.parse(data);

    const rawKey = `rez_${crypto.randomBytes(16).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = new ApiKeyModel({
      keyHash,
      keyPrefix,
      name: validated.name,
      permissions: validated.permissions,
      rateLimit: validated.rateLimit,
      createdAt: new Date(),
    });

    await apiKey.save();

    logger.info('API key created', { keyId: apiKey._id, name: validated.name });

    return {
      id: apiKey._id.toString(),
      key: rawKey,
      name: apiKey.name,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      createdAt: apiKey.createdAt,
    };
  }

  async validateKey(rawKey: string): Promise<IApiKey | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await ApiKeyModel.findOne({ keyHash, isActive: true });

    if (apiKey) {
      apiKey.lastUsed = new Date();
      await apiKey.save();
    }

    return apiKey;
  }

  async revokeKey(keyId: string): Promise<boolean> {
    const result = await ApiKeyModel.updateOne(
      { _id: keyId },
      { $set: { isActive: false } }
    );

    return result.modifiedCount > 0;
  }
}

// ============================================
// Express App
// ============================================

const app: Express = express();
const apiKeyService = new ApiKeyService();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Request ID
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = uuidv4();
  next();
});

// Auth middleware
app.use(createAuthMiddleware());

// Health check (public)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.post('/api/keys', async (req: Request, res: Response) => {
  try {
    const result = await apiKeyService.createKey(req.body as CreateApiKeyRequest);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    logger.error('Failed to create API key', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/keys/:id', async (req: Request, res: Response) => {
  try {
    const success = await apiKeyService.revokeKey(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to revoke API key', { error, keyId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err, stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================
// Startup
// ============================================

const PORT = parseInt(process.env.PORT || '4096', 10);

async function start(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is required');
    }

    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`API Keys service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start service', { error });
    process.exit(1);
  }
}

start();

export { ApiKeyService, CreateApiKeyRequest, CreateApiKeyResponse };
```

### 2.4 Migration Progress Tracker

| Service | Status | Started | Completed | Reviewer |
|---------|--------|---------|-----------|----------|
| `REZ-flywheel-mvp` | Pending | - | - | - |
| `REZ-api-keys` | Pending | - | - | - |
| `REZ-identity-bridge` | Pending | - | - | - |
| `REZ-autonomous-agents` | Pending | - | - | - |
| `REZ-error-intelligence` | Pending | - | - | - |
| `REZ-ai-router` | Pending | - | - | - |
| `REZ-creative-engine` | Pending | - | - | - |

### 2.5 TypeScript Checklist

| Check | Status | Target |
|-------|--------|--------|
| All services use TypeScript | ❌ | ✅ |
| Strict mode enabled | ⚠️ | ✅ |
| No `any` types | ❌ | ✅ |
| All types exported | ❌ | ✅ |
| Zod schemas for validation | ❌ | ✅ |
| TypeScript errors: 0 | ❌ | ✅ |
| Declaration files generated | ❌ | ✅ |

---

## Phase 3: Testing Coverage 100% (Week 5-7)

**Goal:** Testing score 3 → 10/10
**Owner:** QA Team + Backend Engineers

### 3.1 Testing Infrastructure

#### Step 3.1.1: Configure Vitest (All Services)
```typescript
// vitest.config.ts - Standard test configuration
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/tests/**',
        '**/__tests__/**',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/*': path.resolve(__dirname, './src/*'),
    },
  },
});
```

#### Step 3.1.2: Test Setup File
```typescript
// src/tests/setup.ts
import { vi } from 'vitest';
import mongoose from 'mongoose';

// Mock environment
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('LOG_LEVEL', 'error');

// Mock MongoDB connection
vi.mock('../utils/mongodb.js', () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
}));

// Mock Redis
vi.mock('ioredis', () => {
  return vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  }));
});

// Global test timeout
vi.setConfig({ testTimeout: 10000 });

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
```

### 3.2 Testing Patterns by Service Type

#### Pattern 1: API Routes Testing
```typescript
// src/routes/experiment.routes.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { experimentRoutes } from './experiment.routes.js';
import { ExperimentService } from '../services/experiment.service.js';

describe('Experiment Routes', () => {
  let app: Express;
  let experimentService: ExperimentService;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/experiments', experimentRoutes(experimentService));
  });

  afterAll(() => {
    // Cleanup
  });

  describe('POST /api/experiments', () => {
    it('should create experiment with valid data', async () => {
      const validPayload = {
        name: 'Test Experiment',
        description: 'A/B test for checkout button',
        variants: [
          { name: 'Control', weight: 50 },
          { name: 'Variant A', weight: 50 },
        ],
        targeting: {
          userSegments: ['all'],
        },
      };

      const response = await request(app)
        .post('/api/experiments')
        .send(validPayload)
        .expect(201);

      expect(response.body).toMatchObject({
        name: validPayload.name,
        status: 'draft',
      });
      expect(response.body.id).toBeDefined();
    });

    it('should return 400 for invalid payload', async () => {
      const invalidPayload = {
        name: '', // Empty name
        variants: [], // No variants
      };

      const response = await request(app)
        .post('/api/experiments')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .post('/api/experiments')
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('GET /api/experiments/:id', () => {
    it('should return experiment by ID', async () => {
      const experiment = await experimentService.create({
        name: 'Fetch Test',
        variants: [{ name: 'Control', weight: 100 }],
      });

      const response = await request(app)
        .get(`/api/experiments/${experiment.id}`)
        .expect(200);

      expect(response.body.id).toBe(experiment.id);
    });

    it('should return 404 for non-existent experiment', async () => {
      await request(app)
        .get('/api/experiments/non-existent-id')
        .expect(404);
    });
  });
});
```

#### Pattern 2: Service Unit Testing
```typescript
// src/services/experiment.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExperimentService } from './experiment.service.js';
import { ExperimentRepository } from '../repositories/experiment.repository.js';
import { AssignmentService } from './assignment.service.js';
import { ExperimentStatus } from '../types/experiment.types.js';

describe('ExperimentService', () => {
  let experimentService: ExperimentService;
  let mockRepository: Partial<ExperimentRepository>;
  let mockAssignmentService: Partial<AssignmentService>;

  beforeEach(() => {
    mockRepository = {
      create: vi.fn().mockImplementation((data) => ({
        id: 'exp_' + Math.random().toString(36).substr(2, 9),
        ...data,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findById: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockAssignmentService = {
      assignUser: vi.fn().mockReturnValue('Control'),
      getAssignment: vi.fn(),
    };

    experimentService = new ExperimentService(
      mockRepository as ExperimentRepository,
      mockAssignmentService as AssignmentService
    );
  });

  describe('create()', () => {
    it('should create experiment with normalized weights', () => {
      const dto = {
        name: 'Weight Test',
        variants: [
          { name: 'A', weight: 25 },
          { name: 'B', weight: 75 },
        ],
      };

      const experiment = experimentService.create(dto);

      expect(experiment.status).toBe(ExperimentStatus.DRAFT);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dto.name,
          variants: expect.arrayContaining([
            expect.objectContaining({ weight: 25 }),
            expect.objectContaining({ weight: 75 }),
          ]),
        })
      );
    });

    it('should reject negative weights', () => {
      const dto = {
        name: 'Invalid',
        variants: [{ name: 'A', weight: -10 }],
      };

      expect(() => experimentService.create(dto)).toThrow('Weight must be positive');
    });

    it('should reject non-100 total weights', () => {
      const dto = {
        name: 'Invalid',
        variants: [
          { name: 'A', weight: 30 },
          { name: 'B', weight: 30 }, // Total: 60, not 100
        ],
      };

      expect(() => experimentService.create(dto)).toThrow('Weights must sum to 100');
    });
  });

  describe('activate()', () => {
    it('should activate draft experiment', async () => {
      const experiment = {
        id: 'exp_123',
        status: ExperimentStatus.DRAFT,
      };

      mockRepository.findById!.mockResolvedValue(experiment);
      mockRepository.update!.mockResolvedValue({
        ...experiment,
        status: ExperimentStatus.ACTIVE,
      });

      const result = await experimentService.activate('exp_123');

      expect(result.status).toBe(ExperimentStatus.ACTIVE);
      expect(mockAssignmentService.assignUser).toHaveBeenCalled();
    });

    it('should throw for non-existent experiment', async () => {
      mockRepository.findById!.mockResolvedValue(null);

      await expect(experimentService.activate('non-existent')).rejects.toThrow(
        'Experiment not found'
      );
    });
  });
});
```

#### Pattern 3: Integration Testing
```typescript
// src/tests/integration/experiment.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../app.js';
import { Experiment, IExperiment } from '../../models/experiment.model.js';

describe('Experiment Integration Tests', () => {
  let app: Express;
  let authToken: string;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI?.replace('/test', '/test_experiments');
    await mongoose.connect(mongoUri!);

    app = createApp();
    authToken = process.env.TEST_AUTH_TOKEN!;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Experiment.deleteMany({});
  });

  describe('Full CRUD Flow', () => {
    it('should complete full experiment lifecycle', async () => {
      // 1. Create
      const createResponse = await request(app)
        .post('/api/experiments')
        .set('X-Internal-Token', authToken)
        .send({
          name: 'Integration Test Experiment',
          description: 'Testing full CRUD',
          variants: [
            { name: 'Control', weight: 50 },
            { name: 'Variant A', weight: 50 },
          ],
        })
        .expect(201);

      const experimentId = createResponse.body.id;

      // 2. Read
      const readResponse = await request(app)
        .get(`/api/experiments/${experimentId}`)
        .set('X-Internal-Token', authToken)
        .expect(200);

      expect(readResponse.body.name).toBe('Integration Test Experiment');

      // 3. Update
      const updateResponse = await request(app)
        .patch(`/api/experiments/${experimentId}`)
        .set('X-Internal-Token', authToken)
        .send({
          name: 'Updated Name',
        })
        .expect(200);

      expect(updateResponse.body.name).toBe('Updated Name');

      // 4. Delete
      await request(app)
        .delete(`/api/experiments/${experimentId}`)
        .set('X-Internal-Token', authToken)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/experiments/${experimentId}`)
        .set('X-Internal-Token', authToken)
        .expect(404);
    });
  });
});
```

#### Pattern 4: Mock External Services
```typescript
// src/tests/mocks/ai-client.mock.ts
import { vi } from 'vitest';

export const mockAiClient = {
  complete: vi.fn().mockResolvedValue({
    content: 'Generated text response',
    usage: { tokens: 50 },
    model: 'claude-3-sonnet',
  }),
  embed: vi.fn().mockResolvedValue(
    new Array(1536).fill(0).map(() => Math.random() - 0.5)
  ),
  chat: vi.fn().mockResolvedValue({
    message: 'Chat response',
    finishReason: 'stop',
  }),
};

export const createMockAiClient = () => mockAiClient;

// Reset all mocks
export const resetAiClientMocks = () => {
  mockAiClient.complete.mockClear();
  mockAiClient.embed.mockClear();
  mockAiClient.chat.mockClear();
};
```

### 3.3 Coverage Requirements by Service Type

| Service Type | Min Coverage | Critical Paths |
|-------------|---------------|----------------|
| API Services | 80% | All routes, controllers |
| ML Services | 70% | Inference, preprocessing |
| Worker Services | 75% | Job processing, error handling |
| Libraries | 90% | All exported functions |
| Security Services | 95% | Auth, encryption |

### 3.4 Testing Checklist

| Check | Status | Target |
|-------|--------|--------|
| Unit tests: all services | ❌ | ✅ |
| Integration tests: all services | ❌ | ✅ |
| E2E tests: critical flows | ❌ | ✅ |
| Coverage reports generated | ❌ | ✅ |
| Coverage thresholds enforced | ❌ | ✅ |
| CI/CD test gates | ❌ | ✅ |
| Test coverage: 80%+ | ❌ | ✅ |

---

## Phase 4: Code Quality Refinement (Week 7-9)

**Goal:** Code Quality score 6 → 10/10
**Owner:** All Engineers

### 4.1 ESLint Configuration

```javascript
// eslint.config.js - Root configuration
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Imports
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],
      'import/no-unresolved': 'error',
      'import/named': 'error',

      // Best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': 'error',
      'curly': 'error',

      // Security
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.test.ts'],
  },
];
```

### 4.2 Prettier Configuration

```javascript
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 4.3 Pre-commit Hooks

```yaml
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit checks..."

# Type check
echo "Running TypeScript..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "TypeScript check failed!"
  exit 1
fi

# Lint
echo "Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
  echo "Lint failed!"
  exit 1
fi

# Test
echo "Running tests..."
npm run test
if [ $? -ne 0 ]; then
  echo "Tests failed!"
  exit 1
fi

echo "All pre-commit checks passed!"
```

### 4.4 Code Quality Metrics

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| TypeScript errors | Varies | 0 | tsc |
| ESLint errors | Varies | 0 | eslint |
| Code coverage | <50% | >80% | vitest |
| Duplicate code | High | 0% | jscpd |
| Cyclomatic complexity | High | <10 | sonarqube |
| Technical debt | High | Low | sonarqube |

### 4.5 Shared Packages

#### Step 4.5.1: Create Shared Types Package
```typescript
// packages/rez-shared-types/src/index.ts

// ============================================
// Common Types
// ============================================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// API Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  dependencies: DependencyHealth[];
}

export interface DependencyHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  error?: string;
}

// ============================================
// Event Types
// ============================================

export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  version: string;
}

export interface UserEvent extends BaseEvent {
  userId: string;
  sessionId?: string;
  properties: Record<string, unknown>;
}

// ============================================
// Validation
// ============================================

import { z } from 'zod';

export const PaginationParamsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const BaseEntitySchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

#### Step 4.5.2: Create Logger Package
```typescript
// packages/rez-logger/src/index.ts
import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<Map<string, unknown>>();

// Custom format with request context
const requestFormat = winston.format((info) => {
  const context = asyncLocalStorage.getStore();
  if (context) {
    return {
      ...info,
      requestId: context.get('requestId'),
      userId: context.get('userId'),
      sessionId: context.get('sessionId'),
    };
  }
  return info;
});

const structuredFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...meta,
  });
});

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LoggerConfig {
  service: string;
  level?: LogLevel;
  prettyPrint?: boolean;
}

export function createLogger(config: LoggerConfig): winston.Logger {
  const formats = [
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    requestFormat(),
    winston.format.errors({ stack: true }),
  ];

  if (config.prettyPrint) {
    formats.push(winston.format.prettyPrint());
  } else {
    formats.push(structuredFormat);
  }

  return winston.createLogger({
    level: config.level || 'info',
    format: winston.format.combine(...formats),
    defaultMeta: { service: config.service },
    transports: [
      new winston.transports.Console(),
    ],
  });
}

// Context management
export function withContext<T>(
  context: Record<string, unknown>,
  fn: () => T
): T {
  return asyncLocalStorage.run(new Map(Object.entries(context)), fn);
}

export function getContext(key: string): unknown {
  const store = asyncLocalStorage.getStore();
  return store?.get(key);
}

// Logger factory
const loggers = new Map<string, winston.Logger>();

export function getLogger(service: string): winston.Logger {
  if (!loggers.has(service)) {
    loggers.set(
      service,
      createLogger({
        service,
        level: (process.env.LOG_LEVEL as LogLevel) || 'info',
        prettyPrint: process.env.NODE_ENV !== 'production',
      })
    );
  }
  return loggers.get(service)!;
}
```

### 4.6 Code Quality Checklist

| Check | Status | Target |
|-------|--------|--------|
| ESLint: 0 errors | ❌ | ✅ |
| TypeScript: 0 errors | ❌ | ✅ |
| Prettier: consistent | ❌ | ✅ |
| Pre-commit hooks: active | ❌ | ✅ |
| No `any` types | ❌ | ✅ |
| No `console.log` | ❌ | ✅ |
| Proper error handling | ❌ | ✅ |
| Async/await used | ❌ | ✅ |
| No magic numbers | ❌ | ✅ |

---

## Phase 5: Documentation Complete (Week 9-10)

**Goal:** Documentation score 7 → 10/10
**Owner:** Technical Writers + Engineers

### 5.1 Documentation Standards

#### Step 5.1.1: Service README Template
```markdown
# [Service Name]

[Brief description of what this service does]

## Overview

[2-3 sentence overview of the service's role in the system]

## Architecture

[Include a simple diagram showing service boundaries]

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | 3000 | Service port |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `REDIS_URL` | No | localhost:6379 | Redis connection string |
| `LOG_LEVEL` | No | info | Logging level |

## API Reference

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### [Endpoint Name]

```
POST /api/[resource]
```

Request:
```json
{
  "field1": "value1",
  "field2": 123
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "resource_123",
    "field1": "value1"
  }
}
```

## Development

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+ (optional)

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript check |

## Testing

[Describe testing approach]

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

## Deployment

[Deployment instructions]

## Monitoring

[How to monitor this service]

## Troubleshooting

[Common issues and solutions]

## License

MIT
```

### 5.2 API Documentation

#### OpenAPI 3.0 Template
```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: [Service Name] API
  description: API for [Service Name]
  version: 1.0.0
  contact:
    name: REZ Engineering
    email: engineering@rezapp.com

servers:
  - url: http://localhost:{port}
    description: Local development
    variables:
      port:
        default: "3000"
  - url: https://api.rezapp.com/{basePath}
    description: Production
    variables:
      basePath:
        default: "v1"

paths:
  /health:
    get:
      summary: Health check
      operationId: getHealth
      tags:
        - System
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /api/[resource]:
    post:
      summary: Create [resource]
      operationId: create[Resource]
      tags:
        - [Resource]
      security:
        - InternalToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Create[Resource]Request'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/[Resource]Response'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  securitySchemes:
    InternalToken:
      type: apiKey
      in: header
      name: X-Internal-Token
      description: Internal service authentication token

  schemas:
    HealthResponse:
      type: object
      required:
        - status
        - timestamp
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        timestamp:
          type: string
          format: date-time

    Create[Resource]Request:
      type: object
      required:
        - name
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100

    [Resource]Response:
      allOf:
        - $ref: '#/components/schemas/Create[Resource]Request'
        - type: object
          properties:
            id:
              type: string
            createdAt:
              type: string
              format: date-time

    Error:
      type: object
      required:
        - error
        - message
      properties:
        error:
          type: string
        message:
          type: string
        details:
          type: object

  responses:
    ValidationError:
      description: Validation failed
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
```

### 5.3 Documentation Checklist

| Check | Status | Target |
|-------|--------|--------|
| README: all services | ❌ | ✅ |
| API docs (OpenAPI) | ❌ | ✅ |
| JSDoc: all functions | ❌ | ✅ |
| TypeDoc: all types | ❌ | ✅ |
| Architecture diagrams | ❌ | ✅ |
| Deployment guides | ❌ | ✅ |
| Troubleshooting guides | ❌ | ✅ |

---

## Phase 6: Polish & Automation (Week 10-12)

**Goal:** All scores 10/10
**Owner:** DevOps + Engineering

### 6.1 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  quality-checks:
    name: Quality Checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: quality-checks
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
      redis:
        image: redis:7
        ports:
          - 6379:6379
    env:
      MONGODB_URI: mongodb://localhost:27017/test
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
          thresholds: '80%'

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: [quality-checks, test]
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "Deploying..."
          # Add deployment commands
```

### 6.2 Deployment Configuration

```yaml
# docker-compose.yml - Production
version: '3.8'

services:
  rez-intelligence-api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=${REDIS_URL}
      - VAULT_ADDR=${VAULT_ADDR}
      - VAULT_TOKEN=${VAULT_TOKEN}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  # Health monitoring
  health-monitor:
    image: prometheus/node-exporter
    ports:
      - "9100:9100"
```

### 6.3 Monitoring Setup

```typescript
// src/monitoring/index.ts
import { getLogger } from '@rez/logger';
import client from 'prom-client';

const logger = getLogger('monitoring');

// Metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 10],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

// Collect default metrics
client.collectDefaultMetrics();

export { httpRequestDuration, httpRequestTotal, activeConnections };

// Metrics endpoint
export function metricsEndpoint() {
  return async (_req: Request, res: Response) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  };
}
```

---

## Score Tracking Dashboard

### Current vs Target

| Week | Security | TypeScript | Testing | Code Quality | Documentation | Error Handling | Validation | Config | Overall |
|------|----------|------------|---------|--------------|---------------|----------------|------------|--------|---------|
| 0 (Now) | 5 | 5 | 3 | 6 | 7 | 6 | 6 | 7 | 5.6 |
| 2 | 9 | 5 | 3 | 6 | 7 | 7 | 7 | 8 | 6.5 |
| 5 | 9 | 8 | 5 | 7 | 8 | 8 | 8 | 8 | 7.6 |
| 7 | 10 | 9 | 7 | 8 | 8 | 9 | 9 | 9 | 8.6 |
| 9 | 10 | 10 | 9 | 9 | 9 | 9 | 9 | 9 | 9.3 |
| 12 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | **10.0** |

### Definition of 10/10

| Category | 10/10 Criteria |
|----------|----------------|
| **Security** | All secrets in vault, CORS locked, rate limiting, auth middleware, audit logging, penetration tested |
| **TypeScript** | 100% TS, strict mode, 0 any types, 0 errors, 100% type coverage |
| **Testing** | 80%+ coverage, unit + integration + e2e, CI gates, automated |
| **Code Quality** | 0 lint errors, 0 TS errors, consistent formatting, no tech debt |
| **Documentation** | README + API docs + architecture + deployment + troubleshooting |
| **Error Handling** | Global handlers, typed errors, proper logging, no unhandled rejections |
| **Validation** | Zod on all inputs, typed DTOs, centralized validation |
| **Configuration** | Environment validation, type-safe config, .env.example complete |

---

## Appendix: Task Assignment

| Task | Owner | Due |
|------|-------|-----|
| Remove secrets from repo | @security | Week 1 |
| Implement Vault | @devops | Week 1 |
| Fix CORS | @backend | Week 1 |
| Standardize auth middleware | @backend | Week 2 |
| TypeScript: REZ-flywheel-mvp | @engineer1 | Week 3 |
| TypeScript: REZ-api-keys | @engineer2 | Week 3 |
| TypeScript: REZ-identity-bridge | @engineer3 | Week 3 |
| TypeScript: REZ-autonomous-agents | @engineer1 | Week 4 |
| TypeScript: REZ-ai-router | @engineer2 | Week 4 |
| TypeScript: REZ-error-intelligence | @engineer3 | Week 4 |
| TypeScript: REZ-creative-engine | @engineer1 | Week 5 |
| Testing: All services | @qa | Week 6-7 |
| Code quality: Lint fix | @all | Week 8 |
| Documentation: All READMEs | @techwriter | Week 9 |
| CI/CD: Pipeline setup | @devops | Week 10 |
| Monitoring: Prometheus setup | @devops | Week 11 |
| Final review & polish | @all | Week 12 |

---

**Document Version:** 1.0
**Last Updated:** 2024-01-15
**Next Review:** Weekly
