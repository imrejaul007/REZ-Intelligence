import { logger } from './utils/logger.js';

/**
 * REZ Moment Ads - Entry Point
 *
 * Moment-based advertising engine for real-time ad targeting.
 */

const PORT = process.env.PORT || '4111';

logger.info('Moment Ads Engine starting on port ' + PORT);
console.log('[READY] Moment Ads Engine');

export {};
