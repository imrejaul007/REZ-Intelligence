/**
 * Feature Flags Module
 *
 * Runtime feature flags for gradual rollouts and dark launches.
 * All flags default to false for safety (opt-in behavior).
 */

/**
 * Feature flag definitions
 * Each flag has a description and default value (always false for dark launches)
 */
const FEATURE_FLAGS = {
  /**
   * Dark launch: Schema validation for API responses using apiContracts.ts
   * When enabled, responses are validated against canonical schemas but
   * failures are logged (not thrown) to detect schema drift in production.
   */
  SCHEMA_VALIDATION_ENABLED: {
    description: 'Dark-launch schema validation for API responses',
    default: false,
  },
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Get feature flag status
 * Override via environment variable: REZ_FEATURE_FLAGS=SCHEMA_VALIDATION_ENABLED:true,OTHER_FLAG:false
 * Or pass explicit overrides map
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  overrides?: Record<FeatureFlag, boolean>
): boolean {
  // 1. Check explicit overrides (highest priority)
  if (overrides?.[flag] !== undefined) {
    return overrides[flag];
  }

  // 2. Check environment variable
  if (typeof process !== 'undefined' && process.env) {
    const envFlags = process.env.REZ_FEATURE_FLAGS || '';
    const match = envFlags.split(',').find(f => f.startsWith(`${flag}:`));
    if (match) {
      return match.split(':')[1] === 'true';
    }
  }

  // 3. Check localStorage (client-side)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(`rez_flag_${flag}`);
      if (stored !== null) {
        return stored === 'true';
      }
    }
  } catch {
    // localStorage may not be available in some contexts
  }

  // 4. Fall back to default
  return FEATURE_FLAGS[flag].default;
}

/**
 * Set feature flag at runtime (e.g., for testing or admin overrides)
 * In production, prefer environment variables
 */
export function setFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(`rez_flag_${flag}`, String(enabled));
    }
  } catch {
    // localStorage may not be available
  }
}

/**
 * Get all feature flags status for debugging
 */
export function getAllFeatureFlags(): Record<FeatureFlag, { enabled: boolean; description: string }> {
  return Object.entries(FEATURE_FLAGS).reduce((acc, [flag, config]) => {
    acc[flag as FeatureFlag] = {
      enabled: isFeatureEnabled(flag as FeatureFlag),
      description: config.description,
    };
    return acc;
  }, {} as Record<FeatureFlag, { enabled: boolean; description: string }>);
}
