/**
 * Embeddings Service - OpenAI + Redis
 * Vector embeddings for search/recommendations
 */

const OPENAI_URL = process.env.OPENAI_URL || 'https://api.openai.com/v1';
const MODEL = 'text-embedding-3-small';
const CACHE_TTL = 86400 * 7; // 7 days

/**
 * Generate embedding for text
 */
export async function embed(text: string): Promise<number[]> {
  const hashKey = simpleHash(text.toLowerCase().trim());
  const cached = await redis.get(`embed:${hashKey}`);
  if (cached) {
    return JSON.parse(cached);
  }

  const response = await fetch(`${OPENAI_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text.slice(0, 8000),
      model: MODEL,
    }),
  });

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding || [];

  await redis.setex(`embed:${hashKey}`, CACHE_TTL, JSON.stringify(embedding));
  return embedding;
}

/**
 * Batch embed texts
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(t => embed(t)));
}

/**
 * Cosine similarity
 */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

/**
 * Simple hash for cache key
 */
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
