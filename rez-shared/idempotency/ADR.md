# ADR: Idempotency Key Management

## Context
Duplicate requests cause duplicate charges and order creation. Network retries and client-side resubmissions are common.

## Decision
Implement canonical idempotency key generation and storage with Redis or in-memory backing.

## Rationale
- UUIDv4 keys ensure uniqueness across all clients
- Redis store enables distributed idempotency across service replicas
- In-memory fallback for development and single-instance services
- Subsumes bugs: duplicate charges, race conditions on payment submission

## Implementation
Exports:
- `generateIdempotencyKey()`: UUIDv4 generator
- `IDEMPOTENCY_KEY_HEADER`: "X-Idempotency-Key" constant
- `IdempotencyStore` interface: get/set/exists methods
- `RedisIdempotencyStore`, `InMemoryIdempotencyStore` implementations
- `ensureIdempotency()`: helper to cache operation results by key

## Related Issues
- Duplicate payment charges from network retries
- Race conditions on concurrent idempotent requests
- Lost idempotency across service restarts

## Consumers (Phase 2: Wired Integration)

### Client-Side Implementation
- **rez-app-consumer** (utils/idempotencyHelper.ts): Uses shared idempotency key generator
  - `generateIdempotencyKey()` imported from `@rez/shared/idempotency`
  - Helper wraps generation with AsyncStorage caching for deduplication on mobile
  - `executeWithIdempotency<T>()` provides retryable operation wrapper
  - Benefits: Safe retry semantics on unreliable mobile networks, prevents duplicate API requests

### Integration Pattern
- Generated keys used in API request headers (`X-Idempotency-Key`)
- Result cached for 24 hours in AsyncStorage
- Retries return cached result instead of re-executing operation
