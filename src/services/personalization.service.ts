/**
 * Personalization - User Embeddings + Recommendations
 */

import Redis from 'ioredis';
import { embed, cosine } from './embeddings.service';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const USER_EMBED = 'user_embed:';
const ITEM_EMBED = 'item_embed:';
const RECENT = 'user_recent:';

/** Build user embedding from activity */
export async function buildUserEmbedding(userId: string): Promise<number[]> {
  const recent = await redis.lrange(`${RECENT}${userId}`, 0, 19);
  if (!recent.length) return [];

  const texts = recent.map(r => JSON.parse(r)).map(r => r.text || '');
  const embeddings = await Promise.all(texts.map(t => embed(t)));

  if (!embeddings.length) return [];
  const dim = embeddings[0]?.length || 1536;
  const avg = new Array(dim).fill(0);
  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) avg[i] = (avg[i] || 0) + (e[i] || 0);
  }
  return avg.map(v => v / embeddings.length);
}

/** Recommend items */
export async function recommend(userId: string, count = 10): Promise<string[]> {
  const userEmb = await buildUserEmbedding(userId);
  if (!userEmb.length) return [];

  const keys = await redis.keys(`${ITEM_EMBED}*`);
  const scored: Array<{ id: string; score: number }> = [];

  for (const key of keys.slice(0, 100)) {
    const itemEmb = await redis.get(key);
    if (!itemEmb) continue;
    const score = cosine(userEmb, JSON.parse(itemEmb));
    scored.push({ id: key.replace(ITEM_EMBED, ''), score });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, count).map(s => s.id);
}
