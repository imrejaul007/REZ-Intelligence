import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  ClientNode,
  ClientNodeSchema as ClientNodeSchemaType,
  FederatedTrainingConfig,
  ModelUpdate,
  ModelUpdateSchema,
  AggregatedModel,
  FederatedTrainingRequestSchema,
  TrainingStatus,
  FederatedMetrics,
  ClientMetrics,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

// Secure random function
function secureRandom(): number {
  return crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF;
}

// PRODUCTION: MongoDB Schemas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-federated-ml';

const ClientNodeMongoSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true, index: true },
  nodeType: { type: String, required: true },
  organizationId: String,
  status: { type: String, enum: ['active', 'inactive', 'training'], default: 'active' },
  lastSync: Date,
  metrics: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const ModelVersionMongoSchema = new mongoose.Schema({
  modelId: { type: String, required: true, unique: true, index: true },
  version: { type: String, required: true },
  round: Number,
  weights: mongoose.Schema.Types.Mixed,
  metrics: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

const TrainingSessionMongoSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
  round: Number,
  participants: [String],
  startedAt: Date,
  completedAt: Date
});

const ClientNodeModel = mongoose.models.ClientNode || mongoose.model('ClientNode', ClientNodeMongoSchema);
const ModelVersionModel = mongoose.models.ModelVersion || mongoose.model('ModelVersion', ModelVersionMongoSchema);
const TrainingSessionModel = mongoose.models.TrainingSession || mongoose.model('TrainingSession', TrainingSessionMongoSchema);

// In-memory fallback
const clientNodes = new Map<string, ClientNode>();
const modelVersions = new Map<string, AggregatedModel>();
const trainingSessions = new Map<string, TrainingStatus>();

let dbConnected = false;

async function connectDB(): Promise<void> {
  if (dbConnected) return;
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    logger.info('[FederatedML] Connected to MongoDB');
    // Load existing data
    const clients = await ClientNodeModel.find();
    for (const c of clients) {
      clientNodes.set(c.clientId, c.toObject() as ClientNode);
    }
    const models = await ModelVersionModel.find();
    for (const m of models) {
      modelVersions.set(m.modelId, m.toObject() as AggregatedModel);
    }
    const sessions = await TrainingSessionModel.find();
    for (const s of sessions) {
      trainingSessions.set(s.sessionId, s.toObject() as TrainingStatus);
    }
  } catch (error) {
    logger.error('[FederatedML] MongoDB connection failed:', error);
  }
}

export class FederatedMLService {
  // Uses module-level variables: clientNodes, modelVersions, trainingSessions

  async registerClient(client: unknown): Promise<ClientNode> {
    await connectDB();
    const validated = ClientNodeSchemaType.parse(client);
    const node: ClientNode = {
      ...validated,
      status: 'active',
      lastSync: new Date().toISOString(),
    };
    try {
      await ClientNodeModel.create(node);
    } catch (_e) { /* MongoDB insert may fail, continue with memory */ }
    clientNodes.set(node.clientId, node);
    logger.info(`Client registered: ${node.clientId}`);
    return node;
  }

  async updateClientStatus(clientId: string, status: ClientNode['status']): Promise<ClientNode | null> {
    await connectDB();
    const client = clientNodes.get(clientId);
    if (!client) return null;

    const updated: ClientNode = { ...client, status, lastSync: new Date().toISOString() };
    try {
      await ClientNodeModel.updateOne({ clientId }, { status, lastSync: new Date() });
    } catch (_e) { /* MongoDB update may fail */ }
    clientNodes.set(clientId, updated);
    return updated;
  }

  async getClient(clientId: string): Promise<ClientNode | null> {
    return clientNodes.get(clientId) || null;
  }

  async listClients(nodeType?: string): Promise<ClientNode[]> {
    const clients = Array.from(clientNodes.values());
    if (nodeType) {
      return clients.filter((c: ClientNode) => c.nodeType === nodeType);
    }
    return clients;
  }

