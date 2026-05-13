# REZ Unified Agent SDK

A production-ready SDK for AI agents to connect to ReZ commerce platform services.

## Features

- **Service Connectors**: Unified interface for all commerce services (Payment, Wallet, Order, Booking, Notification, Analytics, Catalog)
- **Circuit Breaker**: Automatic failure protection with configurable thresholds
- **Retry Logic**: Exponential backoff with jitter for resilient operations
- **Event Publishing**: Built-in event bus for agent-to-agent communication
- **Health Checks**: Service health monitoring with aggregated status
- **Type Safety**: Full TypeScript support with Zod validation
- **Internal Auth**: X-Internal-Token based service-to-service authentication

## Installation

```bash
npm install @rez/unified-agent-sdk
```

## Quick Start

```typescript
import { UnifiedAgentSDK } from '@rez/unified-agent-sdk';

const sdk = new UnifiedAgentSDK({
  agentId: 'my-agent',
  internalTokens: {
    payment: 'service-token-for-payment',
    wallet: 'service-token-for-wallet',
    order: 'service-token-for-order',
    notification: 'service-token-for-notification',
  },
  services: {
    paymentService: 'http://localhost:4001',
    walletService: 'http://localhost:4002',
    orderService: 'http://localhost:4003',
    bookingService: 'http://localhost:4004',
    notificationService: 'http://localhost:4005',
    analyticsService: 'http://localhost:4006',
    catalogService: 'http://localhost:4007',
  },
  circuitBreaker: {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  },
});

// Process a payment
const payment = await sdk.processPayment('order-123', 9999, 'upi');

// Create an order
const order = await sdk.createOrder([
  { productId: 'prod-1', quantity: 2, price: 4999 },
]);

// Get wallet balance
const balance = await sdk.getBalance('user-123');

// Check service health
const health = await sdk.checkServicesHealth();
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     UnifiedAgentSDK                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Connectors │  │ Event Bus   │  │  Health Monitor     │  │
│  │  ─────────  │  │  ─────────  │  │  ───────────────    │  │
│  │ Payment     │  │ Publisher   │  │ Service health      │  │
│  │ Wallet      │  │ Subscriber  │  │ checks & status     │  │
│  │ Order       │  │             │  │                     │  │
│  │ Booking     │  │             │  │                     │  │
│  │ Notification│  │             │  │                     │  │
│  │ Analytics   │  │             │  │                     │  │
│  │ Catalog     │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                                                │   │
│  ┌──────▼────────────────────────────────────────────────┐ │
│  │         Resilience Layer                               │ │
│  │  Circuit Breaker │ Retry (exp backoff) │ Timeout       │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                  │
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │         HTTP Client (axios)                            │  │
│  │  X-Internal-Token │ Request/Response logging            │  │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Service Connectors

### Payment Connector

```typescript
await sdk.processPayment(orderId, amount, method, {
  currency: 'INR',
  customerEmail: 'user@example.com',
  metadata: { agentId: 'my-agent' },
});
```

### Wallet Connector

```typescript
const balance = await sdk.getBalance(userId);
await sdk.creditWallet(userId, amount, 'Order payment');
await sdk.debitWallet(userId, amount, 'Refund processing');
```

### Order Connector

```typescript
const order = await sdk.createOrder(items, {
  customerId: 'user-123',
  shippingAddress: { ... },
});
await sdk.updateOrderStatus(orderId, 'confirmed');
```

### Booking Connector

```typescript
const booking = await sdk.createBooking({
  serviceType: 'hotel',
  serviceId: 'hotel-123',
  checkIn: '2024-03-01',
  checkOut: '2024-03-05',
});
```

### Notification Connector

```typescript
await sdk.sendNotification(userId, 'order_confirmation', {
  orderId: 'order-123',
  items: [...],
});
```

### Analytics Connector

```typescript
await sdk.trackEvent('purchase_completed', {
  userId: 'user-123',
  orderId: 'order-123',
  value: 9999,
});
```

### Catalog Connector

```typescript
const products = await sdk.searchProducts({
  query: 'hotel room',
  filters: { priceRange: [1000, 5000] },
});
```

## Event Publishing

```typescript
// Publish an event
await sdk.publishEvent('agent.action.completed', {
  agentId: 'my-agent',
  action: 'process_payment',
  result: 'success',
  timestamp: new Date().toISOString(),
});

// Subscribe to events (via EventPublisher)
sdk.events.on('agent.action.completed', (payload) => {
  console.log('Action completed:', payload);
});
```

## Health Checks

```typescript
const health = await sdk.checkServicesHealth();

console.log(health);
// {
//   overall: 'healthy',
//   services: {
//     payment: { status: 'healthy', latency: 45 },
//     wallet: { status: 'healthy', latency: 32 },
//     order: { status: 'degraded', latency: 250 },
//     ...
//   },
//   checkedAt: '2024-03-01T12:00:00Z'
// }
```

## Configuration

```typescript
interface SDKConfig {
  agentId: string;
  internalTokens: Record<string, string>;
  services: {
    paymentService: string;
    walletService: string;
    orderService: string;
    bookingService: string;
    notificationService: string;
    analyticsService: string;
    catalogService: string;
  };
  circuitBreaker?: CircuitBreakerOptions;
  retry?: RetryOptions;
  timeout?: number;
  logger?: Logger;
}

interface CircuitBreakerOptions {
  timeout?: number;           // ms to wait before considering failure (default: 5000)
  errorThresholdPercentage?: number;  // % failures before opening (default: 50)
  resetTimeout?: number;      // ms before attempting reset (default: 30000)
  volumeThreshold?: number;   // min calls before calculating (default: 10)
}

interface RetryOptions {
  maxAttempts?: number;        // default: 3
  initialDelay?: number;       // ms (default: 100)
  maxDelay?: number;          // ms (default: 5000)
  factor?: number;            // backoff multiplier (default: 2)
  jitter?: boolean;           // add randomness (default: true)
}
```

## Error Handling

All SDK methods throw typed errors that you can catch and handle:

```typescript
import {
  SDKError,
  ServiceError,
  CircuitOpenError,
  ValidationError,
  AuthenticationError,
} from '@rez/unified-agent-sdk';

try {
  await sdk.processPayment(orderId, amount, method);
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // Circuit breaker is open, service unavailable
    console.log('Service temporarily unavailable, please retry later');
  } else if (error instanceof ValidationError) {
    // Invalid input parameters
    console.log('Invalid payment parameters:', error.details);
  } else if (error instanceof ServiceError) {
    // Service returned an error
    console.log('Service error:', error.message, error.statusCode);
  } else if (error instanceof AuthenticationError) {
    // Authentication failed
    console.log('Service authentication failed');
  }
}
```

## Logging

The SDK uses Winston for logging. Configure your logger:

```typescript
import winston from 'winston';

const sdk = new UnifiedAgentSDK({
  // ... config
  logger: winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
  }),
});
```

Log levels per operation:
- `error`: Failed requests, circuit breaker events
- `warn`: Retries, slow responses, degraded services
- `info`: Successful requests, health checks
- `debug`: Full request/response details (masked sensitive data)

## Best Practices

1. **Reuse SDK instances**: Create one SDK instance per agent and reuse it
2. **Handle errors gracefully**: Always wrap SDK calls in try/catch
3. **Monitor circuit breakers**: Watch for services that are frequently unavailable
4. **Use health checks**: Verify service availability before critical operations
5. **Log appropriately**: Use log levels consistently for observability

## License

MIT
