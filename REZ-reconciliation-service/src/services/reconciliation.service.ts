import { v4 as uuidv4 } from 'uuid';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { query, queryOne, transaction } from '../config/database';
import { logger } from '../utils/logger.js';
import { config } from '../config';
import {
  Transaction,
  BalanceRecord,
  Discrepancy,
  ReconciliationJob,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '../models/types';

export class ReconciliationService {
  /**
   * Daily Balance Check
   * Compares internal balances with external records to detect discrepancies
   */
  async performDailyBalanceCheck(accountId: string, date: Date = new Date()): Promise<{
    matched: boolean;
    internalBalance: BalanceRecord | null;
    externalBalance: BalanceRecord | null;
    discrepancies: Discrepancy[];
  }> {
    logger.info('Starting daily balance check', { accountId, date });

    const startOfDayDate = startOfDay(date);
    const endOfDayDate = endOfDay(date);

    // Fetch internal balance records
    const internalBalance = await this.getInternalBalance(accountId, startOfDayDate, endOfDayDate);

    // Fetch external balance records (simulated - would come from payment gateway)
    const externalBalance = await this.getExternalBalance(accountId, startOfDayDate, endOfDayDate);

    const discrepancies: Discrepancy[] = [];

    // Compare balances
    if (!internalBalance && !externalBalance) {
      return { matched: true, internalBalance, externalBalance, discrepancies };
    }

    if (!internalBalance || !externalBalance) {
      discrepancies.push(this.createDiscrepancy(
        'missing_transaction',
        internalBalance ? 'external' : 'internal',
        accountId,
        date
      ));
      return { matched: false, internalBalance, externalBalance, discrepancies };
    }

    // Check for amount mismatch
    if (internalBalance.balance !== externalBalance.balance) {
      discrepancies.push(this.createDiscrepancy(
        'amount_mismatch',
        'balance',
        accountId,
        date,
        internalBalance.balance,
        externalBalance.balance
      ));
    }

    // Validate checksum if available
    if (externalBalance.checksum && internalBalance.checksum !== externalBalance.checksum) {
      discrepancies.push(this.createDiscrepancy(
        'amount_mismatch',
        'checksum',
        accountId,
        date,
        internalBalance.checksum,
        externalBalance.checksum
      ));
    }

    const matched = discrepancies.length === 0;
    logger.info('Daily balance check completed', { accountId, matched, discrepancyCount: discrepancies.length });

    // Persist discrepancies
    for (const discrepancy of discrepancies) {
      await this.saveDiscrepancy(discrepancy);
    }

    return { matched, internalBalance, externalBalance, discrepancies };
  }

  /**
   * Transaction Verification
   * Verifies individual transactions against source records
   */
  async verifyTransaction(transactionId: string): Promise<{
    verified: boolean;
    transaction: Transaction | null;
    sourceRecord: Transaction | null;
    discrepancy?: Discrepancy;
  }> {
    logger.info('Verifying transaction', { transactionId });

    const transaction = await this.getTransaction(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const sourceRecord = await this.getSourceTransaction(transactionId);

    if (!sourceRecord) {
      const discrepancy = this.createDiscrepancy(
        'missing_transaction',
        'source',
        transactionId
      );
      await this.saveDiscrepancy(discrepancy);
      return { verified: false, transaction, sourceRecord: null, discrepancy };
    }

    const discrepancies: Discrepancy[] = [];

    // Verify amount
    if (transaction.amount !== sourceRecord.amount) {
      discrepancies.push(this.createDiscrepancy(
        'amount_mismatch',
        transactionId,
        undefined,
        undefined,
        sourceRecord.amount,
        transaction.amount
      ));
    }

    // Verify status
    if (transaction.status !== sourceRecord.status) {
      discrepancies.push(this.createDiscrepancy(
        'status_mismatch',
        transactionId,
        undefined,
        undefined,
        sourceRecord.status,
        transaction.status
      ));
    }

    // Verify timing (within 24 hours tolerance)
    const timeDiff = Math.abs(new Date(transaction.timestamp).getTime() - new Date(sourceRecord.timestamp).getTime());
    if (timeDiff > 24 * 60 * 60 * 1000) {
      discrepancies.push(this.createDiscrepancy(
        'timing_difference',
        transactionId,
        undefined,
        undefined,
        sourceRecord.timestamp,
        transaction.timestamp
      ));
    }

    if (discrepancies.length > 0) {
      await this.saveDiscrepancy(discrepancies[0]);
      return { verified: false, transaction, sourceRecord, discrepancy: discrepancies[0] };
    }

    return { verified: true, transaction, sourceRecord };
  }

  /**
   * Batch Transaction Verification
   */
  async verifyTransactionsBatch(transactionIds: string[]): Promise<{
    total: number;
    verified: number;
    failed: number;
    discrepancies: Discrepancy[];
  }> {
    const discrepancies: Discrepancy[] = [];
    let verified = 0;
    let failed = 0;

    for (const transactionId of transactionIds) {
      try {
        const result = await this.verifyTransaction(transactionId);
        if (result.verified) {
          verified++;
        } else {
          failed++;
          if (result.discrepancy) {
            discrepancies.push(result.discrepancy);
          }
        }
      } catch (error) {
        logger.error('Error verifying transaction in batch', { transactionId, error });
        failed++;
      }
    }

    return { total: transactionIds.length, verified, failed, discrepancies };
  }

  /**
   * Discrepancy Detection
   * Full scan to detect all discrepancies within a date range
   */
  async detectDiscrepancies(
    startDate: Date,
    endDate: Date,
    accountId?: string
  ): Promise<{
    discrepancies: Discrepancy[];
    summary: {
      total: number;
      byType: Record<string, number>;
      bySeverity: Record<string, number>;
    };
  }> {
    logger.info('Detecting discrepancies', { startDate, endDate, accountId });

    // Get all transactions within range
    const transactions = await this.getTransactionsInRange(startDate, endDate, accountId);
    const discrepancies: Discrepancy[] = [];

    // Check for duplicates
    const seenIds = new Set<string>();
    for (const tx of transactions) {
      if (seenIds.has(tx.transactionId)) {
        const discrepancy = this.createDiscrepancy(
          'duplicate_transaction',
          tx.transactionId,
          undefined,
          undefined,
          'unique',
          'duplicate'
        );
        discrepancy.severity = 'high';
        discrepancies.push(discrepancy);
      }
      seenIds.add(tx.transactionId);
    }

    // Verify each transaction
    for (const tx of transactions) {
      const result = await this.verifyTransaction(tx.transactionId);
      if (!result.verified && result.discrepancy) {
        discrepancies.push(result.discrepancy);
      }
    }

    // Persist all discrepancies
    for (const discrepancy of discrepancies) {
      await this.saveDiscrepancy(discrepancy);
    }

    const summary = {
      total: discrepancies.length,
      byType: this.countByField(discrepancies, 'type'),
      bySeverity: this.countByField(discrepancies, 'severity'),
    };

    logger.info('Discrepancy detection completed', summary);

    return { discrepancies, summary };
  }

  /**
   * Get all discrepancies with pagination and filtering
   */
  async getDiscrepancies(
    params: PaginationParams & {
      status?: Discrepancy['status'];
      severity?: Discrepancy['severity'];
      type?: Discrepancy['type'];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<PaginatedResponse<Discrepancy>> {
    const { page, limit, sortBy = 'detectedAt', sortOrder = 'desc', status, severity, type, startDate, endDate } = params;

    let whereClause = 'WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(status);
    }
    if (severity) {
      whereClause += ` AND severity = $${paramIndex++}`;
      values.push(severity);
    }
    if (type) {
      whereClause += ` AND type = $${paramIndex++}`;
      values.push(type);
    }
    if (startDate) {
      whereClause += ` AND detected_at >= $${paramIndex++}`;
      values.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND detected_at <= $${paramIndex++}`;
      values.push(endDate);
    }

    const offset = (page - 1) * limit;
    const validSortColumns = ['detectedAt', 'type', 'severity', 'status'];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'detected_at';

    const countQuery = `SELECT COUNT(*) FROM discrepancies ${whereClause}`;
    const totalResult = await queryOne<{ count: string }>(countQuery, values);
    const total = parseInt(totalResult?.count || '0', 10);

    const dataQuery = `
      SELECT id, type, severity, description, transaction_id, expected_value, actual_value,
             detected_at, resolved_at, resolved_by, status, notes
      FROM discrepancies
      ${whereClause}
      ORDER BY ${safeSortBy === 'detectedAt' ? 'detected_at' : safeSortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const rows = await query<{
      id: string;
      type: string;
      severity: string;
      description: string;
      transaction_id: string | null;
      expected_value: unknown;
      actual_value: unknown;
      detected_at: Date;
      resolved_at: Date | null;
      resolved_by: string | null;
      status: string;
      notes: string | null;
    }>(dataQuery, [...values, limit, offset]);

    const data: Discrepancy[] = rows.map(row => ({
      id: row.id,
      type: row.type as Discrepancy['type'],
      severity: row.severity as Discrepancy['severity'],
      description: row.description,
      transactionId: row.transaction_id ?? undefined,
      expectedValue: row.expected_value,
      actualValue: row.actual_value,
      detectedAt: new Date(row.detected_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolvedBy: row.resolved_by ?? undefined,
      status: row.status as Discrepancy['status'],
      notes: row.notes ?? undefined,
    }));

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
   * Resolve a discrepancy
   */
  async resolveDiscrepancy(
    discrepancyId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<Discrepancy> {
    const resolvedAt = new Date();

    await query(
      `UPDATE discrepancies
       SET status = 'resolved', resolved_at = $1, resolved_by = $2, notes = COALESCE($3, notes)
       WHERE id = $4`,
      [resolvedAt, resolvedBy, notes, discrepancyId]
    );

    const resolved = await queryOne<{
      id: string;
      type: string;
      severity: string;
      description: string;
      transaction_id: string | null;
      expected_value: unknown;
      actual_value: unknown;
      detected_at: Date;
      resolved_at: Date | null;
      resolved_by: string | null;
      status: string;
      notes: string | null;
    }>(
      'SELECT * FROM discrepancies WHERE id = $1',
      [discrepancyId]
    );

    if (!resolved) {
      throw new Error(`Discrepancy not found: ${discrepancyId}`);
    }

    logger.info('Discrepancy resolved', { discrepancyId, resolvedBy });
    return {
      id: resolved.id,
      type: resolved.type as Discrepancy['type'],
      severity: resolved.severity as Discrepancy['severity'],
      description: resolved.description,
      transactionId: resolved.transaction_id ?? undefined,
      expectedValue: resolved.expected_value,
      actualValue: resolved.actual_value,
      detectedAt: new Date(resolved.detected_at),
      resolvedAt: resolved.resolved_at ? new Date(resolved.resolved_at) : undefined,
      resolvedBy: resolved.resolved_by ?? undefined,
      status: resolved.status as Discrepancy['status'],
      notes: resolved.notes ?? undefined,
    };
  }

  /**
   * Run full reconciliation job
   */
  async runReconciliationJob(
    type: ReconciliationJob['type'],
    triggeredBy: string,
    options?: { accountId?: string; startDate?: Date; endDate?: Date }
  ): Promise<ReconciliationJob> {
    const jobId = uuidv4();
    const startTime = new Date();

    const job: ReconciliationJob = {
      id: uuidv4(),
      jobId,
      type,
      status: 'running',
      startedAt: startTime,
      recordsProcessed: 0,
      discrepanciesFound: 0,
      triggeredBy,
    };

    await this.saveJob(job);

    try {
      const startDate = options?.startDate || subDays(new Date(), 1);
      const endDate = options?.endDate || new Date();

      let discrepancies: Discrepancy[] = [];

      switch (type) {
        case 'daily_balance':
          if (options?.accountId) {
            const result = await this.performDailyBalanceCheck(options.accountId, startDate);
            discrepancies = result.discrepancies;
          }
          break;
        case 'transaction_verify':
          const transactions = await this.getTransactionsInRange(startDate, endDate, options?.accountId);
          const batchSize = config.reconciliation.batchSize;

          for (let i = 0; i < transactions.length; i += batchSize) {
            const batch = transactions.slice(i, i + batchSize);
            const result = await this.verifyTransactionsBatch(batch.map(t => t.transactionId));
            discrepancies.push(...result.discrepancies);
            job.recordsProcessed += batch.length;
          }
          break;
        case 'full_reconciliation':
          const discrepancyResult = await this.detectDiscrepancies(startDate, endDate, options?.accountId);
          discrepancies = discrepancyResult.discrepancies;
          job.recordsProcessed = discrepancyResult.summary.total;
          break;
      }

      job.discrepanciesFound = discrepancies.length;
      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = (error as Error).message;
      job.completedAt = new Date();
      logger.error('Reconciliation job failed', { jobId, error });
    }

    await this.saveJob(job);
    logger.info('Reconciliation job completed', { jobId, status: job.status });

    return job;
  }

  /**
   * Get reconciliation history
   */
  async getReconciliationHistory(
    params: PaginationParams
  ): Promise<PaginatedResponse<ReconciliationJob>> {
    const { page, limit, sortBy = 'startedAt', sortOrder = 'desc' } = params;
    const offset = (page - 1) * limit;

    const countResult = await queryOne<{ count: string }>('SELECT COUNT(*) FROM reconciliation_jobs');
    const total = parseInt(countResult?.count || '0', 10);

    const rows = await query<{
      id: string;
      job_id: string;
      type: string;
      status: string;
      started_at: Date | null;
      completed_at: Date | null;
      records_processed: number;
      discrepancies_found: number;
      error_message: string | null;
      triggered_by: string;
      scheduled: boolean;
    }>(
      `SELECT * FROM reconciliation_jobs
       ORDER BY ${sortBy === 'startedAt' ? 'started_at' : sortBy} ${sortOrder.toUpperCase()}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const data: ReconciliationJob[] = rows.map(row => ({
      id: row.id,
      jobId: row.job_id,
      type: row.type as ReconciliationJob['type'],
      status: row.status as ReconciliationJob['status'],
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      recordsProcessed: row.records_processed,
      discrepanciesFound: row.discrepancies_found,
      errorMessage: row.error_message ?? undefined,
      triggeredBy: row.triggered_by,
      scheduled: row.scheduled,
    }));

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

  // Private helper methods

  private async getInternalBalance(accountId: string, startDate: Date, endDate: Date): Promise<BalanceRecord | null> {
    const row = await queryOne<{
      id: string;
      account_id: string;
      balance: string;
      currency: string;
      timestamp: Date;
      source: string;
      checksum: string | null;
    }>(
      `SELECT * FROM balance_records
       WHERE account_id = $1 AND timestamp >= $2 AND timestamp <= $3 AND source = 'internal'
       ORDER BY timestamp DESC LIMIT 1`,
      [accountId, startDate, endDate]
    );

    if (!row) return null;

    return {
      id: row.id,
      accountId: row.account_id,
      balance: parseFloat(row.balance),
      currency: row.currency,
      timestamp: new Date(row.timestamp),
      source: row.source as 'internal' | 'external',
      checksum: row.checksum ?? undefined,
    };
  }

  private async getExternalBalance(accountId: string, startDate: Date, endDate: Date): Promise<BalanceRecord | null> {
    // Simulated external balance fetch - in production, this would call payment gateway API
    const row = await queryOne<{
      id: string;
      account_id: string;
      balance: string;
      currency: string;
      timestamp: Date;
      source: string;
      checksum: string | null;
    }>(
      `SELECT * FROM balance_records
       WHERE account_id = $1 AND timestamp >= $2 AND timestamp <= $3 AND source = 'external'
       ORDER BY timestamp DESC LIMIT 1`,
      [accountId, startDate, endDate]
    );

    if (!row) return null;

    return {
      id: row.id,
      accountId: row.account_id,
      balance: parseFloat(row.balance),
      currency: row.currency,
      timestamp: new Date(row.timestamp),
      source: row.source as 'internal' | 'external',
      checksum: row.checksum ?? undefined,
    };
  }

  private async getTransaction(transactionId: string): Promise<Transaction | null> {
    const row = await queryOne<{
      id: string;
      transaction_id: string;
      amount: string;
      currency: string;
      type: string;
      status: string;
      merchant_id: string;
      customer_id: string;
      timestamp: Date;
      metadata: Record<string, unknown>;
    }>('SELECT * FROM transactions WHERE transaction_id = $1', [transactionId]);

    if (!row) return null;

    return {
      id: row.id,
      transactionId: row.transaction_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      type: row.type as Transaction['type'],
      status: row.status as Transaction['status'],
      merchantId: row.merchant_id,
      customerId: row.customer_id,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata,
    };
  }

  private async getSourceTransaction(transactionId: string): Promise<Transaction | null> {
    // Simulated source transaction - in production, this would verify against source of truth
    const row = await queryOne<{
      id: string;
      transaction_id: string;
      amount: string;
      currency: string;
      type: string;
      status: string;
      merchant_id: string;
      customer_id: string;
      timestamp: Date;
      metadata: Record<string, unknown>;
    }>('SELECT * FROM source_transactions WHERE transaction_id = $1', [transactionId]);

    if (!row) return null;

    return {
      id: row.id,
      transactionId: row.transaction_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      type: row.type as Transaction['type'],
      status: row.status as Transaction['status'],
      merchantId: row.merchant_id,
      customerId: row.customer_id,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata,
    };
  }

  private async getTransactionsInRange(startDate: Date, endDate: Date, accountId?: string): Promise<Transaction[]> {
    let sql = 'SELECT * FROM transactions WHERE timestamp >= $1 AND timestamp <= $2';
    const params: unknown[] = [startDate, endDate];

    if (accountId) {
      sql += ' AND (merchant_id = $3 OR customer_id = $3)';
      params.push(accountId);
    }

    const rows = await query<{
      id: string;
      transaction_id: string;
      amount: string;
      currency: string;
      type: string;
      status: string;
      merchant_id: string;
      customer_id: string;
      timestamp: Date;
      metadata: Record<string, unknown>;
    }>(sql, params);

    return rows.map(row => ({
      id: row.id,
      transactionId: row.transaction_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      type: row.type as Transaction['type'],
      status: row.status as Transaction['status'],
      merchantId: row.merchant_id,
      customerId: row.customer_id,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata,
    }));
  }

  private createDiscrepancy(
    type: Discrepancy['type'],
    transactionId: string | undefined,
    accountId?: string,
    date?: Date,
    expectedValue?: unknown,
    actualValue?: unknown
  ): Discrepancy {
    const descriptions: Record<string, string> = {
      amount_mismatch: `Amount mismatch for ${transactionId || accountId}`,
      missing_transaction: `Missing transaction record for ${transactionId || accountId}`,
      duplicate_transaction: `Duplicate transaction detected: ${transactionId}`,
      status_mismatch: `Status mismatch for transaction ${transactionId}`,
      timing_difference: `Timing difference detected for transaction ${transactionId}`,
    };

    return {
      id: uuidv4(),
      type,
      severity: this.calculateSeverity(type),
      description: descriptions[type] || 'Unknown discrepancy',
      transactionId,
      expectedValue,
      actualValue,
      detectedAt: date || new Date(),
      status: 'open',
    };
  }

  private calculateSeverity(type: Discrepancy['type']): Discrepancy['severity'] {
    const severityMap: Record<string, Discrepancy['severity']> = {
      amount_mismatch: 'high',
      duplicate_transaction: 'high',
      missing_transaction: 'medium',
      status_mismatch: 'medium',
      timing_difference: 'low',
    };
    return severityMap[type] || 'medium';
  }

  private async saveDiscrepancy(discrepancy: Discrepancy): Promise<void> {
    await query(
      `INSERT INTO discrepancies (id, type, severity, description, transaction_id, expected_value, actual_value, detected_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        discrepancy.id,
        discrepancy.type,
        discrepancy.severity,
        discrepancy.description,
        discrepancy.transactionId,
        JSON.stringify(discrepancy.expectedValue),
        JSON.stringify(discrepancy.actualValue),
        discrepancy.detectedAt,
        discrepancy.status,
      ]
    );
  }

  private async saveJob(job: ReconciliationJob): Promise<void> {
    await query(
      `INSERT INTO reconciliation_jobs (id, job_id, type, status, started_at, completed_at, records_processed, discrepancies_found, error_message, triggered_by, scheduled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         completed_at = EXCLUDED.completed_at,
         records_processed = EXCLUDED.records_processed,
         discrepancies_found = EXCLUDED.discrepancies_found,
         error_message = EXCLUDED.error_message`,
      [
        job.id,
        job.jobId,
        job.type,
        job.status,
        job.startedAt,
        job.completedAt,
        job.recordsProcessed,
        job.discrepanciesFound,
        job.errorMessage,
        job.triggeredBy,
        job.scheduled,
      ]
    );
  }

  private countByField(items: Discrepancy[], field: keyof Discrepancy): Record<string, number> {
    return items.reduce((acc, item) => {
      const key = String(item[field]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export const reconciliationService = new ReconciliationService();
