/**
 * REZ Agent Orchestrator
 *
 * Multi-agent coordination system with marketing integration.
 * Exports all orchestrator types, classes, and utilities.
 */

// Core types and interfaces
export {
  AgentTask,
  SubTask,
  AgentResult,
  AgentType,
  Tool,
  ToolParameter,
  ApprovalRequest,
  AGENT_TYPES,
} from './AgentOrchestrator';

// Marketing integration exports
export {
  MarketingIntegration,
  marketingIntegration,
  AgentEventType,
  AgentInsight,
  MarketingCampaignPayload,
  MarketingApiResponse,
  createAbandonmentInsight,
  createWinBackInsight,
  createRetentionInsight,
  createReferralInsight,
  createUrgencyInsight,
  createChurnRiskInsight,
  mapAgentTaskToMarketingInsight,
  onAgentTaskCompleted,
  batchProcessInsights,
  triggerMarketingFromTask,
  triggerMarketingCampaign,
  getMarketingHealth,
} from './AgentOrchestrator';

// Import orchestrator core
import {
  AgentTask,
  AgentType,
  AGENT_TYPES,
  triggerMarketingFromTask,
  triggerMarketingCampaign,
  getMarketingHealth,
} from './AgentOrchestrator';

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

// Re-export for convenience
export { triggerMarketingFromTask, triggerMarketingCampaign, getMarketingHealth };

export default {
  initializeOrchestrator,
  getOrchestratorConfig,
  isMarketingEnabled,
  triggerMarketingFromTask,
  triggerMarketingCampaign,
  getMarketingHealth,
};
