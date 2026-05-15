# [Service Name]

[Brief description - 2-3 sentences about what this service does]

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
| `LOG_LEVEL` | No | info | Logging level (error, warn, info, debug) |
| `INTERNAL_SERVICE_TOKEN` | Yes | - | Service-to-service authentication token |

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

### Readiness Check

```
GET /ready
```

Response:
```json
{
  "ready": true,
  "dependencies": {
    "mongodb": "connected",
    "redis": "connected"
  }
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
- Redis 7+ (optional, for caching)

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run typecheck` | Run TypeScript type checking |

### Project Structure

```
src/
├── index.ts          # Entry point
├── routes/           # Express route handlers
├── services/         # Business logic
├── models/           # Mongoose schemas
├── schemas/          # Zod validation schemas
├── middleware/        # Express middleware
├── utils/            # Utility functions
└── tests/            # Test files
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

Integration tests require running MongoDB and Redis:

```bash
npm run test:integration
```

### Coverage

```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory.

## Deployment

### Docker

```bash
# Build image
docker build -t rez-[service-name]:latest .

# Run container
docker run -p 3000:3000 \
  -e MONGODB_URI=mongodb://host:27017/db \
  -e INTERNAL_SERVICE_TOKEN=$TOKEN \
  rez-[service-name]:latest
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rez-[service-name]
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: rez-[service-name]
          image: rez-[service-name]:latest
          ports:
            - containerPort: 3000
          env:
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: rez-secrets
                  key: mongodb-uri
```

## Monitoring

### Metrics Endpoint

```
GET /metrics
```

Returns Prometheus-formatted metrics.

### Health Checks

- `/health` - Liveness probe
- `/ready` - Readiness probe

## Troubleshooting

### Common Issues

**MongoDB Connection Failed**
- Verify `MONGODB_URI` is correct
- Check MongoDB is running and accessible
- Verify network/firewall rules

**Port Already in Use**
- Change port via `PORT` environment variable
- Kill existing process: `lsof -ti:3000 | xargs kill`

**Tests Failing**
- Ensure MongoDB and Redis are running
- Check environment variables are set
- Clear test database: `npm run test:clean`

## License

MIT
