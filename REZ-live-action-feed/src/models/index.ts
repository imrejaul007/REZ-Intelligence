/**
 * REZ Live Action Feed - Models
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedItem extends Document {
  entity_type: string; entity_id: string;
  agent_id: string; agent_name: string;
  action_type: 'observe' | 'think' | 'decide' | 'act' | 'learn';
  action: string; description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: Record<string, unknown>; error?: string;
  duration_ms?: number; confidence?: number;
  metadata?: Record<string, unknown>;
  timestamp: Date; tenant_id: string;
}
const FeedItemSchema = new Schema<IFeedItem>({
  entity_type: { type: String, enum: ['company', 'merchant', 'restaurant', 'hotel', 'healthcare', 'realestate', 'user'], required: true, index: true },
  entity_id: { type: String, required: true, index: true },
  agent_id: { type: String, required: true, index: true },
  agent_name: String,
  action_type: { type: String, enum: ['observe', 'think', 'decide', 'act', 'learn'], required: true },
  action: { type: String, required: true },
  description: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'running' },
  result: Schema.Types.Mixed, error: String, duration_ms: Number, confidence: Number,
  metadata: Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now, index: true },
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
FeedItemSchema.index({ tenant_id: 1, entity_id: 1, timestamp: -1 });
FeedItemSchema.index({ tenant_id: 1, agent_id: 1, timestamp: -1 });
FeedItemSchema.index({ tenant_id: 1, status: 1, timestamp: -1 });
export const FeedItem = mongoose.model<IFeedItem>('FeedItem', FeedItemSchema);

export interface IAgentStatus extends Document {
  agent_id: string; name: string; type: string;
  status: 'idle' | 'running' | 'error';
  current_action?: string;
  actions_today: number; actions_success: number; actions_failed: number;
  last_action?: Date; tenant_id: string;
}
const AgentStatusSchema = new Schema<IAgentStatus>({
  agent_id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  type: String,
  status: { type: String, enum: ['idle', 'running', 'error'], default: 'idle' },
  current_action: String,
  actions_today: { type: Number, default: 0 },
  actions_success: { type: Number, default: 0 },
  actions_failed: { type: Number, default: 0 },
  last_action: Date,
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
AgentStatusSchema.index({ tenant_id: 1, status: 1 });
export const AgentStatus = mongoose.model<IAgentStatus>('AgentStatus', AgentStatusSchema);
