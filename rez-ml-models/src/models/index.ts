/**
 * ML Models Index - Unified exports for all ML services
 *
 * This module provides a unified interface to all ML models:
 * - FraudDetectionModel: Hybrid rule-based + ML fraud detection
 * - PriceOptimizationModel: Dynamic pricing optimization
 * - RecommendationEngine: Hybrid collaborative + content-based recommendations
 */

// Fraud Detection
export {
  FraudDetectionModel,
  createFraudDetectionModel,
} from '../../rez-fraud-detection/src/models/fraudModel';
export type {
  FraudSignal,
  FraudPrediction,
  Order,
  OrderItem,
  FraudDetectionConfig,
  FraudStats,
} from '../../rez-fraud-detection/src/models/fraudModel';

// Price Optimization
export {
  PriceOptimizationModel,
  createPriceOptimizationModel,
} from '../../rez-price-optimization/src/models/priceOptimization';
export type {
  PriceOptimization,
  PriceFactors,
  OptimizationConfig,
  PriceHistory,
  OptimizationResult,
} from '../../rez-price-optimization/src/models/priceOptimization';

// Recommendation Engine
export {
  RecommendationEngine,
  createRecommendationEngine,
} from '../../rez-recommendation-engine/src/models/recommendationEngine';
export type {
  Recommendation,
  RecommendedItem,
  RecommendationContext,
  UserProfile,
  UserPreferences,
  UserHistoryItem,
  PopularItem,
  RecommendationConfig,
  RecommendationResult,
} from '../../rez-recommendation-engine/src/models/recommendationEngine';

// ML Pipeline orchestration
export { MLService } from './mlService';
export type { MLConfig, MLPipelineResult } from './mlService';
