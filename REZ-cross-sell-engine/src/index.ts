import { logger } from './utils/logger.js';

/**
 * REZ Cross-Sell Engine - Entry Point
 *
 * AI-powered cross-sell recommendations for merchants.
 */

const PORT = process.env.PORT || '4114';

logger.info('Cross-Sell Engine starting on port ' + PORT);
console.log('[READY] Cross-Sell Engine');

export {};
