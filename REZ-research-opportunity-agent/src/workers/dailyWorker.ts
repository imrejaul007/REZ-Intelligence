import cron from 'node-cron';
import { researchAgent, opportunityAgent, insightAgent } from '../agents/index.js';
import { alertService } from '../services/index.js';
import { SCHEDULES } from '../constants/thresholds.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { AlertType, AlertSeverity } from '../types/index.js';

const log = logger.child({ context: 'DailyWorker' });

interface WorkerTask {
  id: string;
  name: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  result?: unknown;
}

class DailyWorker {
  private tasks: Map<string, WorkerTask> = new Map();
  private cronJob: cron.ScheduledTask | null = null;

  async start(): Promise<void> {
    log.info('Starting daily worker', { schedule: SCHEDULES.DAILY_BRIEFING });

    // Schedule the daily briefing job
    this.cronJob = cron.schedule(SCHEDULES.DAILY_BRIEFING, async () => {
      await this.runDailyBriefing();
    });

    log.info('Daily worker started');
  }

  async stop(): Promise<void> {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      log.info('Daily worker stopped');
    }
  }

  async runDailyBriefing(): Promise<WorkerTask> {
    const task: WorkerTask = {
      id: uuidv4(),
      name: 'Daily Briefing',
      startedAt: new Date(),
      status: 'running',
    };

    this.tasks.set(task.id, task);
    log.info('Starting daily briefing', { taskId: task.id });

    try {
      // Step 1: Generate business analysis
      log.info('Step 1: Conducting business analysis');
      const analysis = await researchAgent.conductFullAnalysis();
      log.info('Business analysis completed', { sectionsCount: analysis.sections.length });

      // Step 2: Generate new opportunities
      log.info('Step 2: Generating opportunities');
      const opportunitiesResult = await opportunityAgent.generateOpportunities();
      log.info('Opportunities generated', { count: opportunitiesResult.opportunities.length });

      // Step 3: Generate daily insight briefing
      log.info('Step 3: Generating daily insight');
      const dailyInsight = await insightAgent.generateDailyInsight();
      log.info('Daily insight generated', { summaryLength: dailyInsight.summary.length });

      // Step 4: Generate weekly report if Monday
      if (this.isMonday()) {
        log.info('Step 4: Generating weekly report (Monday)');
        const weeklyReport = await insightAgent.generateWeeklyReport();
        log.info('Weekly report generated', { reportId: weeklyReport.id });
      }

      task.status = 'completed';
      task.completedAt = new Date();
      task.result = {
        analysis,
        opportunities: opportunitiesResult,
        dailyInsight,
      };

      log.info('Daily briefing completed successfully', {
        taskId: task.id,
        duration: `${task.completedAt.getTime() - task.startedAt.getTime()}ms`,
      });
    } catch (error) {
      task.status = 'failed';
      task.error = (error as Error).message;
      task.completedAt = new Date();

      log.error('Daily briefing failed', {
        taskId: task.id,
        error: task.error,
        duration: `${task.completedAt.getTime() - task.startedAt.getTime()}ms`,
      });

      // Create alert for failed task
      await alertService.create({
        type: AlertType.RISK,
        severity: AlertSeverity.HIGH,
        title: 'Daily Briefing Failed',
        description: `Automated daily briefing failed: ${task.error}`,
        data: { taskId: task.id, schedule: SCHEDULES.DAILY_BRIEFING },
      });
    }

    this.tasks.set(task.id, task);
    return task;
  }

  async runOnDemand(): Promise<WorkerTask> {
    log.info('Running daily briefing on-demand');
    return this.runDailyBriefing();
  }

  getTaskStatus(taskId: string): WorkerTask | undefined {
    return this.tasks.get(taskId);
  }

  getRecentTasks(limit: number = 10): WorkerTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  private isMonday(): boolean {
    return new Date().getDay() === 1;
  }

  // Cleanup old tasks (keep last 100)
  cleanup(): void {
    const tasksArray = Array.from(this.tasks.values());
    if (tasksArray.length > 100) {
      const sortedTasks = tasksArray.sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
      );
      const toRemove = sortedTasks.slice(100);

      for (const task of toRemove) {
        this.tasks.delete(task.id);
      }

      log.info('Cleaned up old tasks', { removed: toRemove.length });
    }
  }
}

export const dailyWorker = new DailyWorker();
export default dailyWorker;
