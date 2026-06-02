/**
 * REZ Autonomous Loop Service - Loop Scheduler
 */
import cron from 'node-cron';
import { AutonomousLoop } from '../models/index.js';
import { AutonomousLoopEngine } from './autonomousLoopEngine.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('loop-scheduler');

export class LoopScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  start(): void {
    if (this.isRunning) return;

    // Run every minute to check for loops to execute
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processLoops();
    });

    this.isRunning = true;
    logger.info('scheduler_started');
  }

  stop(): void {
    this.cronJob?.stop();
    this.isRunning = false;
    logger.info('scheduler_stopped');
  }

  private async processLoops(): Promise<void> {
    try {
      // Find loops that need to run
      const now = new Date();
      const loops = await AutonomousLoop.find({
        status: 'active',
        next_run: { $lte: now },
      });

      for (const loop of loops) {
        try {
          const engine = new AutonomousLoopEngine(loop.tenant_id, loop._id.toString());
          const result = await engine.executeCycle();

          logger.info('loop_executed', {
            loopId: loop._id,
            loopName: loop.name,
            success: result.success,
            actionsExecuted: result.actionsExecuted,
          });
        } catch (error) {
          logger.error('loop_execution_failed', {
            loopId: loop._id,
            loopName: loop.name,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }
    } catch (error) {
      logger.error('scheduler_error', { error: error instanceof Error ? error.message : 'Unknown' });
    }
  }

  isActive(): boolean { return this.isRunning; }
}

let schedulerInstance: LoopScheduler | null = null;
export function getLoopScheduler(): LoopScheduler {
  if (!schedulerInstance) schedulerInstance = new LoopScheduler();
  return schedulerInstance;
}
