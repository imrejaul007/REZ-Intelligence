/**
 * REZ Autonomous Loop Service - Models
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IAutonomousLoop extends Document {
  name: string; description: string;
  entity_type: string; entity_id: string;
  status: 'active' | 'paused' | 'stopped' | 'error';
  phase: 'observe' | 'think' | 'decide' | 'act' | 'learn';
  interval_seconds: number;
  config: {
    observe_enabled: boolean; think_enabled: boolean; decide_enabled: boolean;
    act_enabled: boolean; learn_enabled: boolean; auto_execute: boolean;
    require_approval: boolean; max_actions_per_run: number; confidence_threshold: number; alert_on_failure: boolean;
  };
  last_run?: Date; next_run?: Date; run_count: number; success_count: number; failure_count: number;
  tenant_id: string;
}
const AutonomousLoopSchema = new Schema<IAutonomousLoop>({
  name: { type: String, required: true },
  description: String,
  entity_type: { type: String, enum: ['company', 'merchant', 'restaurant', 'hotel', 'healthcare', 'realestate', 'user'], required: true },
  entity_id: { type: String, required: true, index: true },
  status: { type: String, enum: ['active', 'paused', 'stopped', 'error'], default: 'active' },
  phase: { type: String, enum: ['observe', 'think', 'decide', 'act', 'learn'], default: 'observe' },
  interval_seconds: { type: Number, default: 300 },
  config: {
    observe_enabled: { type: Boolean, default: true }, think_enabled: { type: Boolean, default: true },
    decide_enabled: { type: Boolean, default: true }, act_enabled: { type: Boolean, default: true },
    learn_enabled: { type: Boolean, default: true }, auto_execute: { type: Boolean, default: true },
    require_approval: { type: Boolean, default: false }, max_actions_per_run: { type: Number, default: 10 },
    confidence_threshold: { type: Number, default: 0.7 }, alert_on_failure: { type: Boolean, default: true },
  },
  last_run: Date, next_run: Date,
  run_count: { type: Number, default: 0 }, success_count: { type: Number, default: 0 }, failure_count: { type: Number, default: 0 },
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
AutonomousLoopSchema.index({ tenant_id: 1, entity_type: 1, entity_id: 1 });
AutonomousLoopSchema.index({ tenant_id: 1, status: 1, next_run: 1 });
export const AutonomousLoop = mongoose.model<IAutonomousLoop>('AutonomousLoop', AutonomousLoopSchema);

export interface IObservation extends Document {
  loop_id: string; timestamp: Date; source: string; type: string; data: Record<string, unknown>;
  summary: string; priority: 'low' | 'medium' | 'high' | 'critical'; processed: boolean; tenant_id: string;
}
const ObservationSchema = new Schema<IObservation>({
  loop_id: { type: String, required: true, index: true }, timestamp: { type: Date, default: Date.now },
  source: String, type: String, data: Schema.Types.Mixed, summary: String,
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  processed: { type: Boolean, default: false }, tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
ObservationSchema.index({ tenant_id: 1, loop_id: 1, timestamp: -1 });
ObservationSchema.index({ tenant_id: 1, loop_id: 1, processed: 1 });
export const Observation = mongoose.model<IObservation>('Observation', ObservationSchema);

export interface IThought extends Document {
  loop_id: string; observation_ids: [string]; timestamp: Date; reasoning: string;
  context_used: [string]; confidence: number; alternative_thoughts?: [string]; conclusion: string; tenant_id: string;
}
const ThoughtSchema = new Schema<IThought>({
  loop_id: { type: String, required: true, index: true },
  observation_ids: [{ type: String }], timestamp: { type: Date, default: Date.now },
  reasoning: String, context_used: [{ type: String }], confidence: { type: Number, default: 0.5 },
  alternative_thoughts: [{ type: String }], conclusion: String,
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
ThoughtSchema.index({ tenant_id: 1, loop_id: 1, timestamp: -1 });
export const Thought = mongoose.model<IThought>('Thought', ThoughtSchema);

export interface IDecision extends Document {
  loop_id: string; thought_id: string; timestamp: Date; decision_type: string;
  action_type?: string; parameters: Record<string, unknown>; confidence: number; reasoning: string;
  risk_level: 'low' | 'medium' | 'high'; requires_approval: boolean;
  approved_by?: string; approved_at?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'; tenant_id: string;
}
const DecisionSchema = new Schema<IDecision>({
  loop_id: { type: String, required: true, index: true }, thought_id: String,
  timestamp: { type: Date, default: Date.now },
  decision_type: { type: String, enum: ['optimization', 'intervention', 'alert', 'automation', 'rollback'], required: true },
  action_type: String, parameters: Schema.Types.Mixed, confidence: { type: Number, default: 0.5 },
  reasoning: String, risk_level: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  requires_approval: { type: Boolean, default: false }, approved_by: String, approved_at: Date,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'executed', 'failed'], default: 'pending' },
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
DecisionSchema.index({ tenant_id: 1, loop_id: 1, status: 1 });
DecisionSchema.index({ tenant_id: 1, status: 1, requires_approval: 1 });
export const Decision = mongoose.model<IDecision>('Decision', DecisionSchema);

export interface IAutonomousAction extends Document {
  loop_id: string; decision_id: string; action_type: string; parameters: Record<string, unknown>;
  target_service?: string; target_endpoint?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  execution_start?: Date; execution_end?: Date; result?: Record<string, unknown>; error?: string;
  rollback_action_id?: string; tenant_id: string;
}
const AutonomousActionSchema = new Schema<IAutonomousAction>({
  loop_id: { type: String, required: true, index: true }, decision_id: String,
  action_type: String, parameters: Schema.Types.Mixed, target_service: String, target_endpoint: String,
  status: { type: String, enum: ['pending', 'executing', 'completed', 'failed', 'rolled_back'], default: 'pending' },
  execution_start: Date, execution_end: Date, result: Schema.Types.Mixed, error: String,
  rollback_action_id: String, tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
AutonomousActionSchema.index({ tenant_id: 1, loop_id: 1, status: 1 });
AutonomousActionSchema.index({ tenant_id: 1, created_at: -1 });
export const AutonomousAction = mongoose.model<IAutonomousAction>('AutonomousAction', AutonomousActionSchema);

export interface ILearning extends Document {
  loop_id: string; action_id: string; timestamp: Date;
  outcome: 'success' | 'partial' | 'failure';
  metrics: { improvement?: number; accuracy?: number; cost_saved?: number; revenue_impact?: number; time_saved_minutes?: number };
  feedback: string; pattern_identified?: string; confidence_adjustment?: number; tenant_id: string;
}
const LearningSchema = new Schema<ILearning>({
  loop_id: { type: String, required: true, index: true }, action_id: String,
  timestamp: { type: Date, default: Date.now },
  outcome: { type: String, enum: ['success', 'partial', 'failure'], required: true },
  metrics: Schema.Types.Mixed, feedback: String, pattern_identified: String, confidence_adjustment: Number,
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
LearningSchema.index({ tenant_id: 1, loop_id: 1, timestamp: -1 });
export const Learning = mongoose.model<ILearning>('Learning', LearningSchema);

export interface IActivityFeedItem extends Document {
  loop_id: string; entity_type: string; entity_id: string;
  phase: 'observe' | 'think' | 'decide' | 'act' | 'learn';
  action: string; description: String; status: 'info' | 'success' | 'warning' | 'error';
  metadata?: Record<string, unknown>; timestamp: Date; tenant_id: string;
}
const ActivityFeedItemSchema = new Schema<IActivityFeedItem>({
  loop_id: { type: String, required: true, index: true },
  entity_type: { type: String, required: true }, entity_id: { type: String, required: true, index: true },
  phase: { type: String, enum: ['observe', 'think', 'decide', 'act', 'learn'], required: true },
  action: String, description: String, status: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  metadata: Schema.Types.Mixed, timestamp: { type: Date, default: Date.now, index: true },
  tenant_id: { type: String, required: true, index: true },
}, { timestamps: true });
ActivityFeedItemSchema.index({ tenant_id: 1, entity_id: 1, timestamp: -1 });
export const ActivityFeedItem = mongoose.model<IActivityFeedItem>('ActivityFeedItem', ActivityFeedItemSchema);
