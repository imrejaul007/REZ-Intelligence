/**
 * @deprecated Migration to TypeScript in progress
 * TODO: Replace with src/types/index.ts IInteractionDocument interface
 * TODO: See src/models/Interaction.ts for TypeScript implementation
 */

const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  itemId: { type: String, required: true, index: true },
  itemType: { type: String, required: true, enum: ['product', 'content', 'service', 'ad'] },

  // Interaction type
  type: {
    type: String,
    required: true,
    enum: ['view', 'click', 'hover', 'add_to_cart', 'purchase', 'like', 'share', 'save', 'review', 'dismiss']
  },

  // Context
  context: {
    source: { type: String, enum: ['homepage', 'search', 'recommendation', 'category', 'direct', 'email', 'notification'] },
    position: { type: Number },
    sessionId: { type: String },
    deviceType: { type: String },
    location: { type: String },
    referralCode: { type: String }
  },

  // Interaction data
  value: { type: Number, default: 1 },
  duration: { type: Number }, // time spent in ms
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Feedback
  rating: { type: Number, min: 1, max: 5 },
  feedback: { type: String },

  // Result (for recommendations)
  outcome: {
    type: { type: String, enum: ['none', 'converted', 'abandoned', 'saved'] },
    value: { type: Number, default: 0 }
  },

  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'interactions'
});

// Compound indexes
interactionSchema.index({ userId: 1, timestamp: -1 });
interactionSchema.index({ userId: 1, itemId: 1, timestamp: -1 });
interactionSchema.index({ itemId: 1, type: 1, timestamp: -1 });
interactionSchema.index({ userId: 1, type: 1, timestamp: -1 });
interactionSchema.index({ timestamp: -1, type: 1 });

// Virtual for implicit feedback value
interactionSchema.virtual('implicitRating').get(function() {
  const typeValues = {
    view: 0.2,
    hover: 0.3,
    click: 0.5,
    add_to_cart: 0.7,
    purchase: 1.0,
    like: 0.8,
    share: 0.9,
    save: 0.7,
    dismiss: -0.5,
    review: 0.95
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

// Statics for generating user-item matrix
interactionSchema.statics.buildUserItemMatrix = async function(users, items, timeWindow = 30) {
  const cutoffDate = new Date(Date.now() - timeWindow * 24 * 60 * 60 * 1000);

  const interactions = await this.aggregate([
    {
      $match: {
        userId: { $in: users },
        itemId: { $in: items },
        timestamp: { $gte: cutoffDate }
      }
    },
    {
      $group: {
        _id: { userId: '$userId', itemId: '$itemId' },
        interactions: { $sum: 1 },
        types: { $addToSet: '$type' },
        totalValue: { $sum: '$value' },
        lastInteraction: { $max: '$timestamp' }
      }
    }
  ]);

  const matrix = {};
  users.forEach(userId => {
    matrix[userId] = {};
    items.forEach(itemId => {
      matrix[userId][itemId] = 0;
    });
  });

  interactions.forEach(i => {
    const value = i.types.includes('purchase') ? 5 :
                  i.types.includes('add_to_cart') ? 3 :
                  i.types.includes('like') ? 2 :
                  i.types.includes('view') ? 1 : 0.5;
    matrix[i._id.userId][i._id.itemId] = value;
  });

  return matrix;
};

// Method to calculate co-occurrence
interactionSchema.statics.getCoOccurrence = async function(itemId, timeWindow = 7) {
  const cutoffDate = new Date(Date.now() - timeWindow * 24 * 60 * 60 * 1000);

  const userItems = await this.aggregate([
    {
      $match: {
        itemId,
        timestamp: { $gte: cutoffDate },
        userId: { $exists: true }
      }
    },
    {
      $group: { _id: '$userId' }
    }
  ]);

  const userIds = userItems.map(u => u._id);

  if (userIds.length === 0) return {};

  const coOccurrences = await this.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        itemId: { $ne: itemId },
        timestamp: { $gte: cutoffDate }
      }
    },
    {
      $group: {
        _id: '$itemId',
        count: { $sum: 1 },
        users: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        jaccard: { $divide: [{ $size: '$users' }, userIds.length] }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 50 }
  ]);

  return coOccurrences.reduce((acc, item) => {
    acc[item._id] = { count: item.count, jaccard: item.jaccard };
    return acc;
  }, {});
};

const Interaction = mongoose.model('Interaction', interactionSchema);

module.exports = Interaction;
