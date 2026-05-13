/**
 * Logger Service
 * Winston-based structured logging for the REZ Event Bus
 */
import winston from 'winston';
/**
 * Create logger instance
 */
declare const logger: winston.Logger;
/**
 * Create child logger with additional context
 */
export declare function createChildLogger(context: Record<string, unknown>): winston.Logger;
/**
 * Log event-related operations
 */
export declare const eventLogger: winston.Logger;
/**
 * Log subscription-related operations
 */
export declare const subscriptionLogger: winston.Logger;
/**
 * Log Kafka-related operations
 */
export declare const kafkaLogger: winston.Logger;
/**
 * Log Redis-related operations
 */
export declare const redisLogger: winston.Logger;
/**
 * Log HTTP request/response
 */
export declare const httpLogger: winston.Logger;
export { logger };
export default logger;
//# sourceMappingURL=logger.d.ts.map