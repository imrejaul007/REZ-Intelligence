/**
 * @deprecated Migration to TypeScript in progress
 * TODO: Replace with src/types/index.ts IContentItemDocument interface
 * TODO: See src/models/ContentItem.ts for TypeScript implementation
 */

const mongoose = require('mongoose');

const contentItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true, unique: true, index: true },
  itemType: { type: String, required: true, enum: ['product', 'content', 'service', 'ad'] },
  category: { type: String, required: true, index: true },
  subcategory: { type: String },
  tags: [{ type: String, index: true }],
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },

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
  features: {
    price_tier: { type: Number, min: 0, max: 4 },
    quality_tier: { type: Number, min: 0, max: 4 },
    popularity: { type: Number, default: 0 },
    recency: { type: Number, default: 0 },
    engagement_rate: { type: Number, default: 0 },
    conversion_rate: { type: Number, default: 0 }
  },

  // Embedding vectors (for semantic similarity)
  embedding: [{ type: Number }],

  // Availability
  available: { type: Boolean, default: true },
  stockLevel: { type: String, enum: ['high', 'medium', 'low', 'out'], default: 'high' },

  // Personalization metadata
  popularityScore: { type: Number, default: 0 },
  trendingScore: { type: Number, default: 0 },

  // Interaction data
  viewCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  purchaseCount: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'content_items'
});

// Indexes
contentItemSchema.index({ itemType: 1, category: 1 });
contentItemSchema.index({ 'features.popularity': -1 });
contentItemSchema.index({ 'features.trending': -1 });
contentItemSchema.index({ tags: 1 });
contentItemSchema.index({ price: 1 });
contentItemSchema.index({ createdAt: -1 });

// Methods
contentItemSchema.methods.getFeatureVector = function() {
  return {
    price_tier: this.features?.price_tier || 0,
    quality_tier: this.features?.quality_tier || 0,
    popularity: this.features?.popularity || 0,
    recency: this.features?.recency || 0,
    engagement_rate: this.features?.engagement_rate || 0,
    conversion_rate: this.features?.conversion_rate || 0
  };
};

contentItemSchema.methods.calculateRelevanceScore = function(userProfile) {
  let score = 0;

  // Category affinity
  const categoryAffinity = userProfile.contentAffinityScores.find(
    a => a.category === this.category
  );
  if (categoryAffinity) {
    score += categoryAffinity.score * 0.4;
  }

  // Brand affinity
  const brandAffinity = userProfile.brandPreferences.find(
    b => b.brandId === this.brandId
  );
  if (brandAffinity) {
    score += brandAffinity.affinity * 0.2;
  }

  // Price sensitivity alignment
  const priceTiers = { budget: 0, moderate: 1, premium: 2, luxury: 3 };
  const userPriceTier = priceTiers[userProfile.priceSensitivityTier] || 1;
  const itemPriceTier = this.features?.price_tier || 1;
  const priceAlignment = 1 - Math.abs(userPriceTier - itemPriceTier) / 3;
  score += priceAlignment * 0.15;

  // Engagement metrics
  score += (this.features?.popularity || 0) * 0.1;
  score += (this.features?.conversion_rate || 0) * 0.1;

  // Recency bonus
  const ageInDays = (Date.now() - this.createdAt) / (1000 * 60 * 60 * 24);
  const recencyBonus = Math.max(0, 1 - ageInDays / 30) * 0.05;
  score += recencyBonus;

  return Math.min(1, Math.max(0, score));
};

const ContentItem = mongoose.model('ContentItem', contentItemSchema);

module.exports = ContentItem;
