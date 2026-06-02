/**
 * REZ Conversation Intelligence - Action Item Model
 *
 * Stores extracted action items from meetings/conversations
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// Types
// ============================================================================

export type ActionItemPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ActionItemType = 'task' | 'follow_up' | 'decision' | 'commitment' | 'request';

export interface IActionItem extends Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;

  // Meeting reference
  meetingId?: string;
  conversationId?: string;

  // Content
  type: ActionItemType;
  title: string;
  description: string;
  rawText: string; // Original text from which it was extracted

  // Assignment
  assigneeName?: string;
  assigneeEmail?: string;
  assignedBy?: string;

  // Timing
  dueDate?: Date;
  priority: ActionItemPriority;
  status: ActionItemStatus;

  // Context
  context: {
    conversationTitle?: string;
    participants?: string[];
    keywords?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
  };

  // Tracking
  completedAt?: Date;
  completedBy?: string;
  reminderSent?: boolean;
  reminderCount?: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schema
// ============================================================================

const ActionItemSchema = new Schema<IActionItem>({
  tenantId: { type: String, required: true, index: true },

  meetingId: String,
  conversationId: String,

  type: {
    type: String,
    enum: ['task', 'follow_up', 'decision', 'commitment', 'request'],
    default: 'task',
  },
  title: { type: String, required: true },
  description: String,
  rawText: String,

  assigneeName: String,
  assigneeEmail: String,
  assignedBy: String,

  dueDate: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
  },

  context: {
    conversationTitle: String,
    participants: [String],
    keywords: [String],
    sentiment: String,
  },

  completedAt: Date,
  completedBy: String,
  reminderSent: { type: Boolean, default: false },
  reminderCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Indexes
ActionItemSchema.index({ tenantId: 1, status: 1 });
ActionItemSchema.index({ tenantId: 1, assigneeEmail: 1 });
ActionItemSchema.index({ tenantId: 1, dueDate: 1 });
ActionItemSchema.index({ tenantId: 1, meetingId: 1 });
ActionItemSchema.index({ createdAt: -1 });

// ============================================================================
// Model
// ============================================================================

export const ActionItemModel: Model<IActionItem> = mongoose.model<IActionItem>('ActionItem', ActionItemSchema);
export default ActionItemModel;
