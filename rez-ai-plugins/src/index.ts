import logger from './utils/logger';

/**
 * ReZ AI Plugins - Entry Point
 * Start all AI plugins and register with the registry
 */

import { aiRegistry } from './registry';
import { RestaurantAIPlugin } from './base-plugin';

async function main() {
  logger.info('[ReZ AI] Starting AI Plugin Registry...');

  // Register plugins
  await aiRegistry.register(new RestaurantAIPlugin());

  // Register more plugins...
  // await aiRegistry.register(new SalonAIPlugin());
  // await aiRegistry.register(new FitnessAIPlugin());
  // await aiRegistry.register(new HotelAIPlugin());

  logger.info('[ReZ AI] All plugins registered');
  logger.info(`[ReZ AI] Plugins: ${aiRegistry.getAllPlugins().map(p => p.name).join(', ')}`);

  // Start API server (optional)
  const port = process.env.PORT || 4010;

  // Express server would go here
  // Or use existing ReZ API Gateway

  logger.info(`[ReZ AI] Ready on port ${port}`);
}

main().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[ReZ AI] Shutting down...');
  await aiRegistry.shutdown();
  process.exit(0);
});
