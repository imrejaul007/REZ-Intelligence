/**
 * REZ Company Memory - Models
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface ICompanyMemory extends Document {
  entity_type: string; entity_id: string; name: string;
  health_score: number; health_trend: 'improving' | 'stable' | 'declining';
  active_goals: Array<{ id: string; description: string; target_metric?: string; target_value?: number; current_value?: number; progress: number; deadline?: Date; status: string; created_at: Date }>;
  recent_decisions: Array<{ id: string; type: string; description: string; outcome: string; impact_score: number; date: Date }>;
  metrics: {
    revenue?: { value: number; previous_value?: number; change_percent?: number; trend: string; period: string };
    customers?: { value: number; previous_value?: number; change_percent?: number; trend: string; period: string };
    orders?: { value: number; previous_value?: number; change_percent?: number; trend: string; period: string };
    conversion_rate?: { value: number; previous_value?: number; change_percent?: number; trend: string; period: string };
    avg_order_value?: { value: number; previous_value?: number; change_percent?: number; trend: string; period: string };
    retention_rate?: { value: number; previous_value?: number; change_percent?: number; trend: string; period: string };
    custom_metrics: Record<string, { value: number; previous_value?: number; change_percent?: number; trend: string; period: string }>;
  };
  preferences: {
    operating_hours?: { start: string; end: string; timezone: string };
    notification_channels: string[];
    autonomy_level: string;
    risk_tolerance: string;
    decision_approval_required: boolean;
    auto_actions_enabled: string[];
  };
  tenant_id: string;
}
const CompanyMemorySchema = new Schema<ICompanyMemory>({
  entity_type: { type: String, enum: ['company', 'merchant', 'restaurant', 'hotel', 'healthcare', 'realestate', 'retail'], required: true },
  entity_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  health_score: { type: Number, default: 50, min: 0, max: 100 },
  health_trend: { type: String, enum: ['improving', 'stable', 'declining'], default: 'stable' },
  active_goals: [{
    id: String, description: String, target_metric: String, target_value: Number, current_value: Number,
    progress: { type: Number, default: 0, min: 0, max: 100 }, deadline: Date,
    status: { type: String, enum: ['active', 'completed', 'paused', 'failed'], default: 'active' }, created_at: Date,
  }],
  recent_decisions: [{
    id: String, type: String, description: String, outcome: String, impact_score: Number, date: Date,
  }],
  metrics: {
    revenue: { value: Number, previous_value: Number, change_percent: Number, trend: String, period: String },
    customers: { value: Number, previous_value: Number, change_percent: Number, trend: String, period: String },
    orders: { value: Number, previous_value: Number, change_percent: Number, trend: String, period: String },
    conversion_rate: { value: Number, previous_value: Number, change_percent: Number, trend: String, period: String },
    avg_order_value: { value: Number, previous_value: Number, change_percent: Number, trend: String, period: String },
    retention_rate: { value: Number, previous_value: Number, change_percent: Number, trend: String, period: String },
    custom_metrics: { type: Schema.Types.Mixed, default: {} },
  },
  preferences: {
    operating_hours: { start: String, end: String, timezone: String },
    notification_channels: [String], autonomy_level: String, risk_tolerance: String,
    decision_approval_required: Boolean, auto_actions_enabled: [String],
  },
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
CompanyMemorySchema.index({ tenant_id: 1, entity_type: 1, entity_id: 1 }, { unique: true });
export const CompanyMemory = mongoose.model<ICompanyMemory>('CompanyMemory', CompanyMemorySchema);

export interface IMemoryEvent extends Document {
  entity_id: string; event_type: string; description: string; data: Record<string, unknown>;
  source: string; importance: 'low' | 'medium' | 'high' | 'critical'; timestamp: Date; tenant_id: string;
}
const MemoryEventSchema = new Schema<IMemoryEvent>({
  entity_id: { type: String, required: true, index: true },
  event_type: { type: String, enum: ['metric_change', 'decision_made', 'goal_updated', 'action_taken', 'anomaly_detected', 'opportunity_identified'], required: true },
  description: String, data: Schema.Types.Mixed, source: String,
  importance: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  timestamp: { type: Date, default: Date.now, index: true },
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
MemoryEventSchema.index({ tenant_id: 1, entity_id: 1, timestamp: -1 });
export const MemoryEvent = mongoose.model<IMemoryEvent>('MemoryEvent', MemoryEventSchema);

export interface IBusinessKnowledge extends Document {
  entity_id: string; category: string; topic: string; content: string;
  source: 'manual' | 'ai_generated' | 'extracted'; confidence: number; last_verified?: Date; tenant_id: string;
}
const BusinessKnowledgeSchema = new Schema<IBusinessKnowledge>({
  entity_id: { type: String, required: true, index: true },
  category: { type: String, enum: ['strategy', 'operations', 'customers', 'products', 'competitors', 'processes'], required: true },
  topic: String, content: String,
  source: { type: String, enum: ['manual', 'ai_generated', 'extracted'], default: 'ai_generated' },
  confidence: { type: Number, default: 0.5, min: 0, max: 1 }, last_verified: Date,
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
BusinessKnowledgeSchema.index({ tenant_id: 1, entity_id: 1, category: 1 });
export const BusinessKnowledge = mongoose.model<IBusinessKnowledge>('BusinessKnowledge', BusinessKnowledgeSchema);
