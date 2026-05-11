# REZ Event Platform

Central event platform for the REZ ecosystem - handles event publishing, schema validation, and consumption.

## Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────┐
│ Event Publisher │───▶│ Schema Validation    │───▶│ Event Store │
└─────────────────┘    └──────────────────────┘    └─────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────┐          ┌─────────────┐
                       │ BullMQ Queue │─────────▶│  Consumers  │
                       └──────────────┘          └─────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │Dead Letter Q │
                       └──────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB
- Redis

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Build the project
npm run build

# Start the server
npm start
```

### Development

```bash
npm run dev
```

## Event Types

### inventory.low

Emitted when inventory levels fall below the threshold.

**Payload Schema:**
```typescript
{
  inventoryId: string;
  productId: string;
  productName: string;
  currentQuantity: number;
  threshold: number;
  warehouseId?: string;
  sku?: string;
  supplierId?: string;
  suggestedReorderQuantity?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

### order.completed

Emitted when an order is successfully completed.

**Payload Schema:**
```typescript
{
  orderId: string;
  customerId: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency?: string;
  paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer' | 'cash' | 'crypto';
  shippingAddress?: Address;
  billingAddress?: Address;
  fulfillmentStatus?: 'pending' | 'processing' | 'shipped' | 'delivered';
  notes?: string;
}
```

### payment.success

Emitted when a payment is successfully processed.

**Payload Schema:**
```typescript
{
  paymentId: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency?: string;
  method: string;
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partial_refund';
  gateway: 'stripe' | 'paypal' | 'square' | 'braintree' | 'internal';
  gatewayResponse?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  refundAmount?: number;
  refundedAt?: string;
}
```

## API Endpoints

### Publishing Events

#### POST /events/publish
Publish any event with automatic schema validation.

```bash
curl -X POST http://localhost:4008/events/publish \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "inventory.low",
    "timestamp": "2026-05-01T12:00:00.000Z",
    "source": "inventory-service",
    "payload": {
      "inventoryId": "INV-001",
      "productId": "PROD-123",
      "productName": "Widget A",
      "currentQuantity": 5,
      "threshold": 10,
      "severity": "high"
    }
  }'
```

#### POST /events/inventory/low
Emit an inventory.low event.

```bash
curl -X POST http://localhost:4008/events/inventory/low \
  -H "Content-Type: application/json" \
  -d '{
    "inventoryId": "INV-001",
    "productId": "PROD-123",
    "productName": "Widget A",
    "currentQuantity": 5,
    "threshold": 10,
    "severity": "high"
  }'
```

#### POST /events/order/completed
Emit an order.completed event.

```bash
curl -X POST http://localhost:4008/events/order/completed \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-12345",
    "customerId": "CUST-001",
    "items": [
      {
        "productId": "PROD-001",
        "name": "Widget A",
        "quantity": 2,
        "unitPrice": 29.99,
        "subtotal": 59.98
      }
    ],
    "subtotal": 59.98,
    "tax": 5.00,
    "shipping": 5.99,
    "total": 70.97,
    "paymentMethod": "credit_card"
  }'
```

#### POST /events/payment/success
Emit a payment.success event.

```bash
curl -X POST http://localhost:4008/events/payment/success \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "PAY-12345",
    "orderId": "ORD-12345",
    "customerId": "CUST-001",
    "amount": 70.97,
    "method": "card",
    "transactionId": "txn_abc123",
    "status": "completed",
    "gateway": "stripe"
  }'
```

### Monitoring

#### GET /health
Full health check with dependency status.

```json
{
  "status": "healthy",
  "timestamp": "2026-05-01T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "mongodb": { "status": "up", "latencyMs": 5 },
    "redis": { "status": "up", "latencyMs": 2 },
    "queues": { "status": "up", "queues": {} }
  }
}
```

#### GET /stats
Detailed statistics including event counts and queue status.

#### GET /schemas
List all registered event schemas with documentation.

## Emitting Events from Other Services

### Using the Event Emitter

```typescript
import { EventEmitter } from '@rez/event-platform';

// Initialize emitter
const emitter = EventEmitter.getInstance();

// Publish an event
const result = await emitter.publish({
  id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'inventory.low',
  timestamp: new Date().toISOString(),
  source: 'your-service-name',
  payload: {
    inventoryId: 'INV-001',
    productId: 'PROD-123',
    productName: 'Widget A',
    currentQuantity: 5,
    threshold: 10,
  },
});

if (result.success) {
  console.log('Event published:', result.eventId);
} else {
  console.error('Failed:', result.error);
}
```

### Using Convenience Methods

```typescript
// Inventory low event
await emitter.emitInventoryLow({
  inventoryId: 'INV-001',
  productId: 'PROD-123',
  productName: 'Widget A',
  currentQuantity: 5,
  threshold: 10,
});

// Order completed event
await emitter.emitOrderCompleted({
  orderId: 'ORD-12345',
  customerId: 'CUST-001',
  items: [...],
  subtotal: 100,
  tax: 10,
  shipping: 5,
  total: 115,
  paymentMethod: 'credit_card',
});

// Payment success event
await emitter.emitPaymentSuccess({
  paymentId: 'PAY-12345',
  orderId: 'ORD-12345',
  customerId: 'CUST-001',
  amount: 115,
  method: 'card',
  transactionId: 'txn_abc123',
  status: 'completed',
  gateway: 'stripe',
});
```

### Correlation ID Tracking

```typescript
// Set correlation ID for request tracing
emitter.setCorrelationId('req-123-abc');

// All events published will include this correlation ID
await emitter.emitOrderCompleted({...});

// Clear when done
emitter.clearCorrelationId();
```

## Configuration

Environment variables can be configured via `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4008 | Service port |
| `NODE_ENV` | development | Environment |
| `MONGODB_URI` | mongodb://localhost:27017/rez-events | MongoDB connection |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `REDIS_PASSWORD` | - | Redis password |
| `BULLMQ_CONCURRENCY` | 5 | Worker concurrency |
| `BULLMQ_MAX_RETRIES` | 3 | Max retry attempts |
| `LOG_LEVEL` | info | Logging level |

## Deployment

### Docker

```bash
# Build image
docker build -t rez-event-platform .

# Run container
docker run -p 4008:4008 \
  -e MONGODB_URI=mongodb://host:27017/rez-events \
  -e REDIS_HOST=host \
  rez-event-platform
```

### Render

```bash
# Deploy with render.yaml
render deploy
```

## Dead Letter Queue

Failed events (after max retries) are moved to the dead letter queue for manual review.

View dead letter events via MongoDB:
```javascript
db.dead_letter_events.find({ status: 'pending' })
```

Review and replay:
```javascript
// Mark as reviewed
db.dead_letter_events.updateOne(
  { _id: ObjectId("...") },
  { $set: { status: 'reviewed', reviewedAt: new Date() } }
);
```

## License

MIT
