import { logger } from '../utils/logger';

/**
 * Embeddings Service
 * Multi-provider vector embeddings for search/recommendations
 * Supports: OpenAI, Azure OpenAI, Cohere, Local models
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = 86400 * 7; // 7 days

// Initialize Redis (optional - will work without it)
let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
} catch {
  logger.warn('[Embeddings] Redis not available, caching disabled');
}

// Provider configuration
type EmbeddingProvider = 'openai' | 'azure-openai' | 'cohere' | 'local';

interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey?: string;
  endpoint?: string;
  model: string;
}

function getConfig(): EmbeddingConfig {
  // Azure OpenAI
  if (process.env.AZURE_OPENAI_ENDPOINT) {
    return {
      provider: 'azure-openai',
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small',
    };
  }

  // Cohere
  if (process.env.COHERE_API_KEY) {
    return {
      provider: 'cohere',
      apiKey: process.env.COHERE_API_KEY,
      model: 'embed-english-v3.0',
    };
  }

  // Local model
  if (process.env.LOCAL_EMBEDDING_URL) {
    return {
      provider: 'local',
      endpoint: process.env.LOCAL_EMBEDDING_URL,
      model: process.env.LOCAL_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    };
  }

  // Default: OpenAI
  return {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
  };
}

const config = getConfig();

/**
 * Generate hash for cache key
 */
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get from cache
 */
async function getCache(key: string): Promise<number[] | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get(`embed:${key}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

/**
 * Set cache
 */
async function setCache(key: string, embedding: number[]): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(`embed:${key}`, CACHE_TTL, JSON.stringify(embedding));
  } catch {
    // Ignore cache errors
  }
}

/**
 * Generate embedding using OpenAI
 */
async function embedOpenAI(text: string): Promise<number[] | null> {
  if (!config.apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        input: text.slice(0, 8000),
        model: config.model,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

/**
 * Generate embedding using Azure OpenAI
 */
async function embedAzureOpenAI(text: string): Promise<number[] | null> {
  if (!config.apiKey || !config.endpoint) return null;

  try {
    const response = await fetch(
      `${config.endpoint}/openai/deployments/${config.model}/embeddings?api-version=2023-05-15`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
        },
        body: JSON.stringify({ input: text.slice(0, 8000) }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

/**
 * Generate embedding using Cohere
 */
async function embedCohere(text: string): Promise<number[] | null> {
  if (!config.apiKey) return null;

  try {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        texts: [text.slice(0, 500)],
        model: config.model,
        input_type: 'search_document',
      }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { embeddings: number[][] };
    return data.embeddings?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Generate embedding using local model
 */
async function embedLocal(text: string): Promise<number[] | null> {
  if (!config.endpoint) return null;

  try {
    const response = await fetch(`${config.endpoint}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [text.slice(0, 1000)],
        model: config.model,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { embeddings: number[][] };
    return data.embeddings?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Generate embedding for text using available provider
 */
export async function embed(text: string): Promise<number[]> {
  const hashKey = simpleHash(text.toLowerCase().trim());

  // Check cache first
  const cached = await getCache(hashKey);
  if (cached) {
    return cached;
  }

  let embedding: number[] | null = null;

  // Try providers in order
  switch (config.provider) {
    case 'azure-openai':
      embedding = await embedAzureOpenAI(text);
      break;
    case 'cohere':
      embedding = await embedCohere(text);
      break;
    case 'local':
      embedding = await embedLocal(text);
      break;
    case 'openai':
    default:
      embedding = await embedOpenAI(text);
      break;
  }

  // Fallback: simple hash-based embedding
  if (!embedding || embedding.length === 0) {
    logger.warn(`[Embeddings] Provider unavailable, using fallback`);
    embedding = simpleHashEmbedding(text);
  }

  // Cache result
  await setCache(hashKey, embedding);
  return embedding;
}

/**
 * Simple hash-based embedding fallback
 */
function simpleHashEmbedding(text: string, dimensions: number = 1536): number[] {
  const embedding = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().trim();

  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = (charCode * (i + 1) * 17) % dimensions;
    embedding[idx] += 1;
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (magnitude || 1));
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
 * Get service info
 */
export function getServiceInfo(): { provider: string; model: string; cached: boolean } {
  return {
    provider: config.provider,
    model: config.model,
    cached: redis !== null,
  };
}
