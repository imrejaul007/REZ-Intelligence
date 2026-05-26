import { v4 as uuidv4 } from 'uuid';
import { format, subDays } from 'date-fns';
import { query, queryOne, transaction } from '../config/database';
import { logger } from '../utils/logger.js';
import {
  Dispute,
  DisputeEvidence,
  Transaction,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '../models/types';

export class DisputeService {
  /**
   * File a new dispute
   */
  async fileDispute(
    transactionId: string,
    type: Dispute['type'],
    reason: string,
    filedBy: string
  ): Promise<Dispute> {
    logger.info('Filing new dispute', { transactionId, type, filedBy });

    // Verify transaction exists
    const transactionRecord = await this.getTransaction(transactionId);
    if (!transactionRecord) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    // Check for existing open dispute
    const existingDispute = await this.findOpenDispute(transactionId);
    if (existingDispute) {
      throw new Error(`An open dispute already exists for transaction: ${transactionId}`);
    }

    const disputeId = `DSP-${format(new Date(), 'yyyyMMdd')}-${uuidv4().slice(0, 8).toUpperCase()}`;

    const dispute: Dispute = {
      id: uuidv4(),
      transactionId,
      disputeId,
      type,
      reason,
      amount: transactionRecord.amount,
      currency: transactionRecord.currency,
      status: 'initiated',
      filedBy,
      filedAt: new Date(),
    };

    await this.saveDispute(dispute);

    logger.info('Dispute filed successfully', { disputeId, transactionId });
    return dispute;
  }

  /**
   * Get dispute by ID
   */
  async getDispute(disputeId: string): Promise<Dispute | null> {
    const row = await queryOne(
      'SELECT * FROM disputes WHERE id = $1 OR dispute_id = $1',
      [disputeId]
    );

    if (!row) return null;

    return this.mapRowToDispute(row);
  }

  /**
   * Get disputes with pagination and filtering
   */
  async getDisputes(
    params: PaginationParams & {
      status?: Dispute['status'];
      type?: Dispute['type'];
      filedBy?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<PaginatedResponse<Dispute>> {
    const { page, limit, sortBy = 'filedAt', sortOrder = 'desc', status, type, filedBy, startDate, endDate } = params;

    let whereClause = 'WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(status);
    }
    if (type) {
      whereClause += ` AND type = $${paramIndex++}`;
      values.push(type);
    }
    if (filedBy) {
      whereClause += ` AND filed_by = $${paramIndex++}`;
      values.push(filedBy);
    }
    if (startDate) {
      whereClause += ` AND filed_at >= $${paramIndex++}`;
      values.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND filed_at <= $${paramIndex++}`;
      values.push(endDate);
    }

    const offset = (page - 1) * limit;
    const validSortColumns = ['filedAt', 'amount', 'status', 'type'];
    const sortColumnMap: Record<string, string> = {
      filedAt: 'filed_at',
      amount: 'amount',
      status: 'status',
      type: 'type',
    };
    const safeSortBy = sortColumnMap[sortBy] || 'filed_at';

    const countQuery = `SELECT COUNT(*) FROM disputes ${whereClause}`;
    const countResult = await queryOne<{ count: string }>(countQuery, values);
    const total = parseInt(countResult?.count || '0', 10);

    const dataQuery = `
      SELECT * FROM disputes
      ${whereClause}
      ORDER BY ${safeSortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const rows = await query(dataQuery, [...values, limit, offset]);
    const data = rows.map(row => this.mapRowToDispute(row));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update dispute status
   */
  async updateDisputeStatus(
    disputeId: string,
    status: Dispute['status'],
    updatedBy: string,
    notes?: string
  ): Promise<Dispute> {
    const dispute = await this.getDispute(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    // Validate status transition
    this.validateStatusTransition(dispute.status, status);

    const resolutionAt = ['resolved_favor_merchant', 'resolved_favor_customer', 'cancelled'].includes(status)
      ? new Date()
      : undefined;

    await query(
      `UPDATE disputes
       SET status = $1, resolution_at = $2, notes = COALESCE($3, notes)
       WHERE id = $4 OR dispute_id = $4`,
      [status, resolutionAt, notes, disputeId]
    );

    const updated = await this.getDispute(disputeId);
    logger.info('Dispute status updated', { disputeId, status, updatedBy });

    return updated!;
  }

  /**
   * Add evidence to a dispute
   */
  async addEvidence(
    disputeId: string,
    type: DisputeEvidence['type'],
    description: string,
    submittedBy: string,
    fileUrl?: string
  ): Promise<DisputeEvidence> {
    const dispute = await this.getDispute(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    if (!['initiated', 'under_review', 'awaiting_evidence'].includes(dispute.status)) {
      throw new Error(`Cannot add evidence to dispute with status: ${dispute.status}`);
    }

    const evidence: DisputeEvidence = {
      id: uuidv4(),
      type,
      description,
      fileUrl,
      submittedAt: new Date(),
      submittedBy,
    };

    await query(
      `INSERT INTO dispute_evidence (id, dispute_id, type, description, file_url, submitted_at, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [evidence.id, dispute.id, evidence.type, evidence.description, evidence.fileUrl, evidence.submittedAt, evidence.submittedBy]
    );

    // Update dispute status to awaiting_evidence if needed
    if (dispute.status === 'initiated') {
      await this.updateDisputeStatus(disputeId, 'awaiting_evidence', submittedBy);
    }

    logger.info('Evidence added to dispute', { disputeId, evidenceId: evidence.id });
    return evidence;
  }

  /**
   * Get evidence for a dispute
   */
  async getDisputeEvidence(disputeId: string): Promise<DisputeEvidence[]> {
    const dispute = await this.getDispute(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    const rows = await query(
      'SELECT * FROM dispute_evidence WHERE dispute_id = $1 ORDER BY submitted_at DESC',
      [dispute.id]
    );

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      description: row.description,
      fileUrl: row.file_url,
      submittedAt: new Date(row.submitted_at),
      submittedBy: row.submitted_by,
    }));
  }

  /**
   * Get disputes by transaction ID
   */
  async getDisputesByTransaction(transactionId: string): Promise<Dispute[]> {
    const rows = await query(
      'SELECT * FROM disputes WHERE transaction_id = $1 ORDER BY filed_at DESC',
      [transactionId]
    );

    return rows.map(row => this.mapRowToDispute(row));
  }

  /**
   * Get dispute statistics
   */
  async getDisputeStatistics(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    totalAmount: number;
    averageResolutionTime: number;
  }> {
    let whereClause = 'WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND filed_at >= $${paramIndex++}`;
      values.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND filed_at <= $${paramIndex++}`;
      values.push(endDate);
    }

    const rows = await query(
      `SELECT status, type, amount, filed_at, resolution_at
       FROM disputes ${whereClause}`,
      values
    );

    const total = rows.length;
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalAmount = 0;
    let resolutionTimeSum = 0;
    let resolvedCount = 0;

    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      byType[row.type] = (byType[row.type] || 0) + 1;
      totalAmount += parseFloat(row.amount);

      if (row.resolution_at) {
        const resolutionTime = new Date(row.resolution_at).getTime() - new Date(row.filed_at).getTime();
        resolutionTimeSum += resolutionTime;
        resolvedCount++;
      }
    }

    return {
      total,
      byStatus,
      byType,
      totalAmount,
      averageResolutionTime: resolvedCount > 0 ? resolutionTimeSum / resolvedCount : 0,
    };
  }

  /**
   * Escalate dispute
   */
  async escalateDispute(disputeId: string, escalatedBy: string, reason: string): Promise<Dispute> {
    const dispute = await this.getDispute(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    if (dispute.status === 'resolved_favor_merchant' || dispute.status === 'resolved_favor_customer') {
      throw new Error('Cannot escalate a resolved dispute');
    }

    await query(
      `UPDATE disputes
       SET status = 'under_review',
           notes = COALESCE(notes, '') || E'\n[ESCALATED by ' || $2 || ' at ' || NOW() || ']: ' || $3
       WHERE id = $1 OR dispute_id = $1`,
      [disputeId, escalatedBy, reason]
    );

    logger.warn('Dispute escalated', { disputeId, escalatedBy, reason });

    const escalated = await this.getDispute(disputeId);
    return escalated!;
  }

  /**
   * Cancel a dispute
   */
  async cancelDispute(disputeId: string, cancelledBy: string, reason: string): Promise<Dispute> {
    return this.updateDisputeStatus(disputeId, 'cancelled', cancelledBy, reason);
  }

  /**
   * Resolve dispute in favor of merchant
   */
  async resolveInFavorOfMerchant(disputeId: string, resolvedBy: string, notes?: string): Promise<Dispute> {
    return this.updateDisputeStatus(disputeId, 'resolved_favor_merchant', resolvedBy, notes);
  }

  /**
   * Resolve dispute in favor of customer
   */
  async resolveInFavorOfCustomer(disputeId: string, resolvedBy: string, notes?: string): Promise<Dispute> {
    return this.updateDisputeStatus(disputeId, 'resolved_favor_customer', resolvedBy, notes);
  }

  // Private helper methods

  private async getTransaction(transactionId: string): Promise<Transaction | null> {
    const row = await queryOne('SELECT * FROM transactions WHERE transaction_id = $1', [transactionId]);

    if (!row) return null;

    return {
      id: row.id,
      transactionId: row.transaction_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      type: row.type,
      status: row.status,
      merchantId: row.merchant_id,
      customerId: row.customer_id,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata,
    };
  }

  private async findOpenDispute(transactionId: string): Promise<Dispute | null> {
    const row = await queryOne(
      `SELECT * FROM disputes
       WHERE transaction_id = $1 AND status NOT IN ('resolved_favor_merchant', 'resolved_favor_customer', 'cancelled')`,
      [transactionId]
    );

    if (!row) return null;

    return this.mapRowToDispute(row);
  }

  private async saveDispute(dispute: Dispute): Promise<void> {
    await query(
      `INSERT INTO disputes (id, dispute_id, transaction_id, type, reason, amount, currency, status, filed_by, filed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        dispute.id,
        dispute.disputeId,
        dispute.transactionId,
        dispute.type,
        dispute.reason,
        dispute.amount,
        dispute.currency,
        dispute.status,
        dispute.filedBy,
        dispute.filedAt,
      ]
    );
  }

  private mapRowToDispute(row: Record<string, unknown>): Dispute {
    return {
      id: row.id as string,
      transactionId: row.transaction_id as string,
      disputeId: row.dispute_id as string,
      type: row.type as Dispute['type'],
      reason: row.reason as string,
      amount: parseFloat(row.amount as string),
      currency: row.currency as string,
      status: row.status as Dispute['status'],
      filedBy: row.filed_by as string,
      filedAt: new Date(row.filed_at as string),
      resolutionAt: row.resolution_at ? new Date(row.resolution_at as string) : undefined,
      notes: row.notes as string | undefined,
    };
  }

  private validateStatusTransition(currentStatus: Dispute['status'], newStatus: Dispute['status']): void {
    const validTransitions: Record<Dispute['status'], Dispute['status'][]> = {
      initiated: ['under_review', 'cancelled'],
      under_review: ['awaiting_evidence', 'resolved_favor_merchant', 'resolved_favor_customer', 'cancelled'],
      awaiting_evidence: ['under_review', 'resolved_favor_merchant', 'resolved_favor_customer', 'cancelled'],
      resolved_favor_merchant: [],
      resolved_favor_customer: [],
      cancelled: [],
    };

    const allowed = validTransitions[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }
}

export const disputeService = new DisputeService();
