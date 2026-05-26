import { Merchant360 } from '../MerchantProfile';
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
export declare class CrossPlatformSync {
    private modules;
    private config;
    private syncStatus;
    private syncHistory;
    private eventHandlers;
    private intervalHandle?;
    private isRunning;
    constructor(config?: Partial<SyncConfig>);
    /**
     * Subscribe to sync events
     */
    onEvent(handler: SyncEventHandler): () => void;
    private emitEvent;
    /**
     * Start periodic sync
     */
    start(): void;
    /**
     * Stop periodic sync
     */
    stop(): void;
    /**
     * Run scheduled sync (for all pending merchants)
     */
    runScheduledSync(): Promise<void>;
    /**
     * Sync a single merchant
     */
    syncMerchant(merchantId: string, merchant: Merchant360): Promise<SyncResult>;
    /**
     * Batch sync multiple merchants
     */
    batchSync(merchants: Merchant360[]): Promise<{
        results: SyncResult[];
        successful: number;
        failed: number;
        partial: number;
    }>;
    /**
     * Get sync status for a merchant
     */
    getSyncStatus(merchantId: string): SyncStatus;
    /**
     * Get sync history
     */
    getSyncHistory(merchantId?: string, limit?: number): SyncResult[];
    /**
     * Update sync configuration
     */
    updateConfig(config: Partial<SyncConfig>): void;
    /**
     * Retry failed syncs for a merchant
     */
    retrySync(merchantId: string, merchant: Merchant360): Promise<SyncResult | null>;
    private updateSyncStatus;
    private updateMerchantModule;
    /**
     * Force sync specific service for a merchant
     */
    syncService(merchantId: string, service: keyof typeof this.modules, merchant: Merchant360): Promise<{
        success: boolean;
        data?: unknown;
        error?: string;
    }>;
    /**
     * Clear sync history
     */
    clearHistory(): void;
}
//# sourceMappingURL=CrossPlatformSync.d.ts.map