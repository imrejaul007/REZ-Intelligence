import { AIProvider, ModelTier, ModelCosts } from '../types';

// AI Providers
export const PROVIDERS = {
  ANTHROPIC: 'anthropic' as const,
  OPENAI: 'openai' as const,
  GOOGLE: 'google' as const,
  LOCAL: 'local' as const,
};

export type AIProviderType = typeof PROVIDERS[keyof typeof PROVIDERS];

// Model tiers for cost optimization
export const MODEL_TIERS = {
  FAST: 'fast' as const,
  BALANCED: 'balanced' as const,
  POWERFUL: 'powerful' as const,
  MAX: 'max' as const,
};

export type ModelTierType = typeof MODEL_TIERS[keyof typeof MODEL_TIERS];

// Default models per provider
export const DEFAULT_MODELS: Record<string, Record<string, string>> = {
  [PROVIDERS.ANTHROPIC]: {
    [MODEL_TIERS.FAST]: 'claude-3-5-haiku-20241022',
    [MODEL_TIERS.BALANCED]: 'claude-3-5-sonnet-20241022',
    [MODEL_TIERS.POWERFUL]: 'claude-3-5-opus-20241022',
    [MODEL_TIERS.MAX]: 'claude-3-5-opus-20241022',
  },
  [PROVIDERS.OPENAI]: {
    [MODEL_TIERS.FAST]: 'gpt-4o-mini',
    [MODEL_TIERS.BALANCED]: 'gpt-4o-mini',
    [MODEL_TIERS.POWERFUL]: 'gpt-4o',
    [MODEL_TIERS.MAX]: 'gpt-4-turbo',
  },
  [PROVIDERS.GOOGLE]: {
    [MODEL_TIERS.FAST]: 'gemini-1.5-flash',
    [MODEL_TIERS.BALANCED]: 'gemini-1.5-flash',
    [MODEL_TIERS.POWERFUL]: 'gemini-1.5-pro',
    [MODEL_TIERS.MAX]: 'gemini-1.5-pro',
  },
  [PROVIDERS.LOCAL]: {
    [MODEL_TIERS.FAST]: 'local-model',
    [MODEL_TIERS.BALANCED]: 'local-model',
    [MODEL_TIERS.POWERFUL]: 'local-model',
    [MODEL_TIERS.MAX]: 'local-model',
  },
};

// Cost per 1M tokens (approximate)
export const MODEL_COSTS: ModelCosts = {
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-opus-20241022': { input: 15, output: 75 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
};

// Provider endpoints
export const PROVIDER_ENDPOINTS = {
  [PROVIDERS.ANTHROPIC]: 'https://api.anthropic.com/v1/messages',
  [PROVIDERS.OPENAI]: 'https://api.openai.com/v1/chat/completions',
  [PROVIDERS.GOOGLE]: 'https://generativelanguage.googleapis.com/v1beta/models',
};

// Default timeout for AI requests (60 seconds)
export const DEFAULT_TIMEOUT = 60000;

// Public paths that don't require authentication
export const PUBLIC_PATHS = ['/health', '/ready'];

// Required environment variables
export const REQUIRED_ENV = ['REDIS_URL', 'INTERNAL_SERVICE_TOKEN'] as const;
