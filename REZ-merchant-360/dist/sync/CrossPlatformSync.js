"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossPlatformSync = void 0;
const logger_1 = require("../utils/logger");
/**
 * CrossPlatformSync.ts - Synchronization Across Platform Services
 */
const uuid_1 = require("uuid");
const modules_1 = require("../modules");
class CrossPlatformSync {
    modules;
    config;
    syncStatus = new Map();
    syncHistory = [];
    eventHandlers = new Set();
    intervalHandle;
    isRunning = false;
    constructor(config = {}) {
        // Initialize modules with environment variables
        this.modules = {
            finance: new modules_1.FinanceModule(process.env.FINANCE_SERVICE_URL),
            catalog: new modules_1.CatalogModule(process.env.CATALOG_SERVICE_URL),
            inventory: new modules_1.InventoryModule(process.env.INVENTORY_SERVICE_URL),
            crm: new modules_1.CRMModule(process.env.CRM_SERVICE_URL),
            loyalty: new modules_1.LoyaltyModule(process.env.LOYALTY_SERVICE_URL),
            staff: new modules_1.StaffModule(process.env.STAFF_SERVICE_URL),
            compliance: new modules_1.ComplianceModule(process.env.COMPLIANCE_SERVICE_URL),
            analytics: new modules_1.AnalyticsModule(process.env.ANALYTICS_SERVICE_URL),
            aiMemory: new modules_1.AIMemoryModule(process.env.MEMORY_SERVICE_URL),
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
    onEvent(handler) {
        this.eventHandlers.add(handler);
        return () => this.eventHandlers.delete(handler);
    }
    emitEvent(event) {
        for (const handler of this.eventHandlers) {
            try {
                handler(event);
            }
            catch (error) {
                console.error('Error in sync event handler:', error);
            }
        }
    }
    /**
     * Start periodic sync
     */
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        logger_1.logger.info(`Starting cross-platform sync with interval: ${this.config.intervalMs}ms`);
        this.intervalHandle = setInterval(() => {
            this.runScheduledSync().catch(error => {
                console.error('Scheduled sync failed:', error);
            });
        }, this.config.intervalMs);
    }
    /**
     * Stop periodic sync
     */
    stop() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = undefined;
        }
        this.isRunning = false;
        logger_1.logger.info('Cross-platform sync stopped');
    }
    /**
     * Run scheduled sync (for all pending merchants)
     */
    async runScheduledSync() {
        // In production, this would fetch merchants that need syncing
        logger_1.logger.info('Running scheduled sync...');
    }
    /**
     * Sync a single merchant
     */
    async syncMerchant(merchantId, merchant) {
        const syncId = (0, uuid_1.v4)();
        const startTime = Date.now();
        const result = {
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
        ];
        for (const service of serviceOrder) {
            if (!this.config.services[service.name]) {
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
            }
            catch (error) {
                const err = error;
                result.services.push({
                    service: service.name,
                    status: 'failed',
                    duration_ms: Date.now() - serviceStartTime,
                    error: err.message,
                });
                result.errors.push(`${service.name}: ${err.message}`);
                this.emitEvent({
                    type: 'service_failed',
                    sync_id: syncId,
                    merchant_id: merchantId,
                    service: service.name,
                    timestamp: new Date().toISOString(),
                    data: { error: err.message },
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
        }
        else if (failedCount === totalServices) {
            result.status = 'failed';
        }
        else {
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
    async batchSync(merchants) {
        const results = [];
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
                    if (batchResult.value.status === 'completed')
                        successful++;
                    else if (batchResult.value.status === 'partial')
                        partial++;
                    else
                        failed++;
                }
                else {
                    failed++;
                }
            }
        }
        return { results, successful, failed, partial };
    }
    /**
     * Get sync status for a merchant
     */
    getSyncStatus(merchantId) {
        return this.syncStatus.get(merchantId) || {
            sync_in_progress: false,
            pending_syncs: 0,
            failed_syncs: 0,
        };
    }
    /**
     * Get sync history
     */
    getSyncHistory(merchantId, limit = 100) {
        const history = merchantId
            ? this.syncHistory.filter(h => h.merchant_id === merchantId)
            : this.syncHistory;
        return history.slice(-limit);
    }
    /**
     * Update sync configuration
     */
    updateConfig(config) {
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
    async retrySync(merchantId, merchant) {
        const status = this.getSyncStatus(merchantId);
        if (status.failed_syncs === 0) {
            return null;
        }
        return this.syncMerchant(merchantId, merchant);
    }
    updateSyncStatus(merchantId, updates) {
        const current = this.syncStatus.get(merchantId) || {
            sync_in_progress: false,
            pending_syncs: 0,
            failed_syncs: 0,
        };
        this.syncStatus.set(merchantId, { ...current, ...updates });
    }
    updateMerchantModule(merchant, moduleName, data) {
        switch (moduleName) {
            case 'finance':
                merchant.finances = data;
                break;
            case 'catalog':
                merchant.catalog = data;
                break;
            case 'inventory':
                merchant.inventory = data;
                break;
            case 'crm':
                merchant.crm = data;
                break;
            case 'loyalty':
                merchant.loyalty = data;
                break;
            case 'staff':
                merchant.staff = data;
                break;
            case 'compliance':
                merchant.compliance = data;
                break;
            case 'analytics':
                merchant.analytics = data;
                break;
            case 'aiMemory':
                merchant.ai_memory = data;
                break;
        }
    }
    /**
     * Force sync specific service for a merchant
     */
    async syncService(merchantId, service, merchant) {
        const module = this.modules[service];
        if (!module) {
            return { success: false, error: `Unknown service: ${service}` };
        }
        try {
            // Get the appropriate getter method
            const methods = {
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
        }
        catch (error) {
            const err = error;
            return { success: false, error: err.message };
        }
    }
    /**
     * Clear sync history
     */
    clearHistory() {
        this.syncHistory = [];
    }
}
exports.CrossPlatformSync = CrossPlatformSync;
//# sourceMappingURL=CrossPlatformSync.js.map