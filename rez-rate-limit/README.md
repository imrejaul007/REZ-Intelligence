# ReZ Rate Limiting Service

A production-ready rate limiting service with Redis-backed sliding window counters, burst protection, and comprehensive management APIs.

## Features

- **Per-user rate limits**: Authenticated users get individual limits
- **Per-IP rate limits**: Protection against IP-based abuse
- **Per-endpoint rate limits**: Different limits for different endpoints
- **Sliding window algorithm**: Precise rate limiting using Redis sorted sets
- **Burst protection**: Detects and blocks rapid consecutive requests
- **Redis-backed counters**: Persistent, distributed rate limiting
- **Management API**: Full CRUD for rate limit configuration

## Quick Start

```bash
# Install dependencies
cd rez-rate-limit
npm install

# Start Redis (required)
redis-server

# Start the service
npm run dev
```

## Server Details

- **Port**: 4029
- **Health Check**: `http://localhost:4029/health`
- **Management API**: `http://localhost:4029/api/limits`

## API Endpoints

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/api/health` | GET | Detailed API health |
| `/api/limits/status` | GET | Current configuration and stats |
| `/api/limits/stats` | GET | Redis statistics |

### Rate Limit Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/limits/check/:type/:identifier` | GET | Check current usage |
| `/api/limits/reset` | POST | Reset limit for a key |
| `/api/limits/batch-reset` | POST | Reset multiple keys |
| `/api/limits/config` | GET | Get all configurations |
| `/api/limits/config/endpoint` | POST | Update endpoint config |
| `/api/limits/test` | POST | Test rate limit |

### Example Requests

```bash
# Check current usage for an IP
curl http://localhost:4029/api/limits/check/ip/192.168.1.1

# Reset rate limit for a user
curl -X POST http://localhost:4029/api/limits/reset \
  -H "Content-Type: application/json" \
  -d '{"type": "user", "identifier": "user123"}'

# Update endpoint configuration
curl -X POST http://localhost:4029/api/limits/config/endpoint \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "/api/data/search", "windowSizeMs": 60000, "maxRequests": 50}'
```

## Rate Limit Response Headers

All rate-limited responses include:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed |
| `X-RateLimit-Remaining` | Requests remaining in window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds until retry (on 429) |

## Default Limits

| Scope | Window | Max Requests | Burst Limit |
|-------|--------|--------------|-------------|
| User | 1 min | 100 | 30 in 5s |
| IP | 1 min | 200 | 50 in 5s |
| Endpoint | 1 min | 1000 | 100 in 5s |

### Special Endpoint Limits

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| `/api/auth/login` | 1 min | 5 |
| `/api/auth/register` | 1 hour | 3 |
| `/api/data/search` | 1 min | 30 |
| `/api/data/export` | 1 min | 10 |

## Algorithm: Sliding Window

The service uses a sliding window algorithm implemented with Redis sorted sets:

1. **Remove expired entries**: All entries older than `windowSizeMs` are removed
2. **Count remaining**: Current entries in the window are counted
3. **Check limit**: If under limit, add new entry; otherwise reject
4. **Atomic operations**: Uses Redis transactions for consistency

## Burst Protection

Burst protection tracks rapid consecutive requests:

1. **Short window tracking**: 5-second window for burst detection
2. **Threshold**: Configurable burst limit per scope
3. **Early rejection**: Blocks requests before main rate limit check

## Configuration

Environment variables:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Project Structure

```
rez-rate-limit/
├── src/
│   ├── index.ts              # Main server entry
│   ├── config/
│   │   └── index.ts          # Configuration
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   ├── services/
│   │   ├── redisClient.ts    # Redis connection
│   │   └── rateLimitService.ts # Core rate limiting logic
│   ├── middleware/
│   │   └── rateLimit.ts      # Express middleware
│   └── routes/
│       └── limits.routes.ts  # Management API
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
