import { logger } from './utils/logger.js';

/**
 * REZ Offline Commerce Tracker - Entry Point
 *
 * Tracks offline commerce events and attributes them to online touchpoints.
 */

const PORT = process.env.PORT || '4112';

logger.info('Offline Commerce Tracker starting on port ' + PORT);
console.log('[READY] Offline Commerce Tracker');

export {};
