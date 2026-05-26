import {
  ForecastResult,
  ForecastPrediction,
  ForecastMetrics,
  ForecastMethod,
  DemandDataPoint,
  SeasonalDecomposition,
  ProductMaster,
} from '../types/inventory.types.js';
import {
  mean,
  standardDeviation,
  linearRegression,
  exponentialSmoothing,
  doubleExponentialSmoothing,
  seasonalDecomposition as decomposeSeasonality,
  detectSeasonality,
  generateDateArray,
  mape,
  mae,
  rmse,
  forecastBias,
  theilsU,
  zScore,
  roundTo,
} from '../utils/math.js';
import { forecastLogger as logger } from '../utils/logger.js';
import config from '../config/index.js';
import { addDays, subDays, startOfDay } from 'date-fns';

/**
 * Demand Forecasting Service
 * Implements multiple forecasting methods including:
 * - Simple Moving Average
 * - Weighted Moving Average
 * - Exponential Smoothing (Holt-Winters)
 * - Linear Regression
 * - Seasonal Decomposition
 */

export class DemandForecastingService {
  private readonly historyDays: number;
  private readonly seasonalityWeeks: number;
  private readonly confidenceLevel: number;

  constructor() {
    this.historyDays = config.forecast.historyDays;
    this.seasonalityWeeks = config.forecast.seasonalityWeeks;
    this.confidenceLevel = config.forecast.confidenceLevel;
  }

  /**
   * Main forecast method - generates predictions using specified method
   */
  async forecastDemand(
    sku: string,
    horizon: number = 30,
    method: ForecastMethod = ForecastMethod.EXPONENTIAL_SMOOTHING
  ): Promise<ForecastResult> {
    logger.info(`Generating ${method} forecast for SKU: ${sku}`, { horizon });

    // Get historical demand data
    const demandHistory = await this.getDemandHistory(sku);

    if (demandHistory.length < 7) {
      throw new Error(`Insufficient historical data for SKU: ${sku}. Need at least 7 days.`);
    }

    // Get product info for context
    const product = await this.getProductInfo(sku);

    // Select and apply forecasting method
    let predictions: ForecastPrediction[];
    let seasonality: SeasonalDecomposition | undefined;
    let modelMetrics: ForecastMetrics;

    switch (method) {
      case ForecastMethod.SIMPLE_MOVING_AVERAGE:
        ({ predictions, modelMetrics } = this.simpleMovingAverageForecast(demandHistory, horizon));
        break;

      case ForecastMethod.WEIGHTED_MOVING_AVERAGE:
        ({ predictions, modelMetrics } = this.weightedMovingAverageForecast(demandHistory, horizon));
        break;

      case ForecastMethod.EXPONENTIAL_SMOOTHING:
        ({ predictions, modelMetrics, seasonality } = this.exponentialSmoothingForecast(
          demandHistory,
          horizon,
          this.detectBestAlpha(demandHistory)
        ));
        break;

      case ForecastMethod.LINEAR_REGRESSION:
        ({ predictions, modelMetrics } = this.linearRegressionForecast(demandHistory, horizon));
        break;

      case ForecastMethod.SEASONAL_DECOMPOSITION:
        ({ predictions, modelMetrics, seasonality } = this.seasonalForecast(demandHistory, horizon));
        break;

      default:
        throw new Error(`Unknown forecast method: ${method}`);
    }

    return {
      sku,
      method,
      predictions,
      modelMetrics,
      seasonality,
      generatedAt: new Date(),
    };
  }

