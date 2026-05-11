# rez-error-intelligence

Central error knowledge base for the entire REZ ecosystem.

## Purpose

All REZ repositories report errors here. This creates a unified view of every build, deployment, and runtime error across 20+ repositories.

## Error Format

All errors use the format:

```
[SERVICE][TYPE] Short description
```

Examples:
- `[WALLET][BUILD] Missing mongoose dependency in rez-wallet-service`
- `[GATEWAY][DEPLOY] Missing API_KEY environment variable`
- `[PAYMENT][RUNTIME] Stripe webhook signature validation failed`

## Error ID Format

```
ERR-{TYPE}-{NNN}
```

Where:
- `TYPE` = `BUILD` | `DEPLOY` | `RUNTIME` | `CI` | `SECURITY`
- `NNN` = sequential number, padded to 3 digits

Examples: `ERR-BUILD-001`, `ERR-DEPLOY-042`, `ERR-RUNTIME-017`

## Workflow

### 1. Error Occurs
Any repo's CI/CD pipeline or runtime generates an error.

### 2. Issue Created
Either:
- **Auto**: GitHub Actions workflow creates issue via `capture-error.yml`
- **Manual**: Engineer creates issue using the template

### 3. Engineer Investigates
Fills in:
- Root Cause
- Fix Applied
- Prevention Actions

### 4. Fix PR
- Engineer creates fix in the source repository
- PR description includes: `Fixes rez-error-intelligence#<issue_number>`
- Prevention is verified in the PR checklist

### 5. Issue Closed
Issue is closed with `resolution` label and `ERR-*` ID assigned.

### 6. Documented
Error is added to `errors/ERRORS.json` with full metadata.

## Prevention System

Every DEPLOY_ERROR and SECURITY issue MUST have at least ONE prevention:

1. **CI Rule** — Add check to `scripts/arch-fitness/` or shared CI
2. **Test Case** — Add unit or integration test
3. **Validation** — Add input validation at system boundary
4. **Arch Constraint** — Add to architecture fitness rules
5. **Runbook** — Add to docs/runbooks/

## Analytics

Weekly analytics report runs every Monday at 9am:
- Most failing repositories
- Most common error patterns
- Prevention coverage rate
- MTTR (Mean Time To Resolve)

## How to Contribute

1. Report errors using GitHub Issues with the appropriate template
2. Always include root cause and prevention
3. Link fix PRs with `Fixes rez-error-intelligence#<number>`
4. Do not close issues without a prevention action
