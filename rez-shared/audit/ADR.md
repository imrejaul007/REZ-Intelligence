# ADR: Audit Log Emitter

## Context
Services lack centralized audit trails. Compliance audits require manual log aggregation. Who-changed-what tracking is inconsistent.

## Decision
Implement audit logger that emits structured logs (who/when/what/before/after) to a central audit sink via HTTP.

## Rationale
- Centralized audit trail for compliance and forensics
- Structured schema: who (userId, role, IP), what (action, resource, ID), before/after snapshots
- Batching and auto-flush reduce network overhead
- Subsumes bugs: missing audit trails, compliance violations, inconsistent change tracking

## Implementation
Exports:
- `AuditLogger` class: batches entries, flushes to HTTP endpoint
- `AuditLogEntry` interface: structured schema with before/after snapshots
- `createAuditEntry()` helper for common logging pattern
- Auto-flush on batch size or timer

## Related Issues
- Missing audit trails for compliance
- No centralized change history
- Inability to track who changed what and when

## Consumers (Phase 2: Wired Integration)

### Admin Service Integration
- **rezadmin** (services/auditService.ts): AuditLogger wraps destructive admin operations
  - Merchant suspension: `logMerchantSuspension()` captures admin user, merchant ID, suspension reason
  - Order refunds: `logOrderRefund()` captures refund amount, reason, admin context
  - Payout approvals: `logPayoutApproval()` captures payout ID, amount, approval time
  - Implementation: Async audit logging (non-blocking, queued)

### Integration Pattern
- **merchants.ts**: `suspendMerchant()` calls `logMerchantSuspension()` with admin context
- Audit entries include: who (userId, role, IP), what (action, resource), before/after state
- Batch flush: 5 entries per batch, 10s flush interval

### Benefits
- Immutable audit trail of all destructive operations
- Admin accountability and compliance auditing
- Non-blocking: audit failures don't fail operations
