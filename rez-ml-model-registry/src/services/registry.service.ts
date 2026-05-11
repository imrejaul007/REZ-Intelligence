import { Model, IModel, IModelVersion, IMetric, IModelMetadata } from '../models/model.model';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

// ============================================
// DTOs / Request Types
// ============================================

export interface CreateModelDTO {
  name: string;
  namespace?: string;
  description?: string;
  metadata: {
    task: string;
    algorithm: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    trainingDataInfo?: IModelMetadata['trainingDataInfo'];
    owner: string;
    tags?: string[];
    description?: string;
  };
}

export interface RegisterVersionDTO {
  modelName: string;
  namespace?: string;
  version: string;
  modelUri: string;
  description?: string;
  createdBy: string;
  fileSize: number;
  fileBuffer?: Buffer;
  framework: string;
  frameworkVersion: string;
  metrics?: IMetric;
  artifacts?: Omit<IModelVersion['artifacts'][0], 'name'>[];
  environment?: IModelVersion['environment'];
}

export interface UpdateModelDTO {
  description?: string;
  tags?: string[];
  stage?: IModel['stage'];
}

export interface UpdateVersionDTO {
  description?: string;
  metrics?: IMetric;
  status?: IModelVersion['status'];
  validationResult?: IModelVersion['validationResult'];
}

export interface SearchModelsDTO {
  query?: string;
  task?: string;
  tags?: string[];
  owner?: string;
  stage?: IModel['stage'];
  framework?: string;
  minAccuracy?: number;
  isArchived?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================
// Response Types
// ============================================

export interface ModelSearchResult {
  models: IModel[];
  total: number;
  limit: number;
  offset: number;
}

export interface VersionComparison {
  modelName: string;
  namespace: string;
  versions: {
    version: string;
    metrics: IMetric;
    createdAt: Date;
  }[];
  comparison: {
    metric: string;
    values: Record<string, number>;
    improvement: Record<string, number | null>;
  }[];
}

// ============================================
// Registry Service
// ============================================

export class RegistryService {
  /**
   * Create a new model in the registry
   */
  async createModel(dto: CreateModelDTO): Promise<IModel> {
    const name = dto.name.toLowerCase().trim();
    const namespace = (dto.namespace || 'default').toLowerCase().trim();

    // Check for existing model
    const existing = await Model.findOne({ name, namespace });
    if (existing) {
      throw new Error(`Model ${namespace}/${name} already exists`);
    }

    const model = new Model({
      name,
      namespace,
      description: dto.description,
      metadata: {
        ...dto.metadata,
        tags: dto.metadata.tags || [],
        owner: dto.metadata.owner,
      },
      versions: [],
      latestVersion: null,
      stage: 'development',
      isArchived: false,
    });

    await model.save();
    return model;
  }

  /**
   * Get a model by name and namespace
   */
  async getModel(namespace: string, name: string): Promise<IModel | null> {
    return Model.findByFullName(namespace.toLowerCase(), name.toLowerCase());
  }

  /**
   * Get a specific version of a model
   */
  async getModelVersion(
    namespace: string,
    name: string,
    version: string
  ): Promise<{ model: IModel | null; version: IModelVersion | undefined }> {
    const model = await Model.findByFullName(namespace.toLowerCase(), name.toLowerCase());
    if (!model) {
      return { model: null, version: undefined };
    }

    const versionData = model.getVersion(version);
    return { model, version: versionData };
  }

  /**
   * Register a new version for a model
   */
  async registerVersion(dto: RegisterVersionDTO): Promise<{ model: IModel; version: IModelVersion }> {
    const namespace = (dto.namespace || 'default').toLowerCase();
    const model = await Model.findByFullName(namespace, dto.modelName.toLowerCase());

    if (!model) {
      throw new Error(`Model ${namespace}/${dto.modelName} not found`);
    }

    // Calculate checksum from file buffer or use provided URI
    let checksum = '';
    if (dto.fileBuffer) {
      checksum = crypto.createHash('sha256').update(dto.fileBuffer).digest('hex');
    } else {
      checksum = crypto.createHash('sha256').update(dto.modelUri).digest('hex');
    }

    const versionData: Omit<IModelVersion, 'createdAt'> = {
      version: dto.version,
      modelUri: dto.modelUri,
      description: dto.description,
      createdBy: dto.createdBy,
      fileSize: dto.fileSize,
      checksum,
      framework: dto.framework,
      frameworkVersion: dto.frameworkVersion,
      metrics: dto.metrics || {},
      artifacts: (dto.artifacts || []).map((artifact) => ({
        name: artifact.type || 'model',
        path: artifact.path,
        size: artifact.size,
        type: artifact.type,
      })),
      environment: dto.environment || {},
      status: 'pending',
    };

    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(dto.version)) {
      throw new Error('Version must be in semver format (e.g., 1.0.0)');
    }

    // Check for duplicate version
    if (model.getVersion(dto.version)) {
      throw new Error(`Version ${dto.version} already exists for model ${namespace}/${dto.modelName}`);
    }

