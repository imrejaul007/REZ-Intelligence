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
} from './fraudModel';
export type {
  FraudSignal,
  FraudPrediction,
  Order,
  OrderItem,
  FraudDetectionConfig,
  FraudStats,
} from './fraudModel';

// Price Optimization
export {
  PriceOptimizationModel,
  createPriceOptimizationModel,
} from './priceOptimization';
export type {
  PriceOptimization,
  PriceFactors,
  OptimizationConfig,
  PriceHistory,
  OptimizationResult,
} from './priceOptimization';

// Recommendation Engine
export {
  RecommendationEngine,
} from './recommendationEngine';
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
} from './recommendationEngine';

// ML Pipeline orchestration
export { MLService } from './mlService';
export type { MLConfig, MLPipelineResult } from './mlService';
