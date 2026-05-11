# ReZ Error Intelligence — Index

Central error tracking for the entire REZ ecosystem.

## Repositories Covered

| Repository | Type | CI Status |
|-----------|------|----------|
| rez-app-consumer | React Native | ✅ |
| rez-merchant | Next.js | ✅ |
| rezadmin | Next.js | ✅ |
| rez-web-menu | Next.js | ✅ |
| rez-now | Next.js | ✅ |
| adBazaar | Next.js | ✅ |
| rez-backend-master | Node/Express | ✅ |
| rez-api-gateway | API Gateway | ✅ |
| rez-auth-service | Microservice | ✅ |
| rez-wallet-service | Microservice | ✅ |
| rez-payment-service | Microservice | ✅ |
| rez-order-service | Microservice | ✅ |
| rez-merchant-service | Microservice | ✅ |
| rez-catalog-service | Microservice | ✅ |
| rez-search-service | Microservice | ✅ |
| rez-gamification-service | Microservice | ✅ |
| rez-karma-service | Microservice | ✅ |
| rez-ads-service | Microservice | ✅ |
| rez-marketing-service | Microservice | ✅ |
| rez-shared | Shared Package | ✅ |

## Error Types

| Prefix | Category | Description |
|--------|----------|-------------|
| `ERR-BUILD-*` | Build | Compilation, dependency, type errors |
| `ERR-DEPLOY-*` | Deployment | ENV misconfig, platform failures |
| `ERR-RUNTIME-*` | Runtime | API crashes, DB failures, timeouts |
| `ERR-CI-*` | CI/CD | Pipeline failures, test timeouts |
| `ERR-SECURITY-*` | Security | Vulnerability findings |

## How to Report

1. Go to the Issues tab in this repo
2. Use the appropriate template (Bug, Deploy Error, Security)
3. Fill in all required fields
4. Set the `repo` label to the affected repository
5. Link the fix PR with `Fixes rez-error-intelligence#<number>`

## Prevention Enforcement

Every DEPLOY_ERROR and SECURITY issue must have at least ONE prevention action:

- `prevention.ci_rule_added` — CI script or validation added
- `prevention.test_added` — Test case added
- `prevention.validation_added` — Input validation
- `prevention.architectural_constraint` — Arch fitness rule
- `prevention.runbook_entry` — Documentation
