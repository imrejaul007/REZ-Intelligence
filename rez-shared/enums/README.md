# Shared Enum Registry

Canonical enums for order status, payment status, user role, and transaction types.

## Usage

```typescript
import { OrderStatus, PaymentStatus, isValidOrderStatus } from '@rez/enums';

// Type-safe enum usage
const status: OrderStatus = OrderStatus.PAID;

// Validation from external data
if (isValidOrderStatus(externalStatus)) {
  const safeStatus: OrderStatus = externalStatus as OrderStatus;
}

// Iteration
OrderStatus.values; // ['CART', 'CHECKOUT', ...]
```

See `ADR.md` for design rationale.
