import { v4 as uuidv4 } from 'uuid';
import { format, startOfDay, endOfDay, subDays, differenceInDays } from 'date-fns';
import { query, queryOne } from '../config/database';
import { logger } from '../utils/logger.js';
import {
  AuditReport,
  ReportSummary,
  Transaction,
  Discrepancy,
  Dispute,
  ReconciliationJob,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '../models/types';

export class AuditService {
  /**
   * Generate daily balance report
   */
  async generateDailyBalanceReport(date: Date, accountId?: string): Promise<AuditReport> {
    logger.info('Generating daily balance report', { date, accountId });

    const reportDate = format(date, 'yyyy-MM-dd');
    const periodStart = startOfDay(date);
    const periodEnd = endOfDay(date);

    // Get transaction summary
    const transactionSummary = await this.getTransactionSummary(periodStart, periodEnd, accountId);

    // Get balance records
    const balanceRecords = await this.getBalanceRecords(periodStart, periodEnd, accountId);

    // Calculate opening and closing balances
    const openingBalance = balanceRecords[0]?.balance || 0;
    const closingBalance = balanceRecords[balanceRecords.length - 1]?.balance || openingBalance;

    // Get discrepancy summary
    const discrepancySummary = await this.getDiscrepancySummary(periodStart, periodEnd);

    // Get dispute summary
    const disputeSummary = await this.getDisputeSummary(periodStart, periodEnd);

    const summary: ReportSummary = {
      totalTransactions: transactionSummary.totalCount,
      totalAmount: transactionSummary.totalAmount,
      discrepanciesFound: discrepancySummary.total,
      discrepanciesResolved: discrepancySummary.resolved,
      disputesFiled: disputeSummary.total,
      disputesResolved: disputeSummary.resolved,
      successRate: this.calculateSuccessRate(transactionSummary),
    };

    const report: AuditReport = {
      id: uuidv4(),
      reportId: `BAL-${reportDate}-${uuidv4().slice(0, 8).toUpperCase()}`,
      type: 'daily_balance',
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      generatedBy: 'system',
      summary,
      details: {
        openingBalance,
        closingBalance,
        balanceRecords: balanceRecords.length,
        transactionBreakdown: transactionSummary.breakdown,
        discrepancyBreakdown: discrepancySummary.byType,
        disputeBreakdown: disputeSummary.byType,
      },
      status: 'published',
    };

    await this.saveReport(report);

    logger.info('Daily balance report generated', { reportId: report.reportId });
    return report;
  }

  /**
   * Generate transaction summary report
   */
  async generateTransactionSummaryReport(
    startDate: Date,
    endDate: Date,
    accountId?: string
  ): Promise<AuditReport> {
    logger.info('Generating transaction summary report', { startDate, endDate, accountId });

    const transactionSummary = await this.getTransactionSummary(startDate, endDate, accountId);
    const discrepancySummary = await this.getDiscrepancySummary(startDate, endDate);

    // Get hourly breakdown
    const hourlyBreakdown = await this.getHourlyBreakdown(startDate, endDate, accountId);

    // Get top merchants
    const topMerchants = await this.getTopMerchants(startDate, endDate, accountId);

    const summary: ReportSummary = {
      totalTransactions: transactionSummary.totalCount,
      totalAmount: transactionSummary.totalAmount,
      discrepanciesFound: discrepancySummary.total,
      discrepanciesResolved: discrepancySummary.resolved,
      disputesFiled: 0,
      disputesResolved: 0,
      successRate: this.calculateSuccessRate(transactionSummary),
    };

    const report: AuditReport = {
      id: uuidv4(),
      reportId: `TXN-${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}-${uuidv4().slice(0, 6).toUpperCase()}`,
      type: 'transaction_summary',
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      generatedBy: 'system',
      summary,
      details: {
        transactionBreakdown: transactionSummary.breakdown,
        hourlyBreakdown,
        topMerchants,
        discrepancyBreakdown: discrepancySummary.byType,
      },
      status: 'published',
    };

    await this.saveReport(report);
    return report;
  }

  /**
   * Generate discrepancy analysis report
   */
  async generateDiscrepancyAnalysisReport(
    startDate: Date,
    endDate: Date
  ): Promise<AuditReport> {
    logger.info('Generating discrepancy analysis report', { startDate, endDate });

    const discrepancies = await this.getDiscrepanciesInRange(startDate, endDate);
    const discrepanciesByType = this.groupBy(discrepancies, 'type');
    const discrepanciesBySeverity = this.groupBy(discrepancies, 'severity');
    const discrepanciesByStatus = this.groupBy(discrepancies, 'status');

    // Calculate resolution metrics
    const resolved = discrepancies.filter(d => d.status === 'resolved');
    const resolutionRate = discrepancies.length > 0 ? resolved.length / discrepancies.length : 1;

    // Calculate average resolution time
    let avgResolutionTime = 0;
    const resolvedWithTime = resolved.filter(d => d.resolvedAt && d.detectedAt);
    if (resolvedWithTime.length > 0) {
      const totalTime = resolvedWithTime.reduce((sum, d) => {
        return sum + (new Date(d.resolvedAt!).getTime() - new Date(d.detectedAt).getTime());
      }, 0);
      avgResolutionTime = totalTime / resolvedWithTime.length;
    }

    const summary: ReportSummary = {
      totalTransactions: discrepancies.length,
      totalAmount: discrepancies.reduce((sum, d) => sum + (Number(d.actualValue) || 0), 0),
      discrepanciesFound: discrepancies.length,
      discrepanciesResolved: resolved.length,
      disputesFiled: 0,
      disputesResolved: 0,
      successRate: resolutionRate,
    };

    const report: AuditReport = {
      id: uuidv4(),
      reportId: `DSC-${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}-${uuidv4().slice(0, 6).toUpperCase()}`,
      type: 'discrepancy_analysis',
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      generatedBy: 'system',
      summary,
      details: {
        byType: Object.entries(discrepanciesByType).map(([type, items]) => ({
          type,
          count: items.length,
          percentage: (items.length / discrepancies.length) * 100,
        })),
        bySeverity: Object.entries(discrepanciesBySeverity).map(([severity, items]) => ({
          severity,
          count: items.length,
          percentage: (items.length / discrepancies.length) * 100,
        })),
        byStatus: Object.entries(discrepanciesByStatus).map(([status, items]) => ({
          status,
          count: items.length,
          percentage: (items.length / discrepancies.length) * 100,
        })),
        resolutionRate,
        averageResolutionTimeMs: avgResolutionTime,
        averageResolutionTimeDays: avgResolutionTime / (1000 * 60 * 60 * 24),
      },
      status: 'published',
    };

    await this.saveReport(report);
    return report;
  }

  /**
   * Generate dispute report
   */
  async generateDisputeReport(startDate: Date, endDate: Date): Promise<AuditReport> {
    logger.info('Generating dispute report', { startDate, endDate });

    const disputeSummary = await this.getDisputeSummary(startDate, endDate);
    const disputes = await this.getDisputesInRange(startDate, endDate);
    const disputesByType = this.groupBy(disputes.map(d => ({ ...d, type: d.type })), 'type');
    const disputesByStatus = this.groupBy(disputes.map(d => ({ ...d, status: d.status })), 'status');

    // Calculate resolution metrics
    const resolved = disputes.filter(d =>
      d.status === 'resolved_favor_merchant' || d.status === 'resolved_favor_customer'
    );
    const resolutionRate = disputes.length > 0 ? resolved.length / disputes.length : 1;

    const merchantWins = disputes.filter(d => d.status === 'resolved_favor_merchant');
    const customerWins = disputes.filter(d => d.status === 'resolved_favor_customer');

    const summary: ReportSummary = {
      totalTransactions: disputes.length,
      totalAmount: disputes.reduce((sum, d) => sum + d.amount, 0),
      discrepanciesFound: 0,
      discrepanciesResolved: 0,
      disputesFiled: disputes.length,
      disputesResolved: resolved.length,
      successRate: merchantWins.length / resolved.length || 1,
    };

    const report: AuditReport = {
      id: uuidv4(),
      reportId: `DPT-${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}-${uuidv4().slice(0, 6).toUpperCase()}`,
      type: 'dispute_report',
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      generatedBy: 'system',
      summary,
      details: {
        byType: Object.entries(disputesByType).map(([type, items]) => ({
          type,
          count: items.length,
          totalAmount: (items as Dispute[]).reduce((sum, d) => sum + d.amount, 0),
        })),
        byStatus: Object.entries(disputesByStatus).map(([status, items]) => ({
          status,
          count: items.length,
          totalAmount: (items as Dispute[]).reduce((sum, d) => sum + d.amount, 0),
        })),
        merchantWins: merchantWins.length,
        customerWins: customerWins.length,
        totalDisputedAmount: disputes.reduce((sum, d) => sum + d.amount, 0),
        resolutionRate,
      },
      status: 'published',
    };

    await this.saveReport(report);
    return report;
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<AuditReport> {
    logger.info('Generating compliance report', { startDate, endDate });

    const transactionSummary = await this.getTransactionSummary(startDate, endDate);
    const discrepancySummary = await this.getDiscrepancySummary(startDate, endDate);
    const disputeSummary = await this.getDisputeSummary(startDate, endDate);

    // Calculate compliance metrics
    const complianceRate = 1 - (discrepancySummary.total / (transactionSummary.totalCount || 1));
    const slaCompliance = discrepancySummary.total > 0
      ? discrepancySummary.resolved / discrepancySummary.total
      : 1;

    const summary: ReportSummary = {
      totalTransactions: transactionSummary.totalCount,
      totalAmount: transactionSummary.totalAmount,
      discrepanciesFound: discrepancySummary.total,
      discrepanciesResolved: discrepancySummary.resolved,
      disputesFiled: disputeSummary.total,
      disputesResolved: disputeSummary.resolved,
      successRate: complianceRate,
    };

    const report: AuditReport = {
      id: uuidv4(),
      reportId: `CMP-${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}-${uuidv4().slice(0, 6).toUpperCase()}`,
      type: 'compliance_report',
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      generatedBy: 'system',
      summary,
      details: {
        complianceRate,
        slaCompliance,
        discrepancyResolutionRate: discrepancySummary.resolved / (discrepancySummary.total || 1),
        disputeResolutionRate: disputeSummary.resolved / (disputeSummary.total || 1),
        transactionVolume: transactionSummary.totalCount,
        transactionAmount: transactionSummary.totalAmount,
        discrepancyRate: discrepancySummary.total / (transactionSummary.totalCount || 1),
        disputeRate: disputeSummary.total / (transactionSummary.totalCount || 1),
      },
      status: 'published',
    };

    await this.saveReport(report);
    return report;
  }

  /**
   * Get saved reports with pagination
   */
  async getReports(
    params: PaginationParams & {
      type?: AuditReport['type'];
      status?: AuditReport['status'];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<PaginatedResponse<AuditReport>> {
    const { page, limit, sortBy = 'generatedAt', sortOrder = 'desc', type, status, startDate, endDate } = params;

    let whereClause = 'WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (type) {
      whereClause += ` AND type = $${paramIndex++}`;
      values.push(type);
    }
    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(status);
    }
    if (startDate) {
      whereClause += ` AND period_start >= $${paramIndex++}`;
      values.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND period_end <= $${paramIndex++}`;
      values.push(endDate);
    }

    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) FROM audit_reports ${whereClause}`;
    const countResult = await queryOne<{ count: string }>(countQuery, values);
    const total = parseInt(countResult?.count || '0', 10);

    const dataQuery = `
      SELECT * FROM audit_reports
      ${whereClause}
      ORDER BY ${sortBy === 'generatedAt' ? 'generated_at' : sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const rows = await query(dataQuery, [...values, limit, offset]);
    const data = rows.map(row => this.mapRowToReport(row));

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
   * Get report by ID
   */
  async getReport(reportId: string): Promise<AuditReport | null> {
    const row = await queryOne(
      'SELECT * FROM audit_reports WHERE id = $1 OR report_id = $1',
      [reportId]
    );

    if (!row) return null;

    return this.mapRowToReport(row);
  }

  /**
   * Delete/archive report
   */
  async archiveReport(reportId: string): Promise<void> {
    await query(
      "UPDATE audit_reports SET status = 'archived' WHERE id = $1 OR report_id = $1",
      [reportId]
    );
    logger.info('Report archived', { reportId });
  }

  // Private helper methods

  private async getTransactionSummary(
    startDate: Date,
    endDate: Date,
    accountId?: string
  ): Promise<{
    totalCount: number;
    totalAmount: number;
    breakdown: Record<string, { count: number; amount: number }>;
  }> {
    let whereClause = 'WHERE timestamp >= $1 AND timestamp <= $2';
    const values: unknown[] = [startDate, endDate];

    if (accountId) {
      whereClause += ' AND (merchant_id = $3 OR customer_id = $3)';
      values.push(accountId);
    }

    const rows = await query(
      `SELECT type, status, COUNT(*) as count, SUM(amount) as total
       FROM transactions ${whereClause}
       GROUP BY type, status`,
      values
    );

    let totalCount = 0;
    let totalAmount = 0;
    const breakdown: Record<string, { count: number; amount: number }> = {};

    for (const row of rows) {
      const count = parseInt(row.count, 10);
      const amount = parseFloat(row.total || '0');
      totalCount += count;
      totalAmount += amount;
      breakdown[`${row.type}_${row.status}`] = { count, amount };
    }

    return { totalCount, totalAmount, breakdown };
  }

  private async getBalanceRecords(startDate: Date, endDate: Date, accountId?: string): Promise<{
    balance: number;
    timestamp: Date;
  }[]> {
    let whereClause = 'WHERE timestamp >= $1 AND timestamp <= $2 AND source = $3';
    const values: unknown[] = [startDate, endDate, 'internal'];

    if (accountId) {
      whereClause += ' AND account_id = $4';
      values.push(accountId);
    }

    const rows = await query(
      `SELECT balance, timestamp FROM balance_records ${whereClause} ORDER BY timestamp`,
      values
    );

    return rows.map(row => ({
      balance: parseFloat(row.balance),
      timestamp: new Date(row.timestamp),
    }));
  }

  private async getDiscrepancySummary(startDate: Date, endDate: Date): Promise<{
    total: number;
    resolved: number;
    byType: Record<string, number>;
  }> {
    const rows = await query(
      `SELECT type, status, COUNT(*) as count
       FROM discrepancies
       WHERE detected_at >= $1 AND detected_at <= $2
       GROUP BY type, status`,
      [startDate, endDate]
    );

    let total = 0;
    let resolved = 0;
    const byType: Record<string, number> = {};

    for (const row of rows) {
      const count = parseInt(row.count, 10);
      total += count;
      if (row.status === 'resolved') {
        resolved += count;
      }
      byType[row.type] = (byType[row.type] || 0) + count;
    }

    return { total, resolved, byType };
  }

  private async getDisputeSummary(startDate: Date, endDate: Date): Promise<{
    total: number;
    resolved: number;
    byType: Record<string, number>;
  }> {
    const rows = await query(
      `SELECT type, status, COUNT(*) as count
       FROM disputes
       WHERE filed_at >= $1 AND filed_at <= $2
       GROUP BY type, status`,
      [startDate, endDate]
    );

    let total = 0;
    let resolved = 0;
    const byType: Record<string, number> = {};

    for (const row of rows) {
      const count = parseInt(row.count, 10);
      total += count;
      if (row.status === 'resolved_favor_merchant' || row.status === 'resolved_favor_customer') {
        resolved += count;
      }
      byType[row.type] = (byType[row.type] || 0) + count;
    }

    return { total, resolved, byType };
  }

  private async getHourlyBreakdown(startDate: Date, endDate: Date, accountId?: string): Promise<{
    hour: number;
    count: number;
    amount: number;
  }[]> {
    let whereClause = 'WHERE timestamp >= $1 AND timestamp <= $2';
    const values: unknown[] = [startDate, endDate];

    if (accountId) {
      whereClause += ' AND (merchant_id = $3 OR customer_id = $3)';
      values.push(accountId);
    }

    const rows = await query(
      `SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as count, SUM(amount) as total
       FROM transactions ${whereClause}
       GROUP BY EXTRACT(HOUR FROM timestamp)
       ORDER BY hour`,
      values
    );

    return rows.map(row => ({
      hour: parseInt(row.hour, 10),
      count: parseInt(row.count, 10),
      amount: parseFloat(row.total || '0'),
    }));
  }

  private async getTopMerchants(startDate: Date, endDate: Date, accountId?: string, limit = 10): Promise<{
    merchantId: string;
    transactionCount: number;
    totalAmount: number;
  }[]> {
    let whereClause = 'WHERE timestamp >= $1 AND timestamp <= $2 AND type = $3';
    const values: unknown[] = [startDate, endDate, 'credit'];

    if (accountId) {
      whereClause += ' AND merchant_id = $4';
      values.push(accountId);
    }

    const rows = await query(
      `SELECT merchant_id, COUNT(*) as count, SUM(amount) as total
       FROM transactions ${whereClause}
       GROUP BY merchant_id
       ORDER BY total DESC
       LIMIT $${values.length + 1}`,
      [...values, limit]
    );

    return rows.map(row => ({
      merchantId: row.merchant_id,
      transactionCount: parseInt(row.count, 10),
      totalAmount: parseFloat(row.total || '0'),
    }));
  }

  private async getDiscrepanciesInRange(startDate: Date, endDate: Date): Promise<Discrepancy[]> {
    const rows = await query(
      'SELECT * FROM discrepancies WHERE detected_at >= $1 AND detected_at <= $2',
      [startDate, endDate]
    );

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      description: row.description,
      transactionId: row.transaction_id,
      expectedValue: row.expected_value,
      actualValue: row.actual_value,
      detectedAt: new Date(row.detected_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolvedBy: row.resolved_by,
      status: row.status,
      notes: row.notes,
    }));
  }

  private async getDisputesInRange(startDate: Date, endDate: Date): Promise<Dispute[]> {
    const rows = await query(
      'SELECT * FROM disputes WHERE filed_at >= $1 AND filed_at <= $2',
      [startDate, endDate]
    );

    return rows.map(row => ({
      id: row.id,
      transactionId: row.transaction_id,
      disputeId: row.dispute_id,
      type: row.type,
      reason: row.reason,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
      filedBy: row.filed_by,
      filedAt: new Date(row.filed_at),
      resolutionAt: row.resolution_at ? new Date(row.resolution_at) : undefined,
      notes: row.notes,
    }));
  }

  private async saveReport(report: AuditReport): Promise<void> {
    await query(
      `INSERT INTO audit_reports (id, report_id, type, period_start, period_end, generated_at, generated_by, summary, details, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         summary = EXCLUDED.summary,
         details = EXCLUDED.details`,
      [
        report.id,
        report.reportId,
        report.type,
        report.periodStart,
        report.periodEnd,
        report.generatedAt,
        report.generatedBy,
        JSON.stringify(report.summary),
        JSON.stringify(report.details),
        report.status,
      ]
    );
  }

  private mapRowToReport(row: Record<string, unknown>): AuditReport {
    return {
      id: row.id as string,
      reportId: row.report_id as string,
      type: row.type as AuditReport['type'],
      periodStart: new Date(row.period_start as string),
      periodEnd: new Date(row.period_end as string),
      generatedAt: new Date(row.generated_at as string),
      generatedBy: row.generated_by as string,
      summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      status: row.status as AuditReport['status'],
    };
  }

  private calculateSuccessRate(transactionSummary: { breakdown: Record<string, { count: number }> }): number {
    const completed = transactionSummary.breakdown['credit_completed']?.count || 0;
    const total = Object.values(transactionSummary.breakdown).reduce((sum, b) => sum + b.count, 0);
    return total > 0 ? completed / total : 1;
  }

  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((acc, item) => {
      const keyValue = String(item[key]);
      if (!acc[keyValue]) {
        acc[keyValue] = [];
      }
      acc[keyValue].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
}

export const auditService = new AuditService();