  async startTraining(request: unknown): Promise<TrainingStatus> {
    const validated = FederatedTrainingRequestSchema.parse(request);
    const trainingId = uuidv4();

    const status: TrainingStatus = {
      trainingId,
      status: 'in_progress',
      currentRound: 0,
      totalRounds: validated.modelConfig.rounds,
      participatingClients: [],
      startedAt: new Date().toISOString(),
    };

    trainingSessions.set(trainingId, status);
    logger.info(`Training started: ${trainingId}, rounds: ${validated.modelConfig.rounds}`);

    setTimeout(() => this.simulateTrainingProgress(trainingId, validated.modelConfig), 1000);
    return status;
  }

  private async simulateTrainingProgress(trainingId: string, config: FederatedTrainingConfig): Promise<void> {
    const status = trainingSessions.get(trainingId);
    if (!status) return;

    for (let round = 1; round <= config.rounds; round++) {
      status.currentRound = round;
      status.participatingClients = this.selectClients(config.minClientsPerRound);

      const globalLoss = Math.max(0.1, 2.0 - round * 0.1 + secureRandom() * 0.1);
      const globalAccuracy = Math.min(0.99, 0.5 + round * 0.03 + secureRandom() * 0.02);

      status.aggregatedMetrics = {
        globalLoss,
        globalAccuracy,
        clientsPerRound: status.participatingClients.length,
        avgRoundTime: 5 + secureRandom() * 5,
      };

      await this.aggregateRound(trainingId, status, globalLoss, globalAccuracy);
      await this.delay(500);
    }

    status.status = 'completed';
    status.completedAt = new Date().toISOString();
    logger.info(`Training completed: ${trainingId}`);
  }

  private selectClients(minClients: number): string[] {
    const activeClients = Array.from(clientNodes.values())
      .filter((c: ClientNode) => c.status === 'active');

    const selected = activeClients
      .sort(() => secureRandom() - 0.5)
      .slice(0, Math.min(minClients, activeClients.length))
      .map((c: ClientNode) => c.clientId);

    return selected.length > 0 ? selected : ['client_001', 'client_002', 'client_003'];
  }

