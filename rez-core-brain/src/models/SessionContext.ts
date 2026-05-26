import crypto from 'crypto';
import mongoose, { Document, Schema, Model } from 'mongoose';
import { ISession } from '../types';

// Session state enum
export enum SessionState {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
}

// Interface for Session document
export interface ISessionDocument extends ISession, Document {
  _id: mongoose.Types.ObjectId;
  touch(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  end(): Promise<void>;
  addContext(key: string, value: unknown): Promise<void>;
  removeContext(key: string): Promise<void>;
}

// Session schema
const sessionSchema = new Schema<ISessionDocument>(
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
    agentId: {
      type: String,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    context: {
      type: Schema.Types.Mixed,
      default: {},
    },
    state: {
      type: String,
      enum: Object.values(SessionState),
      default: SessionState.ACTIVE,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: 'sessions',
  }
);

// Compound indexes
sessionSchema.index({ userId: 1, state: 1 });
sessionSchema.index({ userId: 1, startTime: -1 });
sessionSchema.index({ agentId: 1, state: 1 });
sessionSchema.index({ endTime: 1 }, { expireAfterSeconds: 0 }); // Auto-cleanup

// Virtuals
sessionSchema.virtual('duration').get(function () {
  if (!this.endTime) {
    return Date.now() - this.startTime.getTime();
  }
  return this.endTime.getTime() - this.startTime.getTime();
});

sessionSchema.virtual('isActive').get(function () {
  return this.state === SessionState.ACTIVE;
});

sessionSchema.virtual('isPaused').get(function () {
  return this.state === SessionState.PAUSED;
});

// Methods
sessionSchema.methods.touch = async function () {
  this.startTime = new Date();
  await this.save();
};

sessionSchema.methods.pause = async function () {
  if (this.state !== SessionState.ACTIVE) {
    throw new Error(`Cannot pause session in state: ${this.state}`);
  }
  this.state = SessionState.PAUSED;
  await this.save();
};

sessionSchema.methods.resume = async function () {
  if (this.state !== SessionState.PAUSED) {
    throw new Error(`Cannot resume session in state: ${this.state}`);
  }
  this.state = SessionState.ACTIVE;
  await this.save();
};

sessionSchema.methods.end = async function () {
  if (this.state === SessionState.ENDED) {
    throw new Error('Session is already ended');
  }
  this.state = SessionState.ENDED;
  this.endTime = new Date();
  await this.save();
};

sessionSchema.methods.addContext = async function (
  key: string,
  value: unknown
) {
  this.context = {
    ...(this.context as Record<string, unknown>),
    [key]: value,
  };
  await this.save();
};

sessionSchema.methods.removeContext = async function (key: string) {
  const context = this.context as Record<string, unknown>;
  delete context[key];
  this.context = context;
  await this.save();
};

// Static methods
sessionSchema.statics.findActiveByUser = function (userId: string) {
  return this.findOne({
    userId,
    state: SessionState.ACTIVE,
  }).sort({ startTime: -1 });
};

sessionSchema.statics.findByUser = function (
  userId: string,
  options: {
    state?: SessionState;
    limit?: number;
    skip?: number;
  } = {}
) {
  const query: Record<string, unknown> = { userId };

  if (options.state) {
    query.state = options.state;
  }

  return this.find(query)
    .sort({ startTime: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 20);
};

sessionSchema.statics.findOrCreate = async function (
  userId: string,
  agentId?: string
): Promise<ISessionDocument> {
  let session = await this.findActiveByUser(userId);

  if (!session) {
    const sessionId = `sess_${crypto.randomUUID()}`;
    session = await this.create({
      id: sessionId,
      userId,
      agentId,
      startTime: new Date(),
      state: SessionState.ACTIVE,
      context: {},
    });
  }

  return session;
};

sessionSchema.statics.endAllActive = async function (userId: string) {
  const result = await this.updateMany(
    {
      userId,
      state: SessionState.ACTIVE,
    },
    {
      $set: {
        state: SessionState.ENDED,
        endTime: new Date(),
      },
    }
  );
  return result.modifiedCount;
};

sessionSchema.statics.cleanupStaleSessions = async function (ttlSeconds: number) {
  const cutoff = new Date(Date.now() - ttlSeconds * 1000);
  const result = await this.updateMany(
    {
      state: SessionState.ACTIVE,
      startTime: { $lt: cutoff },
    },
    {
      $set: {
        state: SessionState.ENDED,
        endTime: new Date(),
      },
    }
  );
  return result.modifiedCount;
};

sessionSchema.statics.getActiveCount = async function (userId: string) {
  return this.countDocuments({
    userId,
    state: SessionState.ACTIVE,
  });
};

// Pre-save hook
sessionSchema.pre('save', function (next) {
  if (!this.id) {
    this.id = `sess_${crypto.randomUUID()}`;
  }
  next();
});

// Create and export model
interface ISessionModel extends Model<ISessionDocument> {
  findActiveByUser(userId: string): Promise<ISessionDocument | null>;
  findByUser(userId: string, options?: { state?: SessionState; limit?: number; skip?: number }): Promise<ISessionDocument[]>;
  findOrCreate(userId: string, agentId?: string): Promise<ISessionDocument>;
  endAllActive(userId: string): Promise<number>;
  cleanupStaleSessions(ttlSeconds: number): Promise<number>;
  getActiveCount(userId: string): Promise<number>;
}

export const Session = mongoose.model<ISessionDocument, ISessionModel>(
  'Session',
  sessionSchema
);

export default Session;
