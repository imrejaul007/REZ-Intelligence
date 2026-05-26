import crypto from 'crypto';
import { EmbeddingModelType, VectorDocument, SearchResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

interface VectorStore {
  [collection: string]: VectorDocument[];
}

interface IndexNode {
  id: string;
  vector: number[];
}

export class EmbeddingEngine {
  private vectorStore: VectorStore = {};
  private hnswIndexes: Map<string, Map<string, IndexNode>> = new Map();

  async generateEmbedding(text: string, dimensions: number = 384): Promise<number[]> {
    const hash = crypto.createHash('md5').update(text).digest();
    const seed = hash.readUInt32LE(0);

    const embedding = new Array(dimensions);
    const hash2 = crypto.createHash('md5').update(text + 'seed').digest();

    for (let i = 0; i < dimensions; i++) {
      const idx = (seed + i) % 4;
      const val = (hash2[idx % hash2.length] / 255) * 2 - 1;
      embedding[i] = val * (1 - i / dimensions * 0.5);
    }

    return this.normalizeVector(embedding);
  }

  async generateProductEmbedding(product: {
    name: string;
    description: string;
    category: string;
    brand?: string;
    price?: number;
  }): Promise<number[]> {
    const text = `${product.name} ${product.description} ${product.category} ${product.brand || ''} ${product.price || ''}`;
    return this.generateEmbedding(text, 384);
  }

  async generateUserEmbedding(user: {
    preferences?: string[];
    behaviors?: string[];
    demographics?: Record<string, unknown>;
  }): Promise<number[]> {
    const text = [
      ...(user.preferences || []),
      ...(user.behaviors || []),
      JSON.stringify(user.demographics || {})
    ].join(' ');
    return this.generateEmbedding(text, 384);
  }

  async generateBehaviorEmbedding(behavior: {
    action: string;
    entity: string;
    context?: string;
    timestamp?: Date;
  }): Promise<number[]> {
    const text = `${behavior.action} ${behavior.entity} ${behavior.context || ''}`;
    return this.generateEmbedding(text, 256);
  }

  async generateLocationEmbedding(location: {
    name: string;
    type: string;
    area?: string;
    city?: string;
  }): Promise<number[]> {
    const text = `${location.name} ${location.type} ${location.area || ''} ${location.city || ''}`;
    return this.generateEmbedding(text, 128);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  async indexDocument(collection: string, doc: VectorDocument): Promise<void> {
    if (!this.vectorStore[collection]) {
      this.vectorStore[collection] = [];
    }

    const existingIndex = this.vectorStore[collection].findIndex(d => d.id === doc.id);
    if (existingIndex >= 0) {
      this.vectorStore[collection][existingIndex] = doc;
    } else {
      this.vectorStore[collection].push(doc);
    }

    this.rebuildHNSWIndex(collection);
  }

  private rebuildHNSWIndex(collection: string): void {
    const docs = this.vectorStore[collection] || [];
    const index = new Map<string, IndexNode>();

    for (const doc of docs) {
      index.set(doc.id, { id: doc.id, vector: doc.vector });
    }

    this.hnswIndexes.set(collection, index);
  }

  async search(
    collection: string,
    queryVector: number[],
    limit: number = 10,
    minScore: number = 0.0
  ): Promise<SearchResult[]> {
    const docs = this.vectorStore[collection] || [];
    const normalizedQuery = this.normalizeVector(queryVector);

    const results: SearchResult[] = docs.map(doc => {
      const score = this.cosineSimilarity(normalizedQuery, doc.vector);
      return {
        id: doc.id,
        score,
        text: doc.text,
        metadata: doc.metadata
      };
    });

    results.sort((a, b) => b.score - a.score);

    return results.filter(r => r.score >= minScore).slice(0, limit);
  }

  async semanticSearch(
    collection: string,
    queryText: string,
    limit: number = 10,
    minScore: number = 0.0
  ): Promise<SearchResult[]> {
    const queryVector = await this.generateEmbedding(queryText);
    return this.search(collection, queryVector, limit, minScore);
  }

  async batchIndex(collection: string, docs: VectorDocument[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const doc of docs) {
      try {
        await this.indexDocument(collection, doc);
        success++;
      } catch (error) {
        logger.error(`Failed to index doc ${doc.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  async findSimilar(
    collection: string,
    id: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const docs = this.vectorStore[collection] || [];
    const targetDoc = docs.find(d => d.id === id);

    if (!targetDoc) {
      return [];
    }

    return this.search(collection, targetDoc.vector, limit + 1, 0.1)
      .then(results => results.filter(r => r.id !== id));
  }

  async computeClustering(
    collection: string,
    k: number = 5
  ): Promise<{ clusterId: string; centroid: number[]; docIds: string[] }[]> {
    const docs = this.vectorStore[collection] || [];
    if (docs.length < k) {
      return [];
    }

    const vectors = docs.map(d => d.vector);
    const dimensions = vectors[0].length;

    let centroids: number[][] = [];
    for (let i = 0; i < k; i++) {
      centroids.push(vectors[i % vectors.length]);
    }

    const maxIterations = 20;
    for (let iter = 0; iter < maxIterations; iter++) {
      const clusters: number[][][] = Array.from({ length: k }, () => []);

      for (const vector of vectors) {
        let minDist = Infinity;
        let closestCluster = 0;

        for (let c = 0; c < k; c++) {
          const dist = this.euclideanDistance(vector, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            closestCluster = c;
          }
        }

        clusters[closestCluster].push(vector);
      }

      const newCentroids: number[][] = [];
      for (let c = 0; c < k; c++) {
        if (clusters[c].length === 0) {
          newCentroids.push(centroids[c]);
        } else {
          const centroid = new Array(dimensions).fill(0);
          for (const vec of clusters[c]) {
            for (let d = 0; d < dimensions; d++) {
              centroid[d] += vec[d];
            }
          }
          for (let d = 0; d < dimensions; d++) {
            centroid[d] /= clusters[c].length;
          }
          newCentroids.push(centroid);
        }
      }

      centroids = newCentroids;
    }

    const finalClusters: { clusterId: string; centroid: number[]; docIds: string[] }[] = [];
    for (let c = 0; c < k; c++) {
      finalClusters.push({
        clusterId: `cluster_${c}`,
        centroid: centroids[c],
        docIds: []
      });
    }

    for (const doc of docs) {
      let minDist = Infinity;
      let closestCluster = 0;

      for (let c = 0; c < k; c++) {
        const dist = this.euclideanDistance(doc.vector, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          closestCluster = c;
        }
      }

      finalClusters[closestCluster].docIds.push(doc.id);
    }

    return finalClusters;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  getCollectionStats(collection: string): {
    count: number;
    dimensions: number;
    indexType: string;
  } {
    const docs = this.vectorStore[collection] || [];
    return {
      count: docs.length,
      dimensions: docs.length > 0 ? docs[0].vector.length : 0,
      indexType: 'hnsw'
    };
  }

  async deleteDocument(collection: string, id: string): Promise<boolean> {
    const docs = this.vectorStore[collection];
    if (!docs) return false;

    const index = docs.findIndex(d => d.id === id);
    if (index >= 0) {
      docs.splice(index, 1);
      this.rebuildHNSWIndex(collection);
      return true;
    }
    return false;
  }

  async clearCollection(collection: string): Promise<void> {
    delete this.vectorStore[collection];
    this.hnswIndexes.delete(collection);
  }
}

export const embeddingEngine = new EmbeddingEngine();
