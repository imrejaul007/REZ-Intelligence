import logger from './utils/logger.js';

/**
 * CrossPlatformSync.ts - Synchronization Across Platform Services
 */

import { v4 as uuidv4 } from 'uuid';
import { Merchant360 } from '../MerchantProfile';
import {
  FinanceModule,
  CatalogModule,
  InventoryModule,
  CRMModule,
  LoyaltyModule,
  StaffModule,
  ComplianceModule,
  AnalyticsModule,
  AIMemoryModule,
} from '../modules';

export interface SyncConfig {
  enabled: boolean;
  intervalMs: number;
  retryAttempts: number;
  batchSize: number;
  services: {
    finance: boolean;
    catalog: boolean;
    inventory: boolean;
    crm: boolean;
    loyalty: boolean;
    staff: boolean;
    compliance: boolean;
    analytics: boolean;
    aiMemory: boolean;
  };
}

export interface SyncResult {
  sync_id: string;
  merchant_id: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  services: {
    service: string;
    status: 'synced' | 'failed' | 'skipped';
    duration_ms: number;
    error?: string;
  }[];
  total_duration_ms: number;
  errors: string[];
}

export interface SyncStatus {
  last_sync_at?: string;
  last_successful_sync_at?: string;
  sync_in_progress: boolean;
  pending_syncs: number;
  failed_syncs: number;
}

export interface SyncEvent {
  type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'service_synced' | 'service_failed';
  sync_id: string;
  merchant_id: string;
  service?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export type SyncEventHandler = (event: SyncEvent) => void;

export class CrossPlatformSync {
  private modules: {
    finance: FinanceModule;
    catalog: CatalogModule;
    inventory: InventoryModule;
    crm: CRMModule;
    loyalty: LoyaltyModule;
    staff: StaffModule;
    compliance: ComplianceModule;
    analytics: AnalyticsModule;
    aiMemory: AIMemoryModule;
  };

  private config: SyncConfig;
  private syncStatus: Map<string, SyncStatus> = new Map();
  private syncHistory: SyncResult[] = [];
  private eventHandlers: Set<SyncEventHandler> = new Set();
  private intervalHandle?: ReturnType<typeof setInterval>;
  private isRunning: boolean = false;

  constructor(config: Partial<SyncConfig> = {}) {
    // Initialize modules with environment variables
    this.modules = {
      finance: new FinanceModule(process.env.FINANCE_SERVICE_URL),
      catalog: new CatalogModule(process.env.CATALOG_SERVICE_URL),
      inventory: new InventoryModule(process.env.INVENTORY_SERVICE_URL),
      crm: new CRMModule(process.env.CRM_SERVICE_URL),
      loyalty: new LoyaltyModule(process.env.LOYALTY_SERVICE_URL),
      staff: new StaffModule(process.env.STAFF_SERVICE_URL),
      compliance: new ComplianceModule(process.env.COMPLIANCE_SERVICE_URL),
      analytics: new AnalyticsModule(process.env.ANALYTICS_SERVICE_URL),
      aiMemory: new AIMemoryModule(process.env.MEMORY_SERVICE_URL),
    };

    this.config = {
      enabled: config.enabled ?? true,
      intervalMs: config.intervalMs ?? parseInt(process.env.SYNC_INTERVAL_MS || '60000'),
      retryAttempts: config.retryAttempts ?? parseInt(process.env.SYNC_RETRY_ATTEMPTS || '3'),
      batchSize: config.batchSize ?? parseInt(process.env.SYNC_BATCH_SIZE || '100'),
      services: {
        finance: config.services?.finance ?? true,
        catalog: config.services?.catalog ?? true,
        inventory: config.services?.inventory ?? true,
        crm: config.services?.crm ?? true,
        loyalty: config.services?.loyalty ?? true,
        staff: config.services?.staff ?? true,
        compliance: config.services?.compliance ?? true,
        analytics: config.services?.analytics ?? true,
        aiMemory: config.services?.aiMemory ?? true,
      },
    };
  }

  /**
   * Subscribe to sync events
   */
  onEvent(handler: SyncEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emitEvent(event: SyncEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in sync event handler:', error);
      }
    }
  }

