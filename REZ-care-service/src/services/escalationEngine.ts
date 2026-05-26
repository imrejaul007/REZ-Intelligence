/**
 * REZ Care Service - Escalation Engine
 *
 * Automatic escalation based on rules:
 * - Time-based (if not resolved in X minutes)
 * - Sentiment-triggered (negative sentiment → escalate)
 * - VIP priority escalation
 * - Repeated issues escalation
 * - SLA breach detection
 */

import mongoose, { Schema } from 'mongoose';
import cron from 'node-cron';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { AgentManagementService } from './agentManagementService';
import { generateRuleId, generateEscalationLogId } from '../utils/idGenerator';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';
const NOTIFICATIONS_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4011';

// Escalation Rule Schema
const EscalationRuleSchema = new mongoose.Schema({
  ruleId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: String,

  // Trigger conditions
  trigger: {
    type: {
      type: String,
      enum: ['time', 'sentiment', 'priority', 'repeat', 'sla', 'tag'],
      required: true
    },
    conditions: mongoose.Schema.Types.Mixed // Flexible conditions
  },

  // Escalation action
  action: {
    type: {
      type: String,
      enum: ['assign_higher', 'notify_manager', 'create_incident', 'auto_resolve', 'ping_agent'],
      required: true
    },
    target: String, // agentId, role, or manager email
    priority: String
  },

  // Timing
  timing: {
    delayMinutes: { type: Number, default: 0 },
    repeatInterval: Number
  },

  active: { type: Boolean, default: true },
  priority: { type: Number, default: 1 }
});

EscalationRuleSchema.index({ 'trigger.type': 1, active: 1 });

const EscalationRule = mongoose.model('EscalationRule', EscalationRuleSchema);

// Escalation Log Schema
const EscalationLogSchema = new mongoose.Schema({
  logId: { type: String, required: true, unique: true, index: true },
  ticketId: String,
  customerId: String,
  ruleId: String,

  // Escalation details
  from: {
    agentId: String,
    agentName: String,
    level: Number
  },
  to: {
    agentId: String,
    agentName: String,
    role: String
  },

  reason: String,
  trigger: String,
  notes: String,

  createdAt: { type: Date, default: Date.now }
});

EscalationLogSchema.index({ ticketId: 1 });
EscalationLogSchema.index({ customerId: 1 });
EscalationLogSchema.index({ createdAt: -1 });

const EscalationLog = mongoose.model('EscalationLog', EscalationLogSchema);

export class EscalationEngine {
  private connected: boolean = false;
  private agentService: AgentManagementService;

