/**
 * Customer Lifetime Value (CLV) Prediction System
 *
 * Features:
 * - RFM (Recency, Frequency, Monetary) Analysis
 * - Churn Probability Calculation
 * - Segment Classification
 * - AI-powered Recommendation Engine
 */

import { EventEmitter } from 'events';

// Types and Interfaces
export interface CustomerTransaction {
  customerId: string;
  transactionDate: Date;
  amount: number;
  items?: number;
  category?: string;
}

export interface CustomerMetrics {
  customerId: string;
  recency: number;          // Days since last purchase
  frequency: number;        // Number of purchases
  monetary: number;          // Average order value
  totalRevenue: number;     // Total revenue generated
  avgItemsPerOrder: number;
  purchaseSpan: number;     // Days between first and last purchase
  orderVelocity: number;    // Purchases per month
  seasonality: number[];     // Monthly purchase patterns
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  criteria: {
    minRFM?: number;
    maxRFM?: number;
    minCLV?: number;
    maxCLV?: number;
    churnRisk?: string[];
  };
  color: string;
  count: number;
  avgCLV: number;
  avgChurnRisk: number;
}

export interface CustomerCLV {
  customerId: string;
  currentCLV: number;
  predicted12Month: number;
  churnRisk: 'low' | 'medium' | 'high';
  segment: string;
  recommendations: string[];
  metrics: CustomerMetrics;
  rfmScores: { r: number; f: number; m: number };
  churnProbability: number;
  clvConfidence: number;
}

export interface CLVPredictionConfig {
  discountRate: number;           // Annual discount rate (default 0.1)
  predictionMonths: number;       // Months to predict (default 12)
  churnThresholdLow: number;      // Churn threshold for low risk
  churnThresholdMedium: number;   // Churn threshold for medium risk
  weights: {
    recency: number;
    frequency: number;
    monetary: number;
  };
  segmentDefinitions: SegmentDefinition[];
}

export interface SegmentDefinition {
  id: string;
  name: string;
  minRFM: number;
  maxRFM: number;
  color: string;
  description: string;
}

// Default segment definitions based on RFM scores
const DEFAULT_SEGMENTS: SegmentDefinition[] = [
  { id: 'champions', name: 'Champions', minRFM: 4, maxRFM: 5, color: '#00C853', description: 'Best customers, bought recently, buy often, spend the most' },
  { id: 'loyal', name: 'Loyal Customers', minRFM: 3, maxRFM: 4, color: '#2196F3', description: 'Customers with high frequency and monetary scores' },
  { id: 'potential', name: 'Potential Loyalists', minRFM: 3, maxRFM: 5, color: '#7C4DFF', description: 'Recent customers with average frequency' },
  { id: 'new', name: 'New Customers', minRFM: 4, maxRFM: 5, color: '#00BCD4', description: 'Recently acquired, need nurturing' },
  { id: 'promising', name: 'Promising', minRFM: 3, maxRFM: 4, color: '#FFC107', description: 'Recent but not frequent buyers, need engagement' },
  { id: 'needs', name: 'Needs Attention', minRFM: 2, maxRFM: 3, color: '#FF9800', description: 'Average recency, frequency, monetary scores' },
  { id: 'at_risk', name: 'At Risk', minRFM: 1, maxRFM: 2, color: '#F44336', description: 'Below average metrics, may churn soon' },
  { id: 'lost', name: 'Lost Customers', minRFM: 0, maxRFM: 1, color: '#9E9E9E', description: 'Lowest RFM scores, likely churned' },
];

const DEFAULT_CONFIG: CLVPredictionConfig = {
  discountRate: 0.1,
  predictionMonths: 12,
  churnThresholdLow: 0.2,
  churnThresholdMedium: 0.5,
  weights: { recency: 0.3, frequency: 0.35, monetary: 0.35 },
  segmentDefinitions: DEFAULT_SEGMENTS,
};

