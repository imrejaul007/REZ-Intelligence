import { getLogger as createRezLogger } from '@rez/logger';

const SERVICE_NAME = 'rez-ab-testing';

export const logger = createRezLogger(SERVICE_NAME);

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  logger.info(message, meta);
}

export function logError(message: string, meta?: Record<string, unknown>): void {
  logger.error(message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  logger.warn(message, meta);
}

export function logDebug(message: string, meta?: Record<string, unknown>): void {
  logger.debug(message, meta);
}