  /**
   * Start periodic sync
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info(`Starting cross-platform sync with interval: ${this.config.intervalMs}ms`);

    this.intervalHandle = setInterval(() => {
      this.runScheduledSync().catch(error => {
        console.error('Scheduled sync failed:', error);
      });
    }, this.config.intervalMs);
  }

  /**
   * Stop periodic sync
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    this.isRunning = false;
    logger.info('Cross-platform sync stopped');
  }

  /**
   * Run scheduled sync (for all pending merchants)
   */
  async runScheduledSync(): Promise<void> {
    // In production, this would fetch merchants that need syncing
    logger.info('Running scheduled sync...');
  }

  /**
   * Sync a single merchant
   */
  async syncMerchant(merchantId: string, merchant: Merchant360): Promise<SyncResult> {
    const syncId = uuidv4();
    const startTime = Date.now();

    const result: SyncResult = {
      sync_id: syncId,
      merchant_id: merchantId,
      started_at: new Date().toISOString(),
      status: 'running',
      services: [],
      total_duration_ms: 0,
      errors: [],
    };

    // Update status
    this.updateSyncStatus(merchantId, { sync_in_progress: true });

    this.emitEvent({
      type: 'sync_started',
      sync_id: syncId,
      merchant_id: merchantId,
      timestamp: new Date().toISOString(),
    });

    const serviceOrder = [
      { name: 'finance', fn: () => this.modules.finance.getFinances(merchantId) },
      { name: 'catalog', fn: () => this.modules.catalog.getCatalog(merchantId) },
      { name: 'inventory', fn: () => this.modules.inventory.getInventory(merchantId) },
      { name: 'crm', fn: () => this.modules.crm.getCRM(merchantId) },
      { name: 'loyalty', fn: () => this.modules.loyalty.getLoyalty(merchantId) },
      { name: 'staff', fn: () => this.modules.staff.getStaff(merchantId) },
      { name: 'compliance', fn: () => this.modules.compliance.getCompliance(merchantId) },
      { name: 'analytics', fn: () => this.modules.analytics.getAnalytics(merchantId) },
      { name: 'aiMemory', fn: () => this.modules.aiMemory.getAIMemory(merchantId) },
    ] as const;

    for (const service of serviceOrder) {
      if (!this.config.services[service.name as keyof typeof this.config.services]) {
        result.services.push({
          service: service.name,
          status: 'skipped',
          duration_ms: 0,
        });
        continue;
      }

      const serviceStartTime = Date.now();

      try {
        const data = await service.fn();

        // Update merchant with synced data
        this.updateMerchantModule(merchant, service.name, data);

        result.services.push({
          service: service.name,
          status: 'synced',
          duration_ms: Date.now() - serviceStartTime,
        });

        this.emitEvent({
          type: 'service_synced',
          sync_id: syncId,
          merchant_id: merchantId,
          service: service.name,
          timestamp: new Date().toISOString(),
          data: { duration_ms: Date.now() - serviceStartTime },
        });
      } catch (error) {
        result.services.push({
          service: service.name,
          status: 'failed',
          duration_ms: Date.now() - serviceStartTime,
          error: error.message,
        });
        result.errors.push(`${service.name}: ${error.message}`);

        this.emitEvent({
          type: 'service_failed',
          sync_id: syncId,
          merchant_id: merchantId,
          service: service.name,
          timestamp: new Date().toISOString(),
          data: { error: error.message },
        });
      }
    }

    result.completed_at = new Date().toISOString();
    result.total_duration_ms = Date.now() - startTime;

    // Determine overall status
    const failedCount = result.services.filter(s => s.status === 'failed').length;
    const skippedCount = result.services.filter(s => s.status === 'skipped').length;
    const totalServices = result.services.length - skippedCount;

    if (failedCount === 0) {
      result.status = 'completed';
    } else if (failedCount === totalServices) {
      result.status = 'failed';
    } else {
      result.status = 'partial';
    }

    // Update status
    this.updateSyncStatus(merchantId, {
      last_sync_at: result.completed_at,
      sync_in_progress: false,
      ...(result.status === 'completed' || result.status === 'partial'
        ? { last_successful_sync_at: result.completed_at }
        : {}),
      ...(result.status === 'failed' ? { failed_syncs: (this.syncStatus.get(merchantId)?.failed_syncs || 0) + 1 } : {}),
    });

    this.syncHistory.push(result);

    this.emitEvent({
      type: result.status === 'completed' ? 'sync_completed' : 'sync_failed',
      sync_id: syncId,
      merchant_id: merchantId,
      timestamp: new Date().toISOString(),
      data: { duration_ms: result.total_duration_ms, failed_count: failedCount },
    });

    return result;
  }

