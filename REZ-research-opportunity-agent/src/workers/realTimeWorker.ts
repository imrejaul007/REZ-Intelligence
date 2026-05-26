import { businessAnalysisService, alertService } from '../services/index.js';
import { THRESHOLDS } from '../constants/thresholds.js';
import logger from './utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { AlertSeverity, AlertType } from '../types/index.js';

const log = logger.child({ context: 'RealTimeWorker' });

interface AnomalyCheck {
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  severity: AlertSeverity;
}

interface RealTimeCheck {
  id: string;
  checkedAt: Date;
  anomalies: AnomalyCheck[];
  alertsCreated: number;
  status: 'success' | 'failed';
  error?: string;
}

class RealTimeWorker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private checks: Record<string, RealTimeCheck> = {} as Record<string, RealTimeCheck>;
  private isRunning: boolean = false;

  async start(intervalMs: number = 300000): Promise<void> {
    if (this.isRunning) {
      log.warn('Real-time worker already running');
      return;
    }

    log.info('Starting real-time worker', { intervalMs });

    // Run immediately on start
    await this.runCheck();

    // Then run at the specified interval
    this.intervalId = setInterval(async () => {
      await this.runCheck();
    }, intervalMs);

    this.isRunning = true;
    log.info('Real-time worker started');
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    log.info('Real-time worker stopped');
  }

  async runCheck(): Promise<RealTimeCheck> {
    const check: RealTimeCheck = {
      id: uuidv4(),
      checkedAt: new Date(),
      anomalies: [],
      alertsCreated: 0,
      status: 'success',
    };

    this.checks[check.id] = check;
    log.debug('Running real-time check', { checkId: check.id });

    try {
      // Get current business metrics
      const businessData = await businessAnalysisService.analyze({});
      const purchasePatterns = businessData.purchasePatterns[0];

      if (purchasePatterns) {
        // Check for revenue anomalies
        await this.checkRevenueAnomaly(check, purchasePatterns);

        // Check for order anomalies
        await this.checkOrderAnomaly(check, purchasePatterns);
      }

      // Check customer behavior anomalies
      for (const segment of businessData.customerBehavior) {
        await this.checkChurnAnomaly(check, segment);
      }

      // Check channel anomalies
      for (const channel of businessData.channelEffectiveness) {
        await this.checkChannelAnomaly(check, channel);
      }

      // Check product performance anomalies
      for (const product of businessData.productPerformance) {
        await this.checkProductAnomaly(check, product);
      }

      log.debug('Real-time check completed', {
        checkId: check.id,
        anomaliesCount: check.anomalies.length,
      });
    } catch (error) {
      check.status = 'failed';
      check.error = (error as Error).message;
      log.error('Real-time check failed', { checkId: check.id, error: check.error });
    }

    this.checks[check.id] = check;
    return check;
  }

  private async checkRevenueAnomaly(
    check: RealTimeCheck,
    patterns: { totalRevenue: number; avgOrderValue: number }
  ): Promise<void> {
    // Mock expected values (in production, these would come from historical data)
    const expectedRevenue = patterns.totalRevenue * 1.1; // 10% higher as baseline
    const deviation = (patterns.totalRevenue - expectedRevenue) / expectedRevenue;

    if (
      deviation < THRESHOLDS.REVENUE.DAILY_CHANGE_MIN ||
      deviation > THRESHOLDS.REVENUE.DAILY_CHANGE_MAX
    ) {
      const anomaly: AnomalyCheck = {
        metric: 'Revenue',
        currentValue: patterns.totalRevenue,
        expectedValue: expectedRevenue,
        deviation,
        severity: Math.abs(deviation) > 0.25 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      };

      check.anomalies.push(anomaly);

      await alertService.createAnomalyAlert(
        'Revenue',
        patterns.totalRevenue,
        expectedRevenue,
        deviation
      );
      check.alertsCreated++;
    }
  }

  private async checkOrderAnomaly(
    check: RealTimeCheck,
    patterns: { totalOrders: number; repeatPurchaseRate: number }
  ): Promise<void> {
    const expectedOrders = patterns.totalOrders * 1.05;
    const deviation = (patterns.totalOrders - expectedOrders) / expectedOrders;

    if (
      deviation < -THRESHOLDS.ORDERS.DAILY_DROP_MIN ||
      deviation > THRESHOLDS.ORDERS.DAILY_SPIKE_MAX - 1
    ) {
      const anomaly: AnomalyCheck = {
        metric: 'Orders',
        currentValue: patterns.totalOrders,
        expectedValue: expectedOrders,
        deviation,
        severity: Math.abs(deviation) > 0.3 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      };

      check.anomalies.push(anomaly);

      await alertService.createAnomalyAlert(
        'Total Orders',
        patterns.totalOrders,
        expectedOrders,
        deviation
      );
      check.alertsCreated++;
    }

    // Check repeat purchase rate
    if (patterns.repeatPurchaseRate < THRESHOLDS.ENGAGEMENT.RETENTION_30D_MIN) {
      const anomaly: AnomalyCheck = {
        metric: 'Repeat Purchase Rate',
        currentValue: patterns.repeatPurchaseRate * 100,
        expectedValue: THRESHOLDS.ENGAGEMENT.RETENTION_30D_MIN * 100,
        deviation: patterns.repeatPurchaseRate - THRESHOLDS.ENGAGEMENT.RETENTION_30D_MIN,
        severity: AlertSeverity.MEDIUM,
      };

      check.anomalies.push(anomaly);
      check.alertsCreated++;
    }
  }

  private async checkChurnAnomaly(
    check: RealTimeCheck,
    segment: { segmentName: string; churnRate: number }
  ): Promise<void> {
    if (segment.churnRate > THRESHOLDS.CUSTOMERS.CHURN_RATE_WARNING) {
      const severity =
        segment.churnRate > THRESHOLDS.CUSTOMERS.CHURN_RATE_CRITICAL
          ? AlertSeverity.HIGH
          : AlertSeverity.MEDIUM;

      const anomaly: AnomalyCheck = {
        metric: `Churn Rate - ${segment.segmentName}`,
        currentValue: segment.churnRate * 100,
        expectedValue: THRESHOLDS.CUSTOMERS.CHURN_RATE_WARNING * 100,
        deviation: segment.churnRate - THRESHOLDS.CUSTOMERS.CHURN_RATE_WARNING,
        severity,
      };

      check.anomalies.push(anomaly);

      await alertService.create({
        type: AlertType.ANOMALY,
        severity,
        title: `High Churn Rate: ${segment.segmentName}`,
        description: `${segment.segmentName} segment has a churn rate of ${(segment.churnRate * 100).toFixed(1)}%, above the warning threshold.`,
        data: {
          segment: segment.segmentName,
          churnRate: segment.churnRate,
          threshold: THRESHOLDS.CUSTOMERS.CHURN_RATE_WARNING,
        },
      });
      check.alertsCreated++;
    }
  }

  private async checkChannelAnomaly(
    check: RealTimeCheck,
    channel: { channel: string; conversionRate: number; ctr: number }
  ): Promise<void> {
    if (channel.conversionRate < THRESHOLDS.CHANNELS.CONVERSION_MIN) {
      const anomaly: AnomalyCheck = {
        metric: `Conversion - ${channel.channel}`,
        currentValue: channel.conversionRate * 100,
        expectedValue: THRESHOLDS.CHANNELS.CONVERSION_MIN * 100,
        deviation: channel.conversionRate - THRESHOLDS.CHANNELS.CONVERSION_MIN,
        severity: AlertSeverity.LOW,
      };

      check.anomalies.push(anomaly);
      check.alertsCreated++;
    }

    if (channel.ctr < THRESHOLDS.CHANNELS.CTR_MIN) {
      const anomaly: AnomalyCheck = {
        metric: `CTR - ${channel.channel}`,
        currentValue: channel.ctr * 100,
        expectedValue: THRESHOLDS.CHANNELS.CTR_MIN * 100,
        deviation: channel.ctr - THRESHOLDS.CHANNELS.CTR_MIN,
        severity: AlertSeverity.LOW,
      };

      check.anomalies.push(anomaly);
      check.alertsCreated++;
    }
  }

  private async checkProductAnomaly(
    check: RealTimeCheck,
    product: { name: string; returnRate?: number; growthRate: number }
  ): Promise<void> {
    if (product.returnRate && product.returnRate > THRESHOLDS.PRODUCTS.RETURN_RATE_WARNING) {
      const severity =
        product.returnRate > THRESHOLDS.PRODUCTS.RETURN_RATE_CRITICAL
          ? AlertSeverity.HIGH
          : AlertSeverity.MEDIUM;

      const anomaly: AnomalyCheck = {
        metric: `Return Rate - ${product.name}`,
        currentValue: product.returnRate * 100,
        expectedValue: THRESHOLDS.PRODUCTS.RETURN_RATE_WARNING * 100,
        deviation: product.returnRate - THRESHOLDS.PRODUCTS.RETURN_RATE_WARNING,
        severity,
      };

      check.anomalies.push(anomaly);

      await alertService.create({
        type: AlertType.ANOMALY,
        severity,
        title: `High Return Rate: ${product.name}`,
        description: `${product.name} has a return rate of ${(product.returnRate * 100).toFixed(1)}%, indicating potential quality or expectation issues.`,
        data: {
          product: product.name,
          returnRate: product.returnRate,
          threshold: THRESHOLDS.PRODUCTS.RETURN_RATE_WARNING,
        },
      });
      check.alertsCreated++;
    }

    if (product.growthRate < -THRESHOLDS.PRODUCTS.SALES_DROP_MIN) {
      const anomaly: AnomalyCheck = {
        metric: `Sales Decline - ${product.name}`,
        currentValue: product.growthRate * 100,
        expectedValue: 0,
        deviation: product.growthRate,
        severity: AlertSeverity.MEDIUM,
      };

      check.anomalies.push(anomaly);
      check.alertsCreated++;
    }
  }

  getCheckStatus(checkId: string): RealTimeCheck | undefined {
    return this.checks[checkId];
  }

  getRecentChecks(limit: number = 20): RealTimeCheck[] {
    return Object.values(this.checks)
      .sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime())
      .slice(0, limit);
  }

  getCurrentStatus(): {
    isRunning: boolean;
    lastCheck?: RealTimeCheck;
    checksLastHour: number;
    anomaliesLastHour: number;
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentChecks = this.getRecentChecks(100).filter(
      (c) => c.checkedAt >= oneHourAgo
    );

    return {
      isRunning: this.isRunning,
      lastCheck: recentChecks[0],
      checksLastHour: recentChecks.length,
      anomaliesLastHour: recentChecks.reduce((sum, c) => sum + c.anomalies.length, 0),
    };
  }

  cleanup(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const [id, check] of Object.entries(this.checks)) {
      if (check.checkedAt < oneDayAgo) {
        delete this.checks[id];
      }
    }

    log.debug('Real-time worker cleanup completed', {
      remainingChecks: Object.keys(this.checks).length,
    });
  }
}

export const realTimeWorker = new RealTimeWorker();
export default realTimeWorker;
