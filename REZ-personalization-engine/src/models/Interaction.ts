/**
 * Interaction Model - TypeScript implementation
 * Migration from JavaScript to TypeScript
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  IInteraction,
  IInteractionDocument,
  IInteractionModel,
  IInteractionContext,
  IInteractionOutcome,
  InteractionType,
  InteractionContextSource,
  ItemType,
} from '../types/index';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const interactionContextSchema = new Schema<IInteractionContext>({
  source: {
    type: String,
    enum: ['homepage', 'search', 'recommendation', 'category', 'direct', 'email', 'notification'] as InteractionContextSource[],
  },
  position: { type: Number },
  sessionId: { type: String },
  deviceType: { type: String },
  location: { type: String },
  referralCode: { type: String },
}, { _id: false });

const interactionOutcomeSchema = new Schema<IInteractionOutcome>({
  type: {
    type: String,
    enum: ['none', 'converted', 'abandoned', 'saved'],
  },
  value: { type: Number, default: 0 },
}, { _id: false });

const interactionSchema = new Schema<IInteractionDocument>({
  userId: { type: String, required: true, index: true },
  itemId: { type: String, required: true, index: true },
  itemType: {
    type: String,
    required: true,
    enum: ['product', 'content', 'service', 'ad'] as ItemType[],
  },

  // Interaction type
  type: {
    type: String,
    required: true,
    enum: ['view', 'click', 'hover', 'add_to_cart', 'purchase', 'like', 'share', 'save', 'review', 'dismiss'] as InteractionType[],
  },

  // Context
  context: { type: interactionContextSchema, default: () => ({}) },

  // Interaction data
  value: { type: Number, default: 1 },
  duration: { type: Number }, // time spent in ms
  metadata: { type: Schema.Types.Mixed, default: {} },

  // Feedback
  rating: { type: Number, min: 1, max: 5 },
  feedback: { type: String },

  // Result (for recommendations)
  outcome: { type: interactionOutcomeSchema, default: () => ({ type: 'none', value: 0 }) },

  timestamp: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'interactions',
});

// ============================================================================
// INDEXES
// ============================================================================

// Compound indexes
interactionSchema.index({ userId: 1, timestamp: -1 });
interactionSchema.index({ userId: 1, itemId: 1, timestamp: -1 });
interactionSchema.index({ itemId: 1, type: 1, timestamp: -1 });
interactionSchema.index({ userId: 1, type: 1, timestamp: -1 });
interactionSchema.index({ timestamp: -1, type: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================

// Virtual for implicit feedback value
interactionSchema.virtual('implicitRating').get(function (this: IInteractionDocument): number {
  const typeValues: Record<string, number> = {
    view: 0.2,
    hover: 0.3,
    click: 0.5,
    add_to_cart: 0.7,
    purchase: 1.0,
    like: 0.8,
    share: 0.9,
    save: 0.7,
    dismiss: -0.5,
    review: 0.95,
  };

  let rating = typeValues[this.type] || 0;

  if (this.rating) {
    rating = (rating + this.rating / 5) / 2;
  }

  if (this.duration) {
    const durationFactor = Math.min(1, this.duration / 30000);
    rating = (rating + durationFactor) / 2;
  }

  return rating;
});

// ============================================================================
// STATICS
// ============================================================================

// Statics for generating user-item matrix
interactionSchema.statics.buildUserItemMatrix = async function(
  users: string[],
  items: string[],
  timeWindow: number = 30
): Promise<Record<string, Record<string, number>>> {
  const cutoffDate = new Date(Date.now() - timeWindow * 24 * 60 * 60 * 1000);

  const interactions = await this.aggregate([
    {
      $match: {
        userId: { $in: users },
        itemId: { $in: items },
        timestamp: { $gte: cutoffDate },
      },
    },
    {
      $group: {
        _id: { userId: '$userId', itemId: '$itemId' },
        interactions: { $sum: 1 },
        types: { $addToSet: '$type' },
        totalValue: { $sum: '$value' },
        lastInteraction: { $max: '$timestamp' },
      },
    },
  ]);

  const matrix: Record<string, Record<string, number>> = {};
  users.forEach((userId) => {
    matrix[userId] = {};
    items.forEach((itemId) => {
      matrix[userId][itemId] = 0;
    });
  });

  interactions.forEach((i) => {
    const id = i._id as { userId: string; itemId: string };
    const value = i.types.includes('purchase')
      ? 5
      : i.types.includes('add_to_cart')
        ? 3
        : i.types.includes('like')
          ? 2
          : i.types.includes('view')
            ? 1
            : 0.5;
    matrix[id.userId][id.itemId] = value;
  });

  return matrix;
};

// Method to calculate co-occurrence
interactionSchema.statics.getCoOccurrence = async function(
  itemId: string,
  timeWindow: number = 7
): Promise<Record<string, { count: number; jaccard: number }>> {
  const cutoffDate = new Date(Date.now() - timeWindow * 24 * 60 * 60 * 1000);

  const userItems = await this.aggregate([
    {
      $match: {
        itemId,
        timestamp: { $gte: cutoffDate },
        userId: { $exists: true },
      },
    },
    {
      $group: { _id: '$userId' },
    },
  ]);

  const userIds = userItems.map((u) => u._id as string);

  if (userIds.length === 0) return {};

  const coOccurrences = await this.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        itemId: { $ne: itemId },
        timestamp: { $gte: cutoffDate },
      },
    },
    {
      $group: {
        _id: '$itemId',
        count: { $sum: 1 },
        users: { $addToSet: '$userId' },
      },
    },
    {
      $addFields: {
        jaccard: { $divide: [{ $size: '$users' }, userIds.length] },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);

  return coOccurrences.reduce((acc, item) => {
    acc[item._id as string] = { count: item.count, jaccard: item.jaccard };
    return acc;
  }, {} as Record<string, { count: number; jaccard: number }>);
};

// ============================================================================
// MODEL EXPORT
// ============================================================================

export const Interaction = mongoose.model<IInteractionDocument, IInteractionModel>(
  'Interaction',
  interactionSchema
);

export default Interaction;
