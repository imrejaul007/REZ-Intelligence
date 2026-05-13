import cron from 'node-cron';
import { researchAgent, opportunityAgent, insightAgent } from '../agents/index.js';
import { opportunityService, alertService } from '../services/index.js';
import { SCHEDULES } from '../constants/thresholds.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { AlertType, AlertSeverity } from '../types/index.js';

const log = logger.child({ context: 'WeeklyWorker' });

interface WeeklyReportTask {
  id: string;
  name: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  result?: {
    reportId?: string;
    opportunitiesGenerated?: number;
    archivedOpportunities?: number;
  };
}

class WeeklyWorker {
  private tasks: Map<string, WeeklyReportTask> = new Map();
  private cronJob: cron.ScheduledTask | null = null;

  async start(): Promise<void> {
    log.info('Starting weekly worker', { schedule: SCHEDULES.WEEKLY_REPORT });

    // Schedule the weekly report job
    this.cronJob = cron.schedule(SCHEDULES.WEEKLY_REPORT, async () => {
      await this.runWeeklyReport();
    });

    log.info('Weekly worker started');
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      log.info('Weekly worker stopped');
    }
  }

  async runWeeklyReport(): Promise<WeeklyReportTask> {
    const task: WeeklyReportTask = {
      id: uuidv4(),
      name: 'Weekly Report',
      startedAt: new Date(),
      status: 'running',
    };

    this.tasks.set(task.id, task);
    log.info('Starting weekly report generation', { taskId: task.id });

    try {
      // Step 1: Generate comprehensive weekly report
      log.info('Step 1: Generating comprehensive weekly report');
      const report = await insightAgent.generateWeeklyReport();
      log.info('Weekly report generated', { reportId: report.id });

      // Step 2: Refresh opportunity analysis
      log.info('Step 2: Refreshing opportunity analysis');
      const opportunitiesResult = await opportunityAgent.generateOpportunities();
      log.info('Opportunities refreshed', { count: opportunitiesResult.opportunities.length });

      // Step 3: Conduct competitor analysis
      log.info('Step 3: Conducting competitor analysis');
      const competitorAnalysis = await researchAgent.analyzeCompetitors();
      log.info('Competitor analysis completed', {
        gapsCount: competitorAnalysis.gaps.length,
        recommendationsCount: competitorAnalysis.recommendations.length,
      });

      // Step 4: Archive old/low-priority opportunities
      log.info('Step 4: Archiving old opportunities');
      const archivedCount = await this.archiveOldOpportunities();
      log.info('Opportunities archived', { count: archivedCount });

      // Step 5: Create summary alert
      log.info('Step 5: Creating weekly summary alert');
      await alertService.create({
        type: AlertType.OPPORTUNITY,
        severity: AlertSeverity.MEDIUM,
        title: 'Weekly Report Generated',
        description: `Weekly intelligence report completed. ${opportunitiesResult.highPriorityCount} high-priority opportunities identified.`,
        data: {
          reportId: report.id,
          highPriorityCount: opportunitiesResult.highPriorityCount,
          archivedCount,
          competitorGaps: competitorAnalysis.gaps.length,
        },
      });

      task.status = 'completed';
      task.completedAt = new Date();
      task.result = {
        reportId: report.id,
        opportunitiesGenerated: opportunitiesResult.opportunities.length,
        archivedOpportunities: archivedCount,
      };

      log.info('Weekly report completed successfully', {
        taskId: task.id,
        duration: `${task.completedAt.getTime() - task.startedAt.getTime()}ms`,
      });
    } catch (error) {
      task.status = 'failed';
      task.error = (error as Error).message;
      task.completedAt = new Date();

      log.error('Weekly report failed', {
        taskId: task.id,
        error: task.error,
      });

      // Create alert for failed task
      await alertService.create({
        type: AlertType.RISK,
        severity: AlertSeverity.HIGH,
        title: 'Weekly Report Failed',
        description: `Automated weekly report failed: ${task.error}`,
        data: { taskId: task.id, schedule: SCHEDULES.WEEKLY_REPORT },
      });
    }

    this.tasks.set(task.id, task);
    return task;
  }

  private async archiveOldOpportunities(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let archivedCount = 0;

    // Archive opportunities that are:
    // 1. Older than 30 days
    // 2. Not in active status
    // 3. Low confidence (below 50%)
    const opportunities = await opportunityService.findAll({
      limit: 100,
    });

    for (const opp of opportunities.opportunities) {
      const isOld = new Date(opp.createdAt) < thirtyDaysAgo;
      const isInactive = opp.status !== 'identified' && opp.status !== 'recommended' && opp.status !== 'approved';
      const isLowConfidence = opp.confidence < 50;

      if ((isOld && isInactive) || (isOld && isLowConfidence)) {
        await opportunityService.archive(opp.id);
        archivedCount++;
      }
    }

    return archivedCount;
  }

  async runOnDemand(): Promise<WeeklyReportTask> {
    log.info('Running weekly report on-demand');
    return this.runWeeklyReport();
  }

  getTaskStatus(taskId: string): WeeklyReportTask | undefined {
    return this.tasks.get(taskId);
  }

  getRecentTasks(limit: number = 10): WeeklyReportTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  // Get weekly statistics
  async getWeeklyStats(): Promise<{
    opportunitiesCreated: number;
    opportunitiesApproved: number;
    opportunitiesExecuted: number;
    alertsGenerated: number;
    avgConfidence: number;
  }> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const opportunities = await opportunityService.findAll({ limit: 1000 });

    const recentOpportunities = opportunities.opportunities.filter(
      (o) => new Date(o.createdAt) >= weekAgo
    );

    const alertStats = await alertService.getStats();

    return {
      opportunitiesCreated: recentOpportunities.length,
      opportunitiesApproved: recentOpportunities.filter((o) => o.status === 'approved').length,
      opportunitiesExecuted: recentOpportunities.filter((o) => o.status === 'executed').length,
      alertsGenerated: alertStats.recentCount,
      avgConfidence:
        recentOpportunities.length > 0
          ? recentOpportunities.reduce((sum, o) => sum + o.confidence, 0) /
            recentOpportunities.length
          : 0,
    };
  }

  cleanup(): void {
    const tasksArray = Array.from(this.tasks.values());
    if (tasksArray.length > 50) {
      const sortedTasks = tasksArray.sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
      );
      const toRemove = sortedTasks.slice(50);

      for (const task of toRemove) {
        this.tasks.delete(task.id);
      }

      log.info('Cleaned up old tasks', { removed: toRemove.length });
    }
  }
}

export const weeklyWorker = new WeeklyWorker();
export default weeklyWorker;
