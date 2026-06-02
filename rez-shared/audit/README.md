# Audit Log Emitter

Structured audit logging to a central audit sink.

## Usage

```typescript
import { AuditLogger } from '@rez/audit';

const auditLogger = new AuditLogger({
  baseUrl: 'https://audit.example.com',
  apiKey: process.env.AUDIT_API_KEY,
});

// Log a change
await auditLogger.log(
  'UPDATE',
  'Payment',
  'payment_123',
  {
    userId: 'user_456',
    userRole: 'admin',
    ipAddress: '192.168.1.1',
  },
  {
    before: { status: 'PENDING' },
    after: { status: 'SUCCESS' },
  },
);

// Cleanup on shutdown
process.on('exit', () => auditLogger.destroy());
```

See `ADR.md` for design rationale.
