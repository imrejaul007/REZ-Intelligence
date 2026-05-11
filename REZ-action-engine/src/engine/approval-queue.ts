import { v4 as uuidv4 } from 'uuid';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import { logger } from '../config/logger';
import { config } from '../config';
import { ApprovalRequest, ActionStatus } from '../types/action-levels';
import { executeNextaBiZAction } from '../integrations/nextabizz';

/**
 * Redis connection for BullMQ
 */
const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
});

/**
 * MongoDB Schema for Approval Requests
 * FIX: Use MongoDB for persistence instead of in-memory Map
 */
const ApprovalRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  actionId: { type: String, required: true, index: true },
  eventId: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: Object.values(ActionStatus), default: ActionStatus.PENDING, index: true },
  requestedAt: { type: Date, default: Date.now, index: true },
  resolvedAt: { type: Date },
  requestedBy: { type: String, index: true },
  resolvedBy: { type: String },
  resolution: { type: String, enum: ['approved', 'rejected'] },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true, collection: 'approval_requests' });

// Compound indexes for common queries
ApprovalRequestSchema.index({ status: 1, requestedAt: -1 });
ApprovalRequestSchema.index({ requestedBy: 1, status: 1 });

const ApprovalRequestModel = mongoose.model('ApprovalRequest', ApprovalRequestSchema);

/**
 * MongoDB connection for approval persistence
 */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_action_engine';

let isConnected = false;

async function ensureConnection(): Promise<void> {
  if (!isConnected && mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    logger.info('MongoDB connected for approval queue');
  }
}

/**
 * Approval Queue for human-in-loop processing
 * FIX: Uses MongoDB for persistence instead of in-memory Map
 */
export class ApprovalQueue {
  private queue: Queue;
  private worker: Worker | null = null;
  private static instance: ApprovalQueue;

  private constructor() {
    this.queue = new Queue('approval-requests', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    // Initialize MongoDB connection
    ensureConnection().catch(err => logger.error('MongoDB connection failed:', err));

    this.initializeWorker();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ApprovalQueue {
    if (!ApprovalQueue.instance) {
      ApprovalQueue.instance = new ApprovalQueue();
    }
    return ApprovalQueue.instance;
  }

  private initializeWorker(): void {
    this.worker = new Worker(
      'approval-requests',
      async (job: Job) => {
        logger.info(`Processing approval job ${job.id}`);
        // Worker handles timeout monitoring
      },
      {
        connection: redisConnection,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info(`Approval job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Approval job ${job?.id} failed`, { error: err.message });
    });
  }

  /**
   * Create a new approval request
   * FIX: Now saves to MongoDB for persistence
   */
  async createApprovalRequest(
    actionId: string,
    eventId: string,
    payload: Record<string, unknown>,
    userId?: string
  ): Promise<ApprovalRequest> {
    await ensureConnection();

    const request: ApprovalRequest = {
      id: uuidv4(),
      actionId,
      eventId,
      payload,
      status: ActionStatus.PENDING,
      requestedAt: new Date(),
      requestedBy: userId,
    };

    // Save to MongoDB
    await ApprovalRequestModel.create(request);

    // Add to queue for monitoring
    await this.queue.add('approval', {
      approvalId: request.id,
      actionId,
      eventId,
    });

    logger.info('Approval request created', {
      approvalId: request.id,
      actionId,
      eventId,
    });

    return request;
  }

  /**
   * Get all pending approval requests
   * FIX: Now queries from MongoDB
   */
  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    await ensureConnection();
    const docs = await ApprovalRequestModel.find({ status: ActionStatus.PENDING })
      .sort({ requestedAt: -1 })
      .lean();
    return docs as unknown as ApprovalRequest[];
  }

  /**
   * Get approval by ID
   * FIX: Now queries from MongoDB
   */
  async getApprovalById(id: string): Promise<ApprovalRequest | undefined> {
    await ensureConnection();
    const doc = await ApprovalRequestModel.findOne({ id }).lean();
    return doc as unknown as ApprovalRequest | undefined;
  }

  /**
   * Get approvals by status
   * FIX: Now queries from MongoDB
   */
  async getApprovalsByStatus(status: ActionStatus): Promise<ApprovalRequest[]> {
    await ensureConnection();
    const docs = await ApprovalRequestModel.find({ status })
      .sort({ requestedAt: -1 })
      .lean();
    return docs as unknown as ApprovalRequest[];
  }

  /**
   * Get all approvals
   * FIX: Now queries from MongoDB
   */
  async getAllApprovals(): Promise<ApprovalRequest[]> {
    await ensureConnection();
    const docs = await ApprovalRequestModel.find({})
      .sort({ requestedAt: -1 })
      .limit(100)
      .lean();
    return docs as unknown as ApprovalRequest[];
  }

  /**
   * Approve an action request
   * FIX: Now updates MongoDB
   */
  async approve(
    approvalId: string,
    approverId: string
  ): Promise<{ success: boolean; request?: ApprovalRequest; error?: string }> {
    await ensureConnection();

    const doc = await ApprovalRequestModel.findOne({ id: approvalId });
    if (!doc) {
      logger.warn(`Approval request not found: ${approvalId}`);
      return { success: false, error: 'Approval request not found' };
    }

    if (doc.status !== ActionStatus.PENDING) {
      logger.warn(`Approval request already processed: ${approvalId}`);
      return { success: false, error: 'Approval request already processed' };
    }

    // Update in MongoDB
    doc.status = ActionStatus.APPROVED;
    doc.resolvedAt = new Date();
    doc.resolvedBy = approverId;
    doc.resolution = 'approved';
    await doc.save();

    const request = doc.toObject() as unknown as ApprovalRequest;

    logger.info('Approval granted', {
      approvalId,
      approverId,
      actionId: request.actionId,
    });

    // Execute the approved action
    try {
      await executeNextaBiZAction(request.actionId, request.payload);
      logger.info('Approved action executed', { approvalId, actionId: request.actionId });
    } catch (error) {
      logger.error('Failed to execute approved action', {
        approvalId,
        actionId: request.actionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return { success: true, request };
  }

  /**
   * Reject an action request
   * FIX: Now updates MongoDB
   */
  async reject(
    approvalId: string,
    rejecterId: string,
    reason?: string
  ): Promise<{ success: boolean; request?: ApprovalRequest; error?: string }> {
    await ensureConnection();

    const doc = await ApprovalRequestModel.findOne({ id: approvalId });
    if (!doc) {
      logger.warn(`Approval request not found: ${approvalId}`);
      return { success: false, error: 'Approval request not found' };
    }

    if (doc.status !== ActionStatus.PENDING) {
      logger.warn(`Approval request already processed: ${approvalId}`);
      return { success: false, error: 'Approval request already processed' };
    }

    // Update in MongoDB
    doc.status = ActionStatus.REJECTED;
    doc.resolvedAt = new Date();
    doc.resolvedBy = rejecterId;
    doc.resolution = 'rejected';
    if (reason) {
      doc.metadata = { ...doc.metadata, rejectionReason: reason };
    }
    await doc.save();

    const request = doc.toObject() as unknown as ApprovalRequest;

    logger.info('Approval rejected', {
      approvalId,
      rejecterId,
      actionId: request.actionId,
      reason,
    });

    return { success: true, request };
  }

  /**
   * Close the queue and worker
   */
  async close(): Promise<void> {
    await this.queue.close();
    if (this.worker) {
      await this.worker.close();
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

// Export singleton getter
export function getApprovalQueue(): ApprovalQueue {
  return ApprovalQueue.getInstance();
}
