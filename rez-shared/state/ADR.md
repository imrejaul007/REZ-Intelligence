# ADR: Payment & Order State Machines

## Context
Invalid state transitions cause data corruption. Services independently manage state without shared rules.

## Decision
Implement explicit finite state machines (FSM) for payment and order lifecycle with guard conditions.

## Rationale
- Prevents invalid transitions at compile and runtime
- Type-safe event handling prevents misuse
- Explicit state graph documents valid flows
- Subsumes bugs: invalid payment retries, order fulfillment races, cancelled order mutations

## Implementation
Two FSMs exported from `@rez/state-machines`:

### PaymentMachine
- States: INIT → PENDING → (SUCCESS | FAILED)
- Retry logic: FAILED → PENDING (max 3 retries)
- Guards: prevent transition from invalid states

### OrderMachine
- Flow: CART → CHECKOUT → PAID → FULFILLED → DELIVERED
- Cancel branch: any state before PAID
- Refund branch: PAID or FULFILLED → REFUNDED
- Guards: prevent empty checkout, invalid cancellations

## Related Issues
- Invalid state transitions causing order corruption
- Missing retry logic for failed payments
- Concurrent order mutations

## Consumers (Phase 2: Wired Integration)

### Webhook Guard Implementation
- **rez-payment-service** (src/routes/paymentRoutes.ts): PaymentMachine guards webhook handlers
  - Payment.captured event: PaymentMachine validates INIT→PENDING→SUCCESS transition before processing
  - Payment.failed event: PaymentMachine validates transition to FAILED state with error logging
  - Guard logs illegal transitions without throwing (fail-safe, non-blocking)
  - Benefits: Prevents webhook-induced invalid state transitions, logs for debugging

### Worker Guard Implementation
- **rez-order-service** (src/worker.ts): OrderMachine guards order lifecycle events
  - Order event processor validates status transitions using OrderMachine
  - Safe guard: logs violations without failing job processing (best-effort)
  - Prevents corrupted states from propagating to database

### Testing
- Integration tests validate machine transitions in realistic webhook/event scenarios
- Machines ensure type-safe transitions across service boundaries
