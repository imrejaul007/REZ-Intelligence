"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("../config");
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
// Custom log format
const logFormat = printf((info) => {
    const { level, message, timestamp: ts, ...metadata } = info;
    let msg = `${ts} [${level}]: ${message}`;
    const metaKeys = Object.keys(metadata);
    if (metaKeys.length > 0 && metadata.stack) {
        msg += `\n${metadata.stack}`;
    }
    else if (metaKeys.length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});
// Create logger instance
exports.logger = winston_1.default.createLogger({
    level: config_1.config.LOG_LEVEL,
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), logFormat),
    defaultMeta: {
        service: config_1.config.SERVICE_NAME,
    },
    transports: [
        // Console transport
        new winston_1.default.transports.Console({
            format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), logFormat),
        }),
    ],
});
// Add file transports in production
if (config_1.isProduction) {
    exports.logger.add(new winston_1.default.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
    }));
    exports.logger.add(new winston_1.default.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
    }));
}
// Create a child logger with additional context
function createLogger(context) {
    return exports.logger.child(context);
}
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map