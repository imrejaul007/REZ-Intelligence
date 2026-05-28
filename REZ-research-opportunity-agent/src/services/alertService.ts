import { v4 as uuidv4 } from 'uuid';
import {
  Alert,
  AlertType,
  AlertSeverity,
} from '../types/index.js';
import { AlertModel, IAlertDocument } from '../models/Alert.js';
import { cacheGet, cacheSet, cacheDelete } from '../utils/redis.js';
import { CACHE_TTL, THRESHOLDS } from '../constants/thresholds.js';
import logger from '../utils/logger.js';

const log = logger.child({ context: 'AlertService' });

class AlertService {
  async create(alert: Omit<Alert, 'id' | 'createdAt' | 'acknowledged'>): Promise<Alert> {
    const id = uuidv4();
    const createdAt = new Date();

    const newAlert: Alert = {
      id,
      ...alert,
      acknowledged: false,
      createdAt,
    };

    await AlertModel.create({
      ...newAlert,
      data: newAlert.data || {},
    });

    // Invalidate cache
    await cacheDelete('alerts:*');

    log.info('Alert created', { id, type: alert.type, severity: alert.severity, title: alert.title });
    return newAlert;
  }

  async findById(id: string): Promise<Alert | null> {
    const cacheKey = `alert:${id}`;
    const cached = await cacheGet<Alert>(cacheKey);
    if (cached) {
      return cached;
    }

    const doc = await AlertModel.findOne({ id }).exec();
    if (!doc) {
      return null;
    }

    const alert = this.documentToAlert(doc);
    await cacheSet(cacheKey, alert, CACHE_TTL.ALERTS);

    return alert;
  }

