# REZ E2E Tests - SPEC.md

**Version:** 1.0.0
**Type:** E2E Test Suite
**Company:** REZ-Intelligence
**Category:** Testing

---

## Overview

End-to-end test suite for REZ Intelligence platform. Tests complete user journeys across multiple services simulating real production scenarios.

---

## Test Scenarios

| Scenario | Description |
|----------|-------------|
| User Journey | Complete user flow from onboarding to order |
| Merchant Flow | Merchant setup to first sale |
| Agent Interaction | User-agent conversation |
| Notification Flow | Trigger to delivery |

---

## Running Tests

```bash
# Run E2E tests
npm test

# Run specific scenario
npm test -- --scenario merchant-flow

# Generate report
npm run test:report
```

---

## Status

- [x] Test foundation
- [ ] User journey tests
- [ ] Merchant flow tests
- [ ] Agent interaction tests
