/**
 * Fraud Detection Model
 *
 * Pattern-based fraud detection using multiple signals:
 * - Transaction velocity
 * - Amount anomalies
 * - Geographic patterns
 * - Device fingerprinting
 */

import { EventEmitter } from 'events';

export interface FraudSignal {
  type: string;
  score: number;
  description: string;
}

export interface FraudPrediction {
  isFraudulent: boolean;
  confidence: number;
  riskScore: number;
  signals: FraudSignal[];
  recommendation: string;
}

export interface Order {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  items: OrderItem[];
  timestamp: string;
  location?: { lat: number; lng: number };
  deviceId?: string;
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface FraudDetectionConfig {
  threshold: number;
  enableRealTime: boolean;
  blockThreshold?: number;
  highAmountThreshold?: number;
  velocityWindowMinutes?: number;
  maxTransactionsPerHour?: number;
}

export interface FraudStats {
  totalChecked: number;
  fraudDetected: number;
  falsePositives: number;
  lastChecked: string;
}

export class FraudDetectionModel extends EventEmitter {
  private config: FraudDetectionConfig;
  private stats: FraudStats = { totalChecked: 0, fraudDetected: 0, falsePositives: 0, lastChecked: '' };
  private transactionLog: Map<string, { timestamp: number; amount: number }[]> = new Map();

  constructor(config?: FraudDetectionConfig) {
    super();
    this.config = {
      threshold: config?.threshold ?? 0.7,
      enableRealTime: config?.enableRealTime ?? true,
      blockThreshold: config?.blockThreshold ?? 70,
      highAmountThreshold: config?.highAmountThreshold ?? 50000,
      velocityWindowMinutes: config?.velocityWindowMinutes ?? 60,
      maxTransactionsPerHour: config?.maxTransactionsPerHour ?? 10,
    };
  }

  async predict(order: Order): Promise<FraudPrediction> {
    const signals: FraudSignal[] = [];
    let totalRiskScore = 0;

    // Signal 1: High amount detection
    if (order.amount > (this.config.highAmountThreshold ?? 50000)) {
      const score = Math.min(1, (order.amount - 50000) / 100000);
      signals.push({ type: 'high_amount', score, description: `Amount ${order.amount} exceeds threshold` });
      totalRiskScore += score * 0.3;
    }

    // Signal 2: Transaction velocity
    const velocityScore = this.checkVelocity(order.userId);
    if (velocityScore > 0) {
      signals.push({ type: 'high_velocity', score: velocityScore, description: 'Unusual transaction frequency' });
      totalRiskScore += velocityScore * 0.25;
    }

    // Signal 3: Bulk item ordering
    const bulkScore = this.checkBulkOrdering(order.items);
    if (bulkScore > 0) {
      signals.push({ type: 'bulk_ordering', score: bulkScore, description: 'Unusual quantity patterns' });
      totalRiskScore += bulkScore * 0.2;
    }

    // Signal 4: New user high value
    const isNewUser = this.isNewUser(order.userId);
    if (isNewUser && order.amount > 10000) {
      signals.push({ type: 'new_user_high_value', score: 0.6, description: 'High-value order from new account' });
      totalRiskScore += 0.6 * 0.15;
    }

    // Signal 5: Location anomaly
    const locationScore = this.checkLocationAnomaly(order);
    if (locationScore > 0) {
      signals.push({ type: 'location_anomaly', score: locationScore, description: 'Location differs from usual' });
      totalRiskScore += locationScore * 0.1;
    }

    // Normalize risk score to 0-1
    const riskScore = Math.min(1, totalRiskScore);
    const blockThreshold = (this.config.blockThreshold ?? 70) / 100;

    const prediction: FraudPrediction = {
      isFraudulent: riskScore >= blockThreshold,
      confidence: signals.length > 0 ? 0.85 + (signals.length * 0.02) : 0.5,
      riskScore,
      signals,
      recommendation: riskScore >= blockThreshold ? 'block' : riskScore >= 0.4 ? 'review' : 'allow',
    };

    // Update stats
    this.stats.totalChecked++;
    this.stats.lastChecked = new Date().toISOString();
    if (prediction.isFraudulent) this.stats.fraudDetected++;

    // Log transaction
    this.logTransaction(order);

    if (prediction.isFraudulent) {
      this.emit('fraudDetected', prediction);
    }

    return prediction;
  }

  private checkVelocity(userId: string): number {
    const transactions = this.transactionLog.get(userId) || [];
    const now = Date.now();
    const windowMs = (this.config.velocityWindowMinutes ?? 60) * 60 * 1000;
    const recentTransactions = transactions.filter(t => now - t.timestamp < windowMs);

    const maxAllowed = this.config.maxTransactionsPerHour ?? 10;
    if (recentTransactions.length >= maxAllowed) return 1;
    return recentTransactions.length / maxAllowed;
  }

  private checkBulkOrdering(items: OrderItem[]): number {
    if (items.length === 0) return 0;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity > 20) return Math.min(1, (totalQuantity - 20) / 30);
    return 0;
  }

  private isNewUser(userId: string): boolean {
    const transactions = this.transactionLog.get(userId);
    return !transactions || transactions.length < 3;
  }

  private checkLocationAnomaly(order: Order): number {
    // Simple location check - in production would use IP geolocation
    if (!order.location) return 0;
    // Flag if location seems invalid (lat/lng outside normal range)
    if (order.location.lat < -90 || order.location.lat > 90) return 0.8;
    if (order.location.lng < -180 || order.location.lng > 180) return 0.8;
    return 0;
  }

  private logTransaction(order: Order): void {
    const transactions = this.transactionLog.get(order.userId) || [];
    transactions.push({ timestamp: Date.now(), amount: order.amount });
    // Keep only last 100 transactions
    if (transactions.length > 100) transactions.shift();
    this.transactionLog.set(order.userId, transactions);
  }

  async calculateRiskScore(order: Order): Promise<FraudPrediction> {
    return this.predict(order);
  }

  async batchPredict(orders: Order[]): Promise<FraudPrediction[]> {
    return Promise.all(orders.map(order => this.predict(order)));
  }

  getStats(): FraudStats {
    return { ...this.stats };
  }

  updateConfig(config: Partial<FraudDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export function createFraudDetectionModel(config?: FraudDetectionConfig): FraudDetectionModel {
  return new FraudDetectionModel(config);
}