    model.addVersion(versionData);
    await model.save();

    const version = model.getVersion(dto.version)!;
    return { model, version };
  }

  /**
   * Update model metadata
   */
  async updateModel(
    namespace: string,
    name: string,
    dto: UpdateModelDTO
  ): Promise<IModel | null> {
    const model = await Model.findByFullName(namespace.toLowerCase(), name.toLowerCase());
    if (!model) {
      return null;
    }

    if (dto.description !== undefined) {
      model.description = dto.description;
    }

    if (dto.tags !== undefined) {
      model.metadata.tags = dto.tags;
    }

    if (dto.stage !== undefined) {
      model.stage = dto.stage;
    }

    await model.save();
    return model;
  }

  /**
   * Update a specific version
   */
  async updateVersion(
    namespace: string,
    name: string,
    version: string,
    dto: UpdateVersionDTO
  ): Promise<IModelVersion | null> {
    const { model, version: versionData } = await this.getModelVersion(namespace, name, version);
    if (!model || !versionData) {
      return null;
    }

    const versionIndex = model.versions.findIndex((v) => v.version === version);

    if (dto.description !== undefined) {
      model.versions[versionIndex].description = dto.description;
    }

    if (dto.metrics !== undefined) {
      model.versions[versionIndex].metrics = {
        ...model.versions[versionIndex].metrics,
        ...dto.metrics,
      };
    }

    if (dto.status !== undefined) {
      model.versions[versionIndex].status = dto.status;
    }

    if (dto.validationResult !== undefined) {
      model.versions[versionIndex].validationResult = dto.validationResult;
    }

    await model.save();
    return model.versions[versionIndex];
  }

  /**
   * Search models with filters
   */
  async searchModels(dto: SearchModelsDTO): Promise<ModelSearchResult> {
    const filter: Record<string, unknown> = {};

    if (dto.query) {
      filter.$or = [
        { name: { $regex: dto.query, $options: 'i' } },
        { description: { $regex: dto.query, $options: 'i' } },
        { 'metadata.tags': { $regex: dto.query, $options: 'i' } },
      ];
    }

    if (dto.task) {
      filter['metadata.task'] = dto.task;
    }

    if (dto.tags && dto.tags.length > 0) {
      filter['metadata.tags'] = { $all: dto.tags };
    }

    if (dto.owner) {
      filter['metadata.owner'] = dto.owner;
    }

    if (dto.stage) {
      filter.stage = dto.stage;
    }

    if (dto.framework) {
      filter['versions.framework'] = dto.framework;
    }

    if (dto.minAccuracy !== undefined) {
      filter['versions.metrics.accuracy'] = { $gte: dto.minAccuracy };
    }

    if (dto.isArchived !== undefined) {
      filter.isArchived = dto.isArchived;
    } else {
      filter.isArchived = false;
    }

    const limit = dto.limit || 20;
    const offset = dto.offset || 0;

    const [models, total] = await Promise.all([
      Model.find(filter).skip(offset).limit(limit).sort({ updatedAt: -1 }),
      Model.countDocuments(filter),
    ]);

    return { models, total, limit, offset };
  }

  /**
   * Archive a model
   */
  async archiveModel(namespace: string, name: string): Promise<IModel | null> {
    const model = await Model.findByFullName(namespace.toLowerCase(), name.toLowerCase());
    if (!model) {
      return null;
    }

    model.isArchived = true;
    model.archivedAt = new Date();

    // Archive all versions
    model.versions.forEach((v) => {
      v.status = 'archived';
    });

    await model.save();
    return model;
  }

  /**
   * Restore an archived model
   */
  async restoreModel(namespace: string, name: string): Promise<IModel | null> {
    const model = await Model.findOne({
      namespace: namespace.toLowerCase(),
      name: name.toLowerCase(),
      isArchived: true,
    });

    if (!model) {
      return null;
    }

    model.isArchived = false;
    model.archivedAt = undefined;

    // Restore versions to their previous status or pending
    model.versions.forEach((v) => {
      if (v.status === 'archived') {
        v.status = 'pending';
      }
    });

    await model.save();
    return model;
  }

  /**
   * Transition model version to a new stage
   */
  async transitionVersionStage(
    namespace: string,
    name: string,
    version: string,
    newStatus: IModelVersion['status']
  ): Promise<IModelVersion | null> {
    const { model, version: versionData } = await this.getModelVersion(namespace, name, version);
    if (!model || !versionData) {
      return null;
    }

    const versionIndex = model.versions.findIndex((v) => v.version === version);
    const currentStatus = model.versions[versionIndex].status;

    // Validate state transition
    const validTransitions: Record<string, string[]> = {
      pending: ['validated'],
      validated: ['staged', 'pending'],
      staged: ['production', 'validated'],
      production: ['staged', 'archived'],
      archived: ['production'],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'`
      );
    }

