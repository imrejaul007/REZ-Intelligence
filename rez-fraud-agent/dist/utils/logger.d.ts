import winston from 'winston';
export declare const logger: winston.Logger;
export declare function createRequestLogger(requestId: string): winston.Logger;
export declare const logAudit: (action: string, details: Record<string, unknown>) => void;
export declare const logSecurity: (event: string, details: Record<string, unknown>) => void;
export declare const logFraudAlert: (alertType: string, details: Record<string, unknown>) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map