/**
 * REZ ML Models Client
 *
 * Production ML predictions for Churn, LTV, and other use cases.
 *
 * Usage:
 *   import { ChurnPredictor, LTVPredictor } from '@rez/ml-models';
 *
 *   const predictor = new ChurnPredictor();
 *   const result = await predictor.predict(userData);
 */

// Re-export Python models (used via ML Production service)
export { ChurnPredictor, predict_churn } from './churn';
export { LTVPredictor, predict_ltv } from './ltv';
