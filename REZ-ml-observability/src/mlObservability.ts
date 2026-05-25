/**
 * REZ ML Observability Service
 *
 * Monitor ML models, detect drift, track quality
 *
 * Features:
 * - Model performance tracking
 * - Drift detection
 * - Latency monitoring
 * - Feature quality tracking
 * - Decision outcome monitoring
 * - Alerting
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ModelMetric {
  modelId: string;
  modelVersion: string;
  timestamp: string;

  // Performance metrics
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;

  // Business metrics
  conversionRate?: number;
  engagementRate?: number;
  revenueImpact?: number;

  // Model-specific
  predictionLatencyMs?: number;
  featureLatencyMs?: number;
  totalLatencyMs?: number;

  // Data quality
  nullRate?: number;
  outlierRate?: number;
}

export interface PredictionLog {
  id: string;
  modelId: string;
  modelVersion: string;
  timestamp: string;

  // Input
  userId?: string;
  context: Record<string, unknown>;
  features: Record<string, unknown>;

  // Output
  prediction;
  confidence?: number;
  decision?: string;

  // Ground truth (for training)
  actual?;
  outcome?: string;

  // Performance
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface DriftDetection {
  modelId: string;
  featureName: string;
  timestamp: string;

  // Statistical tests
  psi?: number;        // Population Stability Index
  klDivergence?: number;
  kolmogorovSmirnov?: number;

  // Results
  driftDetected: boolean;
  severity: 'none' | 'warning' | 'critical';
  driftScore: number;   // 0-1

  // Comparison
  baselineDistribution;
  currentDistribution;
}

export interface Alert {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';

  type: 'drift_detected' | 'latency_spike' | 'accuracy_drop' | 'quality_degradation' | 'model_error';

  modelId?: string;
  featureName?: string;

  message: string;
  details: Record<string, unknown>;

  acknowledged: boolean;
  resolvedAt?: string;
}

// ============================================================================
// Metrics Store
// ============================================================================

class MetricsStore {
  private metrics: Map<string, ModelMetric[]> = new Map();
  private predictions: PredictionLog[] = [];
  private maxPredictions = 100000;

  addMetric(metric: ModelMetric): void {
    const existing = this.metrics.get(metric.modelId) || [];
    existing.push(metric);

    // Keep last 1000 metrics per model
    if (existing.length > 1000) {
      existing.shift();
    }

    this.metrics.set(metric.modelId, existing);
  }

  addPrediction(prediction: PredictionLog): void {
    this.predictions.push(prediction);

    // Keep last N predictions
    if (this.predictions.length > this.maxPredictions) {
      this.predictions.shift();
    }
  }

  getMetrics(modelId: string, limit = 100): ModelMetric[] {
    const metrics = this.metrics.get(modelId) || [];
    return metrics.slice(-limit);
  }

  getPredictions(options?: {
    modelId?: string;
    userId?: string;
    since?: string;
    limit?: number;
  }): PredictionLog[] {
    let results = [...this.predictions];

    if (options?.modelId) {
      results = results.filter(p => p.modelId === options.modelId);
    }

    if (options?.userId) {
      results = results.filter(p => p.userId === options.userId);
    }

    if (options?.since) {
      const since = new Date(options.since).getTime();
      results = results.filter(p => new Date(p.timestamp).getTime() >= since);
    }

    const limit = options?.limit || 100;
    return results.slice(-limit);
  }

  getAverageLatency(modelId: string, windowMinutes = 60): number {
    const since = Date.now() - windowMinutes * 60 * 1000;
    const predictions = this.predictions.filter(
      p => p.modelId === modelId && new Date(p.timestamp).getTime() >= since
    );

    if (predictions.length === 0) return 0;

    const total = predictions.reduce((sum, p) => sum + p.latencyMs, 0);
    return total / predictions.length;
  }

  getSuccessRate(modelId: string, windowMinutes = 60): number {
    const since = Date.now() - windowMinutes * 60 * 1000;
    const predictions = this.predictions.filter(
      p => p.modelId === modelId && new Date(p.timestamp).getTime() >= since
    );

    if (predictions.length === 0) return 1;

    const successes = predictions.filter(p => p.success).length;
    return successes / predictions.length;
  }
}

// ============================================================================
// Drift Detector
// ============================================================================

class DriftDetector {
  private thresholds = {
    psiWarning: 0.1,
    psiCritical: 0.25,
    ksWarning: 0.1,
    ksCritical: 0.15
  };

  /**
   * Calculate Population Stability Index (PSI)
   */
  calculatePSI(baseline: number[], current: number[], buckets = 10): number {
    // Create buckets from baseline
    const min = Math.min(...baseline);
    const max = Math.max(...baseline);
    const bucketSize = (max - min) / buckets;

    const baselineBuckets = new Array(buckets).fill(0);
    const currentBuckets = new Array(buckets).fill(0);

    // Count baseline
    baseline.forEach(v => {
      const bucket = Math.min(Math.floor((v - min) / bucketSize), buckets - 1);
      baselineBuckets[bucket]++;
    });

    // Count current
    current.forEach(v => {
      const bucket = Math.min(Math.floor((v - min) / bucketSize), buckets - 1);
      currentBuckets[bucket]++;
    });

    // Convert to proportions
    const baselineProportions = baselineBuckets.map(c => c / baseline.length);
    const currentProportions = currentBuckets.map(c => c / current.length);

    // Calculate PSI
    let psi = 0;
    for (let i = 0; i < buckets; i++) {
      const b = baselineProportions[i] || 0.001;
      const c = currentProportions[i] || 0.001;
      psi += (c - b) * Math.log(c / b);
    }

    return psi;
  }

  /**
   * Detect drift for a feature
   */
  detectDrift(
    featureName: string,
    modelId: string,
    baselineValues: number[],
    currentValues: number[]
  ): DriftDetection {
    const psi = this.calculatePSI(baselineValues, currentValues);
    const ksScore = this.calculateKS(baselineValues, currentValues);

    const driftScore = Math.max(psi * 2, ksScore * 3); // Weight PSI more heavily

    let severity: 'none' | 'warning' | 'critical' = 'none';
    let driftDetected = false;

    if (psi > this.thresholds.psiCritical || ksScore > this.thresholds.ksCritical) {
      severity = 'critical';
      driftDetected = true;
    } else if (psi > this.thresholds.psiWarning || ksScore > this.thresholds.ksWarning) {
      severity = 'warning';
      driftDetected = true;
    }

    return {
      modelId,
      featureName,
      timestamp: new Date().toISOString(),
      psi,
      kolmogorovSmirnov: ksScore,
      driftDetected,
      severity,
      driftScore,
      baselineDistribution: this.getDistribution(baselineValues),
      currentDistribution: this.getDistribution(currentValues)
    };
  }

  private calculateKS(sample1: number[], sample2: number[]): number {
    const allValues = [...sample1, ...sample2].sort((a, b) => a - b);
    const n1 = sample1.length;
    const n2 = sample2.length;

    let maxD = 0;
    for (const value of allValues) {
      const d1 = Math.abs(sample1.filter(v => v <= value).length / n1 - sample2.filter(v => v <= value).length / n2);
      maxD = Math.max(maxD, d1);
    }

    return maxD;
  }

  private getDistribution(values: number[]): { mean: number; std: number; min: number; max: number; p25: number; p50: number; p75: number } {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    return {
      mean,
      std: Math.sqrt(variance),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p75: sorted[Math.floor(sorted.length * 0.75)]
    };
  }
}

