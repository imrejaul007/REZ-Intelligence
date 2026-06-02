# Feature Flag Client

Abstraction over LaunchDarkly or env-var based feature flags.

## Usage

```typescript
import { createFeatureFlagClient } from '@rez/flags';

// Development: env-based
const flagClient = createFeatureFlagClient('env');

// Production: LaunchDarkly
const flagClient = createFeatureFlagClient('launchdarkly', {
  sdkKey: process.env.LAUNCHDARKLY_SDK_KEY,
});

// Check if feature is enabled
const enabled = await flagClient.isEnabled('new-payment-flow', {
  userId: 'user123',
  userRole: 'premium',
});

if (enabled) {
  // Use new payment flow
}
```

See `ADR.md` for design rationale.
