# JavaScript to TypeScript Migration Guide

## Overview

This guide helps migrate JavaScript files to TypeScript in the REZ-Intelligence platform.

## Migration Strategy

### Step 1: Add TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 2: Basic Conversions

#### Variables and Types

```javascript
// BEFORE (JavaScript)
const port = process.env.PORT || 3000;
const user = { id: 1, name: 'John' };
```

```typescript
// AFTER (TypeScript)
const port: number = parseInt(process.env.PORT || '3000', 10);
interface User {
  id: number;
  name: string;
}
const user: User = { id: 1, name: 'John' };
```

#### Functions

```javascript
// BEFORE (JavaScript)
function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
```

```typescript
// AFTER (TypeScript)
interface TokenPayload {
  userId: string;
  exp?: number;
}

function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
```

#### Express Routes

```javascript
// BEFORE (JavaScript)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

```typescript
// AFTER (TypeScript)
import { Request, Response } from 'express';

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});
```

#### Async/Await

```javascript
// BEFORE (JavaScript)
async function getUser(id) {
  const user = await User.findById(id);
  return user;
}
```

```typescript
// AFTER (TypeScript)
interface IUser {
  id: string;
  name: string;
}

async function getUser(id: string): Promise<IUser | null> {
  const user = await User.findById(id);
  return user;
}
```

### Step 3: Type Definitions

#### MongoDB/Mongoose

```typescript
import { Document, Schema } from 'mongoose';

interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
```

#### Request/Response

```typescript
import { Request, Response } from 'express';

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

app.post('/users', (req: Request<{}, {}, CreateUserRequest>, res: Response) => {
  const { name, email, password } = req.body;
  // ...
});
```

### Step 4: Configuration Validation

```typescript
import { z } from 'zod';

const configSchema = z.object({
  PORT: z.string().default('3000'),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const config = configSchema.parse(process.env);
```

## File-by-File Migration

### High Priority (Do First)

1. **index.js** → **index.ts** - Main entry point
2. **config/** files - Configuration with types
3. **types/** files - Type definitions
4. **models/** files - Database models
5. **routes/** files - API routes

### Medium Priority

1. **services/** - Business logic
2. **middleware/** - Express middleware
3. **utils/** - Utility functions

### Lower Priority

1. **handlers/** - Event handlers
2. **scripts/** - Migration scripts
3. **tests/** - Test files (can keep as JS)

## Common Patterns

### Environment Variables

```typescript
// src/config/index.ts
import 'dotenv/config';
import { z } from 'zod';

export const config = z.object({
  PORT: z.string().default('3000'),
  MONGODB_URI: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
}).parse(process.env);
```

### Database Connection

```typescript
// src/config/database.ts
import mongoose from 'mongoose';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}
```

### Service Client

```typescript
// src/utils/client.ts
interface ClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class ServiceClient {
  constructor(private config: ClientConfig) {}

  protected async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }
}
```

### Error Handling

```typescript
// src/utils/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  } else {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
```

## Migration Checklist

- [ ] Add `tsconfig.json`
- [ ] Add `@types/*` dependencies for external packages
- [ ] Rename `.js` files to `.ts`
- [ ] Add type annotations
- [ ] Create interface/type definitions
- [ ] Add Zod validation schemas
- [ ] Update imports/exports
- [ ] Update scripts in `package.json`
- [ ] Test the service

## Scripts

### Add to package.json

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "migrate": "tsc && node dist/index.js"
  }
}
```

### Dependencies to Add

```bash
npm install -D typescript @types/node @types/express @types/cors
npm install -D ts-node ts-jest @types/jest
```

## Files Already Migrated

| Service | Status |
|---------|--------|
| REZ-autonomous-agents | ✅ TypeScript |
| REZ-care-service | ✅ TypeScript |
| REZ-identity-graph | ✅ TypeScript |
| REZ-signal-aggregator | ✅ TypeScript |
| REZ-recommendation-engine | ✅ TypeScript |
| REZ-personalization-engine | ✅ TypeScript |
| REZ-predictive-engine | ✅ TypeScript |
| REZ-support-copilot | ✅ TypeScript |

## Files to Migrate

See attached spreadsheet for complete list of 266 files.

## Quick Wins

### 1. Add Type Annotations to Function Parameters

```javascript
// Before
function createUser(name, email) { }

// After
function createUser(name: string, email: string): User { }
```

### 2. Add Return Types

```javascript
// Before
function getPort() {
  return process.env.PORT || 3000;
}

// After
function getPort(): number {
  return parseInt(process.env.PORT || '3000', 10);
}
```

### 3. Use const Assertions

```javascript
// Before
const STATUSES = ['pending', 'active', 'closed'];

// After
const STATUSES = ['pending', 'active', 'closed'] as const;
type Status = typeof STATUSES[number];
```

## Testing

```bash
# Run tests after migration
npm test

# Type check without emitting
npx tsc --noEmit
```

## Troubleshooting

### "Cannot find module"

```typescript
// Add module declaration
declare module 'my-module';
```

### "Parameter 'X' implicitly has an 'any' type"

```typescript
// Add explicit type annotation
function handler(req: Request, res: Response) { }
```

### "Property 'X' does not exist on type 'Y'"

```typescript
// Add optional chaining or type guard
if ((user as any).customField) { }
// Or create proper interface
```
