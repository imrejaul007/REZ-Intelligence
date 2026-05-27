"use strict";
/**
 * Logger Utility
 * Centralized logging for the culinary expert agent
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logRequest = logRequest;
exports.logAudit = logAudit;
exports.logPerformance = logPerformance;
const winston_1 = __importDefault(require("winston"));
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
const logFormat = printf((info) => {
    const { level, message, timestamp, stack, ...metadata } = info;
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
        msg += `\n${stack}`;
    }
    return msg;
});
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
        }),
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    exitOnError: false,
});
// Add request logging helper
function logRequest(method, path, statusCode, duration, metadata) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    exports.logger.log({
        level,
        message: `${method} ${path} ${statusCode} - ${duration}ms`,
        ...metadata,
    });
}
// Add audit logging helper
function logAudit(action, userId, details) {
    exports.logger.info(`AUDIT: ${action}`, {
        action,
        userId,
        ...details,
        timestamp: new Date().toISOString(),
    });
}
// Add performance logging helper
function logPerformance(operation, duration, metadata) {
    const level = duration > 1000 ? 'warn' : 'info';
    exports.logger.log({
        level,
        message: `PERF: ${operation} took ${duration}ms`,
        operation,
        duration,
        ...metadata,
    });
}
//# sourceMappingURL=logger.js.map