  /**
   * Get historical demand data for a SKU
   */
  private async getDemandHistory(sku: string): Promise<DemandDataPoint[]> {
    // In production, this would query the database
    // For now, return mock data structure
    const { DemandData } = await import('../models/schemas.js');

    const startDate = subDays(new Date(), this.historyDays);
    const demandRecords = await DemandData.find({
      sku,
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .lean();

    return demandRecords.map((record) => ({
      date: record.date,
      quantity: record.totalQuantity,
      revenue: record.totalRevenue,
    }));
  }

  /**
   * Get product master information
   */
  private async getProductInfo(sku: string): Promise<ProductMaster | null> {
    const { ProductMaster } = await import('../models/schemas.js');
    return ProductMaster.findOne({ sku, isActive: true }).lean();
  }

  /**
   * Simple Moving Average Forecast
   */
  private simpleMovingAverageForecast(
    history: DemandDataPoint[],
    horizon: number
  ): { predictions: ForecastPrediction[]; modelMetrics: ForecastMetrics } {
    const windowSize = Math.min(7, Math.floor(history.length / 2));
    const recentValues = history.slice(-windowSize).map((d) => d.quantity);
    const average = mean(recentValues);
    const stdDev = standardDeviation(recentValues);

    const dates = generateDateArray(startOfDay(history[history.length - 1].date), horizon);
    const z = zScore(this.confidenceLevel);

    const predictions: ForecastPrediction[] = dates.map((date, i) => ({
      date,
      predictedQuantity: roundTo(average, 2),
      lowerBound: roundTo(Math.max(0, average - z * stdDev), 2),
      upperBound: roundTo(average + z * stdDev, 2),
      confidenceLevel: this.confidenceLevel,
    }));

    const modelMetrics = this.calculateMetrics(history, Array(history.length).fill(average));

    logger.info('Simple Moving Average forecast completed', { average, windowSize });

    return { predictions, modelMetrics };
  }

  /**
   * Weighted Moving Average Forecast
   * Recent periods get higher weights
   */
  private weightedMovingAverageForecast(
    history: DemandDataPoint[],
    horizon: number
  ): { predictions: ForecastPrediction[]; modelMetrics: ForecastMetrics } {
    const windowSize = Math.min(7, Math.floor(history.length / 2));
    const recentHistory = history.slice(-windowSize);

    // Generate weights: more recent = higher weight
    const weights = recentHistory.map((_, i) => i + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map((w) => w / totalWeight);

    const values = recentHistory.map((d) => d.quantity);
    const weightedAverage = values.reduce((acc, v, i) => acc + v * normalizedWeights[i], 0);
    const stdDev = standardDeviation(values);

    const dates = generateDateArray(startOfDay(history[history.length - 1].date), horizon);
    const z = zScore(this.confidenceLevel);

    const predictions: ForecastPrediction[] = dates.map((date) => ({
      date,
      predictedQuantity: roundTo(weightedAverage, 2),
      lowerBound: roundTo(Math.max(0, weightedAverage - z * stdDev), 2),
      upperBound: roundTo(weightedAverage + z * stdDev, 2),
      confidenceLevel: this.confidenceLevel,
    }));

    const fittedValues = history.map(() => weightedAverage);
    const modelMetrics = this.calculateMetrics(history, fittedValues);

    logger.info('Weighted Moving Average forecast completed', { weightedAverage, windowSize });

    return { predictions, modelMetrics };
  }

  /**
   * Exponential Smoothing Forecast (Holt's method for trend)
   */
  private exponentialSmoothingForecast(
    history: DemandDataPoint[],
    horizon: number,
    alpha: number = 0.3,
    beta: number = 0.1
  ): {
    predictions: ForecastPrediction[];
    modelMetrics: ForecastMetrics;
    seasonality?: SeasonalDecomposition;
  } {
    const values = history.map((d) => d.quantity);
    const { forecast, level, trend } = doubleExponentialSmoothing(values, alpha, beta);

    // Calculate residual standard deviation for prediction intervals
    const residuals = values.map((v, i) => v - forecast[i]);
    const residualStdDev = standardDeviation(residuals);

    const lastDate = startOfDay(history[history.length - 1].date);
    const dates = generateDateArray(lastDate, horizon);
    const z = zScore(this.confidenceLevel);

    const predictions: ForecastPrediction[] = dates.map((date, i) => {
      const horizonFactor = i + 1;
      const predictedQuantity = level + trend * horizonFactor;

      // Widen prediction intervals for longer horizons
      const horizonMultiplier = Math.sqrt(horizonFactor);

      return {
        date,
        predictedQuantity: roundTo(Math.max(0, predictedQuantity), 2),
        lowerBound: roundTo(Math.max(0, predictedQuantity - z * residualStdDev * horizonMultiplier), 2),
        upperBound: roundTo(predictedQuantity + z * residualStdDev * horizonMultiplier, 2),
        confidenceLevel: this.confidenceLevel,
      };
    });

    const modelMetrics = this.calculateMetrics(history, forecast);

    logger.info('Exponential Smoothing forecast completed', { alpha, beta, level, trend });

    return { predictions, modelMetrics };
  }

  /**
   * Linear Regression Forecast
   */
  private linearRegressionForecast(
    history: DemandDataPoint[],
    horizon: number
  ): { predictions: ForecastPrediction[]; modelMetrics: ForecastMetrics } {
    const values = history.map((d) => d.quantity);
    const { slope, intercept, rSquared } = linearRegression(values);

    // Calculate standard error of regression
    const predicted = values.map((_, i) => slope * i + intercept);
    const residuals = values.map((v, i) => v - predicted[i]);
    const residualStdDev = standardDeviation(residuals);

    const lastDate = startOfDay(history[history.length - 1].date);
    const dates = generateDateArray(lastDate, horizon);
    const z = zScore(this.confidenceLevel);

    const predictions: ForecastPrediction[] = dates.map((date, i) => {
      const t = values.length + i;
      const predictedQuantity = slope * t + intercept;

      // Widen intervals for longer horizons
      const horizonMultiplier = Math.sqrt(i + 1);

      return {
        date,
        predictedQuantity: roundTo(Math.max(0, predictedQuantity), 2),
        lowerBound: roundTo(Math.max(0, predictedQuantity - z * residualStdDev * horizonMultiplier), 2),
        upperBound: roundTo(predictedQuantity + z * residualStdDev * horizonMultiplier, 2),
        confidenceLevel: this.confidenceLevel,
      };
    });

    const modelMetrics = this.calculateMetrics(history, predicted);

    logger.info('Linear Regression forecast completed', { slope, intercept, rSquared });

    return { predictions, modelMetrics };
  }

  /**
   * Seasonal Decomposition Forecast
   */
  private seasonalForecast(
    history: DemandDataPoint[],
    horizon: number
  ): {
    predictions: ForecastPrediction[];
    modelMetrics: ForecastMetrics;
    seasonality: SeasonalDecomposition;
  } {
    const values = history.map((d) => d.quantity);

    // Detect or use default seasonality period
    const seasonalityDetection = detectSeasonality(values, this.seasonalityWeeks * 7);
    const period = seasonalityDetection?.period || 7;

    const decomposition = decomposeSeasonality(values, period);

    // Forecast trend using exponential smoothing on detrended data
    const detrended = decomposition.trend;
    const { forecast: trendForecast, level, trend } = doubleExponentialSmoothing(
      detrended,
      0.3,
      0.1
    );

    // Get seasonal indices for future periods
    const seasonalIndices = decomposition.seasonal.slice(-period);

    // Calculate residual standard deviation
    const residuals = values.map((v, i) => {
      const seasonalFactor = decomposition.seasonal[i] || 1;
      return v / (decomposition.trend[i] * seasonalFactor);
    });
    const residualStdDev = standardDeviation(residuals);

    const lastDate = startOfDay(history[history.length - 1].date);
    const dates = generateDateArray(lastDate, horizon);
    const z = zScore(this.confidenceLevel);

    const predictions: ForecastPrediction[] = dates.map((date, i) => {
      const t = values.length + i;
      const trendValue = level + trend * t;
      const seasonalIndex = seasonalIndices[i % period];
      const predictedQuantity = trendValue * seasonalIndex;

      const horizonMultiplier = Math.sqrt(i + 1);

      return {
        date,
        predictedQuantity: roundTo(Math.max(0, predictedQuantity), 2),
        lowerBound: roundTo(Math.max(0, predictedQuantity - z * residualStdDev * trendValue * horizonMultiplier), 2),
        upperBound: roundTo(predictedQuantity + z * residualStdDev * trendValue * horizonMultiplier, 2),
        confidenceLevel: this.confidenceLevel,
      };
    });

    // Calculate fitted values for metrics
    const fittedValues = values.map((v, i) => {
      const seasonalFactor = decomposition.seasonal[i] || 1;
      return decomposition.trend[i] * seasonalFactor;
    });

    const modelMetrics = this.calculateMetrics(history, fittedValues);

    logger.info('Seasonal Decomposition forecast completed', { period, rSquared: modelMetrics.rSquared });

    return {
      predictions,
      modelMetrics,
      seasonality: {
        trend: decomposition.trend,
        seasonal: decomposition.seasonal,
        residual: decomposition.residual,
        seasonalIndices: seasonalIndices,
        period,
      },
    };
  }

  /**
   * Calculate forecast accuracy metrics
   */
  private calculateMetrics(history: DemandDataPoint[], fitted: number[]): ForecastMetrics {
    const actual = history.map((d) => d.quantity);

    return {
      mae: roundTo(mae(actual, fitted), 4),
      mape: roundTo(mape(actual, fitted), 2),
      rmse: roundTo(rmse(actual, fitted), 4),
      rSquared: roundTo(this.calculateRSquared(actual, fitted), 4),
      bias: roundTo(forecastBias(actual, fitted), 4),
      theilU: roundTo(theilsU(actual, fitted), 4),
    };
  }

  /**
   * Calculate R-squared
   */
  private calculateRSquared(actual: number[], predicted: number[]): number {
    if (actual.length === 0) return 0;

    const actualMean = mean(actual);
    const ssTotal = actual.reduce((acc, a) => acc + Math.pow(a - actualMean, 2), 0);
    const ssResidual = actual.reduce((acc, a, i) => acc + Math.pow(a - predicted[i], 2), 0);

    if (ssTotal === 0) return 1;
    return 1 - ssResidual / ssTotal;
  }

  /**
   * Detect best alpha for exponential smoothing using grid search
   */
  private detectBestAlpha(history: DemandDataPoint[]): number {
    const values = history.map((d) => d.quantity);
    const trainSize = Math.floor(values.length * 0.8);
    const trainData = values.slice(0, trainSize);
    const testData = values.slice(trainSize);

    let bestAlpha = 0.3;
    let bestMape = Infinity;

    for (const alpha of [0.1, 0.2, 0.3, 0.4, 0.5]) {
      const { forecast } = exponentialSmoothing(trainData, alpha);
      const lastLevel = forecast[forecast.length - 1];

      const predictions = testData.map(() => lastLevel);
      const currentMape = mape(testData, predictions);

      if (currentMape < bestMape) {
        bestMape = currentMape;
        bestAlpha = alpha;
      }
    }

    return bestAlpha;
  }

  /**
   * Compare multiple forecasting methods and return the best one
   */
  async compareMethods(sku: string, horizon: number = 30): Promise<{
    bestMethod: ForecastMethod;
    allResults: Array<{ method: ForecastMethod; metrics: ForecastMetrics }>;
  }> {
    const methods = Object.values(ForecastMethod);
    const allResults: Array<{ method: ForecastMethod; metrics: ForecastMetrics }> = [];

    for (const method of methods) {
      try {
        const result = await this.forecastDemand(sku, horizon, method);
        allResults.push({
          method,
          metrics: result.modelMetrics,
        });
      } catch (error) {
        logger.warn(`Failed to generate forecast for method ${method}`, { error });
      }
    }

    // Select best method based on MAPE (lower is better)
    const sortedResults = [...allResults].sort((a, b) => a.metrics.mape - b.metrics.mape);
    const bestMethod = sortedResults[0]?.method || ForecastMethod.EXPONENTIAL_SMOOTHING;

    return { bestMethod, allResults };
  }

  /**
   * Generate ensemble forecast (weighted average of multiple methods)
   */
  async ensembleForecast(sku: string, horizon: number = 30): Promise<ForecastResult> {
    const { bestMethod, allResults } = await this.compareMethods(sku, horizon);

    // Weight by inverse MAPE
    const totalWeight = allResults.reduce(
      (acc, r) => acc + (r.metrics.mape > 0 ? 1 / r.metrics.mape : 1),
      0
    );

    const methodWeights: Record<string, number> = {};
    for (const result of allResults) {
      methodWeights[result.method] = result.metrics.mape > 0 ? 1 / result.metrics.mape : 1;
    }

    // Generate forecasts with each method
    const forecasts = await Promise.all(
      allResults.map(async (r) => {
        const forecast = await this.forecastDemand(sku, horizon, r.method);
        return {
          method: r.method,
          weight: methodWeights[r.method] / totalWeight,
          predictions: forecast.predictions,
        };
      })
    );

    // Combine predictions
    const combinedPredictions: ForecastPrediction[] = [];
    const z = zScore(this.confidenceLevel);

    for (let i = 0; i < horizon; i++) {
      let weightedPrediction = 0;
      let maxUncertainty = 0;

      for (const f of forecasts) {
        weightedPrediction += f.predictions[i].predictedQuantity * f.weight;
        const uncertainty = (f.predictions[i].upperBound - f.predictions[i].lowerBound) / 2;
        maxUncertainty = Math.max(maxUncertainty, uncertainty);
      }

      combinedPredictions.push({
        date: forecasts[0].predictions[i].date,
        predictedQuantity: roundTo(weightedPrediction, 2),
        lowerBound: roundTo(Math.max(0, weightedPrediction - z * maxUncertainty), 2),
        upperBound: roundTo(weightedPrediction + z * maxUncertainty, 2),
        confidenceLevel: this.confidenceLevel,
      });
    }

    logger.info('Ensemble forecast completed', {
      methodsUsed: allResults.length,
      bestMethod,
    });

    return {
      sku,
      method: bestMethod, // Label as the primary method
      predictions: combinedPredictions,
      modelMetrics: {
        mae: 0,
        mape: 0,
        rmse: 0,
        rSquared: 0,
        bias: 0,
        theilU: 0,
      },
      generatedAt: new Date(),
    };
  }
}

// Export singleton instance
export const demandForecastingService = new DemandForecastingService();
export default demandForecastingService;
