const NodeCache = require('node-cache');

class CacheManager {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.CACHE_TTL_SECONDS) || 300,
      checkperiod: 60,
      useClones: false
    });

    this.cache.on('expired', (key, value) => {
      const logger = require('./logger');
      logger.debug(`Cache expired: ${key}`);
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl = null) {
    if (ttl) {
      return this.cache.set(key, value, ttl);
    }
    return this.cache.set(key, value);
  }

  del(key) {
    return this.cache.del(key);
  }

  delPattern(pattern) {
    const keys = this.cache.keys();
    const regex = new RegExp(pattern);
    keys.forEach(key => {
      if (regex.test(key)) {
        this.cache.del(key);
      }
    });
  }

  flush() {
    this.cache.flushAll();
  }

  stats() {
    return this.cache.getStats();
  }

  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }
}

module.exports = new CacheManager();
