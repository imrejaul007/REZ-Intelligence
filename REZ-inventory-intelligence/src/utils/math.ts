/**
 * Statistical and mathematical utility functions for inventory intelligence
 */

/**
 * Calculate the arithmetic mean of an array
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a: number, b: number) => a + b, 0);
  return sum / values.length;
}

/**
 * Calculate the median of an array
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[], sample: boolean = true): number {
  if (values.length < 2) return 0;

  const avg = mean(values);
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));

  const divisor = sample ? values.length - 1 : values.length;
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / divisor;

  return Math.sqrt(variance);
}

/**
 * Calculate coefficient of variation (CV)
 */
export function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return (standardDeviation(values) / avg) * 100;
}

/**
 * Calculate z-score for a given confidence level
 */
export function zScore(confidenceLevel: number): number {
  // Z-scores for common confidence levels
  const zScores: Record<number, number> = {
    0.80: 1.282,
    0.85: 1.440,
    0.90: 1.645,
    0.95: 1.960,
    0.97: 2.170,
    0.99: 2.576,
    0.995: 2.807,
    0.999: 3.291,
  };

  // Find closest match or interpolate
  const closest = Object.keys(zScores)
    .map(Number)
    .reduce((prev, curr) =>
      Math.abs(curr - confidenceLevel) < Math.abs(prev - confidenceLevel) ? curr : prev
    );

  return zScores[closest] || 1.96; // Default to 95%
}

/**
 * Calculate safety stock using the standard formula
 * SS = Z * sqrt(σ_d² * LT + d_avg² * σ_LT²)
 */
export function calculateSafetyStock(
  averageDemand: number,
  demandStdDev: number,
  leadTimeDays: number,
  leadTimeStdDev: number,
  serviceLevel: number
): number {
  const z = zScore(serviceLevel);

  // If no variability in lead time, use simplified formula
  if (leadTimeStdDev === 0) {
    return z * demandStdDev * Math.sqrt(leadTimeDays);
  }

  // If no variability in demand, use simplified formula
  if (demandStdDev === 0) {
    return z * averageDemand * leadTimeStdDev;
  }

  // Full formula: sqrt(σ_d² * LT + d_avg² * σ_LT²)
  const term1 = Math.pow(demandStdDev, 2) * leadTimeDays;
  const term2 = Math.pow(averageDemand, 2) * Math.pow(leadTimeStdDev, 2);
  const std = Math.sqrt(term1 + term2);

  return Math.max(0, z * std);
}

/**
 * Calculate reorder point
 * ROP = d_avg * LT + SS
 */
export function calculateReorderPoint(
  averageDemand: number,
  leadTimeDays: number,
  safetyStock: number
): number {
  return Math.ceil(averageDemand * leadTimeDays + safetyStock);
}

/**
 * Calculate Economic Order Quantity (EOQ)
 * EOQ = sqrt(2 * D * S / H)
 */
export function calculateEOQ(
  annualDemand: number,
  orderCost: number,
  holdingCostPerUnit: number
): number {
  if (annualDemand === 0 || orderCost === 0 || holdingCostPerUnit === 0) return 0;

  const eoq = Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit);
  return Math.ceil(eoq);
}

/**
 * Calculate inventory turnover ratio
 */
export function calculateInventoryTurnover(
  costOfGoodsSold: number,
  averageInventory: number
): number {
  if (averageInventory === 0) return 0;
  return costOfGoodsSold / averageInventory;
}

/**
 * Calculate days of inventory on hand
 */
export function daysOfInventory(
  currentStock: number,
  averageDailyDemand: number
): number {
  if (averageDailyDemand === 0) return Infinity;
  return currentStock / averageDailyDemand;
}

/**
 * Linear regression for trend analysis
 */
export function linearRegression(values: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  if (values.length < 2) {
    return { slope: 0, intercept: values[0] || 0, rSquared: 0 };
  }

  const n = values.length;
  const x = values.map((_, i) => i);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: mean(values), rSquared: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = values.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
  const ssResidual = values.reduce((acc, yi, i) => {
    const predicted = slope * i + intercept;
    return acc + Math.pow(yi - predicted, 2);
  }, 0);

  const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

  return { slope, intercept, rSquared };
}

/**
 * Exponential smoothing (simple)
 */
export function exponentialSmoothing(
  values: number[],
  alpha: number = 0.3
): { forecast: number[]; level: number } {
  if (values.length === 0) return { forecast: [], level: 0 };

  const forecast: number[] = [values[0]];
  let level = values[0];

  for (let i = 1; i < values.length; i++) {
    level = alpha * values[i] + (1 - alpha) * level;
    forecast.push(level);
  }

  return { forecast, level };
}

/**
 * Double exponential smoothing (Holt's method)
 */
export function doubleExponentialSmoothing(
  values: number[],
  alpha: number = 0.3,
  beta: number = 0.1
): { forecast: number[]; level: number; trend: number } {
  if (values.length === 0) return { forecast: [], level: 0, trend: 0 };
  if (values.length === 1) return { forecast: [values[0]], level: values[0], trend: 0 };

  let level = values[0];
  let trend = values[1] - values[0];
  const forecast: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    forecast.push(level + trend);
  }

  return { forecast, level, trend };
}

/**
 * Calculate Mean Absolute Percentage Error (MAPE)
 */
