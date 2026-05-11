import { EventEmitter } from 'events';
import {
  FraudDetectionModel,
  PriceOptimizationModel,
  RecommendationEngine,
  Order,
  FraudPrediction,
  PriceOptimization,
  Recommendation,
  RecommendationContext,
} from './index';

/**
 * ML Service Configuration
 */
export interface MLConfig {
  fraudDetection: {
    enabled: boolean;
    autoBlock: boolean;
    blockThreshold: number;
  };
  priceOptimization: {
    enabled: boolean;
    updateIntervalMs: number;
  };
  recommendations: {
    enabled: boolean;
    maxRecommendations: number;
  };
}

/**
 * Result from ML pipeline processing
 */
export interface MLPipelineResult {
  orderId?: string;
  itemId?: string;
  userId?: string;
  fraudPrediction?: FraudPrediction;
  priceOptimization?: PriceOptimization;
  recommendations?: Recommendation;
  errors: string[];
  processedAt: Date;
}

/**
 * Default ML configuration
 */
const DEFAULT_CONFIG: MLConfig = {
  fraudDetection: {
    enabled: true,
    autoBlock: false,
    blockThreshold: 70,
  },
  priceOptimization: {
    enabled: true,
    updateIntervalMs: 3600000, // 1 hour
  },
  recommendations: {
    enabled: true,
    maxRecommendations: 10,
  },
};

/**
 * MLService - Unified ML pipeline orchestrator
 *
 * Coordinates all ML models to provide comprehensive ML capabilities:
 * - Fraud detection for orders
 * - Price optimization for items
 * - Personalized recommendations for users
 */
export class MLService extends EventEmitter {
  private config: MLConfig;
  private fraudModel: FraudDetectionModel;
  private priceModel: PriceOptimizationModel;
  private recommendationEngine: RecommendationEngine;

  constructor(config: Partial<MLConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize models
    this.fraudModel = new FraudDetectionModel({
      blockThreshold: this.config.fraudDetection.blockThreshold,
    });

    this.priceModel = new PriceOptimizationModel();
    this.recommendationEngine = new RecommendationEngine({
      maxRecommendations: this.config.recommendations.maxRecommendations,
    });

    // Set up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Set up event forwarding from individual models
   */
  private setupEventForwarding(): void {
    this.fraudModel.on('fraudDetected', (prediction: FraudPrediction) => {
      this.emit('fraudDetected', prediction);

      // Auto-block if configured
      if (
        this.config.fraudDetection.autoBlock &&
        prediction.recommendation === 'block'
      ) {
        this.emit('autoBlock', prediction);
      }
    });

    this.priceModel.on('optimizationComplete', (optimization: PriceOptimization) => {
      this.emit('priceOptimized', optimization);
    });

    this.recommendationEngine.on('recommendationGenerated', (recommendation: Recommendation) => {
      this.emit('recommendationGenerated', recommendation);
    });
  }

  /**
   * Process an order through the ML pipeline
   */
  async processOrder(order: Order): Promise<MLPipelineResult> {
    const result: MLPipelineResult = {
      orderId: order.id,
      errors: [],
      processedAt: new Date(),
    };

    // Fraud detection
    if (this.config.fraudDetection.enabled) {
      try {
        const fraudPrediction = this.fraudModel.calculateRiskScore(order);
        result.fraudPrediction = fraudPrediction;
      } catch (error) {
        result.errors.push(
          `Fraud detection error: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    }

    return result;
  }

  /**
   * Optimize price for an item
   */
  async optimizePrice(itemId: string, date: Date = new Date()): Promise<MLPipelineResult> {
    const result: MLPipelineResult = {
      itemId,
      errors: [],
      processedAt: new Date(),
    };

    if (this.config.priceOptimization.enabled) {
      try {
        const optimizationResult = this.priceModel.optimize(itemId, date);
        if (optimizationResult.success && optimizationResult.optimization) {
          result.priceOptimization = optimizationResult.optimization;
        } else {
          result.errors.push(optimizationResult.error || 'Price optimization failed');
        }
      } catch (error) {
        result.errors.push(
          `Price optimization error: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    }

    return result;
  }

  /**
   * Get recommendations for a user
   */
  async getRecommendations(
    userId: string,
    context: RecommendationContext = {}
  ): Promise<MLPipelineResult> {
    const result: MLPipelineResult = {
      userId,
      errors: [],
      processedAt: new Date(),
    };

    if (this.config.recommendations.enabled) {
      try {
        const recommendationResult = this.recommendationEngine.recommend(userId, context);
        if (recommendationResult.success && recommendationResult.recommendation) {
          result.recommendations = recommendationResult.recommendation;
        } else {
          result.errors.push(recommendationResult.error || 'Recommendation generation failed');
        }
      } catch (error) {
        result.errors.push(
          `Recommendation error: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    }

    return result;
  }

  /**
   * Get fraud detection statistics
   */
  getFraudStats() {
    return this.fraudModel.getStats();
  }

  /**
   * Get current configuration
   */
  getConfig(): MLConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MLConfig>): void {
    this.config = { ...this.config, ...config };

    // Update individual model configs
    if (config.fraudDetection?.blockThreshold !== undefined) {
      this.fraudModel.updateConfig({
        blockThreshold: config.fraudDetection.blockThreshold,
      });
    }

    if (config.recommendations?.maxRecommendations !== undefined) {
      this.recommendationEngine.updateConfig({
        maxRecommendations: config.recommendations.maxRecommendations,
      });
    }
  }

  /**
   * Get individual model instances for direct access
   */
  getModels() {
    return {
      fraudModel: this.fraudModel,
      priceModel: this.priceModel,
      recommendationEngine: this.recommendationEngine,
    };
  }
}

// Factory function
export function createMLService(config?: Partial<MLConfig>): MLService {
  return new MLService(config);
}