    model.versions[versionIndex].status = newStatus;
    await model.save();

    return model.versions[versionIndex];
  }

  /**
   * Compare multiple versions of a model
   */
  async compareVersions(
    namespace: string,
    name: string,
    versions: string[]
  ): Promise<VersionComparison | null> {
    const model = await Model.findByFullName(namespace.toLowerCase(), name.toLowerCase());
    if (!model) {
      return null;
    }

    const versionDataList = versions
      .map((v) => {
        const vd = model.getVersion(v);
        return vd ? { version: v, ...vd } : null;
      })
      .filter((v): v is IModelVersion & { version: string } => v !== null);

    if (versionDataList.length < 2) {
      throw new Error('At least two versions are required for comparison');
    }

    // Collect all metric keys
    const metricKeys = new Set<string>();
    versionDataList.forEach((v) => {
      Object.keys(v.metrics).forEach((key) => {
        if (key !== '_id') metricKeys.add(key);
      });
    });

    // Build comparison
    const comparison = Array.from(metricKeys).map((metric) => {
      const values: Record<string, number> = {};
      const improvement: Record<string, number | null> = {};

      versionDataList.forEach((v, index) => {
        const value = (v.metrics as Record<string, number | undefined>)[metric];
        values[v.version] = value ?? 0;

        if (index > 0) {
          const prevValue = (versionDataList[index - 1].metrics as Record<string, number | undefined>)[metric] || 0;
          const currentValue = value || 0;
          if (prevValue !== 0) {
            improvement[v.version] = ((currentValue - prevValue) / prevValue) * 100;
          } else {
            improvement[v.version] = null;
          }
        } else {
          improvement[v.version] = null;
        }
      });

      return { metric, values, improvement };
    });

    return {
      modelName: model.name,
      namespace: model.namespace,
      versions: versionDataList.map((v) => ({
        version: v.version,
        metrics: v.metrics,
        createdAt: v.createdAt,
      })),
      comparison,
    };
  }

  /**
   * Get model lineage (all versions in order)
   */
  async getModelLineage(namespace: string, name: string): Promise<IModel | null> {
    const model = await Model.findByFullName(namespace.toLowerCase(), name.toLowerCase());
    if (!model) {
      return null;
    }

    // Sort versions by creation date
    model.versions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return model;
  }

  /**
   * Get model statistics
   */
  async getModelStats(): Promise<{
    totalModels: number;
    totalVersions: number;
    modelsByStage: Record<string, number>;
    modelsByTask: Record<string, number>;
    modelsByFramework: Record<string, number>;
    avgVersionsPerModel: number;
  }> {
    const [models, stats] = await Promise.all([
      Model.find({ isArchived: false }),
      Model.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: null,
            totalModels: { $sum: 1 },
            totalVersions: { $sum: { $size: '$versions' } },
            avgVersionsPerModel: { $avg: { $size: '$versions' } },
          },
        },
      ]),
    ]);

    const modelsByStage: Record<string, number> = {};
    const modelsByTask: Record<string, number> = {};
    const modelsByFramework: Record<string, number> = {};

    models.forEach((model) => {
      modelsByStage[model.stage] = (modelsByStage[model.stage] || 0) + 1;
      modelsByTask[model.metadata.task] = (modelsByTask[model.metadata.task] || 0) + 1;

      model.versions.forEach((v) => {
        modelsByFramework[v.framework] = (modelsByFramework[v.framework] || 0) + 1;
      });
    });

    const aggregated = stats[0] || {
      totalModels: 0,
      totalVersions: 0,
      avgVersionsPerModel: 0,
    };

    return {
      totalModels: aggregated.totalModels,
      totalVersions: aggregated.totalVersions,
      modelsByStage,
      modelsByTask,
      modelsByFramework,
      avgVersionsPerModel: Math.round(aggregated.avgVersionsPerModel * 100) / 100,
    };
  }

  /**
   * Delete a model (hard delete - use with caution)
   */
  async deleteModel(namespace: string, name: string): Promise<boolean> {
    const result = await Model.deleteOne({
      namespace: namespace.toLowerCase(),
      name: name.toLowerCase(),
    });
    return result.deletedCount > 0;
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(
    namespace: string,
    name: string,
    version: string
  ): Promise<boolean> {
    const model = await Model.findByFullName(namespace.toLowerCase(), name.toLowerCase());
    if (!model) {
      return false;
    }

    const versionIndex = model.versions.findIndex((v) => v.version === version);
    if (versionIndex === -1) {
      return false;
    }

    // Cannot delete the only version
    if (model.versions.length === 1) {
      throw new Error('Cannot delete the only version of a model');
    }

    model.versions.splice(versionIndex, 1);

    // Update latest version if needed
    if (model.latestVersion === version) {
      const sortedVersions = model.versions.sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      model.latestVersion = sortedVersions[0]?.version || null;
    }

    await model.save();
    return true;
  }
}

// Export singleton instance
export const registryService = new RegistryService();