  constructor() {
    this.agentService = new AgentManagementService();
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await mongoose.connect(MONGODB_URI);
      this.connected = true;
      logger.info('Escalation Engine connected to MongoDB');
    }
  }

  // ============================================
  // ESCALATION RULES
  // ============================================

  /**
   * Create escalation rule
   */
  async createRule(rule: {
    name: string;
    description?: string;
    trigger: {
      type: 'time' | 'sentiment' | 'priority' | 'repeat' | 'sla' | 'tag';
      conditions: Record<string, unknown>;
    };
    action: {
      type: 'assign_higher' | 'notify_manager' | 'create_incident' | 'auto_resolve' | 'ping_agent';
      target?: string;
      priority?: string;
    };
    delayMinutes?: number;
    repeatInterval?: number;
  }): Promise<unknown> {
    await this.connect();

    const ruleId = generateRuleId();

    const newRule = new EscalationRule({
      ruleId,
      ...rule
    });

    await newRule.save();
    logger.info('Escalation rule created', { ruleId, name: rule.name });

    return newRule;
  }

  /**
   * Initialize default rules
   */
  async initializeDefaultRules(): Promise<void> {
    await this.connect();

    const defaultRules = [
      {
        ruleId: 'RULE-001',
        name: 'Time-based: Not resolved in 30 min',
        description: 'Escalate if ticket not resolved within 30 minutes',
        trigger: { type: 'time', conditions: { minutes: 30 } },
        action: { type: 'assign_higher', target: 'senior_agent' },
        timing: { delayMinutes: 0 },
        active: true,
        priority: 1
      },
      {
        ruleId: 'RULE-002',
        name: 'Time-based: Not resolved in 60 min',
        description: 'Escalate to team lead if not resolved within 60 minutes',
        trigger: { type: 'time', conditions: { minutes: 60 } },
        action: { type: 'assign_higher', target: 'team_lead' },
        timing: { delayMinutes: 0 },
        active: true,
        priority: 2
      },
      {
        ruleId: 'RULE-003',
        name: 'Sentiment: Critical negative',
        description: 'Escalate immediately if sentiment is critical negative',
        trigger: { type: 'sentiment', conditions: { sentiment: 'critical_negative' } },
        action: { type: 'notify_manager', target: 'manager' },
        timing: { delayMinutes: 0 },
        active: true,
        priority: 1
      },
      {
        ruleId: 'RULE-004',
        name: 'Sentiment: Negative',
        description: 'Escalate to senior agent if sentiment is negative',
        trigger: { type: 'sentiment', conditions: { sentiment: 'negative' } },
        action: { type: 'assign_higher', target: 'senior_agent' },
        timing: { delayMinutes: 15 },
        active: true,
        priority: 2
      },
      {
        ruleId: 'RULE-005',
        name: 'Priority: Urgent tickets',
        description: 'Escalate urgent tickets immediately',
        trigger: { type: 'priority', conditions: { priority: 'urgent' } },
        action: { type: 'assign_higher', target: 'senior_agent' },
        timing: { delayMinutes: 0 },
        active: true,
        priority: 1
      },
      {
        ruleId: 'RULE-006',
        name: 'Repeat: Same issue 3 times',
        description: 'Escalate if customer reports same issue 3+ times',
        trigger: { type: 'repeat', conditions: { count: 3 } },
        action: { type: 'create_incident', target: 'quality_team' },
        timing: { delayMinutes: 0 },
        active: true,
        priority: 1
      },
      {
        ruleId: 'RULE-007',
        name: 'VIP: Always escalate',
        description: 'VIP customers always get senior agent attention',
        trigger: { type: 'tag', conditions: { tag: 'vip' } },
        action: { type: 'assign_higher', target: 'senior_agent' },
        timing: { delayMinutes: 10 },
        active: true,
        priority: 1
      },
      {
        ruleId: 'RULE-008',
        name: 'SLA breach: 50% time passed',
        description: 'Alert if SLA is at 50% time with no resolution',
        trigger: { type: 'sla', conditions: { threshold: 50 } },
        action: { type: 'ping_agent', target: 'current' },
        timing: { delayMinutes: 0 },
        active: true,
        priority: 2
      }
    ];

    for (const rule of defaultRules) {
      await EscalationRule.findOneAndUpdate(
        { ruleId: rule.ruleId },
        rule,
        { upsert: true, new: true }
      );
    }

    logger.info('Default escalation rules initialized');
  }

  // ============================================
  // ESCALATION EXECUTION
  // ============================================

  /**
   * Check and execute escalations for a ticket
   */
  async checkEscalations(ticket: {
    ticketId: string;
    customerId: string;
    customerPhone: string;
    assignedAgent?: { agentId: string; agentName: string; level?: number };
    priority?: string;
    sentiment?: string;
    tags?: string[];
    createdAt: Date;
    slaDeadline?: Date;
    platform?: string;
  }): Promise<{
    escalated: boolean;
    reason?: string;
    action?: string;
  }> {
    await this.connect();

    const rules = await EscalationRule.find({ active: true }).sort({ priority: 1 });

    for (const rule of rules) {
      const triggered = await this.evaluateRule(rule, ticket);
      if (triggered) {
        return await this.executeEscalation(rule, ticket);
      }
    }

    return { escalated: false };
  }

  /**
   * Evaluate if rule should trigger
   */
  private async evaluateRule(rule: InstanceType<typeof EscalationRule>, ticket: {
    ticketId: string;
    customerId: string;
    customerPhone: string;
    assignedAgent?: { agentId: string; agentName: string; level?: number };
    priority?: string;
    sentiment?: string;
    tags?: string[];
    createdAt: Date;
    slaDeadline?: Date;
    platform?: string;
  }): Promise<boolean> {
    const { type, conditions } = rule.trigger as { type: string; conditions: Record<string, unknown> };

    switch (type) {
      case 'time': {
        const minutesElapsed = (Date.now() - new Date(ticket.createdAt).getTime()) / 60000;
        return minutesElapsed >= (conditions.minutes as number);
      }

      case 'sentiment': {
        return ticket.sentiment === conditions.sentiment;
      }

      case 'priority': {
        return ticket.priority === conditions.priority;
      }

      case 'tag': {
        return ticket.tags?.includes(conditions.tag as string);
      }

      case 'repeat': {
        // Check if customer had same issue before
        const recentEscalations = await EscalationLog.countDocuments({
          customerId: ticket.customerId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });
        return recentEscalations >= (conditions.count as number);
      }

      case 'sla': {
        if (!ticket.slaDeadline) return false;
        const totalTime = ticket.slaDeadline.getTime() - new Date(ticket.createdAt).getTime();
        const elapsed = Date.now() - new Date(ticket.createdAt).getTime();
        const percentElapsed = (elapsed / totalTime) * 100;
        return percentElapsed >= (conditions.threshold as number);
      }

      default:
        return false;
    }
  }

  /**
   * Execute escalation action
   */
  private async executeEscalation(rule: InstanceType<typeof EscalationRule>, ticket: {
    ticketId: string;
    customerId: string;
    customerPhone: string;
    assignedAgent?: { agentId: string; agentName: string; level?: number };
    priority?: string;
    sentiment?: string;
    tags?: string[];
    createdAt: Date;
    slaDeadline?: Date;
    platform?: string;
  }): Promise<{
    escalated: boolean;
    reason?: string;
    action?: string;
  }> {
    const ruleAction = rule.action as { type: string; target?: string; priority?: string };
    const { type, target } = ruleAction;

    switch (type) {
      case 'assign_higher': {
        const escalatedTo = await this.agentService.escalateTicket(ticket.ticketId, ticket.assignedAgent?.agentId);

        if (escalatedTo) {
          await this.logEscalation({
            ticketId: ticket.ticketId,
            customerId: ticket.customerId,
            ruleId: rule.ruleId,
            from: ticket.assignedAgent,
            to: { agentId: escalatedTo.agentId, agentName: escalatedTo.name, role: escalatedTo.role },
            reason: rule.name,
            trigger: rule.trigger.type
          });

          // Notify new agent
          await this.notifyAgent(escalatedTo.agentId, {
            ticketId: ticket.ticketId,
            customerPhone: ticket.customerPhone,
            reason: `Escalated from ${ticket.assignedAgent?.agentName}: ${rule.description}`
          });

          return {
            escalated: true,
            reason: rule.name,
            action: `Escalated to ${escalatedTo.name}`
          };
        }
        break;
      }

      case 'notify_manager': {
        await this.notifyManager({
          ticketId: ticket.ticketId,
          customerId: ticket.customerId,
          reason: rule.description,
          priority: ticket.priority
        });

        return {
          escalated: true,
          reason: rule.name,
          action: 'Manager notified'
        };
      }

      case 'ping_agent': {
        if (ticket.assignedAgent) {
          await this.notifyAgent(ticket.assignedAgent.agentId, {
            ticketId: ticket.ticketId,
            message: `⚠️ SLA Alert: Your ticket is approaching deadline. Please prioritize.`
          });
        }

        return {
          escalated: true,
          reason: rule.name,
          action: 'Agent pinged'
        };
      }

      case 'create_incident': {
        // Create incident ticket for quality team
        await this.createIncident({
          ticketId: ticket.ticketId,
          customerId: ticket.customerId,
          reason: rule.description
        });

        return {
          escalated: true,
          reason: rule.name,
          action: 'Incident created for quality team'
        };
      }
    }

    return { escalated: false };
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  private async notifyAgent(agentId: string, data: { ticketId: string; customerPhone?: string; message?: string; reason?: string }): Promise<void> {
    try {
      await axios.post(`${NOTIFICATIONS_URL}/api/notifications/send`, {
        userId: agentId,
        type: 'escalation',
        channel: 'inapp',
        title: 'Ticket Escalated',
        body: data.message || `Ticket ${data.ticketId} has been escalated to you`,
        data
      }, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to notify agent', error);
    }
  }

  private async notifyManager(data: { ticketId: string; customerId: string; reason: string; priority?: string }): Promise<void> {
    try {
      await axios.post(`${NOTIFICATIONS_URL}/api/notifications/send`, {
        userId: 'support-manager',
        type: 'escalation',
        channel: 'inapp',
        title: `Escalation Alert: ${data.priority || 'Medium'}`,
        body: `${data.reason}`,
        data
      }, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to notify manager', error);
    }
  }

  private async createIncident(data: { ticketId: string; customerId: string; reason: string }): Promise<void> {
    // Would create incident in incident management system
    logger.info('Incident created', data);
  }

  // ============================================
  // LOGGING
  // ============================================

  private async logEscalation(data: {
    ticketId: string;
    customerId: string;
    ruleId: string;
    from?: { agentId?: string; agentName?: string; level?: number };
    to: { agentId: string; agentName: string; role?: string };
    reason: string;
    trigger: string;
  }): Promise<void> {
    const logId = generateEscalationLogId();

    await EscalationLog.create({
      logId,
      ...data,
      createdAt: new Date()
    });
  }

  // ============================================
  // CRON JOBS
  // ============================================

  /**
   * Start escalation monitoring
   */
  startMonitoring(): void {
    // Check escalations every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.runEscalationChecks();
    });

    logger.info('Escalation monitoring started');
  }

  /**
   * Run escalation checks on all open tickets
   */
  private async runEscalationChecks(): Promise<void> {
    try {
      // This would query actual ticket system
      // For now, just log
      logger.info('Running escalation checks');
    } catch (error) {
      logger.error('Escalation check failed', error);
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get escalation metrics
   */
  async getMetrics(): Promise<{
    totalEscalations: number;
    byRule: Record<string, number>;
    avgEscalationTime: number;
    escalationRate: number;
  }> {
    await this.connect();

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const logs = await EscalationLog.find({ createdAt: { $gte: yesterday } });

    const byRule: Record<string, number> = {};
    let totalTime = 0;

    for (const log of logs) {
      if (log.ruleId) {
        byRule[log.ruleId] = (byRule[log.ruleId] || 0) + 1;
      }
    }

    return {
      totalEscalations: logs.length,
      byRule,
      avgEscalationTime: logs.length > 0 ? totalTime / logs.length : 0,
      escalationRate: 0 // Would calculate from total tickets
    };
  }

  /**
   * Get escalation history for ticket
   */
  async getTicketHistory(ticketId: string): Promise<unknown[]> {
    await this.connect();
    return EscalationLog.find({ ticketId }).sort({ createdAt: -1 });
  }
}
