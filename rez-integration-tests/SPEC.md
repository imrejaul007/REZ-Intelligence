# REZ Integration Tests - SPEC.md

**Version:** 1.0.0
**Type:** Test Suite
**Company:** REZ-Intelligence
**Category:** Testing

---

## Overview

Integration test suite for REZ Intelligence services. Tests cross-service communication, API contracts, and end-to-end workflows.

---

## Test Coverage

| Category | Coverage |
|----------|----------|
| API Endpoints | Request/response validation |
| Service Communication | Inter-service calls |
| Data Flow | End-to-end transactions |
| Error Handling | Failure scenarios |

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/services/order.test.ts

# Run with coverage
npm run test:coverage
```

---

## Status

- [x] Test foundation
- [ ] API tests
- [ ] Service tests
- [ ] E2E tests
