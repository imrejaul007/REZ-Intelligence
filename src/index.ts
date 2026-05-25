/**
 * REZ Agent Orchestrator
 *
 * Multi-agent coordination system with marketing integration.
 * Exports all orchestrator types, classes, and utilities.
 */

// Core types and interfaces
export type {
  AgentTask,
  SubTask,
  AgentResult,
  AgentType,
  Tool,
  ToolParameter,
  ApprovalRequest,
} from './AgentOrchestrator';

export { AGENT_TYPES } from './AgentOrchestrator';

// Marketing integration exports
export type {
  AgentEventType,
  AgentInsight,
  MarketingCampaignPayload,
  MarketingApiResponse,
} from './marketingIntegration';

export {
  MarketingIntegration,
  marketingIntegration,
  createAbandonmentInsight,
  createWinBackInsight,
  createRetentionInsight,
  createReferralInsight,
  createUrgencyInsight,
  createChurnRiskInsight,
  mapAgentTaskToMarketingInsight,
  onAgentTaskCompleted,
  batchProcessInsights,
} from './marketingIntegration';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Base URL for marketing service */
  marketingServiceUrl?: string;
  /** Internal service token for authentication */
  internalServiceToken?: string;
  /** Enable/disable marketing integration */
  marketingEnabled?: boolean;
  /** Maximum concurrent marketing requests */
  maxConcurrentMarketingRequests?: number;
}

const DEFAULT_CONFIG: Required<OrchestratorConfig> = {
  marketingServiceUrl: process.env.MARKETING_SERVICE_URL || 'http://localhost:4000',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || '',
  marketingEnabled: process.env.MARKETING_ENABLED !== 'false',
  maxConcurrentMarketingRequests: 3,
};

let currentConfig: OrchestratorConfig = {};

/**
 * Initialize the orchestrator with configuration
 */
export function initializeOrchestrator(config: OrchestratorConfig = {}): void {
  currentConfig = { ...DEFAULT_CONFIG, ...config };

  // Set environment variables if provided
  if (config.marketingServiceUrl) {
    process.env.MARKETING_SERVICE_URL = config.marketingServiceUrl;
  }
  if (config.internalServiceToken) {
    process.env.INTERNAL_SERVICE_TOKEN = config.internalServiceToken;
  }
}

/**
 * Get current orchestrator configuration
 */
export function getOrchestratorConfig(): OrchestratorConfig {
  return { ...currentConfig };
}

/**
 * Check if marketing integration is enabled
 */
export function isMarketingEnabled(): boolean {
  return currentConfig.marketingEnabled ?? DEFAULT_CONFIG.marketingEnabled;
}

export default {
  initializeOrchestrator,
  getOrchestratorConfig,
  isMarketingEnabled,
};
