/**
 * Feature Service - Core Business Logic for ML Feature Store
 * Handles feature retrieval, storage, and serving operations
 */

import { Feature, IFeatureDocument, IFeaturePoint, IFeatureRow } from '../models/feature.model';
import {
  FeatureCategory,
  FeatureDefinition,
  FEATURE_BY_NAME,
  FEATURES_BY_CATEGORY,
  ENTITY_FEATURES,
  FeatureAggregation,
  FeatureType,
} from '../config/features';
import { FEATURE_STORE_CONFIG } from '../config/features';

export interface GetFeaturesRequest {
  entityId: string;
  entityValues: string[];
  featureNames?: string[];
  featureTypes?: FeatureType[];
  includeMetadata?: boolean;
}

export interface GetFeaturesResponse {
  features: IFeaturePoint[];
  metadata: {
    totalEntities: number;
    totalFeatures: number;
    cached: boolean;
    timestamp: Date;
  };
}

export interface SetFeaturesRequest {
  entityId: string;
  entityValue: string;
  features: Record<string, unknown>;
  category?: FeatureCategory;
  source?: string;
  tags?: string[];
  expiresIn?: number; // milliseconds
}

export interface BatchSetFeaturesRequest {
  entityId: string;
  entities: Array<{
    value: string;
    features: Record<string, unknown>;
  }>;
  category?: FeatureCategory;
  source?: string;
}

export interface FeatureDefinitionRequest {
  category?: FeatureCategory;
  entityId?: string;
  tags?: string[];
}

export interface AggregationRequest {
  entityId: string;
  entityValue: string;
  featureName: string;
  windowStart: Date;
  windowEnd: Date;
}

interface FeatureStats {
  totalFeatures: number;
  totalEntities: number;
  featuresByCategory: Record<string, number>;
  featuresByType: Record<string, number>;
  lastUpdated: Date | null;
}

export class FeatureService {
  // In-memory cache for frequently accessed features
  private cache: Map<string, { data: IFeaturePoint; expiry: number }> = new Map();

