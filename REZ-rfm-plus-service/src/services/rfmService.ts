/**
 * RFM++ Service
 * Advanced customer segmentation beyond RFM
 */

import { CustomerProfile, Segment, AnalyticsSnapshot } from '../models';

interface Transaction {
  customerId: string;
  amount: number;
  date: Date;
  orderId: string;
}

class RFMService {
  /**
   * Calculate RFM for customer
   */
  async calculateRFM(customerId: string, transactions: Transaction[]): Promise<{
    rfm: { recency: number; frequency: number; monetary: number };
    score: { r: number; f: number; m: number; total: number };
  }> {
    if (transactions.length === 0) {
      return {
        rfm: { recency: 0, frequency: 0, monetary: 0 },
        score: { r: 1, f: 1, m: 1, total: 3 },
      };
    }

    const now = new Date();
    const sorted = transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Recency: Days since last purchase
    const recency = Math.floor(
      (now.getTime() - sorted[0].date.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Frequency: Total transactions
    const frequency = transactions.length;

    // Monetary: Total spend
    const monetary = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Calculate scores (1-5)
    // Recency: Lower is better (1=90+ days, 5=<7 days)
    const rScore = recency < 7 ? 5 : recency < 30 ? 4 : recency < 60 ? 3 : recency < 90 ? 2 : 1;

    // Frequency: Higher is better
    const fScore = frequency >= 10 ? 5 : frequency >= 7 ? 4 : frequency >= 5 ? 3 : frequency >= 3 ? 2 : 1;

    // Monetary: Higher is better (adjust thresholds based on your average order value)
    const avgOrder = monetary / frequency;
    const mScore = avgOrder >= 5000 ? 5 : avgOrder >= 3000 ? 4 : avgOrder >= 1500 ? 3 : avgOrder >= 500 ? 2 : 1;

    return {
      rfm: { recency, frequency, monetary },
      score: { r: rScore, f: fScore, m: mScore, total: rScore + fScore + mScore },
    };
  }

  /**
   * Update customer profile with RFM
   */
  async updateCustomerRFM(customerId: string, transactions: Transaction[]): Promise<void> {
    const { rfm, score } = await this.calculateRFM(customerId, transactions);

    await CustomerProfile.findOneAndUpdate(
      { customerId },
      {
        $set: {
          'rfm': rfm,
          'rfmScore': score,
          'stats.totalOrders': transactions.length,
          'stats.totalSpend': rfm.monetary,
          'stats.avgOrderValue': transactions.length > 0 ? rfm.monetary / transactions.length : 0,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  /**
   * Assign segment based on RFM score
   */
  async assignSegment(customerId: string): Promise<string> {
    const customer = await CustomerProfile.findOne({ customerId });
    if (!customer) return 'unknown';

    const total = customer.rfmScore?.total || 0;
    const r = customer.rfmScore?.r || 1;

    // Champions: High all 3 (13-15)
    if (total >= 13) return 'champions';
    // Loyal: High frequency and monetary (9-15)
    if (customer.rfmScore?.f >= 4 && customer.rfmScore?.m >= 4) return 'loyal_customers';
    // Potential Loyalist: Recent + decent frequency (9-12)
    if (r >= 4 && total >= 9) return 'potential_loyalist';
    // Promising: Recent + some engagement (6-8)
    if (r >= 3 && total >= 6) return 'promising';
    // Needs Attention: Middle of the road (6-9)
    if (total >= 6 && total <= 9) return 'needs_attention';
    // At Risk: Haven't purchased recently (5-7)
    if (r <= 2 && total >= 5) return 'at_risk';
    // Can't Lose Them: High past value but churned (5-7)
    if (customer.rfmScore?.m >= 4 && r <= 2) return 'cant_lose_them';
    // Churned: Lowest scores (3-5)
    return 'churned';
  }

  /**
   * Predict LTV
   */
  async predictLTV(customerId: string): Promise<{ ltv: number; confidence: number }> {
    const customer = await CustomerProfile.findOne({ customerId });
    if (!customer) return { ltv: 0, confidence: 0 };

    const { frequency, monetary } = customer.rfm || { frequency: 1, monetary: 0 };
    const daysSinceFirst = customer.lifecycle?.daysSinceFirstPurchase || 365;

    // Simple LTV = (monthly spend) × (expected months)
    const monthlySpend = monetary / (daysSinceFirst / 30);
    const expectedMonths = 24; // 2 year retention
    const ltv = monthlySpend * expectedMonths;

    // Confidence based on data quality
    const confidence = Math.min(1, frequency / 10); // More purchases = more confidence

    return { ltv, confidence };
  }

  /**
   * Detect churn risk
   */
  async detectChurnRisk(customerId: string): Promise<{ risk: string; score: number }> {
    const customer = await CustomerProfile.findOne({ customerId });
    if (!customer) return { risk: 'unknown', score: 0 };

    let riskScore = 0;
    const reasons: string[] = [];

    // Check recency
    const recency = customer.rfm?.recency || 999;
    if (recency > 90) {
      riskScore += 30;
      reasons.push('90+ days inactive');
    } else if (recency > 60) {
      riskScore += 20;
      reasons.push('60+ days inactive');
    }

    // Check engagement drop
    const engagement = customer.engagement;
    if (engagement?.lastActive) {
      const daysInactive = (Date.now() - new Date(engagement.lastActive).getTime()) / (1000 * 60 * 60 * 24);
      if (daysInactive > 30) riskScore += 25;
    }

    // Check support tickets
    if ((customer.stats?.supportTickets || 0) > 3) {
      riskScore += 15;
      reasons.push('Multiple support tickets');
    }

    // Check refunds
    const refundRate = customer.stats?.returns || 0;
    const totalOrders = customer.stats?.totalOrders || 1;
    if (refundRate / totalOrders > 0.2) {
      riskScore += 20;
      reasons.push('High refund rate');
    }

    // Determine risk level
    let risk: string;
    if (riskScore >= 50) risk = 'critical';
    else if (riskScore >= 30) risk = 'high';
    else if (riskScore >= 15) risk = 'medium';
    else risk = 'low';

    return { risk, score: riskScore };
  }

  /**
   * Get cohort analysis
   */
  async analyzeCohort(cohortDate: Date): Promise<unknown> {
    const startOfMonth = new Date(cohortDate.getFullYear(), cohortDate.getMonth(), 1);
    const endOfMonth = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + 1, 0);

    const customers = await CustomerProfile.find({
      'cohort.acquisitionDate': {
        $gte: startOfMonth,
        $lte: endOfMonth,
      },
    });

    const cohortSize = customers.length;
    if (cohortSize === 0) return null;

    // Calculate retention for each month
    const retention: { month: number; date: string; retained: number; retentionRate: string }[] = [];
    const now = new Date();
    const msPerMonth = 30 * 24 * 60 * 60 * 1000;
    const months = Math.min(12, Math.floor((now.getTime() - cohortDate.getTime()) / msPerMonth));

    for (let i = 0; i <= months; i++) {
      const monthDate = new Date(cohortDate);
      monthDate.setMonth(monthDate.getMonth() + i);

      const activeCustomers = customers.filter(c => {
        const lastActivity = new Date(c.lifecycle?.daysSinceLastActivity || 0);
        return lastActivity >= monthDate;
      }).length;

      retention.push({
        month: i,
        date: monthDate.toISOString().slice(0, 7),
        retained: activeCustomers,
        retentionRate: (activeCustomers / cohortSize * 100).toFixed(2),
      });
    }

    return {
      cohortDate: cohortDate.toISOString().slice(0, 7),
      cohortSize,
      retention,
      avgLTV: customers.reduce((sum, c) => sum + (c.ltv?.actual || 0), 0) / cohortSize,
    };
  }

  /**
   * Batch update all customers
   */
  async recalculateAll(): Promise<{ processed: number }> {
    // Get unique customer IDs from recent transactions
    // This would integrate with order service in production
    const customers = await CustomerProfile.find({}, { customerId: 1 });
    let processed = 0;

    for (const customer of customers) {
      // In production, fetch actual transactions
      const transactions: Transaction[] = [];
      await this.updateCustomerRFM(customer.customerId, transactions);
      await this.assignSegment(customer.customerId);
      processed++;
    }

    return { processed };
  }
}

export const rfmService = new RFMService();
