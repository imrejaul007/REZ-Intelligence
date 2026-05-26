import crypto from 'crypto';
import mongoose, { Document, Schema, Model } from 'mongoose';
import { IMemoryEntry } from '../types';

// Memory types enum
export enum MemoryType {
  SHORT_TERM = 'short_term',
  LONG_TERM = 'long_term',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
}

// Interface for Memory document
export interface IMemoryDocument extends IMemoryEntry, Document {
  _id: mongoose.Types.ObjectId;
  access(): Promise<void>;
  incrementAccess(): Promise<void>;
}

// Interface for Memory model with static methods
export interface IMemoryModel extends Model<IMemoryDocument> {
  deleteExpired(): Promise<number>;
  findByUser(userId: string, options?: { type?: MemoryType; limit?: number; skip?: number }): Promise<IMemoryDocument[]>;
}

// Memory schema
const memorySchema = new Schema<IMemoryDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(MemoryType),
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      select: false, // Don't include in queries by default for performance
    },
    importance: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      default: 5,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    lastAccessed: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    tags: {
      type: [String],
      index: true,
    },
    source: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'memories',
  }
);

// Compound indexes for efficient queries
memorySchema.index({ userId: 1, type: 1 });
memorySchema.index({ userId: 1, createdAt: -1 });
memorySchema.index({ userId: 1, importance: -1 });
memorySchema.index({ userId: 1, tags: 1 });
memorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual for checking if memory is expired
memorySchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Virtual for age in hours
memorySchema.virtual('ageInHours').get(function () {
  const now = new Date();
  const created = this.createdAt;
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
});

// Methods
memorySchema.methods.access = async function () {
  this.lastAccessed = new Date();
  await this.save();
};

memorySchema.methods.incrementAccess = async function () {
  this.accessCount += 1;
  this.lastAccessed = new Date();
  await this.save();
};

// Static methods
memorySchema.statics.findByUser = function (
  userId: string,
  options: {
    type?: MemoryType;
    limit?: number;
    skip?: number;
    sort?: { field: string; order: 'asc' | 'desc' };
  } = {}
) {
  const query: Record<string, unknown> = { userId };

  if (options.type) {
    query.type = options.type;
  }

  const sortField = options.sort?.field || 'createdAt';
  const sortOrder = options.sort?.order === 'asc' ? 1 : -1;

  return this.find(query)
    .sort({ [sortField]: sortOrder })
    .skip(options.skip || 0)
    .limit(options.limit || 50);
};

memorySchema.statics.findByTags = function (
  userId: string,
  tags: string[],
  options: { limit?: number } = {}
) {
  return this.find({
    userId,
    tags: { $in: tags },
  })
    .sort({ importance: -1, createdAt: -1 })
    .limit(options.limit || 50);
};

memorySchema.statics.findRecent = function (
  userId: string,
  limit: number = 10
) {
  return this.find({ userId })
    .sort({ lastAccessed: -1, createdAt: -1 })
    .limit(limit);
};

memorySchema.statics.deleteExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

memorySchema.statics.consolidateMemories = async function (userId: string) {
  // Move high-importance short-term memories to long-term
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await this.updateMany(
    {
      userId,
      type: MemoryType.SHORT_TERM,
      importance: { $gte: 7 },
      createdAt: { $lt: thirtyDaysAgo },
    },
    {
      $set: { type: MemoryType.LONG_TERM },
    }
  );

  return result.modifiedCount;
};

// Pre-save hook for validation
memorySchema.pre('save', function (next) {
  // Auto-generate ID if not provided
  if (!this.id) {
    this.id = `${crypto.randomUUID()}`;
  }

  // Set default expiration for short-term memories
  if (this.type === MemoryType.SHORT_TERM && !this.expiresAt) {
    const ttl = parseInt(process.env.SHORT_TERM_MEMORY_TTL || '3600', 10);
    this.expiresAt = new Date(Date.now() + ttl * 1000);
  }

  next();
});

// Create and export model
export const Memory = mongoose.model<IMemoryDocument, IMemoryModel>(
  'Memory',
  memorySchema
);

// Index for semantic search (vector operations would need MongoDB Atlas or a plugin)
memorySchema.index({ embedding: '2dsphere' });

export default Memory;
