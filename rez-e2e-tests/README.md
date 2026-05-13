# REZ E2E Integration Tests

End-to-end integration tests for the REZ platform, covering message flows, order processing, multi-agent collaboration, and channel bridge integrations.

## Overview

This test suite validates the complete flow of the REZ platform across multiple services:

- **Orchestrator** - Intent detection and expert routing
- **Payment Service** - Payment processing and wallet operations
- **Order Service** - Order lifecycle management
- **Channel Bridges** - WhatsApp and Instagram integrations

## Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 7+
- All services running (or use `LOCAL_SERVICES=true` to start them automatically)

## Installation

```bash
cd REZ-Intelligence/rez-e2e-tests
npm install
```

## Environment Variables

Create a `.env` file in the test directory:

```bash
# Service URLs
ORCHESTRATOR_URL=http://localhost:3000
PAYMENT_SERVICE_URL=http://localhost:3001
WALLET_SERVICE_URL=http://localhost:4002
ORDER_SERVICE_URL=http://localhost:4003
AUTH_SERVICE_URL=http://localhost:4004
NOTIFICATION_SERVICE_URL=http://localhost:4005
WHATSAPP_BRIDGE_URL=http://localhost:5000
INSTAGRAM_BRIDGE_URL=http://localhost:5001

# Database
MONGODB_URI=mongodb://localhost:27017
TEST_DATABASE_NAME=rez_e2e_tests
REDIS_URL=redis://localhost:6379

# Service Tokens (for internal service communication)
ORCHESTRATOR_TOKEN=your-orchestrator-token
PAYMENT_TOKEN=your-payment-token
WALLET_TOKEN=your-wallet-token
ORDER_TOKEN=your-order-token

# Optional: Start services automatically
LOCAL_SERVICES=true
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode (sequential, forced exit)
npm run test:ci

# Run a specific test file
npx jest tests/message-flow.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="should route to CULINARY"
```

## Test Structure

```
tests/
├── setup.ts                   # Global test setup, helpers, and configuration
├── message-flow.test.ts       # Intent detection and expert routing tests
├── order-flow.test.ts         # Order creation and payment flow tests
├── multi-agent.test.ts        # Multi-agent collaboration tests
├── channel-bridge.test.ts     # WhatsApp/Instagram bridge tests
└── service-connector.test.ts  # Backend service integration tests
```

## Test Categories

### Message Flow Tests (`message-flow.test.ts`)

- Intent detection for various user messages
- Expert routing to appropriate handlers
- Session management
- Channel handling (WhatsApp, Instagram, Web, API)
- Error handling and edge cases
- Multi-turn conversations

### Order Flow Tests (`order-flow.test.ts`)

- Order creation and validation
- Payment initiation and confirmation
- Payment failure and retry scenarios
- Wallet deduction
- Order status transitions
- Order analytics

### Multi-Agent Tests (`multi-agent.test.ts`)

- Agent handoff between experts
- Shared context propagation
- Cross-domain requests
- Intent escalation to human agents
- Agent performance monitoring
- Agent state management and audit trails

### Channel Bridge Tests (`channel-bridge.test.ts`)

- WhatsApp message handling
- Instagram Direct integration
- Message format normalization
- Channel-specific features (quick replies, templates)
- Webhook handling
- Message delivery guarantees
- Cross-channel features

### Service Connector Tests (`service-connector.test.ts`)

- Payment Service connector operations
- Wallet Service connector operations
- Order Service connector operations
- Service health checks
- Error propagation and handling
- Data consistency across services
- Service-to-service authentication

## Writing Tests

### Using Test Helpers

The `setup.ts` exports helper functions for common operations:

```typescript
import { helpers, db } from './setup';

// Create a test user
const user = await helpers.createTestUser({
  walletBalance: 5000,
});

// Create a test order
const order = await helpers.createTestOrder(user.userId, [
  { itemId: 'item_1', name: 'Biryani', quantity: 2, price: 300 },
]);

// Send a chat message
const response = await helpers.sendChatMessage(
  'I want biryani',
  user.userId,
  'WHATSAPP'
);

// Create a payment
const payment = await helpers.createPayment(
  order.orderId,
  order.total,
  user.userId,
  'WALLET'
);

// Verify payment
const status = await helpers.verifyPayment(payment.paymentId);

// Get wallet balance
const balance = await helpers.getWalletBalance(user.userId);
```

### Test Pattern

```typescript
import { describe, test, expect, beforeEach } from '@jest/globals';
import { helpers, db } from './setup';

describe('Feature Name', () => {
  let testUser: Awaited<ReturnType<typeof helpers.createTestUser>>;

  beforeEach(async () => {
    testUser = await helpers.createTestUser({ walletBalance: 5000 });
  });

  test('should perform expected behavior', async () => {
    // Arrange
    const order = await helpers.createTestOrder(testUser.userId);

    // Act
    const result = await helpers.createPayment(
      order.orderId,
      order.total,
      testUser.userId,
      'WALLET'
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.paymentId).toBeDefined();
  });
});
```

## Configuration

### Jest Configuration

The `jest.config.js` file is pre-configured with:

- TypeScript support via `ts-jest`
- 30-second test timeout
- Coverage collection
- Forced exit after tests
- Open handle detection

### Test Database

Tests use a dedicated MongoDB database (`rez_e2e_tests`) that is:

- Created fresh before test suite
- Cleaned up between tests
- Recreated after each test

### Service Health Checks

Before running tests, the setup verifies:

- MongoDB connectivity
- Redis connectivity
- Service health endpoints
- HTTP client initialization

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:6
        ports:
          - 27017:27017
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd REZ-Intelligence/rez-e2e-tests
          npm install

      - name: Run tests
        run: |
          cd REZ-Intelligence/rez-e2e-tests
          npm run test:ci
        env:
          MONGODB_URI: mongodb://localhost:27017
          REDIS_URL: redis://localhost:6379
          ORCHESTRATOR_URL: http://localhost:3000
          # ... other env vars
```

## Troubleshooting

### Tests Hang

If tests hang after completion, ensure `forceExit: true` is set in Jest config.

### Connection Refused

Ensure all required services are running or set `LOCAL_SERVICES=true`.

### MongoDB Errors

- Check `MONGODB_URI` is correct
- Ensure MongoDB is running
- Verify user has permissions for test database

### Redis Errors

- Check `REDIS_URL` is correct
- Ensure Redis is running

## Debugging

```bash
# Run with verbose output
npm test -- --verbose

# Run with debugger
npm test -- --inspect-brk

# Run specific test with debug
npx jest tests/order-flow.test.ts --verbose --inspect
```

## Contributing

When adding new tests:

1. Follow the existing test patterns
2. Use TypeScript with proper types
3. Include both positive and negative test cases
4. Add descriptive test names
5. Clean up test data in `afterEach`
6. Update this README with new test categories