  async findAll(options: {
    acknowledged?: boolean;
    severity?: AlertSeverity;
    type?: AlertType;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ alerts: Alert[]; total: number }> {
    const { acknowledged, severity, type, limit = 50, offset = 0 } = options;

    const filter: Record<string, unknown> = {};
    if (acknowledged !== undefined) filter.acknowledged = acknowledged;
    if (severity) filter.severity = severity;
    if (type) filter.type = type;

    const [docs, total] = await Promise.all([
      AlertModel.find(filter)
        .sort({ severity: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      AlertModel.countDocuments(filter).exec(),
    ]);

    const alerts = docs.map((doc) => this.documentToAlert(doc));
    return { alerts, total };
  }

  async findActive(): Promise<Alert[]> {
    const docs = await AlertModel.findActive().exec();
    return docs.map((doc) => this.documentToAlert(doc));
  }

  async findCritical(): Promise<Alert[]> {
    const docs = await AlertModel.findCritical().exec();
    return docs.map((doc) => this.documentToAlert(doc));
  }

  async acknowledge(id: string, acknowledgedBy: string): Promise<Alert | null> {
    const doc = await AlertModel.findOne({ id }).exec();
    if (!doc) {
      return null;
    }

    doc.acknowledge(acknowledgedBy);
    await doc.save();

    await cacheDelete(`alert:${id}`);
    await cacheDelete('alerts:*');

    log.info('Alert acknowledged', { id, acknowledgedBy });
    return this.documentToAlert(doc);
  }

  async acknowledgeAll(acknowledgedBy: string): Promise<number> {
    const result = await AlertModel.updateMany(
      { acknowledged: false },
      {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy,
      }
    );

    await cacheDelete('alerts:*');

    log.info('All alerts acknowledged', { count: result.modifiedCount, acknowledgedBy });
    return result.modifiedCount;
  }

  async delete(id: string): Promise<boolean> {
    const result = await AlertModel.deleteOne({ id }).exec();
    if (result.deletedCount === 0) {
      return false;
    }

    await cacheDelete(`alert:${id}`);
    await cacheDelete('alerts:*');

    log.info('Alert deleted', { id });
    return true;
  }

  async getStats(): Promise<{
    total: number;
    unacknowledged: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
    recentCount: number;
  }> {
    const [countsBySeverity, countsByType, unacknowledgedCount, total, recentAlerts] =
      await Promise.all([
        AlertModel.countBySeverity(),
        AlertModel.aggregate([
          { $match: { acknowledged: false } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
        AlertModel.countUnacknowledged().exec(),
        AlertModel.countDocuments().exec(),
        AlertModel.findRecent(24 * 7).exec(),
      ]);

    return {
      total,
      unacknowledged: unacknowledgedCount,
      bySeverity: countsBySeverity,
      byType: Object.fromEntries(
        countsByType.map((item: { _id: string; count: number }) => [item._id, item.count])
      ) as Record<AlertType, number>,
      recentCount: recentAlerts.length,
    };
  }

  // Alert creation helpers for different scenarios
  async createAnomalyAlert(
    metric: string,
    value: number,
    expectedValue: number,
    deviation: number
  ): Promise<Alert | null> {
    // Check cooldown to prevent spam
    const recentAlerts = await AlertModel.find({
      type: AlertType.ANOMALY,
      createdAt: { $gte: new Date(Date.now() - THRESHOLDS.ALERTS.HIGH_COOLDOWN * 1000) },
    }).exec();

    if (recentAlerts.length > 0) {
      log.debug('Anomaly alert suppressed due to cooldown');
      return null;
    }

    const severity = Math.abs(deviation) > 0.3 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;

    return this.create({
      type: AlertType.ANOMALY,
      severity,
      title: `Anomaly Detected: ${metric}`,
      description: `${metric} is ${deviation > 0 ? 'above' : 'below'} expected by ${Math.abs(deviation * 100).toFixed(1)}%`,
      data: {
        metric,
        value,
        expectedValue,
        deviation,
        threshold: THRESHOLDS.REVENUE.DAILY_CHANGE_MAX,
      },
    });
  }

  async createTrendAlert(
    trend: string,
    direction: 'up' | 'down',
    significance: number
  ): Promise<Alert> {
    const severity =
      significance > THRESHOLDS.MARKET.TREND_SIGNIFICANCE_MIN
        ? AlertSeverity.HIGH
        : AlertSeverity.MEDIUM;

    return this.create({
      type: AlertType.TREND,
      severity,
      title: `Significant Trend: ${trend}`,
      description: `${trend} is showing a ${direction === 'up' ? 'positive' : 'negative'} trend with ${(significance * 100).toFixed(1)}% significance`,
      data: { trend, direction, significance },
    });
  }

  async createCompetitorAlert(
    competitorName: string,
    change: string,
    impact: string
  ): Promise<Alert> {
    return this.create({
      type: AlertType.COMPETITOR,
      severity: AlertSeverity.MEDIUM,
      title: `Competitor Activity: ${competitorName}`,
      description: `${competitorName} has made a ${change}. Expected impact: ${impact}`,
      data: { competitorName, change, impact },
    });
  }

  async createOpportunityAlert(
    opportunityTitle: string,
    opportunityId: string,
    confidence: number
  ): Promise<Alert> {
    const severity =
      confidence >= THRESHOLDS.OPPORTUNITY.HIGH_IMPACT_MIN
        ? AlertSeverity.HIGH
        : AlertSeverity.LOW;

    return this.create({
      type: AlertType.OPPORTUNITY,
      severity,
      title: `New Opportunity Identified`,
      description: `${opportunityTitle} - Confidence: ${confidence}%`,
      data: { opportunityTitle, opportunityId, confidence },
    });
  }

  async createRiskAlert(
    risk: string,
    probability: number,
    impact: 'low' | 'medium' | 'high'
  ): Promise<Alert> {
    const severityMap: Record<string, AlertSeverity> = { low: AlertSeverity.LOW, medium: AlertSeverity.MEDIUM, high: AlertSeverity.HIGH };
    const severity = severityMap[impact];

    return this.create({
      type: AlertType.RISK,
      severity,
      title: `Risk Alert: ${risk}`,
      description: `Risk probability: ${(probability * 100).toFixed(1)}%, Impact: ${impact}`,
      data: { risk, probability, impact },
    });
  }

  private documentToAlert(doc: IAlertDocument): Alert {
    return {
      id: doc.id,
      type: doc.type,
      severity: doc.severity,
      title: doc.title,
      description: doc.description,
      data: typeof doc.data === 'object' && doc.data !== null ? doc.data as Record<string, unknown> : {},
      acknowledged: doc.acknowledged,
      acknowledgedAt: doc.acknowledgedAt,
      acknowledgedBy: doc.acknowledgedBy,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    };
  }
}

export const alertService = new AlertService();
export default alertService;
