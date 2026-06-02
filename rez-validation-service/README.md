# ReZ Validation Service

A comprehensive input validation and sanitization service providing schema validation, security scanning, and data sanitization utilities for the ReZ ecosystem.

## Features

- **Schema Validation**: Zod-based schema validation for API requests
- **Input Sanitization**: Protection against XSS, SQL injection, and command injection
- **Rate Limiting**: Endpoint-specific rate limiting middleware
- **Request Size Limits**: Configurable request size restrictions
- **API Key Authentication**: Secure API key validation middleware
- **Security Scanning**: Detect potential security threats in requests
- **Custom Validators**: Define custom validation rules and schemas
- **Error Formatting**: Consistent error response formatting

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   ReZ Validation Service                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Validation │  │   Security  │  │    Sanitization       │  │
│  │   Middleware │  │   Scanner   │  │    Utilities         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                      │               │
│  ┌──────▼──────────────────▼──────────────────────▼───────────┐  │
│  │                    Validation Engine                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │   Schema    │ │   Rate      │ │    Error          │  │  │
│  │  │   Builder   │ │   Limiter   │ │    Formatter      │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```env
PORT=3022
NODE_ENV=development

# Security
VALIDATION_API_KEY=your_validation_api_key
MAX_REQUEST_SIZE_MB=10

# Rate Limiting
DEFAULT_RATE_LIMIT_WINDOW=1m
DEFAULT_RATE_LIMIT_MAX=100
```

## Running the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

### Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/validate` | Validate request body |
| POST | `/api/validate/schema` | Validate against custom schema |
| POST | `/api/sanitize` | Sanitize input data |

### Schema Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schemas` | Create validation schema |
| GET | `/api/schemas/:name` | Get schema by name |
| PUT | `/api/schemas/:name` | Update schema |

## Usage

### As Express Middleware

```typescript
import { validateRequest } from './services/schemaService';

const userSchema = {
  body: {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, minLength: 8 },
    name: { type: 'string', required: true }
  }
};

app.post('/users', validateRequest, userSchema, (req, res) => {
  // req.body is validated and sanitized
  res.json({ success: true });
});
```

### Using Zod Schemas Directly

```typescript
import { buildZodSchemas, formatZodErrors } from './services/schemaService';
import { z } from 'zod';

const userSchema = buildZodSchemas({
  body: {
    email: { type: 'email', required: true },
    age: { type: 'number', min: 18, max: 120 }
  }
});

// Use with express-async-handler or manual error handling
app.post('/validate', (req, res) => {
  const result = userSchema.body.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      errors: formatZodErrors(result.error)
    });
  }
  res.json({ success: true, data: result.data });
});
```

### Sanitization

```typescript
import { sanitizeHtml, escapeSql, validateAndSanitize } from './services/sanitization';

// Sanitize HTML
const safeHtml = sanitizeHtml('<script>alert("xss")</script>');
// Result: &lt;script&gt;alert("xss")&lt;/script&gt;

// Escape SQL
const safeSql = escapeSql("'; DROP TABLE users; --");
// Result: ''; DROP TABLE users; --

// Validate and sanitize
const validated = validateAndSanitize('  <script>test</script>  ');
// Result: 'test' (sanitized)
```

### Rate Limiting

```typescript
import { createEndpointRateLimiter } from './services/schemaService';

// 100 requests per minute
const limiter = createEndpointRateLimiter(100, '1m');

app.post('/api/data', limiter, (req, res) => {
  res.json({ success: true });
});

// Custom limit per endpoint
app.get('/api/expensive', createEndpointRateLimiter(10, '1m'), handler);
```

### Request Size Limit

```typescript
import { RequestSizeLimit } from './services/schemaService';

// Limit to 1MB
app.use(RequestSizeLimit(1024 * 1024));

// Limit to 10MB
app.use(RequestSizeLimit(10 * 1024 * 1024));
```

### API Key Authentication

```typescript
import { validateApiKey } from './services/schemaService';

app.get('/api/protected', validateApiKey, (req, res) => {
  res.json({ success: true, data: 'Protected data' });
});
```

## Field Types

| Type | Description | Validation |
|------|-------------|------------|
| `string` | Text input | minLength, maxLength, pattern |
| `number` | Numeric input | min, max |
| `boolean` | True/false | - |
| `email` | Email address | RFC 5322 format |
| `url` | URL address | Valid URL format |
| `uuid` | UUID string | UUID v4 format |
| `object` | Nested object | - |
| `array` | Array input | minLength, maxLength |

## Security Features

### XSS Detection Patterns

- `<script>` tags
- `javascript:` URLs
- Event handlers (`onclick`, `onerror`, etc.)
- `<iframe>`, `<object>`, `<embed>`
- HTML entity encoding evasion

### SQL Injection Detection

- SQL keywords (SELECT, INSERT, DROP, etc.)
- Common injection patterns
- Union-based attacks
- Comment injection

## Error Response Format

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "validation": [
      { "field": "body.email", "message": "email must be a valid email" }
    ],
    "security": ["XSS detected in body.comment"]
  }
}
```

## Testing

```bash
npm test
```

## Deployment

### Docker

```bash
docker build -t rez-validation-service .
docker run -p 3022:3022 rez-validation-service
```

## License

MIT
