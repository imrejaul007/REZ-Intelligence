/**
 * Logger Utility
 * Centralized logging for the culinary expert agent
 */
export declare const logger: any;
export declare function logRequest(method: string, path: string, statusCode: number, duration: number, metadata?: Record<string, unknown>): void;
export declare function logAudit(action: string, userId: string, details: Record<string, unknown>): void;
export declare function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void;
export type Logger = typeof logger;
//# sourceMappingURL=logger.d.ts.map