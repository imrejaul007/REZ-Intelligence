import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWorkflowNode {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface IWorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface IWorkflow extends Document {
  id: string;
  name: string;
  description?: string;
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema = new Schema<IWorkflow>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    nodes: { type: [Object], required: true },
    edges: { type: [Object], required: true },
    isActive: { type: Boolean, default: true },
    createdBy: String,
  },
  { timestamps: true }
);

WorkflowSchema.index({ name: 'text' });
WorkflowSchema.index({ isActive: 1 });

export const Workflow: Model<IWorkflow> = mongoose.model<IWorkflow>('Workflow', WorkflowSchema);

export interface IWorkflowExecution extends Document {
  executionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  triggerData?: Record<string, unknown>;
  nodeResults: Record<string, unknown>;
  output?: unknown;
  executionErrors: string[];
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

const ExecutionSchema = new Schema<IWorkflowExecution>({
  executionId: { type: String, required: true, unique: true, index: true },
  workflowId: { type: String, required: true, index: true },
  status: { type: String, enum: ['running', 'completed', 'failed', 'paused'], required: true },
  triggerData: Schema.Types.Mixed,
  nodeResults: { type: Schema.Types.Mixed, default: {} },
  output: Schema.Types.Mixed,
  executionErrors: { type: [String], default: [] },
  startedAt: { type: Date, required: true },
  completedAt: Date,
  durationMs: Number,
});

ExecutionSchema.index({ workflowId: 1, startedAt: -1 });
ExecutionSchema.index({ status: 1 });

export const WorkflowExecution: Model<IWorkflowExecution> = mongoose.model<IWorkflowExecution>('WorkflowExecution', ExecutionSchema);
