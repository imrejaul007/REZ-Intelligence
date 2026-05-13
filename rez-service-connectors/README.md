# ReZ Service Connectors

Service connectors for the ReZ Orchestrator to communicate with backend services via REST APIs.

## Overview

This package provides typed connectors for each backend service in the ReZ platform. Each connector handles:

- **Authentication** via `X-Internal-Token` header
- **Retry logic** with exponential backoff for transient failures
- **Error handling** with descriptive error messages
- **Request/Response logging** for debugging

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Payment | 4001 | Payment processing, refunds, transactions |
| Wallet | 4002 | Wallet balance, credits, debits, payouts |
| Order | 3008 | Order management, status updates, fulfillment |
| Booking | 4020 | Hotel, travel, event bookings |
| Notification | 4023 | Push, SMS, email, in-app notifications |
| Analytics | 4005 | Dashboards, KPIs, reporting |

## Installation

```bash
npm install @rez/service-connectors
```

## Quick Start

```typescript
import { PaymentConnector, WalletConnector, OrderConnector } from '@rez/service-connectors';

// Initialize connectors
const payment = new PaymentConnector();
const wallet = new WalletConnector();
const order = new OrderConnector();

// Initiate payment
const paymentResult = await payment.initiate({
  orderId: 'order_123',
  amount: 500,
  paymentMethod: 'upi',
  orchestratorIdempotencyKey: 'unique-key-123',
});

// Create order
const orderResult = await order.create({
  merchantId: 'merchant_456',
  userId: 'user_789',
  items: [
    { productId: 'prod_1', name: 'Pizza', quantity: 2, price: 250 },
  ],
  total: 500,
  paymentMethod: 'upi',
});

// Credit wallet after successful order
await wallet.credit({
  userId: 'user_789',
  amount: 50,
  coinType: 'cashback',
  source: 'order_reward',
  description: 'Order completion reward',
});
```

## Configuration

### Environment Variables

```bash
# Service URLs
PAYMENT_SERVICE_URL=http://localhost:4001
WALLET_SERVICE_URL=http://localhost:4002
ORDER_SERVICE_URL=http://localhost:3008
BOOKING_SERVICE_URL=http://localhost:4020
NOTIFICATION_SERVICE_URL=http://localhost:4023
ANALYTICS_SERVICE_URL=http://localhost:4005

# Internal Service Token (JSON map)
INTERNAL_SERVICE_TOKENS_JSON={"orchestrator":"your-token-here"}

# Optional overrides
SERVICE_CONNECTOR_TIMEOUT_MS=30000
SERVICE_CONNECTOR_MAX_RETRIES=3
```

### Programmatic Configuration

```typescript
const payment = new PaymentConnector({
  baseUrl: 'https://payment.rez.money',
  internalToken: 'my-secret-token',
  timeout: 60000,
  maxRetries: 5,
});
```

## Usage Examples

### Payment Flow

```typescript
import { PaymentConnector } from '@rez/service-connectors';

const payment = new PaymentConnector();

// 1. Initiate payment
const initiated = await payment.initiate({
  orderId: 'order_abc',
  amount: 999,
  paymentMethod: 'upi',
  purpose: 'order_payment',
});

// 2. Wait for user to complete payment in app

// 3. Capture payment after gateway confirmation
await payment.capture({
  paymentId: initiated.paymentId,
  razorpayPaymentId: 'pay_xyz123',
  razorpayOrderId: 'order_xyz123',
  razorpaySignature: 'signature123',
});

// 4. Or refund if needed
await payment.refund({
  paymentId: initiated.paymentId,
  amount: 999,
  reason: 'Customer requested refund',
});
```

### Order Management

```typescript
import { OrderConnector } from '@rez/service-connectors';

const order = new OrderConnector();

// List orders
const { items, pagination } = await order.listOrders({
  merchantId: 'merchant_123',
  status: 'pending',
  page: 1,
  limit: 20,
});

// Update order status
await order.updateStatus('order_abc', {
  status: 'confirmed',
  reason: 'Payment confirmed',
});

// Cancel order
await order.cancel('order_abc', 'Customer cancelled', 'user');
```

### Notifications

```typescript
import { NotificationConnector } from '@rez/service-connectors';

const notification = new NotificationConnector();

// Send push notification
await notification.sendPush(
  'user_123',
  'Order Confirmed',
  'Your order #12345 has been confirmed!',
  { orderId: 'order_12345' }
);

// Schedule notification
await notification.schedule({
  userId: 'user_123',
  type: 'reminder',
  channel: 'push',
  title: 'Payment Due Tomorrow',
  body: 'Don\'t forget to complete your payment tomorrow.',
  scheduledFor: '2026-05-15T09:00:00',
  timezone: 'Asia/Kolkata',
});

// Send bulk notification
await notification.sendBulk({
  userIds: ['user_1', 'user_2', 'user_3'],
  notifications: [{
    type: 'promotion',
    channel: 'push',
    title: 'Flash Sale!',
    body: '50% off on all items today only!',
    priority: 'high',
  }],
});
```

### Analytics

```typescript
import { AnalyticsConnector } from '@rez/service-connectors';

const analytics = new AnalyticsConnector();

// Get dashboard summary
const summary = await analytics.getDashboardSummary({
  startDate: '2026-05-01',
  endDate: '2026-05-12',
});

// Get KPIs
const kpis = await analytics.getKPIs();

// Export report
const report = await analytics.generateReport({
  reportType: 'sales',
  dateRange: { startDate: '2026-04-01', endDate: '2026-04-30' },
  merchantId: 'merchant_123',
  format: 'csv',
});
```

### Service Manager

For orchestrating multiple services:

```typescript
import { getServiceManager } from '@rez/service-connectors';

const manager = getServiceManager();

// Check all service health
const health = await manager.getAllHealthStatuses();
console.log(health);

// Use convenience getters
const payment = manager.payment;
const order = manager.order;
```

## Error Handling

All connector methods throw descriptive errors:

```typescript
import { PaymentConnector } from '@rez/service-connectors';

const payment = new PaymentConnector();

try {
  await payment.initiate({ ... });
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('Authentication failed')) {
      // Invalid token
    } else if (error.message.includes('Rate limit')) {
      // Too many requests
    } else if (error.message.includes('Server error')) {
      // Service unavailable
    }
  }
}
```

## Retries

The connector automatically retries on:

- Network errors
- 5xx server errors
- Timeout errors

Retries use exponential backoff (1s, 2s, 4s, ...).

## TypeScript

All connectors are fully typed with TypeScript. Import types as needed:

```typescript
import {
  PaymentConnector,
  type InitiatePaymentRequest,
  type PaymentStatus,
  type WalletBalance,
} from '@rez/service-connectors';
```

## Building

```bash
npm run build
```

## Testing

```bash
npm test
npm run test:watch
```

## License

Proprietary - ReZ Commerce Platform
