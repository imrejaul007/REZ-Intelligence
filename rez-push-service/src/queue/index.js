const queueManager = require('./queueManager');
const rateLimiter = require('./rateLimiter');
const deduplicator = require('./deduplicator');

async function initializeAll() {
  await Promise.all([
    queueManager.initialize(),
    rateLimiter.initialize(),
    deduplicator.initialize(),
  ]);
}

async function shutdownAll() {
  await Promise.all([
    queueManager.close(),
    rateLimiter.close(),
    deduplicator.close(),
  ]);
}

module.exports = {
  queueManager,
  rateLimiter,
  deduplicator,
  initializeAll,
  shutdownAll,
};
