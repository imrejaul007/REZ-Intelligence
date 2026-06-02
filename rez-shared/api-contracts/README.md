# API Contracts Registry

Canonical OpenAPI/tRPC schema registry for REZ ecosystem.

## Usage

```typescript
import { PaymentSchema, OrderSchema, APIContractRegistry } from '@rez/api-contracts';

// Validate incoming payment data
const payment = PaymentSchema.parse(incomingData);

// Validate order mutations
const orderUpdate = OrderSchema.partial().parse(updatePayload);

// Access schema metadata
const paymentContract = APIContractRegistry.payment;
```

See `ADR.md` for design rationale and mapping to bug fixes.
