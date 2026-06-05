/**
 * REZ ML Service - Machine Learning Infrastructure
 *
 * Provides ML model infrastructure including CLV prediction, feature engineering,
 * model training, and inference capabilities.
 */

export * from './clvPrediction';

// Re-export integrations
export { MLIntegrations } from './integrations';

// Types
export interface MLConfig {
  modelDir: string;
  cacheDir: string;
  maxConcurrentModels: number;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
}

export interface PredictionResult {
  modelId: string;
  prediction: number;
  confidence: number;
  features: Record<string, number>;
  timestamp: string;
}

export interface TrainingJob {
  id: string;
  modelType: string;
  status: 'pending' | 'training' | 'completed' | 'failed';
  progress: number;
  metrics?: ModelMetrics;
  createdAt: string;
  completedAt?: string;
}

// Default configuration
export const DEFAULT_CONFIG: MLConfig = {
  modelDir: process.env.ML_MODEL_DIR || './models',
  cacheDir: process.env.ML_CACHE_DIR || './cache',
  maxConcurrentModels: parseInt(process.env.ML_MAX_CONCURRENT || '5', 10),
};

// Health check
export async function healthCheck(): Promise<{ status: string; models: number }> {
  return {
    status: 'healthy',
    models: 0, // Would track loaded models in production
  };
}