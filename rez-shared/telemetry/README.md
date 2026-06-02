# Redacting Logger with Sentry

PII-aware logger with regex-based redaction and Sentry integration.

## Usage

```typescript
import { RedactingLogger } from '@rez/telemetry';

const logger = new RedactingLogger({
  serviceName: 'payment-service',
  environment: 'production',
  sentryDsn: process.env.SENTRY_DSN,
});

logger.info('User signed up', {
  email: 'user@example.com', // automatically redacted
  phone: '+1-234-567-8900', // automatically redacted
});

logger.error('Payment failed', {
  cardNumber: '4111111111111111', // automatically redacted
  error: 'Gateway timeout',
});
```

See `ADR.md` for design rationale.
