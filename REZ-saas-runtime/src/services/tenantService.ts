/**
 * REZ SaaS Runtime - Tenant Service
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Tenant,
  ClientType,
  IntelligenceLevel,
  TenantStatus,
  PlanType,
  CreateTenantRequest,
  UpdateTenantRequest,
} from '../types';
import { logger } from '../utils/logger.js';

// In-memory store (replace with MongoDB in production)
const tenants = new Map<string, Tenant>();

export class TenantService {
  private apiKeyPrefixes = {
    [ClientType.REZ_ECOSYSTEM]: 'rez_',
    [ClientType.NON_REZ]: 'ext_',
    [ClientType.RABTUL_SAAS]: 'saas_',
  };

  /**
   * Create a new tenant
   */
  async createTenant(request: CreateTenantRequest): Promise<{ tenant: Tenant; apiKey: string }> {
    const tenantId = this.generateTenantId(request.clientType, request.displayName);
    const apiKey = this.generateApiKey(request.clientType, tenantId);

    const tenant: Tenant = {
      id: uuidv4(),
      tenantId,
      clientType: request.clientType,
      displayName: request.displayName,
      industry: request.industry,
      merchantId: request.merchantId,
      email: request.email,
      phone: request.phone,
      status: TenantStatus.PENDING,
      intelligenceLevel: this.getDefaultIntelligenceLevel(request.clientType),
      dataIsolation: request.clientType === ClientType.REZ_ECOSYSTEM ? 'shared' : 'strict',
      permissions: this.getDefaultPermissions(request.clientType),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tenants.set(tenantId, tenant);
    logger.info('Tenant created', { tenantId, clientType: request.clientType });

    return { tenant, apiKey };
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): Tenant | undefined {
    return tenants.get(tenantId);
  }

  /**
   * List all tenants
   */
  listTenants(clientType?: ClientType): Tenant[] {
    const all = Array.from(tenants.values());
    if (clientType) {
      return all.filter(t => t.clientType === clientType);
    }
    return all;
  }

  /**
   * Update tenant
   */
  updateTenant(tenantId: string, updates: UpdateTenantRequest): Tenant | undefined {
    const tenant = tenants.get(tenantId);
    if (!tenant) return undefined;

    const updated: Tenant = {
      ...tenant,
      ...updates,
      updatedAt: new Date(),
    };

    tenants.set(tenantId, updated);
    logger.info('Tenant updated', { tenantId });
    return updated;
  }

  /**
   * Activate tenant
   */
  activateTenant(tenantId: string): Tenant | undefined {
    return this.updateTenant(tenantId, { status: TenantStatus.ACTIVE });
  }

  /**
   * Suspend tenant
   */
  suspendTenant(tenantId: string): Tenant | undefined {
    return this.updateTenant(tenantId, { status: TenantStatus.SUSPENDED });
  }

  /**
   * Delete tenant
   */
  deleteTenant(tenantId: string): boolean {
    const deleted = tenants.delete(tenantId);
    if (deleted) {
      logger.info('Tenant deleted', { tenantId });
    }
    return deleted;
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey: string): { valid: boolean; tenant?: Tenant; clientType?: ClientType } {
    const parts = apiKey.split('_');
    if (parts.length < 3) {
      return { valid: false };
    }

    const prefix = parts[0];
    const clientType = this.getClientTypeFromPrefix(prefix);
    if (!clientType) {
      return { valid: false };
    }

    const tenantId = parts.slice(1, -1).join('_');
    const tenant = tenants.get(tenantId);

    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      return { valid: false };
    }

    return { valid: true, tenant, clientType };
  }

  /**
   * Generate tenant ID
   */
  private generateTenantId(clientType: ClientType, displayName: string): string {
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 20);
    return `${slug}_${Date.now().toString(36)}`;
  }

  /**
   * Generate API key
   */
  private generateApiKey(clientType: ClientType, tenantId: string): string {
    const prefix = this.apiKeyPrefixes[clientType];
    const random = uuidv4().replace(/-/g, '').substring(0, 16);
    return `${prefix}${tenantId}_${random}`;
  }

  /**
   * Get client type from prefix
   */
  private getClientTypeFromPrefix(prefix: string): ClientType | null {
    const entry = Object.entries(this.apiKeyPrefixes).find(([, p]) => p === `${prefix}_`);
    return entry ? (entry[0] as ClientType) : null;
  }

  /**
   * Get default intelligence level for client type
   */
  private getDefaultIntelligenceLevel(clientType: ClientType): IntelligenceLevel {
    switch (clientType) {
      case ClientType.REZ_ECOSYSTEM:
        return IntelligenceLevel.FULL;
      case ClientType.NON_REZ:
        return IntelligenceLevel.ISOLATED;
      case ClientType.RABTUL_SAAS:
        return IntelligenceLevel.FULL;
      default:
        return IntelligenceLevel.ISOLATED;
    }
  }

  /**
   * Get default permissions for client type
   */
  private getDefaultPermissions(clientType: ClientType): string[] {
    switch (clientType) {
      case ClientType.REZ_ECOSYSTEM:
        return ['admin', 'read', 'write', 'execute', 'share'];
      case ClientType.NON_REZ:
        return ['read', 'write'];
      case ClientType.RABTUL_SAAS:
        return ['admin', 'read', 'write', 'execute', 'billing'];
      default:
        return ['read'];
    }
  }
}

export const tenantService = new TenantService();
