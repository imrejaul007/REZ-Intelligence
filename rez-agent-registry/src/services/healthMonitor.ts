import axios, { AxiosInstance } from 'axios';
import cron from 'node-cron';
import { Registry, ExpertInfo } from './registry';
import { logger } from './logger';

export interface HealthCheckResult {
  expertId: string;
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
  checkedAt: string;
}

export interface HealthMonitorConfig {
  registry: Registry;
  healthCheckIntervalSeconds: number;
  timeoutMs: number;
  maxConsecutiveFailures: number;
  enableCronSchedule: boolean;
  cronSchedule?: string;
}

export class HealthMonitor {
  private registry: Registry;
  private config: HealthMonitorConfig;
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private isRunning: boolean = false;
  private cronJob?: cron.ScheduledTask;
  private intervalTimer?: NodeJS.Timeout;

  constructor(config: HealthMonitorConfig) {
    this.registry = config.registry;
    this.config = config;
  }

  /**
   * Start the health monitor
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Health monitor starting', {
      intervalSeconds: this.config.healthCheckIntervalSeconds,
      enableCron: this.config.enableCronSchedule,
    });

    if (this.config.enableCronSchedule && this.config.cronSchedule) {
      this.startCronScheduler();
    } else {
      this.startIntervalScheduler();
    }
  }

  /**
   * Start interval-based health checks
   */
  private startIntervalScheduler(): void {
    const runChecks = async () => {
      if (!this.isRunning) return;

      try {
        await this.checkAllExperts();
      } catch (error) {
        logger.error('Health check cycle failed', { error: error instanceof Error ? error.message : 'Unknown' });
      }

      if (this.isRunning) {
        this.intervalTimer = setTimeout(runChecks, this.config.healthCheckIntervalSeconds * 1000);
      }
    };

    // Run initial check
    runChecks();
  }

  /**
   * Start cron-based health checks
   */
  private startCronScheduler(): void {
    if (!this.config.cronSchedule) return;

    this.cronJob = cron.schedule(this.config.cronSchedule, async () => {
      logger.info('Running scheduled health check');
      try {
        await this.checkAllExperts();
      } catch (error) {
        logger.error('Scheduled health check failed', { error: error instanceof Error ? error.message : 'Unknown' });
      }
    });

    logger.info('Cron health check scheduled', { schedule: this.config.cronSchedule });
  }

