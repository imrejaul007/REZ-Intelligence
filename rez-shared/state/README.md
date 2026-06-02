# Payment & Order State Machines

Type-safe finite state machines for payment and order lifecycle.

## Usage

```typescript
import { PaymentMachine, OrderMachine } from '@rez/state-machines';

// Payment FSM
const payment = new PaymentMachine();
payment.transition({ type: 'INIT', amount: 100, currency: 'USD' });
payment.transition({ type: 'SUBMIT' });
payment.transition({ type: 'SUCCESS', transactionId: 'txn_123' });

// Order FSM
const order = new OrderMachine();
order.transition({ type: 'ADD_ITEM', sku: 'SKU123', quantity: 2 });
order.transition({ type: 'CHECKOUT' });
order.transition({ type: 'CONFIRM_PAYMENT' });
order.transition({ type: 'FULFILL' });

// Guard checking
if (order.canTransition({ type: 'DELIVER' })) {
  order.transition({ type: 'DELIVER' });
}
```

See `ADR.md` for state diagrams and design rationale.
