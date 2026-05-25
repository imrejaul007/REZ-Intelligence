import crypto from 'crypto';
import { Collection, VectorDocument } from '../types/index.js';

interface CollectionMetadata {
  name: string;
  description?: string;
  dimensions: number;
  indexType: string;
  metric: string;
  documentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CollectionManager {
  private collections: Map<string, CollectionMetadata> = new Map();

  createCollection(config: Collection): CollectionMetadata {
    if (this.collections.has(config.name)) {
      throw new Error(`Collection ${config.name} already exists`);
    }

    const metadata: CollectionMetadata = {
      name: config.name,
      description: config.description,
      dimensions: config.dimensions,
      indexType: config.indexType,
      metric: config.metric,
      documentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.collections.set(config.name, metadata);
    return metadata;
  }

  getCollection(name: string): CollectionMetadata | undefined {
    return this.collections.get(name);
  }

  getAllCollections(): CollectionMetadata[] {
    return Array.from(this.collections.values());
  }

  updateCollectionCount(name: string, delta: number): void {
    const collection = this.collections.get(name);
    if (collection) {
      collection.documentCount += delta;
      collection.updatedAt = new Date();
    }
  }

  deleteCollection(name: string): boolean {
    return this.collections.delete(name);
  }

  exists(name: string): boolean {
    return this.collections.has(name);
  }

  getTotalDocuments(): number {
    let total = 0;
    for (const collection of this.collections.values()) {
      total += collection.documentCount;
    }
    return total;
  }

  getStorageStats(): {
    totalCollections: number;
    totalDocuments: number;
    byCollection: Record<string, number>;
  } {
    const byCollection: Record<string, number> = {};
    let total = 0;

    for (const [name, collection] of this.collections.entries()) {
      byCollection[name] = collection.documentCount;
      total += collection.documentCount;
    }

    return {
      totalCollections: this.collections.size,
      totalDocuments: total,
      byCollection
    };
  }
}

export const collectionManager = new CollectionManager();