  /**
   * Stop the health monitor
   */
  stop(): void {
    this.isRunning = false;

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }

    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer);
      this.intervalTimer = undefined;
    }

    logger.info('Health monitor stopped');
  }

  /**
   * Check health of all registered experts
   */
  async checkAllExperts(): Promise<HealthCheckResult[]> {
    const experts = await this.registry.getAllExperts();
    const results: HealthCheckResult[] = [];

    logger.info('Starting health check cycle', { expertCount: experts.length });

    for (const expert of experts) {
      const result = await this.checkExpert(expert);
      results.push(result);
    }

    // Log summary
    const healthyCount = results.filter(r => r.healthy).length;
    logger.info('Health check cycle completed', {
      total: results.length,
      healthy: healthyCount,
      unhealthy: results.length - healthyCount,
    });

    return results;
  }

  /**
   * Check health of a single expert
   */
  async checkExpert(expert: ExpertInfo): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      expertId: expert.id,
      healthy: false,
      responseTimeMs: 0,
      checkedAt: new Date().toISOString(),
    };

    try {
      // Create HTTP client with timeout
      const client = axios.create({
        timeout: this.config.timeoutMs,
      });

      // Make health check request
      await client.get(expert.endpoints.health);

      result.responseTimeMs = Date.now() - startTime;
      result.healthy = true;

      // Update registry with successful heartbeat
      await this.registry.updateHeartbeat(expert.id, {
        avgResponseTimeMs: result.responseTimeMs,
      });

      // Reset consecutive failures
      this.consecutiveFailures.set(expert.id, 0);

      // Update history
      this.addToHistory(result);

      logger.debug('Expert health check passed', {
        expertId: expert.id,
        name: expert.name,
        responseTimeMs: result.responseTimeMs,
      });

    } catch (error) {
      result.responseTimeMs = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : 'Unknown error';

      // Increment consecutive failures
      const failures = (this.consecutiveFailures.get(expert.id) || 0) + 1;
      this.consecutiveFailures.set(expert.id, failures);

      // Update registry with failure
      await this.registry.updateExpertStatus(
        expert.id,
        failures >= this.config.maxConsecutiveFailures ? 'error' : 'active',
        result.error
      );

      // Update history
      this.addToHistory(result);

      logger.warn('Expert health check failed', {
        expertId: expert.id,
        name: expert.name,
        consecutiveFailures: failures,
        error: result.error,
      });

      // Trigger alert if max failures reached
      if (failures >= this.config.maxConsecutiveFailures) {
        this.triggerAlert(expert, failures);
      }
    }

    return result;
  }

  /**
   * Check health of a specific expert by ID
   */
  async checkExpertById(expertId: string): Promise<HealthCheckResult | null> {
    const expert = await this.registry.getExpert(expertId);

    if (!expert) {
      logger.warn('Expert not found for health check', { expertId });
      return null;
    }

    return this.checkExpert(expert);
  }

  /**
   * Get health history for an expert
   */
  getHealthHistory(expertId: string, limit: number = 100): HealthCheckResult[] {
    const history = this.healthHistory.get(expertId) || [];
    return history.slice(-limit);
  }

  /**
   * Get overall health status
   */
  async getOverallHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    totalExperts: number;
    healthyCount: number;
    unhealthyCount: number;
    avgResponseTimeMs: number;
    byType: Record<string, { total: number; healthy: number }>;
  }> {
    const experts = await this.registry.getAllExperts();

    const healthyCount = experts.filter(e => e.health.healthy).length;
    const unhealthyCount = experts.length - healthyCount;

    const totalResponseTime = experts.reduce((sum, e) => sum + (e.health.responseTimeMs || 0), 0);

    const byType: Record<string, { total: number; healthy: number }> = {};
    for (const expert of experts) {
      if (!byType[expert.type]) {
        byType[expert.type] = { total: 0, healthy: 0 };
      }
      byType[expert.type].total++;
      if (expert.health.healthy) {
        byType[expert.type].healthy++;
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (experts.length === 0) {
      status = 'healthy';
    } else if (unhealthyCount === 0) {
      status = 'healthy';
    } else if (unhealthyCount < experts.length * 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      totalExperts: experts.length,
      healthyCount,
      unhealthyCount,
      avgResponseTimeMs: experts.length > 0 ? totalResponseTime / experts.length : 0,
      byType,
    };
  }

  /**
   * Add result to history
   */
  private addToHistory(result: HealthCheckResult): void {
    const history = this.healthHistory.get(result.expertId) || [];

    history.push(result);

    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.shift();
    }

    this.healthHistory.set(result.expertId, history);
  }

  /**
   * Trigger alert for failing expert
   */
  private triggerAlert(expert: ExpertInfo, consecutiveFailures: number): void {
    logger.error('EXPERT ALERT: Max consecutive failures reached', {
      expertId: expert.id,
      name: expert.name,
      type: expert.type,
      consecutiveFailures,
      endpoints: expert.endpoints,
    });

    // In production, this would:
    // - Send notification (Slack, PagerDuty, etc.)
    // - Create incident ticket
    // - Trigger auto-remediation
  }

  /**
   * Get consecutive failure count for an expert
   */
  getConsecutiveFailures(expertId: string): number {
    return this.consecutiveFailures.get(expertId) || 0;
  }

  /**
   * Reset failure count for an expert
   */
  resetFailureCount(expertId: string): void {
    this.consecutiveFailures.set(expertId, 0);
  }

  /**
   * Get health monitor status
   */
  getStatus(): {
    running: boolean;
    expertCount: number;
    maxConsecutiveFailures: number;
    checkIntervalSeconds: number;
    schedulerType: string;
  } {
    return {
      running: this.isRunning,
      expertCount: this.healthHistory.size,
      maxConsecutiveFailures: this.config.maxConsecutiveFailures,
      checkIntervalSeconds: this.config.healthCheckIntervalSeconds,
      schedulerType: this.config.enableCronSchedule ? 'cron' : 'interval',
    };
  }
}
