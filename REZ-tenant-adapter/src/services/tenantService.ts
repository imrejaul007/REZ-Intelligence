/**
 * Tenant Service
 * Manages tenant configurations, knowledge bases, and isolation
 */

import { v4 as uuidv4 } from 'uuid';
import { TenantConfig, ClientType, IntelligenceLevel } from '../types';

// In-memory tenant store (use Redis/MongoDB in production)
const tenantStore = new Map<string, TenantConfig>();

// Default configurations by client type
const DEFAULT_CONFIGS: Record<ClientType, Partial<TenantConfig>> = {
  [ClientType.REZ_ECOSYSTEM]: {
    intelligenceLevel: IntelligenceLevel.FULL,
    permissions: ['read', 'write', 'admin', 'share', 'analytics'],
    rateLimit: { requestsPerMinute: 1000, requestsPerDay: 100000 },
    features: {
      intentPrediction: true,
      recommendations: true,
      automatedResponses: true,
      analytics: true,
      multiLanguage: true
    },
    privacy: {
      shareAnonymizedData: true,
      allowCrossTenantLearning: true,
      dataRetentionDays: 365
    }
  },
  [ClientType.NON_REZ]: {
    intelligenceLevel: IntelligenceLevel.ANONYMIZED,
    permissions: ['read', 'write', 'analytics'],
    rateLimit: { requestsPerMinute: 100, requestsPerDay: 10000 },
    features: {
      intentPrediction: true,
      recommendations: true,
      automatedResponses: false,
      analytics: true,
      multiLanguage: true
    },
    privacy: {
      shareAnonymizedData: false,
      allowCrossTenantLearning: false,
      dataRetentionDays: 90
    }
  },
  [ClientType.RABTUL_SAAS]: {
    intelligenceLevel: IntelligenceLevel.ISOLATED,
    permissions: ['read', 'write'],
    rateLimit: { requestsPerMinute: 500, requestsPerDay: 50000 },
    features: {
      intentPrediction: true,
      recommendations: false,
      automatedResponses: true,
      analytics: false,
      multiLanguage: false
    },
    privacy: {
      shareAnonymizedData: false,
      allowCrossTenantLearning: false,
      dataRetentionDays: 30
    }
  }
};

export class TenantService {
  /**
   * Create a new tenant
   */
  createTenant(config: {
    clientType: ClientType;
    displayName: string;
    industry: string;
    merchantId?: string;
  }): TenantConfig {
    const tenantId = uuidv4();
    const knowledgeBaseId = `kb_${tenantId.substring(0, 8)}`;

    const tenant: TenantConfig = {
      tenantId,
      clientType: config.clientType,
      merchantId: config.merchantId,
      displayName: config.displayName,
      industry: config.industry,
      knowledgeBaseId,
      intelligenceLevel: DEFAULT_CONFIGS[config.clientType].intelligenceLevel!,
      permissions: DEFAULT_CONFIGS[config.clientType].permissions!,
      rateLimit: DEFAULT_CONFIGS[config.clientType].rateLimit!,
      features: DEFAULT_CONFIGS[config.clientType].features!,
      privacy: DEFAULT_CONFIGS[config.clientType].privacy!
    };

    tenantStore.set(tenantId, tenant);
    return tenant;
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): TenantConfig | undefined {
    return tenantStore.get(tenantId);
  }

  /**
   * Get tenant by API key
   */
  getTenantByApiKey(apiKey: string): TenantConfig | undefined {
    for (const tenant of tenantStore.values()) {
      if (this.generateApiKey(tenant) === apiKey) {
        return tenant;
      }
    }
    return undefined;
  }

  /**
   * Generate API key for tenant
   */
  generateApiKey(tenant: TenantConfig): string {
    const prefix = {
      [ClientType.REZ_ECOSYSTEM]: 'rez_rez',
      [ClientType.NON_REZ]: 'rez_ext',
      [ClientType.RABTUL_SAAS]: 'rez_saas'
    };
    return `${prefix[tenant.clientType]}_${tenant.tenantId.replace(/-/g, '')}`;
  }

  /**
   * Update tenant configuration
   */
  updateTenant(tenantId: string, updates: Partial<TenantConfig>): TenantConfig | undefined {
    const tenant = tenantStore.get(tenantId);
    if (!tenant) return undefined;

    const updated = { ...tenant, ...updates, tenantId: tenant.tenantId };
    tenantStore.set(tenantId, updated);
    return updated;
  }

  /**
   * Delete tenant
   */
  deleteTenant(tenantId: string): boolean {
    return tenantStore.delete(tenantId);
  }

  /**
   * List all tenants
   */
  listTenants(clientType?: ClientType): TenantConfig[] {
    const all = Array.from(tenantStore.values());
    if (clientType) {
      return all.filter(t => t.clientType === clientType);
    }
    return all;
  }

  /**
   * Check if intelligence sharing is allowed
   */
  canShareIntelligence(tenantId: string): boolean {
    const tenant = tenantStore.get(tenantId);
    if (!tenant) return false;
    return tenant.intelligenceLevel === IntelligenceLevel.FULL;
  }

  /**
   * Get data isolation level
   */
  getDataIsolationLevel(tenantId: string): 'strict' | 'standard' | 'shared' {
    const tenant = tenantStore.get(tenantId);
    if (!tenant) return 'strict';

    switch (tenant.intelligenceLevel) {
      case IntelligenceLevel.FULL:
        return 'shared';
      case IntelligenceLevel.ANONYMIZED:
        return 'standard';
      case IntelligenceLevel.ISOLATED:
        return 'strict';
      default:
        return 'strict';
    }
  }

  /**
   * Validate tenant access to resource
   */
  canAccessResource(tenantId: string, resourceTenantId: string): boolean {
    if (tenantId === resourceTenantId) return true;

    const tenant = tenantStore.get(tenantId);
    if (!tenant) return false;

    // REZ ecosystem can access shared resources
    if (tenant.clientType === ClientType.REZ_ECOSYSTEM) {
      return true;
    }

    // External tenants can only access their own resources
    return false;
  }
}

export const tenantService = new TenantService();
