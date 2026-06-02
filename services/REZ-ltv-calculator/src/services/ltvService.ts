import { CustomerLTV, LTVScore, SegmentAnalysis, RevenueForecast } from '../types';
import logger from '../utils/logger';

export class LTVService {
  private modelVersion = '1.0.0';
  private defaultDiscountRate = 0.1;

  calculateLTV(customer: CustomerLTV): LTVScore {
    logger.info(`Calculating LTV for customer: ${customer.customerId}`);

    const discountRate = customer.discountRate ?? this.defaultDiscountRate;
    const historicalLTV = customer.historicalRevenue;
    const monthlyValue = customer.averageOrderValue * customer.orderFrequency;

    const baseRetentionRate = this.calculateRetentionRate(customer);
    const growthRate = this.calculateGrowthRate(customer);

    const predictedMonthlyValue = monthlyValue * (1 + growthRate);
    const churnRisk = this.calculateChurnRisk(customer);

    const projectedLTV12Months = this.projectLTV(predictedMonthlyValue, baseRetentionRate, 12, discountRate);
    const projectedLTV24Months = this.projectLTV(predictedMonthlyValue, baseRetentionRate, 24, discountRate);
    const projectedLTV36Months = this.projectLTV(predictedMonthlyValue, baseRetentionRate, 36, discountRate);

    const predictedLTV = (projectedLTV12Months + projectedLTV24Months + projectedLTV36Months) / 3;
    const segmentScore = this.determineSegment(predictedLTV, customer.orderFrequency, customer.customerTenure);
    const customerLifetimeMonths = this.estimateCustomerLifetime(baseRetentionRate);
    const confidence = this.calculateConfidence(customer);

    return {
      customerId: customer.customerId,
      historicalLTV: Math.round(historicalLTV * 100) / 100,
      predictedLTV: Math.round(predictedLTV * 100) / 100,
      projectedLTV12Months: Math.round(projectedLTV12Months * 100) / 100,
      projectedLTV24Months: Math.round(projectedLTV24Months * 100) / 100,
      projectedLTV36Months: Math.round(projectedLTV36Months * 100) / 100,
      segmentScore,
      customerLifetimeMonths: Math.round(customerLifetimeMonths * 10) / 10,
      monthlyValue: Math.round(monthlyValue * 100) / 100,
      churnRisk: Math.round(churnRisk * 1000) / 1000,
      growthRate: Math.round(growthRate * 1000) / 1000,
      confidence: Math.round(confidence * 100) / 100,
      modelVersion: this.modelVersion,
      calculatedAt: new Date().toISOString(),
    };
  }

  calculateSegmentAnalysis(customers: CustomerLTV[]): SegmentAnalysis[] {
    const segments: Record<string, CustomerLTV[]> = {
      platinum: [],
      gold: [],
      silver: [],
      bronze: [],
      standard: [],
    };

    customers.forEach(customer => {
      const ltv = this.calculateLTV(customer);
      segments[ltv.segmentScore].push(customer);
    });

    return (['platinum', 'gold', 'silver', 'bronze', 'standard'] as const).map(segment => {
      const segmentCustomers = segments[segment];
      if (segmentCustomers.length === 0) {
        return {
          segment,
          averageLTV: 0,
          averageTenure: 0,
          averageOrderFrequency: 0,
          retentionRate: 0,
          customerCount: 0,
          revenueShare: 0,
        };
      }

      const totalRevenue = segmentCustomers.reduce((sum, c) => sum + c.historicalRevenue, 0);
      const totalRevenueAll = customers.reduce((sum, c) => sum + c.historicalRevenue, 0);

      return {
        segment,
        averageLTV: totalRevenue / segmentCustomers.length,
        averageTenure: segmentCustomers.reduce((sum, c) => sum + c.customerTenure, 0) / segmentCustomers.length,
        averageOrderFrequency: segmentCustomers.reduce((sum, c) => sum + c.orderFrequency, 0) / segmentCustomers.length,
        retentionRate: this.calculateAverageRetention(segmentCustomers),
        customerCount: segmentCustomers.length,
        revenueShare: totalRevenueAll > 0 ? (totalRevenue / totalRevenueAll) * 100 : 0,
      };
    });
  }

