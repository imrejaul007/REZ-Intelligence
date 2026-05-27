"use strict";
/**
 * Logger Service
 * Winston-based structured logging for the REZ Event Bus
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.httpLogger = exports.redisLogger = exports.kafkaLogger = exports.subscriptionLogger = exports.eventLogger = void 0;
exports.createChildLogger = createChildLogger;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("../config");
/**
 * Custom log format for structured logging
 */
const structuredFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
/**
 * Human-readable format for development
 */
const devFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.colorize(), winston_1.default.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
}));
/**
 * Create logger instance
 */
const logger = winston_1.default.createLogger({
    level: config_1.config.logging.level,
    format: config_1.config.logging.format === 'json' ? structuredFormat : devFormat,
    defaultMeta: {
        service: 'rez-event-bus',
        version: '1.0.0',
    },
    transports: [
        // Console transport
        new winston_1.default.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
    ],
    exitOnError: false,
});
exports.logger = logger;
/**
 * Add file transport in production
 */
if (config_1.config.server.nodeEnv === 'production') {
    logger.add(new winston_1.default.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
    }));
    logger.add(new winston_1.default.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
    }));
}
/**
 * Create child logger with additional context
 */
function createChildLogger(context) {
    return logger.child(context);
}
/**
 * Log event-related operations
 */
exports.eventLogger = createChildLogger({ component: 'event' });
/**
 * Log subscription-related operations
 */
exports.subscriptionLogger = createChildLogger({ component: 'subscription' });
/**
 * Log Kafka-related operations
 */
exports.kafkaLogger = createChildLogger({ component: 'kafka' });
/**
 * Log Redis-related operations
 */
exports.redisLogger = createChildLogger({ component: 'redis' });
/**
 * Log HTTP request/response
 */
exports.httpLogger = createChildLogger({ component: 'http' });
exports.default = logger;
//# sourceMappingURL=logger.js.map