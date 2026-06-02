# ADR: Feature Flag Client Interface

## Context
Services hardcode feature rollouts. Rolling back features requires code deployment. A/B testing and canary releases are manual.

## Decision
Implement feature flag client interface with LaunchDarkly as primary backend and env-var fallback for development.

## Rationale
- Abstraction over LaunchDarkly allows switching implementations
- Env-based fallback enables development without external service
- Context-aware evaluation (user role, merchant, environment) enables fine-grained targeting
- Subsumes bugs: stuck feature flags, hard-coded rollouts, manual A/B testing overhead

## Implementation
Exports:
- `FeatureFlagClient` interface: isEnabled, getVariation, track methods
- `EnvBasedFeatureFlagClient`: reads FEATURE_FLAG_* env vars
- `LaunchDarklyFeatureFlagClient`: delegates to LaunchDarkly SDK
- `createFeatureFlagClient()`: factory function for client selection

## Related Issues
- Hard-coded feature rollouts requiring deployment
- Inability to disable features in production
- Manual A/B testing overhead
