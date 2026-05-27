"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logFraudAlert = exports.logSecurity = exports.logAudit = exports.logger = void 0;
exports.createRequestLogger = createRequestLogger;
const winston_1 = __importDefault(require("winston"));
const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'simple';
const formats = {
    json: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    simple: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf((info) => {
        const { level, message, timestamp: ts, ...meta } = info;
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${ts} [${level}]: ${message} ${metaStr}`;
    })),
    detailed: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        const stack = meta.stack ? `\n${meta.stack}` : '';
        return `${ts} [${level}]: ${message}${metaStr}${stack}`;
    })),
};
exports.logger = winston_1.default.createLogger({
    level: logLevel,
    format: formats[logFormat] || formats.simple,
    defaultMeta: { service: 'rez-fraud-agent' },
    transports: [
        new winston_1.default.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
    ],
    exitOnError: false,
});
// Add request ID helper for structured logging
function createRequestLogger(requestId) {
    return exports.logger.child({ requestId });
}
// Log levels with structured metadata
const logAudit = (action, details) => {
    exports.logger.info(`[AUDIT] ${action}`, { audit: true, ...details });
};
exports.logAudit = logAudit;
const logSecurity = (event, details) => {
    exports.logger.warn(`[SECURITY] ${event}`, { security: true, ...details });
};
exports.logSecurity = logSecurity;
const logFraudAlert = (alertType, details) => {
    exports.logger.warn(`[FRAUD_ALERT] ${alertType}`, { fraudAlert: true, ...details });
};
exports.logFraudAlert = logFraudAlert;
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map