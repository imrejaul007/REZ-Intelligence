/**
 * ReZ AI Plugins - Entry Point
 * Start all AI plugins and register with the registry
 */

import { aiRegistry } from './registry';
import { RestaurantAIPlugin } from './base-plugin';

async function main() {
  console.log('[ReZ AI] Starting AI Plugin Registry...');

  // Register plugins
  await aiRegistry.register(new RestaurantAIPlugin());

  // Register more plugins...
  // await aiRegistry.register(new SalonAIPlugin());
  // await aiRegistry.register(new FitnessAIPlugin());
  // await aiRegistry.register(new HotelAIPlugin());

  console.log('[ReZ AI] All plugins registered');
  console.log(`[ReZ AI] Plugins: ${aiRegistry.getAllPlugins().map(p => p.name).join(', ')}`);

  // Start API server (optional)
  const port = process.env.PORT || 4010;

  // Express server would go here
  // Or use existing ReZ API Gateway

  console.log(`[ReZ AI] Ready on port ${port}`);
}

main().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[ReZ AI] Shutting down...');
  await aiRegistry.shutdown();
  process.exit(0);
});
