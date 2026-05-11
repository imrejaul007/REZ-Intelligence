/**
 * ContentItem Model - TypeScript implementation
 * Migration from JavaScript to TypeScript
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  IContentItem,
  IContentItemDocument,
  IContentItemModel,
  IItemFeatures,
  IUserDNAProfile,
  ItemType,
} from '../types/index';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const itemFeaturesSchema = new Schema<IItemFeatures>({
  price_tier: { type: Number, min: 0, max: 4, default: 0 },
  quality_tier: { type: Number, min: 0, max: 4, default: 0 },
  popularity: { type: Number, default: 0 },
  recency: { type: Number, default: 0 },
  engagement_rate: { type: Number, default: 0 },
  conversion_rate: { type: Number, default: 0 },
}, { _id: false });

const contentItemSchema = new Schema<IContentItemDocument>({
  itemId: { type: String, required: true, unique: true, index: true },
  itemType: {
    type: String,
    required: true,
    enum: ['product', 'content', 'service', 'ad'] as ItemType[],
  },
  category: { type: String, required: true, index: true },
  subcategory: { type: String },
  tags: [{ type: String, index: true }],
  attributes: { type: Schema.Types.Mixed, default: {} },

  // Content metadata
  title: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  price: { type: Number },
  brandId: { type: String, index: true },
  brandName: { type: String },
  rating: { type: Number, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },

  // Feature vectors for content-based filtering
  features: { type: itemFeaturesSchema, default: () => ({}) },

  // Embedding vectors (for semantic similarity)
  embedding: [{ type: Number }],

  // Availability
  available: { type: Boolean, default: true },
  stockLevel: {
    type: String,
    enum: ['high', 'medium', 'low', 'out'],
    default: 'high',
  },

  // Personalization metadata
  popularityScore: { type: Number, default: 0 },
  trendingScore: { type: Number, default: 0 },

  // Interaction data
  viewCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  purchaseCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'content_items',
});

// ============================================================================
// INDEXES
// ============================================================================

contentItemSchema.index({ itemType: 1, category: 1 });
contentItemSchema.index({ 'features.popularity': -1 });
contentItemSchema.index({ 'features.trending': -1 });
contentItemSchema.index({ tags: 1 });
contentItemSchema.index({ price: 1 });
contentItemSchema.index({ createdAt: -1 });

// ============================================================================
// METHODS
// ============================================================================

contentItemSchema.methods.getFeatureVector = function(): IItemFeatures {
  const features = this.features as IItemFeatures | undefined;
  return {
    price_tier: features?.price_tier || 0,
    quality_tier: features?.quality_tier || 0,
    popularity: features?.popularity || 0,
    recency: features?.recency || 0,
    engagement_rate: features?.engagement_rate || 0,
    conversion_rate: features?.conversion_rate || 0,
  };
};

contentItemSchema.methods.calculateRelevanceScore = function(
  userProfile: IUserDNAProfile
): number {
  let score = 0;

  // Category affinity
  const categoryAffinity = userProfile.contentAffinityScores.find(
    (a) => a.category === this.category
  );
  if (categoryAffinity) {
    score += categoryAffinity.score * 0.4;
  }

  // Brand affinity
  const brandAffinity = userProfile.brandPreferences.find(
    (b) => b.brandId === this.brandId
  );
  if (brandAffinity) {
    score += brandAffinity.affinity * 0.2;
  }

  // Price sensitivity alignment
  const priceTiers: Record<string, number> = { budget: 0, moderate: 1, premium: 2, luxury: 3 };
  const userPriceTier = priceTiers[userProfile.priceSensitivityTier] || 1;
  const itemPriceTier = (this.features as IItemFeatures)?.price_tier || 1;
  const priceAlignment = 1 - Math.abs(userPriceTier - itemPriceTier) / 3;
  score += priceAlignment * 0.15;

  // Engagement metrics
  const features = this.features as IItemFeatures | undefined;
  score += (features?.popularity || 0) * 0.1;
  score += (features?.conversion_rate || 0) * 0.1;

  // Recency bonus
  const ageInDays = (Date.now() - (this.createdAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24);
  const recencyBonus = Math.max(0, 1 - ageInDays / 30) * 0.05;
  score += recencyBonus;

  return Math.min(1, Math.max(0, score));
};

// ============================================================================
// MODEL EXPORT
// ============================================================================

export const ContentItem = mongoose.model<IContentItemDocument, IContentItemModel>(
  'ContentItem',
  contentItemSchema
);

export default ContentItem;