  forecastRevenue(customers: CustomerLTV[], months: number = 12): RevenueForecast {
    const discountRate = this.defaultDiscountRate;
    let totalProjectedRevenue = 0;
    let totalChurnExpected = 0;
    let acquisitionNeeded = 0;

    customers.forEach(customer => {
      const ltv = this.calculateLTV(customer);
      const projectedRevenue = this.projectLTV(ltv.monthlyValue, 1 - ltv.churnRisk, months, discountRate);
      totalProjectedRevenue += projectedRevenue;

      const expectedChurnRate = Math.pow(ltv.churnRisk, months / 12);
      totalChurnExpected += expectedChurnRate;
    });

    const avgChurnRate = customers.length > 0 ? totalChurnExpected / customers.length : 0;
    const targetCustomers = customers.length * (1 + avgChurnRate * 0.5);
    acquisitionNeeded = Math.max(0, targetCustomers - customers.length);

    const confidenceFactor = 0.85;
    const lowRevenue = totalProjectedRevenue * (1 - confidenceFactor);
    const highRevenue = totalProjectedRevenue * (1 + confidenceFactor);

    return {
      period: `${months} months`,
      projectedRevenue: Math.round(totalProjectedRevenue * 100) / 100,
      confidenceInterval: {
        low: Math.round(lowRevenue * 100) / 100,
        high: Math.round(highRevenue * 100) / 100,
      },
      customerAcquisitionNeeded: Math.round(acquisitionNeeded),
      churnExpected: Math.round(avgChurnRate * 100 * 100) / 100,
    };
  }

  private calculateRetentionRate(customer: CustomerLTV): number {
    let baseRate = 0.85;

    if (customer.customerTenure > 24) {
      baseRate += 0.1;
    } else if (customer.customerTenure > 12) {
      baseRate += 0.05;
    }

    if (customer.orderFrequency > 4) {
      baseRate += 0.05;
    }

    if (customer.averageOrderValue > 200) {
      baseRate += 0.03;
    }

    return Math.min(baseRate, 0.99);
  }

  private calculateGrowthRate(customer: CustomerLTV): number {
    let growthRate = 0;

    if (customer.purchaseHistory && customer.purchaseHistory.length >= 3) {
      const recentPurchases = customer.purchaseHistory.slice(-3);
      const avgRecentAmount = recentPurchases.reduce((sum, p) => sum + p.amount, 0) / recentPurchases.length;
      const firstPurchase = customer.purchaseHistory[0].amount;

      if (firstPurchase > 0) {
        growthRate = (avgRecentAmount - firstPurchase) / firstPurchase / customer.purchaseHistory.length;
      }
    }

    if (customer.segment === 'active') {
      growthRate += 0.02;
    } else if (customer.segment === 'at-risk') {
      growthRate -= 0.05;
    }

    return Math.max(Math.min(growthRate, 0.5), -0.3);
  }

  private calculateChurnRisk(customer: CustomerLTV): number {
    let risk = 0.1;

    if (customer.customerTenure < 6) {
      risk += 0.15;
    }

    if (customer.orderFrequency < 1) {
      risk += 0.2;
    }

    if (customer.segment === 'at-risk') {
      risk += 0.3;
    } else if (customer.segment === 'churned') {
      risk += 0.5;
    } else if (customer.segment === 'new') {
      risk += 0.1;
    }

    return Math.min(risk, 0.95);
  }

  private projectLTV(monthlyValue: number, retentionRate: number, months: number, discountRate: number): number {
    let totalLTV = 0;
    for (let i = 1; i <= months; i++) {
      const discountFactor = 1 / Math.pow(1 + discountRate, i / 12);
      const survivalProbability = Math.pow(retentionRate, i);
      totalLTV += monthlyValue * survivalProbability * discountFactor;
    }
    return totalLTV;
  }

  private determineSegment(
    predictedLTV: number,
    orderFrequency: number,
    tenure: number
  ): 'platinum' | 'gold' | 'silver' | 'bronze' | 'standard' {
    if (predictedLTV >= 10000 && orderFrequency >= 4 && tenure >= 24) {
      return 'platinum';
    }
    if (predictedLTV >= 5000 && orderFrequency >= 3 && tenure >= 12) {
      return 'gold';
    }
    if (predictedLTV >= 2000 && orderFrequency >= 2 && tenure >= 6) {
      return 'silver';
    }
    if (predictedLTV >= 500 || tenure >= 3) {
      return 'bronze';
    }
    return 'standard';
  }

  private estimateCustomerLifetime(retentionRate: number): number {
    if (retentionRate >= 1) return 120;
    return -1 / Math.log(retentionRate);
  }

  private calculateConfidence(customer: CustomerLTV): number {
    let confidence = 0.5;

    if (customer.purchaseHistory && customer.purchaseHistory.length >= 5) {
      confidence += 0.2;
    } else if (customer.purchaseHistory && customer.purchaseHistory.length >= 3) {
      confidence += 0.1;
    }

    if (customer.customerTenure >= 12) {
      confidence += 0.15;
    } else if (customer.customerTenure >= 6) {
      confidence += 0.1;
    }

    if (customer.segment) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95);
  }

  private calculateAverageRetention(customers: CustomerLTV[]): number {
    if (customers.length === 0) return 0;
    const totalRetention = customers.reduce((sum, c) => sum + this.calculateRetentionRate(c), 0);
    return totalRetention / customers.length;
  }

  getModelVersion(): string {
    return this.modelVersion;
  }
}

export const ltvService = new LTVService();
