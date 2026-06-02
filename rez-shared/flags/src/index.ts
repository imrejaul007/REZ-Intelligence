export interface FeatureFlagContext {
  userId?: string;
  userRole?: string;
  merchantId?: string;
  environment?: string;
  [key: string]: any;
}

export interface FeatureFlagClient {
  isEnabled(flagKey: string, context: FeatureFlagContext, defaultValue?: boolean): Promise<boolean>;
  getVariation(flagKey: string, context: FeatureFlagContext, defaultValue?: any): Promise<any>;
  track(eventKey: string, context: FeatureFlagContext, data?: any): Promise<void>;
}

export class EnvBasedFeatureFlagClient implements FeatureFlagClient {
  constructor(private envPrefix = 'FEATURE_FLAG_') {}

  async isEnabled(
    flagKey: string,
    _context: FeatureFlagContext,
    defaultValue = false,
  ): Promise<boolean> {
    const envKey = `${this.envPrefix}${flagKey.toUpperCase()}`;
    const envValue = process.env[envKey];
    if (envValue === undefined) return defaultValue;
    return envValue === 'true' || envValue === '1';
  }

  async getVariation(
    flagKey: string,
    _context: FeatureFlagContext,
    defaultValue?: any,
  ): Promise<any> {
    const envKey = `${this.envPrefix}${flagKey.toUpperCase()}`;
    const envValue = process.env[envKey];
    return envValue || defaultValue;
  }

  async track(_eventKey: string, _context: FeatureFlagContext, _data?: any): Promise<void> {
    // No-op for env-based client
  }
}

export class LaunchDarklyFeatureFlagClient implements FeatureFlagClient {
  private initialized = false;

  constructor(private sdkKey: string) {}

  async init(): Promise<void> {
    // LaunchDarkly initialization would happen here
    // This is a stub to demonstrate the pattern
    this.initialized = true;
  }

  async isEnabled(
    flagKey: string,
    context: FeatureFlagContext,
    defaultValue = false,
  ): Promise<boolean> {
    if (!this.initialized) {
      return defaultValue;
    }
    // LaunchDarkly evaluation would happen here
    return defaultValue;
  }

  async getVariation(
    flagKey: string,
    context: FeatureFlagContext,
    defaultValue?: any,
  ): Promise<any> {
    if (!this.initialized) {
      return defaultValue;
    }
    // LaunchDarkly variation would happen here
    return defaultValue;
  }

  async track(eventKey: string, context: FeatureFlagContext, data?: any): Promise<void> {
    if (!this.initialized) {
      return;
    }
    // LaunchDarkly tracking would happen here
  }
}

export function createFeatureFlagClient(
  mode: 'env' | 'launchdarkly' = 'env',
  options?: { envPrefix?: string; sdkKey?: string },
): FeatureFlagClient {
  if (mode === 'launchdarkly' && options?.sdkKey) {
    return new LaunchDarklyFeatureFlagClient(options.sdkKey);
  }
  return new EnvBasedFeatureFlagClient(options?.envPrefix);
}