// ============================================================================
// Alert Manager
// ============================================================================

class AlertManager {
  private alerts: Alert[] = [];
  private maxAlerts = 1000;
  private listeners: ((alert: Alert) => void)[] = [];

  create(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Alert {
    const fullAlert: Alert = {
      ...alert,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.alerts.push(fullAlert);

    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(fullAlert));

    return fullAlert;
  }

  acknowledge(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  resolve(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  getActive(): Alert[] {
    return this.alerts.filter(a => !a.resolvedAt);
  }

  getUnacknowledged(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged && !a.resolvedAt);
  }

  onAlert(callback: (alert: Alert) => void): void {
    this.listeners.push(callback);
  }
}

// ============================================================================
// ML Observability Service
// ============================================================================

export class MLObservabilityService {
  private store: MetricsStore;
  private driftDetector: DriftDetector;
  private alertManager: AlertManager;
  private baselineData: Map<string, Map<string, number[]>> = new Map(); // modelId → featureName → values

  constructor() {
    this.store = new MetricsStore();
    this.driftDetector = new DriftDetector();
    this.alertManager = new AlertManager();

    // Check for drift every 5 minutes
    setInterval(() => this.checkDrift(), 5 * 60 * 1000);
  }

  // ============================================
  // Logging Methods
  // ============================================

  /**
   * Log a model prediction
   */
  logPrediction(prediction: Omit<PredictionLog, 'id' | 'timestamp'>): void {
    const fullPrediction: PredictionLog = {
      ...prediction,
      id: randomUUID(),
      timestamp: new Date().toISOString()
    };

    this.store.addPrediction(fullPrediction);

    // Check for latency issues
    if (prediction.latencyMs > 500) {
      this.alertManager.create({
        severity: 'warning',
        type: 'latency_spike',
        modelId: prediction.modelId,
        message: `High latency detected for model ${prediction.modelId}`,
        details: { latencyMs: prediction.latencyMs, threshold: 500 }
      });
    }

    // Check for errors
    if (!prediction.success) {
      this.alertManager.create({
        severity: 'critical',
        type: 'model_error',
        modelId: prediction.modelId,
        message: `Model error: ${prediction.error}`,
        details: { error: prediction.error }
      });
    }
  }

  /**
   * Log model metrics
   */
  logMetrics(metrics: ModelMetric): void {
    this.store.addMetric(metrics);

    // Check for accuracy degradation
    const recentMetrics = this.store.getMetrics(metrics.modelId, 100);
    if (recentMetrics.length >= 50) {
      const oldAccuracy = recentMetrics[0].accuracy || 0;
      const newAccuracy = metrics.accuracy || 0;
      const degradation = oldAccuracy - newAccuracy;

      if (degradation > 0.05) {
        this.alertManager.create({
          severity: 'warning',
          type: 'accuracy_drop',
          modelId: metrics.modelId,
          message: `Accuracy dropped by ${(degradation * 100).toFixed(1)}%`,
          details: { oldAccuracy, newAccuracy, degradation }
        });
      }
    }
  }

  // ============================================
  // Drift Detection
  // ============================================

  /**
   * Set baseline for a feature
   */
  setBaseline(modelId: string, featureName: string, values: number[]): void {
    if (!this.baselineData.has(modelId)) {
      this.baselineData.set(modelId, new Map());
    }
    this.baselineData.get(modelId)!.set(featureName, values.slice(0, 1000));
  }

  /**
   * Check drift for all models and features
   */
  private async checkDrift(): Promise<void> {
    const predictions = this.store.getPredictions({ limit: 1000 });

    // Group by model
    const byModel = new Map<string, PredictionLog[]>();
    predictions.forEach(p => {
      const existing = byModel.get(p.modelId) || [];
      existing.push(p);
      byModel.set(p.modelId, existing);
    });

    for (const [modelId, modelPredictions] of byModel) {
      // Check each feature
      const features = new Set<string>();
      modelPredictions.forEach(p => {
        Object.keys(p.features || {}).forEach(f => features.add(f));
      });

      for (const feature of features) {
        const values = modelPredictions
          .map(p => p.features?.[feature])
          .filter((v): v is number => typeof v === 'number');

        if (values.length < 100) continue;

        const baseline = this.baselineData.get(modelId)?.get(feature);
        if (!baseline || baseline.length < 100) continue;

        const drift = this.driftDetector.detectDrift(feature, modelId, baseline, values);

        if (drift.driftDetected) {
          this.alertManager.create({
            severity: drift.severity === 'critical' ? 'critical' : 'warning',
            type: 'drift_detected',
            modelId,
            featureName: feature,
            message: `Drift detected in ${feature}: score ${drift.driftScore.toFixed(3)}`,
            details: {
              driftScore: drift.driftScore,
              psi: drift.psi,
              ks: drift.kolmogorovSmirnov,
              severity: drift.severity
            }
          });
        }
      }
    }
  }

  /**
   * Detect drift for specific feature
   */
  detectDrift(modelId: string, featureName: string, currentValues: number[]): DriftDetection | null {
    const baseline = this.baselineData.get(modelId)?.get(featureName);
    if (!baseline || baseline.length < 100) {
      return null;
    }

    return this.driftDetector.detectDrift(featureName, modelId, baseline, currentValues);
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get model performance over time
   */
  getModelPerformance(modelId: string, windowMinutes = 60): {
    avgLatencyMs: number;
    successRate: number;
    predictionCount: number;
    errorCount: number;
  } {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const predictions = this.store.getPredictions({ modelId, since });

    const avgLatencyMs = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.latencyMs, 0) / predictions.length
      : 0;

    const successCount = predictions.filter(p => p.success).length;
    const errorCount = predictions.filter(p => !p.success).length;

    return {
      avgLatencyMs,
      successRate: predictions.length > 0 ? successCount / predictions.length : 1,
      predictionCount: predictions.length,
      errorCount
    };
  }

  /**
   * Get feature importance over time
   */
  getFeatureImportance(modelId: string, limit = 10): { feature: string; importance: number }[] {
    const predictions = this.store.getPredictions({ modelId, limit: 1000 });

    // Calculate importance based on usage frequency and variance
    const featureStats = new Map<string, { count: number; variance: number }>();

    predictions.forEach(p => {
      Object.entries(p.features || {}).forEach(([feature, value]) => {
        const existing = featureStats.get(feature) || { count: 0, variance: 0 };
        existing.count++;
        if (typeof value === 'number') {
          existing.variance += Math.abs(value);
        }
        featureStats.set(feature, existing);
      });
    });

    return Array.from(featureStats.entries())
      .map(([feature, stats]) => ({
        feature,
        importance: stats.count * Math.log(stats.variance + 1)
      }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alertManager.getActive();
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): Alert[] {
    return this.alertManager.getUnacknowledged();
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    return this.alertManager.acknowledge(alertId);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    return this.alertManager.resolve(alertId);
  }

  /**
   * Get service health
   */
  getHealth(): {
    totalPredictions: number;
    activeAlerts: number;
    modelsTracked: number;
    baselineFeatures: number;
  } {
    return {
      totalPredictions: this.store['predictions'].length,
      activeAlerts: this.alertManager.getActive().length,
      modelsTracked: this.store['metrics'].size,
      baselineFeatures: Array.from(this.baselineData.values()).reduce((sum, m) => sum + m.size, 0)
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const mlObservability = new MLObservabilityService();
export default mlObservability;