// Recommendation templates based on customer state
const RECOMMENDATION_TEMPLATES = {
  champions: [
    'Offer exclusive VIP rewards and early access to new products',
    'Create referral program to leverage their advocacy',
    'Provide personalized premium services',
  ],
  loyal: [
    'Maintain engagement with loyalty rewards',
    'Cross-sell complementary products',
    'Request reviews and testimonials',
  ],
  potential: [
    'Increase purchase frequency with targeted promotions',
    'Recommend related products based on purchase history',
    'Invite to loyalty program for additional benefits',
  ],
  new: [
    'Welcome series with product education',
    'Highlight popular products and reviews',
    'Offer first-time buyer incentives',
  ],
  promising: [
    'Re-engage with recent activity triggers',
    'Offer time-limited discounts to encourage repeat',
    'Send personalized product recommendations',
  ],
  needs_attention: [
    'Create urgency with limited-time offers',
    'Win-back campaign with special incentives',
    'Survey to understand concerns',
  ],
  at_risk: [
    'Send win-back email with significant discount',
    'Personalized outreach from customer service',
    'Highlight new arrivals and improvements',
  ],
  lost: [
    'Aggressive win-back campaign with best offers',
    'Reintroduction to brand with updated catalog',
    'Consider removing from active marketing if multiple attempts fail',
  ],
};

// Customer data store (in production, this would be a database)
interface CustomerDataStore {
  transactions: Map<string, CustomerTransaction[]>;
  metrics: Map<string, CustomerMetrics>;
  clvCache: Map<string, CustomerCLV>;
  lastUpdated: Date;
}

/**
 * CLVPredictor - Customer Lifetime Value Prediction System
 *
 * Uses RFM analysis combined with statistical modeling to predict
 * customer value and churn probability.
 */
export class CLVPredictor extends EventEmitter {
  private config: CLVPredictionConfig;
  private dataStore: CustomerDataStore;
  private segmentCache: Segment[] = [];
  private isInitialized = false;

  constructor(config: Partial<CLVPredictionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataStore = {
      transactions: new Map(),
      metrics: new Map(),
      clvCache: new Map(),
      lastUpdated: new Date(),
    };
  }

  /**
   * Initialize the predictor with historical transaction data
   */
  async initialize(transactions: CustomerTransaction[]): Promise<void> {
    this.emit('init:start');

    // Group transactions by customer
    for (const tx of transactions) {
      const customerTxs = this.dataStore.transactions.get(tx.customerId) || [];
      customerTxs.push({ ...tx, transactionDate: new Date(tx.transactionDate) });
      this.dataStore.transactions.set(tx.customerId, customerTxs);
    }

    // Calculate metrics for all customers
    const customerIds = Array.from(this.dataStore.transactions.keys());
    for (const customerId of customerIds) {
      const metrics = await this.calculateMetrics(customerId);
      this.dataStore.metrics.set(customerId, metrics);
    }

    this.dataStore.lastUpdated = new Date();
    this.isInitialized = true;
    this.emit('init:complete', { customerCount: customerIds.length });
  }