export function mape(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;

  const nonZeroActuals = actual.filter(a => a !== 0);
  if (nonZeroActuals.length === 0) return 0;

  const errors = actual.map((a, i) => Math.abs((a - predicted[i]) / a));
  return (errors.reduce((a, b) => a + b, 0) / errors.length) * 100;
}

/**
 * Calculate Mean Absolute Error (MAE)
 */
export function mae(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;

  const errors = actual.map((a, i) => Math.abs(a - predicted[i]));
  return errors.reduce((a, b) => a + b, 0) / errors.length;
}

/**
 * Calculate Root Mean Square Error (RMSE)
 */
export function rmse(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;

  const squaredErrors = actual.map((a, i) => Math.pow(a - predicted[i], 2));
  return Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length);
}

/**
 * Calculate forecast bias
 */
export function forecastBias(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;

  const errors = actual.map((a, i) => predicted[i] - a);
  return errors.reduce((a, b) => a + b, 0) / errors.length;
}

/**
 * Calculate Theil's U statistic
 */
export function theilsU(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length < 2) return 0;

  const naiveForecast = actual.slice(0, -1);
  const actualForecast = actual.slice(1);

  if (naiveForecast.length === 0) return 0;

  const numerator = rmse(actualForecast, predicted.slice(1));
  const denominator = rmse(actualForecast, naiveForecast);

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Detect seasonality using autocorrelation
 */
export function detectSeasonality(
  values: number[],
  maxPeriod: number = 52
): { period: number; strength: number } | null {
  if (values.length < maxPeriod * 2) return null;

  const n = values.length;
  const meanValue = mean(values);
  let maxCorrelation = 0;
  let bestPeriod = 0;

  for (let lag = 1; lag <= maxPeriod; lag++) {
    let correlation = 0;
    let count = 0;

    for (let i = lag; i < n; i++) {
      correlation += (values[i] - meanValue) * (values[i - lag] - meanValue);
      count++;
    }

    if (count > 0) {
      correlation /= count;
      const autocorrelation = correlation / Math.pow(
        values.reduce((acc, v) => acc + Math.pow(v - meanValue, 2), 0) / n,
        0.5
      );

      if (Math.abs(autocorrelation) > Math.abs(maxCorrelation)) {
        maxCorrelation = autocorrelation;
        bestPeriod = lag;
      }
    }
  }

  const strength = Math.abs(maxCorrelation);
  if (strength < 0.3) return null; // No significant seasonality

  return { period: bestPeriod, strength };
}

/**
 * Seasonal decomposition using moving averages
 */
export function seasonalDecomposition(
  values: number[],
  period: number
): { trend: number[]; seasonal: number[]; residual: number[] } {
  const n = values.length;
  const halfPeriod = Math.floor(period / 2);

  // Calculate trend using centered moving average
  const trend: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < halfPeriod || i >= n - halfPeriod) {
      trend.push(values[i]); // Edge values
    } else {
      let sum = 0;
      let count = 0;
      for (let j = i - halfPeriod; j <= i + halfPeriod; j++) {
        if (j >= 0 && j < n) {
          sum += values[j];
          count++;
        }
      }
      trend.push(count > 0 ? sum / count : values[i]);
    }
  }

  // Calculate seasonal indices
  const seasonalFactors: number[] = new Array(period).fill(0);
  const seasonalCounts: number[] = new Array(period).fill(0);

  for (let i = 0; i < n; i++) {
    if (trend[i] !== 0 && values[i] / trend[i] > 0) {
      const seasonalIndex = i % period;
      seasonalFactors[seasonalIndex] += values[i] / trend[i];
      seasonalCounts[seasonalIndex]++;
    }
  }

  const seasonalIndices = seasonalFactors.map((f, i) =>
    seasonalCounts[i] > 0 ? f / seasonalCounts[i] : 1
  );

  // Normalize seasonal indices
  const seasonalMean = mean(seasonalIndices);
  const normalizedIndices = seasonalIndices.map(s => s / seasonalMean);

  // Apply seasonal indices to full series
  const seasonal: number[] = values.map((_, i) => normalizedIndices[i % period]);
  const residual: number[] = values.map((v, i) =>
    trend[i] !== 0 ? v / (trend[i] * seasonal[i]) : 1
  );

  return { trend, seasonal, residual };
}

/**
 * Simple weighted moving average
 */
export function weightedMovingAverage(
  values: number[],
  weights: number[]
): number {
  if (values.length === 0 || weights.length === 0) return 0;
  if (values.length !== weights.length) return 0;

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = values.reduce((acc, v, i) => acc + v * weights[i], 0);
  return weightedSum / totalWeight;
}

/**
 * Generate date array for forecasting
 */
export function generateDateArray(
  startDate: Date,
  horizon: number
): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < horizon; i++) {
    const nextDate = new Date(startDate);
    nextDate.setDate(nextDate.getDate() + i + 1);
    dates.push(nextDate);
  }
  return dates;
}

/**
 * Calculate growth rate
 */
export function growthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Round to specific decimal places
 */
export function roundTo(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sum of array
 */
export function sum(values: number[]): number {
  return values.reduce((acc: number, v: number) => acc + v, 0);
}

/**
 * Product of array
 */
export function product(values: number[]): number {
  return values.reduce((acc: number, v: number) => acc * v, 1);
}