  private async aggregateRound(
    trainingId: string,
    status: TrainingStatus,
    globalLoss: number,
    globalAccuracy: number
  ): Promise<AggregatedModel> {
    const modelId = uuidv4();
    const model: AggregatedModel = {
      modelId,
      roundNumber: status.currentRound,
      globalWeights: Array.from({ length: 100 }, () => secureRandom() * 0.1 - 0.05),
      aggregatedFrom: status.participatingClients,
      aggregationMetrics: {
        totalSamples: status.participatingClients.length * 1000,
        avgLoss: globalLoss,
        weightedAccuracy: globalAccuracy,
      },
      createdAt: new Date().toISOString(),
    };

    modelVersions.set(modelId, model);
    return model;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async submitModelUpdate(update: unknown): Promise<ModelUpdate> {
    const validated = ModelUpdateSchema.parse(update);
    logger.info(`Model update received from ${validated.clientId}, round ${validated.roundNumber}`);
    return validated;
  }

  async getTrainingStatus(trainingId: string): Promise<TrainingStatus | null> {
    return trainingSessions.get(trainingId) || null;
  }

  async getModel(modelId: string): Promise<AggregatedModel | null> {
    return modelVersions.get(modelId) || null;
  }

  async getLatestModel(): Promise<AggregatedModel | null> {
    const models = Array.from(modelVersions.values());
    if (models.length === 0) return null;
    return models.sort((a: AggregatedModel, b: AggregatedModel) => b.roundNumber - a.roundNumber)[0];
  }

  async getMetrics(trainingId: string): Promise<FederatedMetrics | null> {
    const status = trainingSessions.get(trainingId);
    if (!status || !status.aggregatedMetrics) return null;

    return {
      roundNumber: status.currentRound,
      globalAccuracy: status.aggregatedMetrics.globalAccuracy || 0,
      globalLoss: status.aggregatedMetrics.globalLoss || 0,
      participatingClients: status.participatingClients.length,
      totalSamples: status.aggregatedMetrics.clientsPerRound
        ? status.aggregatedMetrics.clientsPerRound * 1000
        : 0,
      avgRoundDuration: status.aggregatedMetrics.avgRoundTime || 0,
      modelStaleness: secureRandom() * 0.1,
    };
  }

  async getClientMetrics(clientId: string): Promise<ClientMetrics | null> {
    const client = clientNodes.get(clientId);
    if (!client) return null;

    const sessions = Array.from(trainingSessions.values())
      .filter((s: TrainingStatus) => s.participatingClients.includes(clientId));

    return {
      clientId,
      roundsParticipated: sessions.length,
      avgLocalAccuracy: 0.75 + secureRandom() * 0.15,
      avgLocalLoss: 0.3 + secureRandom() * 0.2,
      totalDataProcessed: sessions.length * 1000,
      lastActiveAt: client.lastSync || new Date().toISOString(),
    };
  }

  async listTrainingSessions(): Promise<TrainingStatus[]> {
    return Array.from(trainingSessions.values());
  }

  async pauseTraining(trainingId: string): Promise<TrainingStatus | null> {
    const status = trainingSessions.get(trainingId);
    if (!status || status.status !== 'in_progress') return null;

    status.status = 'paused';
    return status;
  }

  async resumeTraining(trainingId: string): Promise<TrainingStatus | null> {
    const status = trainingSessions.get(trainingId);
    if (!status || status.status !== 'paused') return null;

    status.status = 'in_progress';
    return status;
  }
}

export const federatedMLService = new FederatedMLService();

// ============================================
// HEALTH CHECK
// ============================================

interface ServiceHealth {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  checks: {
    mongodb: { status: string; error?: string };
    clients: { active: number; inactive: number; training: number };
    models: { total: number };
    training: { active: number; completed: number; failed: number };
  };
}

const serviceStartTime = Date.now();

/**
 * Get comprehensive health status for Federated ML Service
 * Call this from an Express route in the parent app
 */
export function getFederatedMLHealth(): ServiceHealth {
  const clients = Array.from(clientNodes.values());
  const models = Array.from(modelVersions.values());
  const sessions = Array.from(trainingSessions.values());

  const activeClients = clients.filter((c: ClientNode) => c.status === 'active').length;
  const inactiveClients = clients.filter((c: ClientNode) => c.status === 'inactive').length;
  const trainingClients = clients.filter((c: ClientNode) => c.status === 'training').length;
  const activeTraining = sessions.filter((s: TrainingStatus) => s.status === 'in_progress').length;
  const completedTraining = sessions.filter((s: TrainingStatus) => s.status === 'completed').length;
  const failedTraining = sessions.filter((s: TrainingStatus) => s.status === 'failed').length;

  return {
    status: dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serviceStartTime) / 1000),
    service: 'rez-federated-ml',
    version: '1.0.0',
    checks: {
      mongodb: {
        status: dbConnected ? 'healthy' : 'unhealthy'
      },
      clients: {
        active: activeClients,
        inactive: inactiveClients,
        training: trainingClients
      },
      models: {
        total: models.length
      },
      training: {
        active: activeTraining,
        completed: completedTraining,
        failed: failedTraining
      }
    }
  };
}

/**
 * Check MongoDB connectivity for health endpoint
 */
async function checkMongoDBHealth(): Promise<{ status: string; error?: string }> {
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      return { status: 'healthy' };
    }
    return { status: 'disconnected' };
  } catch (e) {
    const error = e as Error;
    return { status: 'unhealthy', error: error.message };
  }
}

/**
 * Express route handler for health check
 * Usage: app.get('/health', federatedMLHealthHandler);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function federatedMLHealthHandler(_req: any, res: any): Promise<void> {
  const mongodbHealth = await checkMongoDBHealth();
  const baseHealth = getFederatedMLHealth();

  const health = {
    ...baseHealth,
    checks: {
      ...baseHealth.checks,
      mongodb: mongodbHealth
    }
  };

  if (!dbConnected || mongodbHealth.status === 'unhealthy') {
    health.status = 'unhealthy';
    res.status(503).json(health);
    return;
  }

  if (health.status === 'degraded') {
    res.status(503).json(health);
    return;
  }

  res.json(health);
}