  /**
   * Batch sync multiple merchants
   */
  async batchSync(merchants: Merchant360[]): Promise<{
    results: SyncResult[];
    successful: number;
    failed: number;
    partial: number;
  }> {
    const results: SyncResult[] = [];
    let successful = 0;
    let failed = 0;
    let partial = 0;

    // Process in batches
    for (let i = 0; i < merchants.length; i += this.config.batchSize) {
      const batch = merchants.slice(i, i + this.config.batchSize);

      const batchPromises = batch.map(m => this.syncMerchant(m.merchant_id, m));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          results.push(batchResult.value);
          if (batchResult.value.status === 'completed') successful++;
          else if (batchResult.value.status === 'partial') partial++;
          else failed++;
        } else {
          failed++;
        }
      }
    }

    return { results, successful, failed, partial };
  }

  /**
   * Get sync status for a merchant
   */
  getSyncStatus(merchantId: string): SyncStatus {
    return this.syncStatus.get(merchantId) || {
      sync_in_progress: false,
      pending_syncs: 0,
      failed_syncs: 0,
    };
  }

  /**
   * Get sync history
   */
  getSyncHistory(merchantId?: string, limit: number = 100): SyncResult[] {
    const history = merchantId
      ? this.syncHistory.filter(h => h.merchant_id === merchantId)
      : this.syncHistory;

    return history.slice(-limit);
  }

  /**
   * Update sync configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.config = {
      ...this.config,
      ...config,
    };

    if (wasRunning && this.config.enabled) {
      this.start();
    }
  }

  /**
   * Retry failed syncs for a merchant
   */
  async retrySync(merchantId: string, merchant: Merchant360): Promise<SyncResult | null> {
    const status = this.getSyncStatus(merchantId);
    if (status.failed_syncs === 0) {
      return null;
    }

    return this.syncMerchant(merchantId, merchant);
  }

  private updateSyncStatus(merchantId: string, updates: Partial<SyncStatus>): void {
    const current = this.syncStatus.get(merchantId) || {
      sync_in_progress: false,
      pending_syncs: 0,
      failed_syncs: 0,
    };

    this.syncStatus.set(merchantId, { ...current, ...updates });
  }

  private updateMerchantModule(merchant: Merchant360, moduleName: string, data: unknown): void {
    switch (moduleName) {
      case 'finance':
        merchant.finances = data as Merchant360['finances'];
        break;
      case 'catalog':
        merchant.catalog = data as Merchant360['catalog'];
        break;
      case 'inventory':
        merchant.inventory = data as Merchant360['inventory'];
        break;
      case 'crm':
        merchant.crm = data as Merchant360['crm'];
        break;
      case 'loyalty':
        merchant.loyalty = data as Merchant360['loyalty'];
        break;
      case 'staff':
        merchant.staff = data as Merchant360['staff'];
        break;
      case 'compliance':
        merchant.compliance = data as Merchant360['compliance'];
        break;
      case 'analytics':
        merchant.analytics = data as Merchant360['analytics'];
        break;
      case 'aiMemory':
        merchant.ai_memory = data as Merchant360['ai_memory'];
        break;
    }
  }

  /**
   * Force sync specific service for a merchant
   */
  async syncService(
    merchantId: string,
    service: keyof typeof this.modules,
    merchant: Merchant360
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const module = this.modules[service];

    if (!module) {
      return { success: false, error: `Unknown service: ${service}` };
    }

    try {
      // Get the appropriate getter method
      const methods: Record<string, (id: string) => Promise<unknown>> = {
        finance: (id) => this.modules.finance.getFinances(id),
        catalog: (id) => this.modules.catalog.getCatalog(id),
        inventory: (id) => this.modules.inventory.getInventory(id),
        crm: (id) => this.modules.crm.getCRM(id),
        loyalty: (id) => this.modules.loyalty.getLoyalty(id),
        staff: (id) => this.modules.staff.getStaff(id),
        compliance: (id) => this.modules.compliance.getCompliance(id),
        analytics: (id) => this.modules.analytics.getAnalytics(id),
        aiMemory: (id) => this.modules.aiMemory.getAIMemory(id),
      };

      const data = await methods[service](merchantId);
      this.updateMerchantModule(merchant, service, data);

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear sync history
   */
  clearHistory(): void {
    this.syncHistory = [];
  }
}