  /**
   * Calculate RFM and other metrics for a single customer
   */
  private async calculateMetrics(customerId: string): Promise<CustomerMetrics> {
    const transactions = this.dataStore.transactions.get(customerId) || [];
    const now = new Date();

    if (transactions.length === 0) {
      return {
        customerId,
        recency: 365,
        frequency: 0,
        monetary: 0,
        totalRevenue: 0,
        avgItemsPerOrder: 0,
        purchaseSpan: 0,
        orderVelocity: 0,
        seasonality: new Array(12).fill(0),
      };
    }

    // Sort transactions by date
    const sortedTxs = transactions.sort(
      (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime()
    );

    const lastTx = sortedTxs[sortedTxs.length - 1];
    const firstTx = sortedTxs[0];

    // Calculate recency (days since last purchase)
    const recency = Math.floor(
      (now.getTime() - lastTx.transactionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Frequency (number of purchases)
    const frequency = transactions.length;

    // Monetary (average order value)
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const monetary = totalRevenue / frequency;

    // Average items per order
    const totalItems = transactions.reduce((sum, tx) => sum + (tx.items || 1), 0);
    const avgItemsPerOrder = totalItems / frequency;

    // Purchase span (days between first and last purchase)
    const purchaseSpan = Math.floor(
      (lastTx.transactionDate.getTime() - firstTx.transactionDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Order velocity (purchases per month)
    const monthsActive = Math.max(purchaseSpan / 30, 1);
    const orderVelocity = frequency / monthsActive;

    // Seasonality (monthly purchase patterns)
    const seasonality = new Array(12).fill(0);
    for (const tx of transactions) {
      const month = tx.transactionDate.getMonth();
      seasonality[month]++;
    }

    return {
      customerId,
      recency,
      frequency,
      monetary,
      totalRevenue,
      avgItemsPerOrder,
      purchaseSpan,
      orderVelocity,
      seasonality,
    };
  }

  /**
   * Calculate RFM scores (1-5 scale) for a customer
   */
  private calculateRFMScores(metrics: CustomerMetrics): { r: number; f: number; m: number } {
    // Get all customer metrics for percentile calculation
    const allMetrics = Array.from(this.dataStore.metrics.values());

    if (allMetrics.length === 0) {
      return { r: 1, f: 1, m: 1 };
    }

    // Calculate percentiles
    const rScore = this.calculatePercentileScore(
      metrics.recency,
      allMetrics.map((m) => m.recency),
      true  // Lower is better for recency
    );

    const fScore = this.calculatePercentileScore(
      metrics.frequency,
      allMetrics.map((m) => m.frequency)
    );

    const mScore = this.calculatePercentileScore(
      metrics.monetary,
      allMetrics.map((m) => m.monetary)
    );

    return { r: rScore, f: fScore, m: mScore };
  }

  /**
   * Calculate percentile-based score (1-5)
   */
  private calculatePercentileScore(
    value: number,
    allValues: number[],
    invert = false
  ): number {
    const sorted = [...allValues].sort((a, b) => a - b);
    const rank = sorted.filter((v) =>
      invert ? v >= value : v <= value
    ).length;
    const percentile = rank / sorted.length;

    // Map percentile to score (1-5)
    if (percentile >= 0.8) return 5;
    if (percentile >= 0.6) return 4;
    if (percentile >= 0.4) return 3;
    if (percentile >= 0.2) return 2;
    return 1;
  }

  /**
   * Calculate combined RFM score
   */
  private calculateRFMComposite(rfm: { r: number; f: number; m: number }): number {
    const { recency, frequency, monetary } = this.config.weights;
    return rfm.r * recency + rfm.f * frequency + rfm.m * monetary;
  }

  /**
   * Calculate current CLV using historical data
   * Uses a modified Pareto/NBD model approach
   */
  private calculateCurrentCLV(metrics: CustomerMetrics): number {
    const { monetary, frequency, purchaseSpan } = metrics;

    if (frequency === 0 || purchaseSpan === 0) {
      return monetary;
    }

    // Average customer lifetime value based on purchase patterns
    const avgPurchaseValue = monetary;
    const avgPurchaseFrequency = frequency / (purchaseSpan / 30); // Monthly frequency

    // Estimate customer lifetime (in months) - simplified model
    const estimatedLifetime = Math.max(
      purchaseSpan / 30,
      1
    ) * (1 + Math.log(frequency) / Math.log(10));

    // Current CLV approximation
    const currentCLV = avgPurchaseValue * avgPurchaseFrequency * estimatedLifetime;

    return Math.max(currentCLV, monetary);
  }

  /**
   * Predict 12-month CLV using exponential decay and growth models
   */
  private predict12MonthCLV(
    metrics: CustomerMetrics,
    rfm: { r: number; f: number; m: number },
    churnProb: number
  ): number {
    const { monetary, orderVelocity } = metrics;

    // Base prediction: expected monthly value
    const baseMonthlyValue = monetary * Math.max(orderVelocity, 0.5);

    // Recency factor: decay for inactive customers
    const recencyFactor = Math.exp(-metrics.recency / 90); // 90-day half-life

    // Frequency factor: normalize based on RFM
    const frequencyFactor = rfm.f / 5;

    // Monetary growth factor: based on spending trends
    const monetaryFactor = rfm.m / 5;

    // Survival probability (1 - churn probability)
    const survivalProb = 1 - churnProb;

    // Combine factors
    const expectedMonthlyValue =
      baseMonthlyValue * recencyFactor * frequencyFactor * monetaryFactor;

    // Discount factor for time value of money
    const discountFactor = 1 / (1 + this.config.discountRate / 12);

    // Calculate NPV of future payments
    let predictedCLV = 0;
    for (let month = 1; month <= this.config.predictionMonths; month++) {
      const monthSurvival = Math.pow(survivalProb, month);
      const monthDiscount = Math.pow(discountFactor, month);
      predictedCLV += expectedMonthlyValue * monthSurvival * monthDiscount;
    }

    return Math.max(predictedCLV, 0);
  }

  /**
   * Calculate churn probability based on customer behavior patterns
   */
  private calculateChurnProbability(
    metrics: CustomerMetrics,
    rfm: { r: number; f: number; m: number }
  ): number {
    // Recency-based churn (primary indicator)
    // Exponential decay model: P(churn) = 1 - exp(-recency / characteristicLife)
    const characteristicLife = 60; // Average days before churn
    const recencyChurn = 1 - Math.exp(-metrics.recency / characteristicLife);

    // Frequency-based adjustment (higher frequency = lower churn)
    const frequencyFactor = 1 - Math.min(metrics.frequency / 20, 0.8);

    // RFM score adjustment
    const rfmComposite = (rfm.r + rfm.f + rfm.m) / 3;
    const rfmFactor = 1 - (rfmComposite / 5) * 0.3;

    // Order velocity adjustment
    const velocityFactor =
      metrics.orderVelocity > 0.5
        ? 1 - Math.min(metrics.orderVelocity * 0.1, 0.5)
        : 1 + Math.min((0.5 - metrics.orderVelocity) * 0.3, 0.5);

    // Weighted combination
    const churnProb =
      recencyChurn * 0.5 +
      frequencyFactor * 0.25 +
      rfmFactor * 0.15 +
      velocityFactor * 0.1;

    return Math.min(Math.max(churnProb, 0), 1);
  }

  /**
   * Determine churn risk level
   */
  private getChurnRiskLevel(churnProb: number): 'low' | 'medium' | 'high' {
    if (churnProb <= this.config.churnThresholdLow) {
      return 'low';
    }
    if (churnProb <= this.config.churnThresholdMedium) {
      return 'medium';
    }
    return 'high';
  }

  /**
   * Assign customer to a segment based on RFM scores
   */
  private assignSegment(rfm: { r: number; f: number; m: number }): string {
    const { segmentDefinitions } = this.config;
    const rfmComposite = (rfm.r + rfm.f + rfm.m) / 3;

    // Find matching segment
    for (const segment of segmentDefinitions) {
      if (rfmComposite >= segment.minRFM && rfmComposite <= segment.maxRFM) {
        return segment.name;
      }
    }

    return 'Unknown';
  }

  /**
   * Generate recommendations based on customer profile
   */
  private generateRecommendations(
    segment: string,
    metrics: CustomerMetrics,
    churnRisk: 'low' | 'medium' | 'high',
    churnProb: number
  ): string[] {
    const recommendations: string[] = [];
    const segmentKey = segment.toLowerCase().replace(/\s+/g, '_');

    // Get base recommendations for segment
    const templates = RECOMMENDATION_TEMPLATES as Record<string, string[]>;
    const segmentRecommendations = templates[segmentKey] || templates.promising;

    // Add segment-based recommendations
    recommendations.push(...segmentRecommendations.slice(0, 2));

    // Add churn-specific recommendations
    if (churnRisk === 'high' || churnProb > 0.6) {
      if (!recommendations.includes(templates.at_risk[0])) {
        recommendations.unshift('URGENT: Send win-back campaign immediately');
      }
      if (metrics.recency > 90) {
        recommendations.push('Consider personal outreach call');
      }
    } else if (churnRisk === 'medium' || churnProb > 0.3) {
      recommendations.push('Schedule re-engagement email sequence');
    }

    // Add metrics-specific recommendations
    if (metrics.frequency < 2) {
      recommendations.push('First repeat purchase incentive needed');
    }

    if (metrics.monetary < 50) {
      recommendations.push('Encourage larger basket size with volume discounts');
    }

    if (metrics.orderVelocity < 0.5) {
      recommendations.push('Build urgency with limited-time offers');
    }

    // Add general engagement recommendations
    if (recommendations.length < 3) {
      recommendations.push('Implement loyalty rewards program');
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  /**
   * Calculate confidence level for CLV prediction
   */
  private calculateCLVConfidence(
    metrics: CustomerMetrics,
    churnProb: number
  ): number {
    let confidence = 0.5; // Base confidence

    // More transactions = higher confidence
    if (metrics.frequency >= 10) confidence += 0.2;
    else if (metrics.frequency >= 5) confidence += 0.15;
    else if (metrics.frequency >= 2) confidence += 0.1;

    // Longer purchase history = higher confidence
    if (metrics.purchaseSpan >= 180) confidence += 0.15;
    else if (metrics.purchaseSpan >= 90) confidence += 0.1;
    else if (metrics.purchaseSpan >= 30) confidence += 0.05;

    // Recent activity = higher confidence
    if (metrics.recency <= 30) confidence += 0.1;
    else if (metrics.recency <= 60) confidence += 0.05;

    // Churn probability affects confidence
    if (churnProb > 0.7) confidence -= 0.15;
    else if (churnProb > 0.5) confidence -= 0.1;

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Predict CLV for a single customer
   */
  async predict(customerId: string): Promise<CustomerCLV> {
    // Check cache first
    const cached = this.dataStore.clvCache.get(customerId);
    if (cached) {
      return cached;
    }

    // Get customer metrics
    let metrics = this.dataStore.metrics.get(customerId);
    if (!metrics) {
      // Calculate if not exists
      metrics = await this.calculateMetrics(customerId);
      this.dataStore.metrics.set(customerId, metrics);
    }

    // Calculate RFM scores
    const rfmScores = this.calculateRFMScores(metrics);

    // Calculate churn probability
    const churnProbability = this.calculateChurnProbability(metrics, rfmScores);
    const churnRisk = this.getChurnRiskLevel(churnProbability);

    // Calculate current CLV
    const currentCLV = this.calculateCurrentCLV(metrics);

    // Predict 12-month CLV
    const predicted12Month = this.predict12MonthCLV(metrics, rfmScores, churnProbability);

    // Assign segment
    const segment = this.assignSegment(rfmScores);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      segment,
      metrics,
      churnRisk,
      churnProbability
    );

    // Calculate confidence
    const clvConfidence = this.calculateCLVConfidence(metrics, churnProbability);

    const result: CustomerCLV = {
      customerId,
      currentCLV: Math.round(currentCLV * 100) / 100,
      predicted12Month: Math.round(predicted12Month * 100) / 100,
      churnRisk,
      segment,
      recommendations,
      metrics,
      rfmScores,
      churnProbability: Math.round(churnProbability * 1000) / 1000,
      clvConfidence: Math.round(clvConfidence * 100) / 100,
    };

    // Cache result
    this.dataStore.clvCache.set(customerId, result);

    this.emit('predict:complete', { customerId, result });
    return result;
  }

  /**
   * Predict CLV for multiple customers (batch processing)
   */
  async predictBatch(customerIds: string[]): Promise<CustomerCLV[]> {
    this.emit('predict:batch:start', { count: customerIds.length });

    const results: CustomerCLV[] = [];

    // Process in chunks for better performance
    const chunkSize = 100;
    for (let i = 0; i < customerIds.length; i += chunkSize) {
      const chunk = customerIds.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map((id) => this.predict(id)));
      results.push(...chunkResults);
    }

    this.emit('predict:batch:complete', { count: results.length });
    return results;
  }

  /**
   * Get all customer segments with statistics
   */
  async getSegments(): Promise<Segment[]> {
    const { segmentDefinitions } = this.config;
    const segments: Segment[] = [];

    for (const def of segmentDefinitions) {
      const segmentCustomers = await this.getCustomersInSegment(def);

      if (segmentCustomers.length === 0) {
        continue;
      }

      const clvValues = segmentCustomers.map((c) => c.currentCLV);
      const churnValues = segmentCustomers.map((c) => c.churnProbability);

      segments.push({
        id: def.id,
        name: def.name,
        description: def.description,
        criteria: {
          minRFM: def.minRFM,
          maxRFM: def.maxRFM,
        },
        color: def.color,
        count: segmentCustomers.length,
        avgCLV: Math.round((clvValues.reduce((a, b) => a + b, 0) / clvValues.length) * 100) / 100,
        avgChurnRisk: Math.round((churnValues.reduce((a, b) => a + b, 0) / churnValues.length) * 1000) / 1000,
      });
    }

    // Sort by average CLV descending
    segments.sort((a, b) => b.avgCLV - a.avgCLV);

    this.segmentCache = segments;
    return segments;
  }

  /**
   * Get customers belonging to a specific segment definition
   */
  private async getCustomersInSegment(
    segmentDef: SegmentDefinition
  ): Promise<CustomerCLV[]> {
    const results: CustomerCLV[] = [];

    for (const [customerId] of this.dataStore.transactions) {
      const clv = await this.predict(customerId);
      const rfmComposite =
        (clv.rfmScores.r + clv.rfmScores.f + clv.rfmScores.m) / 3;

      if (rfmComposite >= segmentDef.minRFM && rfmComposite <= segmentDef.maxRFM) {
        results.push(clv);
      }
    }

    return results;
  }

  /**
   * Get list of at-risk customer IDs
   */
  async getAtRiskCustomers(): Promise<string[]> {
    const atRisk: { customerId: string; score: number }[] = [];

    for (const [customerId] of this.dataStore.transactions) {
      const clv = await this.predict(customerId);
      const score = clv.churnProbability * (1 - clv.clvConfidence);

      if (clv.churnRisk === 'high' || clv.churnProbability > 0.5) {
        atRisk.push({ customerId, score });
      }
    }

    // Sort by risk score descending
    atRisk.sort((a, b) => b.score - a.score);

    return atRisk.map((r) => r.customerId);
  }

  /**
   * Get detailed at-risk customers with full data
   */
  async getAtRiskCustomersDetailed(): Promise<CustomerCLV[]> {
    const atRisk: CustomerCLV[] = [];

    for (const [customerId] of this.dataStore.transactions) {
      const clv = await this.predict(customerId);
      if (clv.churnRisk === 'high' || clv.churnProbability > 0.5) {
        atRisk.push(clv);
      }
    }

    // Sort by churn probability descending
    atRisk.sort((a, b) => b.churnProbability - a.churnProbability);

    return atRisk;
  }

  /**
   * Recalculate all metrics and predictions
   */
  async recalculate(): Promise<void> {
    this.emit('recalculate:start');

    // Clear cache
    this.dataStore.clvCache.clear();
    this.segmentCache = [];

    // Recalculate metrics for all customers
    for (const [customerId] of this.dataStore.transactions) {
      const metrics = await this.calculateMetrics(customerId);
      this.dataStore.metrics.set(customerId, metrics);
    }

    this.dataStore.lastUpdated = new Date();
    this.emit('recalculate:complete');
  }

  /**
   * Add a new transaction and update predictions
   */
  async addTransaction(transaction: CustomerTransaction): Promise<CustomerCLV> {
    const { customerId } = transaction;

    // Add to transactions
    const customerTxs = this.dataStore.transactions.get(customerId) || [];
    customerTxs.push({ ...transaction, transactionDate: new Date(transaction.transactionDate) });
    this.dataStore.transactions.set(customerId, customerTxs);

    // Clear cache for this customer
    this.dataStore.clvCache.delete(customerId);

    // Recalculate metrics
    const metrics = await this.calculateMetrics(customerId);
    this.dataStore.metrics.set(customerId, metrics);

    // Return fresh prediction
    return this.predict(customerId);
  }

  /**
   * Get overall CLV statistics
   */
  async getStatistics(): Promise<{
    totalCustomers: number;
    avgCLV: number;
    avgPredicted12Month: number;
    avgChurnProbability: number;
    segmentDistribution: Record<string, number>;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
  }> {
    const allCLVs: CustomerCLV[] = [];

    for (const [customerId] of this.dataStore.transactions) {
      const clv = await this.predict(customerId);
      allCLVs.push(clv);
    }

    const segmentDistribution: Record<string, number> = {};
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;

    let totalCLV = 0;
    let totalPredicted = 0;
    let totalChurn = 0;

    for (const clv of allCLVs) {
      totalCLV += clv.currentCLV;
      totalPredicted += clv.predicted12Month;
      totalChurn += clv.churnProbability;

      segmentDistribution[clv.segment] = (segmentDistribution[clv.segment] || 0) + 1;

      if (clv.churnRisk === 'high') highRiskCount++;
      else if (clv.churnRisk === 'medium') mediumRiskCount++;
      else lowRiskCount++;
    }

    const count = allCLVs.length || 1;

    return {
      totalCustomers: count,
      avgCLV: Math.round((totalCLV / count) * 100) / 100,
      avgPredicted12Month: Math.round((totalPredicted / count) * 100) / 100,
      avgChurnProbability: Math.round((totalChurn / count) * 1000) / 1000,
      segmentDistribution,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
    };
  }

  /**
   * Get top N customers by predicted value
   */
  async getTopCustomers(n: number = 10): Promise<CustomerCLV[]> {
    const allCLVs: CustomerCLV[] = [];

    for (const [customerId] of this.dataStore.transactions) {
      const clv = await this.predict(customerId);
      allCLVs.push(clv);
    }

    return allCLVs.sort((a, b) => b.predicted12Month - a.predicted12Month).slice(0, n);
  }

  /**
   * Export all predictions to JSON
   */
  async exportAll(): Promise<string> {
    const allCLVs: CustomerCLV[] = [];

    for (const [customerId] of this.dataStore.transactions) {
      const clv = await this.predict(customerId);
      allCLVs.push(clv);
    }

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        customerCount: allCLVs.length,
        predictions: allCLVs,
      },
      null,
      2
    );
  }

  /**
   * Get health status of the predictor
   */
  getStatus(): {
    isInitialized: boolean;
    customerCount: number;
    lastUpdated: Date;
    cacheSize: number;
  } {
    return {
      isInitialized: this.isInitialized,
      customerCount: this.dataStore.transactions.size,
      lastUpdated: this.dataStore.lastUpdated,
      cacheSize: this.dataStore.clvCache.size,
    };
  }
}

// Factory function for quick instantiation
export function createCLVPredictor(config?: Partial<CLVPredictionConfig>): CLVPredictor {
  return new CLVPredictor(config);
}

// Default export
export default CLVPredictor;
