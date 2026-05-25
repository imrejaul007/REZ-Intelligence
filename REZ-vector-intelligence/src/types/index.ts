import { z } from 'zod';

export const EmbeddingModelType = z.enum(['text', 'product', 'user', 'behavior', 'location', 'image']);
export type EmbeddingModelType = z.infer<typeof EmbeddingModelType>;

export const VectorIndexType = z.enum(['hnsw', 'ivf', 'flat', 'pq']);
export type VectorIndexType = z.infer<typeof VectorIndexType>;

export const EmbeddingRequestSchema = z.object({
  id: z.string(),
  text: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  type: EmbeddingModelType,
  dimensions: z.number().min(64).max(4096).default(384)
});
export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;

export const BatchEmbeddingRequestSchema = z.object({
  texts: z.array(z.string()).min(1).max(1000),
  type: EmbeddingModelType,
  dimensions: z.number().min(64).max(4096).default(384),
  batchSize: z.number().min(1).max(100).default(32)
});
export type BatchEmbeddingRequest = z.infer<typeof BatchEmbeddingRequestSchema>;

export const SearchRequestSchema = z.object({
  collection: z.string(),
  query: z.string().optional(),
  vector: z.array(z.number()).optional(),
  limit: z.number().min(1).max(100).default(10),
  filters: z.record(z.unknown()).optional(),
  includeVectors: z.boolean().default(false),
  minScore: z.number().min(0).max(1).default(0.0)
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SemanticSearchResponseSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    score: z.number(),
    text: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    vector: z.array(z.number()).optional()
  })),
  query: z.string(),
  totalResults: z.number(),
  searchTimeMs: z.number()
});
export type SemanticSearchResponse = z.infer<typeof SemanticSearchResponseSchema>;

export const CollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  dimensions: z.number().min(64).max(4096).default(384),
  indexType: VectorIndexType.default('hnsw'),
  metric: z.enum(['cosine', 'dot', 'euclidean']).default('cosine'),
  metadata: z.record(z.unknown()).optional()
});
export type Collection = z.infer<typeof CollectionSchema>;

export interface VectorDocument {
  id: string;
  vector: number[];
  text?: string;
  metadata?: Record<string, unknown>;
  type: EmbeddingModelType;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  score: number;
  text?: string;
  metadata?: Record<string, unknown>;
  vector?: number[];
}

export interface SimilarityResult {
  sourceId: string;
  targetId: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}
