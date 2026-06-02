# ADR: API Contracts Registry

## Context
Multiple services need a canonical source of truth for API schemas to prevent data format mismatches and enable type-safe integrations across the REZ ecosystem.

## Decision
Establish a centralized Zod-based schema registry with OpenAPI metadata that all services consume for validation and code generation.

## Rationale
- Zod provides runtime validation with TypeScript type inference
- OpenAPI metadata enables documentation generation and SDK creation
- Single source of truth prevents schema divergence between services
- Subsumes bug tracking for: data validation inconsistencies, cross-service contract violations

## Implementation
Registry located at `@rez/api-contracts` exports Zod schemas for:
- Payment (id, amount, currency, status, timestamps)
- Order (id, paymentId, items, status, total, timestamps)
- Extension point for additional domains

## Related Issues
- Data format mismatches between payment and order services
- Schema drift in microservices communication
- Type safety gaps in cross-service integrations
