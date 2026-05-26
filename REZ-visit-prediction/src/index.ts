import { logger } from './utils/logger';

/**
 * REZ Visit Prediction - Entry Point
 *
 * ML service for predicting store visits and offline engagement.
 */

const PORT = process.env.PORT || '4113';

logger.info('Visit Prediction starting on port ' + PORT);
console.log('[READY] Visit Prediction');

export {};
