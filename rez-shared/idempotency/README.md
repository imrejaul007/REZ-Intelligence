# Idempotency Key Management

Idempotency key client and server helpers for preventing duplicate operations.

## Usage

```typescript
import {
  generateIdempotencyKey,
  IDEMPOTENCY_KEY_HEADER,
  RedisIdempotencyStore,
  ensureIdempotency
} from '@rez/idempotency';

// Client: generate and send key
const idempotencyKey = generateIdempotencyKey();
headers[IDEMPOTENCY_KEY_HEADER] = idempotencyKey;

// Server: check cache before operation
const store = new RedisIdempotencyStore(redisClient);
const result = await ensureIdempotency(store, idempotencyKey, async () => {
  return await createPayment(data);
});
```

See `ADR.md` for design rationale.
