/**
 * Privacy Service
 * Enforces data isolation and intelligence sharing rules
 */

import { ClientType, IntelligenceLevel, TenantConfig, TenantContext } from '../types';

export interface PrivacyCheck {
  allowed: boolean;
  reason?: string;
  level: 'strict' | 'standard' | 'shared';
}

type TenantIdentity = Pick<TenantConfig, 'tenantId' | 'clientType' | 'intelligenceLevel'>;

export class PrivacyService {
  /**
   * Check if tenant can access cross-tenant data
   */
  canAccessCrossTenantData(
    requestingTenant: TenantIdentity,
    targetTenantId: string
  ): PrivacyCheck {
    if (requestingTenant.tenantId === targetTenantId) {
      return { allowed: true, level: 'shared' };
    }

    if (requestingTenant.clientType === ClientType.REZ_ECOSYSTEM) {
      return {
        allowed: true,
        reason: 'REZ ecosystem data sharing enabled',
        level: 'shared'
      };
    }

    return {
      allowed: false,
      reason: 'Cross-tenant access not allowed for external tenants',
      level: 'strict'
    };
  }

  /**
   * Check if intent can be shared
   */
  canShareIntent(
    tenant: TenantIdentity,
    intentData: { userId: string; intent: string; confidence: number }
  ): PrivacyCheck {
    if (tenant.clientType === ClientType.REZ_ECOSYSTEM) {
      return {
        allowed: true,
        level: 'shared'
      };
    }

    if (tenant.intelligenceLevel === IntelligenceLevel.ANONYMIZED) {
      return {
        allowed: true,
        reason: 'Anonymized patterns only',
        level: 'standard'
      };
    }

    return {
      allowed: false,
      reason: 'Intent sharing not enabled for this tenant type',
      level: 'strict'
    };
  }

  /**
   * Check if analytics can be shared
   */
  canShareAnalytics(
    tenant: TenantIdentity,
    analyticsType: 'aggregate' | 'per_user' | 'per_merchant'
  ): PrivacyCheck {
    if (tenant.clientType === ClientType.REZ_ECOSYSTEM) {
      return { allowed: true, level: 'shared' };
    }

    if (analyticsType === 'aggregate') {
      return {
        allowed: true,
        reason: 'Aggregate analytics only',
        level: 'standard'
      };
    }

    return {
      allowed: false,
      reason: 'Per-user or per-merchant analytics not available',
      level: 'strict'
    };
  }

  /**
   * Filter data based on tenant privacy settings
   */
  filterData<T extends Record<string, unknown>>(
    tenant: TenantIdentity,
    data: T
  ): Partial<T> {
    const filtered = { ...data };

    if (tenant.clientType !== ClientType.REZ_ECOSYSTEM) {
      delete filtered.email;
      delete filtered.phone;
      delete filtered.address;
    }

    return filtered;
  }

  /**
   * Get data retention period (from TenantConfig with privacy)
   */
  getDataRetentionDays(tenant: TenantConfig): number {
    return tenant.privacy?.dataRetentionDays || 30;
  }

  /**
   * Check if tenant can train on data
   */
  canTrainOnData(
    tenant: TenantIdentity,
    dataOwnerId: string
  ): PrivacyCheck {
    if (tenant.tenantId === dataOwnerId) {
      return { allowed: true, level: 'shared' };
    }

    if (tenant.clientType === ClientType.REZ_ECOSYSTEM) {
      return {
        allowed: true,
        reason: 'REZ ecosystem cross-training enabled',
        level: 'shared'
      };
    }

    return {
      allowed: false,
      reason: 'Cross-tenant training not allowed',
      level: 'strict'
    };
  }

  /**
   * Validate data isolation boundary
   */
  validateIsolation(
    tenant: TenantIdentity,
    resourceTenantId: string
  ): boolean {
    if (tenant.tenantId === resourceTenantId) return true;
    if (tenant.clientType === ClientType.REZ_ECOSYSTEM) return true;
    return false;
  }
}

export const privacyService = new PrivacyService();
