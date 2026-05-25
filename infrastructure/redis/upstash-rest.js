import logger from './utils/logger';

/**
 * Upstash Redis REST API client (for edge/serverless)
 * Use this instead of redis client for serverless environments
 */
const axios = require('axios');

class UpstashRedis {
  constructor() {
    this.url = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!this.url || !this.token) {
      logger.warn('Upstash credentials not configured');
    }

    this.client = axios.create({
      baseURL: this.url,
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });
  }

  async get(key) {
    const res = await this.client.post('/', {
      cmd: 'GET',
      args: [key]
    });
    return res.data.result;
  }

  async set(key, value, options = {}) {
    const args = [key, value];
    if (options.ex) args.push('EX', options.ex);
    if (options.px) args.push('PX', options.px);
    if (options.nx) args.push('NX');
    if (options.xx) args.push('XX');

    const res = await this.client.post('/', {
      cmd: 'SET',
      args
    });
    return res.data.result;
  }

  async del(key) {
    const res = await this.client.post('/', {
      cmd: 'DEL',
      args: [key]
    });
    return res.data.result;
  }

  async hset(key, field, value) {
    const res = await this.client.post('/', {
      cmd: 'HSET',
      args: [key, field, value]
    });
    return res.data.result;
  }

  async hget(key, field) {
    const res = await this.client.post('/', {
      cmd: 'HGET',
      args: [key, field]
    });
    return res.data.result;
  }

  async hgetall(key) {
    const res = await this.client.post('/', {
      cmd: 'HGETALL',
      args: [key]
    });
    return res.data.result;
  }

  async incr(key) {
    const res = await this.client.post('/', {
      cmd: 'INCR',
      args: [key]
    });
    return res.data.result;
  }

  async expire(key, seconds) {
    const res = await this.client.post('/', {
      cmd: 'EXPIRE',
      args: [key, seconds]
    });
    return res.data.result;
  }

  async zadd(key, members) {
    const args = [key];
    members.forEach(m => {
      args.push(m.score, m.value);
    });
    const res = await this.client.post('/', {
      cmd: 'ZADD',
      args
    });
    return res.data.result;
  }

  async zrangebyscore(key, min, max) {
    const res = await this.client.post('/', {
      cmd: 'ZRANGEBYSCORE',
      args: [key, min, max]
    });
    return res.data.result;
  }
}

module.exports = new UpstashRedis();
