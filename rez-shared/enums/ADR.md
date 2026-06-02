# ADR: Shared Enum Registry

## Context
Services use different string representations for order status, payment status, user roles, etc., causing data inconsistencies and comparison bugs.

## Decision
Centralize all canonical enums in a single TypeScript module with validation helpers.

## Rationale
- Single source of truth prevents status value inconsistencies
- Type-safe enum checking prevents runtime errors
- Validation helpers enable safe casting from external data
- Subsumes bugs: status comparison mismatches, invalid state transitions

## Implementation
Exports enums for:
- OrderStatus (CART, CHECKOUT, PAID, FULFILLED, DELIVERED, CANCELLED, REFUNDED)
- PaymentStatus (INIT, PENDING, SUCCESS, FAILED)
- UserRole (CUSTOMER, MERCHANT, ADMIN, SUPPORT)
- TransactionType, NotificationChannel

Includes validators: `isValidOrderStatus()`, `isValidPaymentStatus()`, etc.

## Related Issues
- Status value string mismatches across services
- Invalid enum values causing silent failures
- Type inference gaps in status handling

## Consumers (Phase 2: Wired Integration)

### Services Using Enums
- **rez-payment-service** (src/services/paymentService.ts): Replaced 3 string literal usages with PaymentStatus enum
  - Line 292: `status: PaymentStatus.PENDING` (was `'pending'`)
  - Line 682: `payment.status = PaymentStatus.FAILED` (was `'failed'`)
  - Line 205/247: Payment status checks use PaymentStatus enum values

- **rez-order-service** (src/worker.ts): Replaced status string literals with OrderStatus enum
  - Line 268: `status: OrderStatus.CANCELLED` (was `'cancelled'`)
  - Line 370: `status: OrderStatus.CANCELLED` (was `'returned'`)
  - Worker status transition logic now type-safe with enum

### Validation Approach
- Imported enums ensure compile-time type safety
- Runtime validation via `isValidOrderStatus()` and `isValidPaymentStatus()` guards
- Enum values used consistently across event handling and state persistence
