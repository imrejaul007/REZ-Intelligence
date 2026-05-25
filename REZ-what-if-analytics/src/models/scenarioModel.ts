import mongoose, { Schema, Document } from 'mongoose';

export interface IScenarioDocument extends Document {
  name: string;
  description: string;
  type: string;
  baselineId?: string;
  assumptions: Record<string, string | number>;
  parameters: {
    metric: string;
    changePercent: number;
    timeHorizon: string;
    confidenceLevel: number;
  };
  constraints?: Array<{
    type: 'min' | 'max' | 'equal';
    metric: string;
    value: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ScenarioSchema = new Schema<IScenarioDocument>({
  name: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 1000 },
  type: { type: String, required: true, enum: ['pricing', 'demand', 'promotion', 'inventory', 'customer', 'marketing', 'operational', 'financial'] },
  baselineId: { type: String },
  assumptions: { type: Schema.Types.Mixed, default: {} },
  parameters: {
    metric: { type: String, required: true },
    changePercent: { type: Number, required: true },
    timeHorizon: { type: String, required: true },
    confidenceLevel: { type: Number, default: 0.95 }
  },
  constraints: [{
    type: { type: String, enum: ['min', 'max', 'equal'] },
    metric: { type: String },
    value: { type: Number }
  }]
}, {
  timestamps: true
});

ScenarioSchema.index({ name: 1 });
ScenarioSchema.index({ type: 1 });
ScenarioSchema.index({ createdAt: -1 });

export const ScenarioModel = mongoose.model<IScenarioDocument>('Scenario', ScenarioSchema);