  /**
   * Get features for one or more entities
   */
  async getFeatures(request: GetFeaturesRequest): Promise<GetFeaturesResponse> {
    const { entityId, entityValues, featureNames, includeMetadata = false } = request;

    // Validate request
    if (!entityId || !entityValues || entityValues.length === 0) {
      throw new Error('entityId and entityValues are required');
    }

    if (entityValues.length > FEATURE_STORE_CONFIG.maxEntityValues) {
      throw new Error(
        `Too many entity values. Maximum allowed: ${FEATURE_STORE_CONFIG.maxEntityValues}`
      );
    }

    if (featureNames && featureNames.length > FEATURE_STORE_CONFIG.maxFeaturesPerRequest) {
      throw new Error(
        `Too many features requested. Maximum allowed: ${FEATURE_STORE_CONFIG.maxFeaturesPerRequest}`
      );
    }

    // Check cache first
    const cachedFeatures = this.getCachedFeatures(entityId, entityValues, featureNames);

    // Get from database
    const features = await Feature.getFeaturesForEntities(
      entityId,
      entityValues,
      featureNames
    );

    // Add missing entities with default values
    const existingValues = new Set(features.map((f) => f.entityValue));
    const missingValues = entityValues.filter((v) => !existingValues.has(v));

    for (const missingValue of missingValues) {
      const defaultFeatures = this.getDefaultFeatures(featureNames, entityId);
      features.push({
        entityId,
        entityValue: missingValue,
        features: defaultFeatures,
        lastUpdated: new Date(),
      });
    }

    // Update cache
    for (const feature of features) {
      this.setCache(entityId, feature.entityValue, feature);
    }

    return {
      features,
      metadata: {
        totalEntities: features.length,
        totalFeatures: features.reduce((sum, f) => sum + Object.keys(f.features).length, 0),
        cached: cachedFeatures.length > 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Set features for a single entity
   */
  async setFeatures(request: SetFeaturesRequest): Promise<IFeatureDocument> {
    const {
      entityId,
      entityValue,
      features,
      category,
      source = 'unknown',
      tags = [],
      expiresIn,
    } = request;

    // Validate entityId exists in known features
    const knownFeatures = ENTITY_FEATURES.get(entityId);
    if (!knownFeatures) {
      throw new Error(`Unknown entityId: ${entityId}`);
    }

    // Determine category from entityId if not provided
    const resolvedCategory = category ?? this.inferCategory(entityId);

    // Validate feature names
    for (const featureName of Object.keys(features)) {
      const featureDef = FEATURE_BY_NAME.get(featureName);
      if (!featureDef) {
        console.warn(`Unknown feature: ${featureName}`);
      } else if (featureDef.entityId !== entityId) {
        throw new Error(
          `Feature ${featureName} belongs to entity ${featureDef.entityId}, not ${entityId}`
        );
      }
    }

    // Upsert to database
    const doc = await Feature.upsertFeatures(
      entityId,
      entityValue,
      resolvedCategory,
      features,
      source,
      tags
    );

    // Invalidate cache
    this.invalidateCache(entityId, entityValue);

    return doc;
  }

  /**
   * Batch set features for multiple entities
   */
  async batchSetFeatures(request: BatchSetFeaturesRequest): Promise<IFeatureDocument[]> {
    const { entityId, entities, category, source = 'unknown' } = request;

    if (!entityId || !entities || entities.length === 0) {
      throw new Error('entityId and entities are required');
    }

    if (entities.length > FEATURE_STORE_CONFIG.batchSize) {
      throw new Error(
        `Batch too large. Maximum allowed: ${FEATURE_STORE_CONFIG.batchSize}`
      );
    }

    // Determine category
    const resolvedCategory = category ?? this.inferCategory(entityId);

    // Validate all features
    for (const entity of entities) {
      for (const featureName of Object.keys(entity.features)) {
        const featureDef = FEATURE_BY_NAME.get(featureName);
        if (featureDef && featureDef.entityId !== entityId) {
          throw new Error(
            `Feature ${featureName} belongs to entity ${featureDef.entityId}, not ${entityId}`
          );
        }
      }
    }

    // Batch upsert
    const docs = await Feature.batchUpsert(entityId, entities, resolvedCategory, source);

    // Invalidate cache for all entities
    for (const entity of entities) {
      this.invalidateCache(entityId, entity.value);
    }

    return docs;
  }

  /**
   * Delete features for an entity
   */
  async deleteFeatures(entityId: string, entityValue: string): Promise<boolean> {
    const result = await Feature.deleteByEntity(entityId, entityValue);
    this.invalidateCache(entityId, entityValue);
    return (result.deletedCount ?? 0) > 0;
  }

  /**
   * Get feature definitions
   */
  getFeatureDefinitions(request: FeatureDefinitionRequest = {}): FeatureDefinition[] {
    const { category, entityId, tags } = request;
    let definitions = [...FEATURE_BY_NAME.values()];

    if (category) {
      definitions = definitions.filter((d) => d.category === category);
    }

    if (entityId) {
      definitions = definitions.filter((d) => d.entityId === entityId);
    }

    if (tags && tags.length > 0) {
      definitions = definitions.filter((d) =>
        tags.some((tag) => d.tags.includes(tag))
      );
    }

    return definitions;
  }

  /**
   * Get feature statistics
   */
  async getFeatureStats(): Promise<FeatureStats> {
    const stats = await Feature.aggregate([
      {
        $facet: {
          totalDocuments: [{ $count: 'count' }],
          byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
          lastUpdated: [{ $sort: { 'metadata.lastUpdated': -1 } }, { $limit: 1 }],
          featureTypes: [
            { $unwind: '$values' },
            { $group: { _id: '$values.featureType', count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const result = stats[0];
    const totalDocs = result.totalDocuments[0]?.count ?? 0;
    const uniqueEntities = await Feature.distinct('entityValue').countDocuments();

    return {
      totalFeatures: totalDocs,
      totalEntities: uniqueEntities,
      featuresByCategory: Object.fromEntries(
        result.byCategory.map((c: { _id: string; count: number }) => [c._id, c.count])
      ),
      featuresByType: Object.fromEntries(
        result.featureTypes.map((t: { _id: string; count: number }) => [t._id, t.count])
      ),
      lastUpdated: result.lastUpdated[0]?.metadata?.lastUpdated ?? null,
    };
  }

  /**
   * Compute aggregation over a time window
   */
  async computeAggregation(request: AggregationRequest): Promise<unknown> {
    const { entityId, entityValue, featureName, windowStart, windowEnd } = request;

    const featureDef = FEATURE_BY_NAME.get(featureName);
    if (!featureDef) {
      throw new Error(`Unknown feature: ${featureName}`);
    }

    // For now, we compute simple aggregations
    // In production, this would query a time-series database or materialized view
    const docs = await Feature.find({
      entityId,
      entityValue,
      'metadata.lastUpdated': { $gte: windowStart, $lte: windowEnd },
    });

    const values = docs
      .map((doc) => doc.getFeature(featureName))
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) {
      return null;
    }

    switch (featureDef.aggregation) {
      case FeatureAggregation.SUM:
        return values.reduce((acc: number, v) => acc + (Number(v) || 0), 0);
      case FeatureAggregation.AVG:
        const sum = values.reduce((acc: number, v) => acc + (Number(v) || 0), 0);
        return sum / values.length;
      case FeatureAggregation.COUNT:
        return values.length;
      case FeatureAggregation.MIN:
        return Math.min(...values.map((v) => Number(v) || 0));
      case FeatureAggregation.MAX:
        return Math.max(...values.map((v) => Number(v) || 0));
      case FeatureAggregation.FIRST:
        return values[0];
      case FeatureAggregation.LAST:
        return values[values.length - 1];
      default:
        return values;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; database: boolean; cache: boolean }> {
    try {
      await Feature.findOne().limit(1);
      const cacheSize = this.cache.size;
      return {
        status: 'healthy',
        database: true,
        cache: cacheSize > 0 || true, // Cache is optional
      };
    } catch {
      return {
        status: 'unhealthy',
        database: false,
        cache: false,
      };
    }
  }

  // Private helper methods

  private getCacheKey(
    entityId: string,
    entityValue: string,
    featureNames?: string[]
  ): string {
    const features = featureNames ? featureNames.sort().join(',') : '*';
    return `${entityId}:${entityValue}:${features}`;
  }

  private getCachedFeatures(
    entityId: string,
    entityValues: string[],
    featureNames?: string[]
  ): IFeaturePoint[] {
    const now = Date.now();
    const results: IFeaturePoint[] = [];

    for (const entityValue of entityValues) {
      const key = this.getCacheKey(entityId, entityValue, featureNames);
      const cached = this.cache.get(key);

      if (cached && cached.expiry > now) {
        results.push(cached.data);
      }
    }

    return results;
  }

  private setCache(entityId: string, entityValue: string, data: IFeaturePoint): void {
    const key = this.getCacheKey(entityId, entityValue);
    const expiry = Date.now() + FEATURE_STORE_CONFIG.cacheTTL;
    this.cache.set(key, { data, expiry });

    // Limit cache size
    if (this.cache.size > 10000) {
      this.cleanCache();
    }
  }

  private invalidateCache(entityId: string, entityValue: string): void {
    const prefix = `${entityId}:${entityValue}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry <= now) {
        this.cache.delete(key);
      }
    }
  }

  private inferCategory(entityId: string): FeatureCategory {
    switch (entityId) {
      case 'userId':
        return FeatureCategory.USER;
      case 'merchantId':
        return FeatureCategory.MERCHANT;
      case 'transactionId':
        return FeatureCategory.TRANSACTION;
      default:
        return FeatureCategory.BEHAVIORAL;
    }
  }

  private getDefaultFeatures(
    featureNames: string[] | undefined,
    entityId: string
  ): Record<string, unknown> {
    const features = new Map<string, unknown>();

    if (featureNames) {
      for (const name of featureNames) {
        const def = FEATURE_BY_NAME.get(name);
        if (def && def.entityId === entityId) {
          features.set(name, def.defaultValue);
        }
      }
    } else {
      const entityFeatures = ENTITY_FEATURES.get(entityId) ?? [];
      for (const def of entityFeatures) {
        features.set(def.name, def.defaultValue);
      }
    }

    return Object.fromEntries(features);
  }
}

// Export singleton instance
export const featureService = new FeatureService();
