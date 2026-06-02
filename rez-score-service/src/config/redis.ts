/**
 * Redis Configuration
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export function getLeaderboardKey(type: string): string {
  return `leaderboard:${type}`;
}

export { redis };
