# REZ Intelligence Integration Tests

End-to-end and integration tests for the REZ Intelligence services.

## Services Tested

| Service | Port | Description |
|---------|------|-------------|
| Orchestrator | 4070 | Routes messages to appropriate experts |
| Context Engine | 4071 | Provides session and merchant context |
| Core Brain | 4072 | User memory and personalization |
| Agent Registry | 4073 | Service discovery and registration |
| Hospitality Expert | 3000 | Hotel and hospitality queries |
| Culinary Expert | 3001 | Food and restaurant queries |

## Prerequisites

1. All services must be running (or at minimum, the services you want to test)
2. Environment variables must be configured (see `.env.example`)

## Setup

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your service URLs
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- e2e.test.ts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| ORCHESTRATOR_URL | http://localhost:4070 | Orchestrator service URL |
| CONTEXT_ENGINE_URL | http://localhost:4071 | Context Engine service URL |
| CORE_BRAIN_URL | http://localhost:4072 | Core Brain service URL |
| AGENT_REGISTRY_URL | http://localhost:4073 | Agent Registry service URL |
| HOSPITALITY_EXPERT_URL | http://localhost:3000 | Hospitality Expert URL |
| CULINARY_EXPERT_URL | http://localhost:3001 | Culinary Expert URL |
| INTERNAL_SERVICE_TOKEN | - | Token for internal service calls |

## Test Structure

```
tests/
├── setup.ts              # Test configuration and helpers
├── e2e.test.ts          # End-to-end message flow tests
└── service-discovery.test.ts  # Service registration and discovery tests
```

## Test Categories

### E2E Message Flow Tests
- Orchestrator routing to experts
- Context enrichment from external services
- Expert request/response handling
- Error handling and fallbacks

### Service Discovery Tests
- Health checks for all services
- Agent registration
- Service-to-service communication
- Capability-based routing

## Debugging

```bash
# Run with DEBUG output
DEBUG=1 npm test

# Run specific test
npm test -- --testNamePattern="should route hospitality"
```

## Notes

- Tests will attempt to connect to all services but gracefully skip tests if services are unavailable
- This allows running tests in a development environment with only some services running
- For CI/CD, ensure all services are running before running tests
