import { logger } from './utils/logger.js';

/**
 * REZ Bootstrap Intelligence - Entry Point
 *
 * AI-powered onboarding and initialization for new merchants.
 */

const PORT = process.env.PORT || '4115';

logger.info('Bootstrap Intelligence starting on port ' + PORT);
console.log('[READY] Bootstrap Intelligence');

export {};
