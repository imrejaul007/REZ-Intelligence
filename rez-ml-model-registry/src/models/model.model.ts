import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// Type Definitions
// ============================================

export interface IMetric {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  rmse?: number;
  mae?: number;
  custom?: Record<string, number>;
}

export interface IModelVersion {
  version: string;
  modelUri: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  fileSize: number;
  checksum: string;
  framework: string;
  frameworkVersion: string;
  metrics: IMetric;
  artifacts: {
    name: string;
    path: string;
    size: number;
    type: string;
  }[];
  environment: {
    pythonVersion?: string;
    dependencies?: Record<string, string>;
    hardware?: string;
  };
  status: 'pending' | 'validated' | 'staged' | 'production' | 'archived';
  validationResult?: {
    passed: boolean;
    checksRun: string[];
    errors?: string[];
  };
}

export interface IModelMetadata {
  task: string;
  algorithm: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  trainingDataInfo?: {
    datasetName: string;
    datasetVersion: string;
    size: number;
    splitRatio?: { train: number; validation: number; test: number };
  };
  owner: string;
  tags: string[];
  description?: string;
}

export interface IModel extends Document {
  name: string;
  namespace: string;
  description?: string;
  metadata: IModelMetadata;
  versions: IModelVersion[];
  latestVersion: string;
  stage: 'development' | 'staging' | 'production' | 'archived';
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

// ============================================
// Schema Definitions
// ============================================

const MetricSchema = new Schema<IMetric>(
  {
    accuracy: { type: Number, min: 0, max: 1 },
    precision: { type: Number, min: 0, max: 1 },
    recall: { type: Number, min: 0, max: 1 },
    f1Score: { type: Number, min: 0, max: 1 },
    auc: { type: Number, min: 0, max: 1 },
    rmse: { type: Number },
    mae: { type: Number },
    custom: { type: Map, of: Number },
  },
  { _id: false }
);

const ModelVersionSchema = new Schema<IModelVersion>(
  {
    version: {
      type: String,
      required: true,
      match: /^\d+\.\d+\.\d+$/,
    },
    modelUri: { type: String, required: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 0 },
    checksum: { type: String, required: true },
    framework: { type: String, required: true },
    frameworkVersion: { type: String, required: true },
    metrics: { type: MetricSchema, default: {} },
    artifacts: [
      {
        name: { type: String, required: true },
        path: { type: String, required: true },
        size: { type: Number, required: true },
        type: { type: String, required: true },
      },
    ],
    environment: {
      pythonVersion: String,
      dependencies: { type: Map, of: String },
      hardware: String,
    },
    status: {
      type: String,
      enum: ['pending', 'validated', 'staged', 'production', 'archived'],
      default: 'pending',
    },
    validationResult: {
      passed: Boolean,
      checksRun: [String],
      errors: [String],
    },
  },
  { _id: false }
);

const ModelMetadataSchema = new Schema<IModelMetadata>(
  {
    task: { type: String, required: true },
    algorithm: { type: String, required: true },
    inputSchema: { type: Schema.Types.Mixed, required: true },
    outputSchema: { type: Schema.Types.Mixed, required: true },
    trainingDataInfo: {
      datasetName: String,
      datasetVersion: String,
      size: Number,
      splitRatio: {
        train: Number,
        validation: Number,
        test: Number,
      },
    },
    owner: { type: String, required: true },
    tags: [{ type: String }],
    description: String,
  },
  { _id: false }
);

const ModelSchema = new Schema<IModel>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9-_]+$/,
    },
    namespace: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'default',
    },
    description: { type: String, trim: true },
    metadata: { type: ModelMetadataSchema, required: true },
    versions: [ModelVersionSchema],
    latestVersion: { type: String, default: null },
    stage: {
      type: String,
      enum: ['development', 'staging', 'production', 'archived'],
      default: 'development',
    },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// ============================================
// Indexes
// ============================================

ModelSchema.index({ name: 1, namespace: 1 }, { unique: true });
ModelSchema.index({ 'metadata.tags': 1 });
ModelSchema.index({ 'metadata.task': 1 });
ModelSchema.index({ 'metadata.owner': 1 });
ModelSchema.index({ stage: 1 });
ModelSchema.index({ isArchived: 1 });
ModelSchema.index({ createdAt: -1 });
ModelSchema.index({ 'versions.version': 1 });

// ============================================
// Virtuals
// ============================================

ModelSchema.virtual('versionCount').get(function () {
  return this.versions?.length || 0;
});

ModelSchema.virtual('fullName').get(function () {
  return `${this.namespace}/${this.name}`;
});

// ============================================
// Methods
// ============================================

ModelSchema.methods.getVersion = function (version: string): IModelVersion | undefined {
  return this.versions.find((v) => v.version === version);
};

ModelSchema.methods.getLatestProductionVersion = function (): IModelVersion | undefined {
  return this.versions
    .filter((v) => v.status === 'production')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
};

ModelSchema.methods.addVersion = function (versionData: Omit<IModelVersion, 'createdAt'>): void {
  const existingIndex = this.versions.findIndex((v) => v.version === versionData.version);
  if (existingIndex >= 0) {
    throw new Error(`Version ${versionData.version} already exists`);
  }
  this.versions.push(versionData as IModelVersion);
  this.latestVersion = versionData.version;
};

// ============================================
// Static Methods
// ============================================

ModelSchema.statics.findByFullName = function (namespace: string, name: string): Promise<IModel | null> {
  return this.findOne({ namespace: namespace.toLowerCase(), name: name.toLowerCase() });
};

ModelSchema.statics.findByTag = function (tag: string): Promise<IModel[]> {
  return this.find({ 'metadata.tags': tag, isArchived: false });
};

ModelSchema.statics.findByTask = function (task: string): Promise<IModel[]> {
  return this.find({ 'metadata.task': task, isArchived: false });
};

ModelSchema.statics.findByOwner = function (owner: string): Promise<IModel[]> {
  return this.find({ 'metadata.owner': owner, isArchived: false });
};

// ============================================
// Pre/Post Hooks
// ============================================

ModelSchema.pre('save', function (next) {
  if (this.isModified('isArchived') && this.isArchived) {
    this.archivedAt = new Date();
  }
  next();
});

ModelSchema.pre('findOneAndUpdate', function (next) {
  this.setOptions({ runValidators: true });
  next();
});

// ============================================
// Export
// ============================================

export const Model = mongoose.model<IModel>('Model', ModelSchema);
