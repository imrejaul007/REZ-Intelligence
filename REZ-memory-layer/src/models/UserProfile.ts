/**
 * REZ Memory Layer - User Profile Model
 * MongoDB model for storing computed user profiles
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUserProfileDocument extends Document {
  userId: string;
  segments: unknown[];
  preferences;
  behavioralPatterns: unknown[];
  eventCount: number;
  lastEventTimestamp: Date;
  firstEventTimestamp: Date;
  tags: string[];
  metadata: Record<string, unknown>;
}

const UserProfileSchema = new Schema<IUserProfileDocument>({
  userId: { type: String, required: true, unique: true, index: true },
  segments: { type: Schema.Types.Mixed, default: [] },
  preferences: { type: Schema.Types.Mixed, default: {} },
  behavioralPatterns: { type: Schema.Types.Mixed, default: [] },
  eventCount: { type: Number, default: 0 },
  lastEventTimestamp: Date,
  firstEventTimestamp: Date,
  tags: { type: [String], default: [] },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export const UserProfile = mongoose.model<IUserProfileDocument>('UserProfile', UserProfileSchema);
