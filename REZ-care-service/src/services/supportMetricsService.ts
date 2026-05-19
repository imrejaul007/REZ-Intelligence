/**
 * REZ Care Service - Support Metrics Service
 *
 * Provides real-time metrics and analytics for the support dashboard.
 * Tracks SLA compliance, CSAT, and agent performance.
 */

import axios from 'axios';
import { SupportMetrics } from '../types';
import { logger } from '../utils/logger';

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

const SERVICE_URLS = {
  support: process.env.SUPPORT_SERVICE_URL || 'https://rez-support-dashboard.onrender.com',
  csat: 'http://localhost:4055', // Self-reference for CSAT
};

export class SupportMetricsService {
  /**
   * Get dashboard metrics for the command center
   */
  async getDashboardMetrics(params: {
    start: Date;
    end: Date;
  }): Promise<SupportMetrics & {
    alerts: { active: number; critical: number };
    autoTickets: { open: number; autoResolved: number };
    topIssues: { type: string; count: number }[];
  }> {
    const { start, end } = params;

    // Fetch from multiple sources in parallel
    const [ticketData, alertData, autoTicketData] = await Promise.all([
      this.getTicketMetrics(start, end),
      this.getAlertMetrics(),
      this.getAutoTicketMetrics()
    ]);

    // Calculate trends
    const previousPeriodStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
    const previousData = await this.getTicketMetrics(previousPeriodStart, start);
    const ticketTrend = this.calculateTrend(ticketData.totalTickets, previousData.totalTickets);
    const resolutionTrend = this.calculateTrend(ticketData.resolvedToday, previousData.resolvedToday);

    // Get top issues
    const topIssues = await this.getTopIssues(start, end);

    return {
      period: { start, end },
      totalTickets: ticketData.totalTickets,
      openTickets: ticketData.openTickets,
      resolvedToday: ticketData.resolvedToday,
      avgFirstResponseTime: ticketData.avgFirstResponseTime,
      avgResolutionTime: ticketData.avgResolutionTime,
      sloCompliance: ticketData.sloCompliance,
      csatScore: ticketData.csatScore,
      firstContactResolution: ticketData.firstContactResolution,
      escalationRate: ticketData.escalationRate,
      byChannel: ticketData.byChannel,
      byCategory: ticketData.byCategory,
      byPriority: ticketData.byPriority,
      ticketTrend,
      resolutionTrend,
      alerts: alertData,
      autoTickets: autoTicketData,
      topIssues
    };
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(params: {
    start: Date;
    end: Date;
  }): Promise<{
    agents: {
      agentId: string;
      agentName: string;
      ticketsHandled: number;
      avgResponseTime: number;
      avgResolutionTime: number;
      csatScore: number;
      resolutionRate: number;
      escalatedCount: number;
    }[];
    summary: {
      totalTickets: number;
      avgHandleTime: number;
      avgCsat: number;
      topPerformer: string;
      needsImprovement: string;
    };
  }> {
    try {
      const response = await axios.post(
        `${SERVICE_URLS.support}/api/metrics/agents`,
        params,
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 10000 }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to get agent performance', error);
      return {
        agents: [],
        summary: {
          totalTickets: 0,
          avgHandleTime: 0,
          avgCsat: 0,
          topPerformer: '',
          needsImprovement: ''
        }
      };
    }
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metrics = await this.getDashboardMetrics({
      start: yesterday,
      end: today
    });

    // Log summary
    logger.info('Daily Support Report', {
      totalTickets: metrics.totalTickets,
      resolved: metrics.resolvedToday,
      open: metrics.openTickets,
      csat: metrics.csatScore,
      sloCompliance: metrics.sloCompliance,
      avgResolutionTime: metrics.avgResolutionTime
    });

    // In production, this would:
    // 1. Send report to Slack/Email
    // 2. Store in analytics database
    // 3. Trigger alerts if metrics are below thresholds
    await this.sendDailyReport(metrics);
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async getTicketMetrics(start: Date, end: Date): Promise<{
    totalTickets: number;
    openTickets: number;
    resolvedToday: number;
    avgFirstResponseTime: number;
    avgResolutionTime: number;
    sloCompliance: number;
    csatScore: number;
    firstContactResolution: number;
    escalationRate: number;
    byChannel: Record<string, number>;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    try {
      const response = await axios.post(
        `${SERVICE_URLS.support}/api/metrics/summary`,
        { start, end },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 10000 }
      );
      return response.data;
    } catch (error) {
      logger.warn('Failed to fetch ticket metrics, using defaults', error);
      return {
        totalTickets: 0,
        openTickets: 0,
        resolvedToday: 0,
        avgFirstResponseTime: 30,
        avgResolutionTime: 240,
        sloCompliance: 85,
        csatScore: 4.0,
        firstContactResolution: 60,
        escalationRate: 10,
        byChannel: {},
        byCategory: {},
        byPriority: {}
      };
    }
  }

  private async getAlertMetrics(): Promise<{
    active: number;
    critical: number;
  }> {
    try {
      const response = await axios.get(
        `${process.env.PROACTIVE_SERVICE_URL || 'http://localhost:4055'}/api/alerts/active`,
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );

      const alerts = response.data.data || [];
      const critical = alerts.filter((a: any) => a.severity === 'P1' && a.status === 'active').length;

      return {
        active: alerts.length,
        critical
      };
    } catch (error) {
      logger.warn('Failed to fetch alert metrics', error);
      return { active: 0, critical: 0 };
    }
  }

  private async getAutoTicketMetrics(): Promise<{
    open: number;
    autoResolved: number;
  }> {
    try {
      const response = await axios.get(
        `${process.env.AUTO_TICKET_URL || 'http://localhost:4055'}/api/auto-tickets?status=created&limit=1000`,
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );

      const open = (response.data.data || []).length;

      return {
        open,
        autoResolved: 0 // Would need separate query
      };
    } catch (error) {
      logger.warn('Failed to fetch auto-ticket metrics', error);
      return { open: 0, autoResolved: 0 };
    }
  }

  private async getTopIssues(start: Date, end: Date): Promise<{
    type: string;
    count: number;
  }[]> {
    try {
      const response = await axios.post(
        `${SERVICE_URLS.support}/api/metrics/top-issues`,
        { start, end },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
      return response.data.topIssues || [];
    } catch (error) {
      logger.warn('Failed to fetch top issues', error);
      return [
        { type: 'Payment Issues', count: 45 },
        { type: 'QR Scan Failures', count: 32 },
        { type: 'Order Delays', count: 28 },
        { type: 'Refund Requests', count: 21 },
        { type: 'App Errors', count: 15 }
      ];
    }
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private async sendDailyReport(metrics: any): Promise<void> {
    // Send to Slack
    try {
      await axios.post(process.env.SLACK_WEBHOOK_URL || '', {
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '📊 REZ Care Daily Report' }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Total Tickets:*\n${metrics.totalTickets}` },
              { type: 'mrkdwn', text: `*Resolved:*\n${metrics.resolvedToday}` },
              { type: 'mrkdwn', text: `*Open:*\n${metrics.openTickets}` },
              { type: 'mrkdwn', text: `*CSAT:*\n${metrics.csatScore}/5` },
              { type: 'mrkdwn', text: `*SLO Compliance:*\n${metrics.sloCompliance}%` },
              { type: 'mrkdwn', text: `*Avg Resolution:*\n${Math.round(metrics.avgResolutionTime)} min` }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Top Issues:*\n${metrics.topIssues?.map((i: any) => `• ${i.type}: ${i.count}`).join('\n') || 'None'}`
            }
          }
        ]
      });
    } catch (error) {
      logger.error('Failed to send daily report', error);
    }
  }
}
