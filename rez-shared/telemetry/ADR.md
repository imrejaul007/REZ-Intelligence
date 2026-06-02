# ADR: Redacting Logger with Sentry

## Context
Services log sensitive data (PII, credit cards, SSN, tokens) to stdout and Sentry, causing data breaches.

## Decision
Implement regex-based PII redaction at log time and Sentry integration wrapper.

## Rationale
- Regex patterns catch credit cards, SSN, email, phone, passwords before logging
- Redaction is transparent to callers
- Sentry integration catches unhandled errors with redacted context
- Subsumes bugs: PII leaks in logs, untracked errors, inconsistent log formats

## Implementation
Exports:
- `RedactingLogger` class with debug/info/warn/error methods
- Default redaction patterns for credit card, SSN, email, phone, password fields
- Sentry initialization wrapper in constructor
- Recursive context redaction for nested objects

## Related Issues
- PII leaks in application logs
- Untracked service errors
- Inconsistent error reporting across services

## Consumers (Phase 2: Wired Integration)

### Redacting Logger Integration
- **rez-app-consumer** (utils/logger.ts): Integrated RedactingLogger from `@rez/shared/telemetry`
  - Logger instance instantiates RedactingLogger for PII redaction
  - All console.log paths wrapped with shared redaction patterns
  - Redaction patterns include: credit cards, tokens, passwords, SSNs, emails, phone numbers
  - Implementation: Logger.debug/info/warn/error methods call redactingLogger for centralized redaction

### Log Redaction Pipeline
- Development: Full logs to console
- Production: Redacted logs via Sentry integration
- Context: Service name `rez-app-consumer`, environment-aware configuration

### Benefits
- Prevents accidental logging of sensitive data
- Consistent redaction across all services
- Centralized patterns prevent pattern drift
