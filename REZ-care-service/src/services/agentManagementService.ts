/**
 * REZ Care Service - Agent Management
 *
 * Agent roster, skills, routing, and load balancing.
 * HIGH PRIORITY - Needed for ticket assignment.
 */

import mongoose, { Schema } from 'mongoose';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';

// Interface for Agent documents
interface IAgent {
  agentId: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  level: number;
  status: string;
  currentTicketCount: number;
  maxConcurrentTickets: number;
  skills: Array<{ category: string; proficiency: string }>;
  platforms: string[];
  languages: string[];
  performance: {
    avgResolutionTime?: number;
    csatScore?: number;
    ticketsResolved: number;
    firstContactResolution?: number;
  };
}

// Agent Schema
const AgentSchema = new mongoose.Schema({
  agentId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,

  // Role & Level
  role: {
    type: String,
    enum: ['agent', 'senior_agent', 'team_lead', 'supervisor', 'manager', 'escalation'],
    default: 'agent'
  },
  level: { type: Number, default: 1 }, // 1-5

  // Skills & Categories
  skills: [{
    category: String,
    proficiency: { type: String, enum: ['basic', 'intermediate', 'expert'], default: 'intermediate' }
  }],

  // Supported platforms
  platforms: [{
    type: String,
    enum: ['hotel', 'restaurant', 'retail', 'delivery', 'ecommerce', 'all'],
    default: 'all'
  }],

  // Languages
  languages: [{ type: String, default: ['en'] }],

  // Status
  status: {
    type: String,
    enum: ['online', 'offline', 'busy', 'break', 'away'],
    default: 'offline'
  },
  currentTicketCount: { type: Number, default: 0 },
  maxConcurrentTickets: { type: Number, default: 10 },

  // Performance
  performance: {
    avgResolutionTime: Number, // minutes
    csatScore: Number,
    ticketsResolved: { type: Number, default: 0 },
    firstContactResolution: Number // percentage
  },

  // Schedule
  schedule: {
    timezone: { type: String, default: 'Asia/Kolkata' },
    shiftStart: String, // "09:00"
    shiftEnd: String, // "18:00"
    workingDays: [{ type: Number }], // [0-6]
  },

  // Escalation
  canEscalate: { type: Boolean, default: false },
  escalationTarget: String, // agentId to escalate to

  // Metadata
  hiredAt: Date,
  lastActiveAt: Date,
  metadata: mongoose.Schema.Types.Mixed

}, { timestamps: true });

AgentSchema.index({ status: 1, role: 1 });
AgentSchema.index({ 'skills.category': 1, status: 1 });
AgentSchema.index({ 'platforms': 1, status: 1 });

const AgentModel = mongoose.model('AgentModel', AgentSchema);

// Ticket Assignment Schema
const TicketAssignmentSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, index: true },
  agentId: { type: String, required: true, index: true },
  assignedAt: { type: Date, default: Date.now },
  assignedBy: String, // 'system', 'agentId', 'customer'
  reason: String,
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' }
});

const TicketAssignmentModel = mongoose.model('TicketAssignmentModel', TicketAssignmentSchema);

export class AgentManagementService {
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (!this.connected) {
      await mongoose.connect(MONGODB_URI);
      this.connected = true;
      logger.info('Agent Management connected to MongoDB');
    }
  }

  // ============================================
  // AGENT CRUD
  // ============================================

  async createAgent(agent: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
    skills?: { category: string; proficiency: string }[];
    platforms?: string[];
    languages?: string[];
    maxConcurrentTickets?: number;
  }): Promise<any> {
    await this.connect();

    const agentId = `AGENT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const newAgent = new AgentModel({
      agentId,
      ...agent,
      performance: {
        avgResolutionTime: 0,
        csatScore: 0,
        ticketsResolved: 0,
        firstContactResolution: 0
      },
      hiredAt: new Date(),
      lastActiveAt: new Date()
    });

    await newAgent.save();
    logger.info('Agent created', { agentId, name: agent.name });
    return newAgent;
  }

  async getAgent(agentId: string): Promise<IAgent | null> {
    await this.connect();
    return AgentModel.findOne({ agentId });
  }

  async getAllAgents(filters?: {
    status?: string;
    role?: string;
    platform?: string;
    onlineOnly?: boolean;
  }): Promise<IAgent[]> {
    await this.connect();

    const query: any = {};

    if (filters?.status) query.status = filters.status;
    if (filters?.role) query.role = filters.role;
    if (filters?.onlineOnly) query.status = 'online';
    if (filters?.platform) {
      query.$or = [
        { platforms: filters.platform },
        { platforms: 'all' }
      ];
    }

    return AgentModel.find(query).sort({ level: -1, 'performance.csatScore': -1 }) as any;
  }

  async updateAgent(agentId: string, updates: Partial<any>): Promise<IAgent | null> {
    await this.connect();
    const agent = await AgentModel.findOneAndUpdate(
      { agentId },
      { $set: updates },
      { new: true }
    );
    if (agent) {
      agent.lastActiveAt = new Date();
      await agent.save();
    }
    return agent as any;
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    await this.connect();
    const result = await AgentModel.deleteOne({ agentId });
    return result.deletedCount > 0;
  }

  // ============================================
  // AGENT STATUS
  // ============================================

  async setStatus(agentId: string, status: string): Promise<IAgent | null> {
    await this.connect();
    return AgentModel.findOneAndUpdate(
      { agentId },
      { $set: { status, lastActiveAt: new Date() } },
      { new: true }
    ) as any;
  }

  async goOnline(agentId: string): Promise<IAgent | null> {
    return this.setStatus(agentId, 'online');
  }

  async goOffline(agentId: string): Promise<IAgent | null> {
    return this.setStatus(agentId, 'offline');
  }

  async goOnBreak(agentId: string): Promise<IAgent | null> {
    return this.setStatus(agentId, 'break');
  }

  async incrementTicketCount(agentId: string): Promise<void> {
    await this.connect();
    await AgentModel.findOneAndUpdate(
      { agentId },
      { $inc: { currentTicketCount: 1 } }
    );
  }

  async decrementTicketCount(agentId: string): Promise<void> {
    await this.connect();
    await AgentModel.findOneAndUpdate(
      { agentId },
      { $inc: { currentTicketCount: -1 } }
    );
  }

  // ============================================
  // TICKET ROUTING
  // ============================================

  /**
   * Find best agent for ticket based on skills, load, and availability
   */
  async findBestAgent(ticket: {
    category?: string;
    platform?: string;
    priority?: string;
    language?: string;
    customerId?: string;
  }): Promise<any | null> {
    await this.connect();

    // Find online agents
    const onlineAgents = await AgentModel.find({ status: 'online' });

    if (onlineAgents.length === 0) {
      logger.warn('No online agents available');
      return null;
    }

    // Filter by skills and platform
    let candidates = onlineAgents.filter(agent => {
      // Check platform
      if (ticket.platform && !agent.platforms.includes('all') && !agent.platforms.includes(ticket.platform as any)) {
        return false;
      }
      return true;
    });

    // Check capacity
    candidates = candidates.filter(agent => {
      return agent.currentTicketCount < agent.maxConcurrentTickets;
    });

    if (candidates.length === 0) {
      logger.warn('No available agents with capacity');
      return null;
    }

    // Score agents based on:
    // 1. Skill proficiency for category
    // 2. Current load (prefer less busy)
    // 3. Priority handling (higher level for urgent)
    const scored = candidates.map(agent => {
      let score = 100;

      // Skill match
      if (ticket.category) {
        const skill = agent.skills.find(s => s.category === ticket.category);
        if (skill) {
          if (skill.proficiency === 'expert') score += 30;
          else if (skill.proficiency === 'intermediate') score += 15;
        }
      }

      // Load balancing (prefer less busy)
      const loadScore = (agent.maxConcurrentTickets - agent.currentTicketCount) * 5;
      score += loadScore;

      // Priority handling (higher level for urgent)
      if (ticket.priority === 'urgent' && agent.level >= 3) {
        score += 20;
      }

      // Performance bonus
      if (agent.performance.csatScore > 4) score += 10;

      return { agent, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.agent || null;
  }

  /**
   * Assign ticket to best available agent
   */
  async assignTicket(ticket: {
    ticketId: string;
    category?: string;
    platform?: string;
    priority?: string;
    customerId?: string;
  }): Promise<{ agent: IAgent; assignment: any } | null> {
    const agent = await this.findBestAgent(ticket);

    if (!agent) {
      logger.warn('No agent available for ticket', { ticketId: ticket.ticketId });
      return null;
    }

    // Create assignment record
    const assignment = new TicketAssignmentModel({
      ticketId: ticket.ticketId,
      agentId: agent.agentId,
      assignedBy: 'system',
      reason: 'auto_assignment',
      priority: ticket.priority || 'medium'
    });
    await assignment.save();

    // Update agent
    await this.incrementTicketCount(agent.agentId);

    logger.info('Ticket assigned', {
      ticketId: ticket.ticketId,
      agentId: agent.agentId,
      agentName: agent.name
    });

    return { agent, assignment };
  }

  /**
   * Manual assignment
   */
  async manualAssign(ticketId: string, agentId: string, assignedBy: string): Promise<boolean> {
    const agent = await AgentModel.findOne({ agentId });
    if (!agent) return false;

    const assignment = new TicketAssignmentModel({
      ticketId,
      agentId,
      assignedBy,
      reason: 'manual_assignment'
    });
    await assignment.save();

    await this.incrementTicketCount(agentId);

    logger.info('Ticket manually assigned', { ticketId, agentId, assignedBy });
    return true;
  }

  /**
   * Unassign ticket
   */
  async unassignTicket(ticketId: string): Promise<boolean> {
    const assignment = await TicketAssignmentModel.findOne({ ticketId });
    if (!assignment) return false;

    await this.decrementTicketCount(assignment.agentId);
    await TicketAssignmentModel.deleteOne({ ticketId });

    logger.info('Ticket unassigned', { ticketId });
    return true;
  }

  // ============================================
  // ESCALATION
  // ============================================

  /**
   * Escalate ticket to higher level
   */
  async escalateTicket(ticketId: string, currentAgentId: string): Promise<IAgent | null> {
    const currentAgent = await AgentModel.findOne({ agentId: currentAgentId });
    if (!currentAgent) return null;

    // Find escalation target
    let escalationAgent: IAgent | null = null;

    if (currentAgent.escalationTarget) {
      escalationAgent = await AgentModel.findOne({
        agentId: currentAgent.escalationTarget,
        status: 'online'
      }) as any;
    } else {
      // Find higher level agent
      escalationAgent = await AgentModel.findOne({
        level: { $gt: currentAgent.level },
        status: 'online',
        role: { $in: ['senior_agent', 'team_lead', 'supervisor'] }
      }).sort({ level: 1 }) as any;
    }

    if (escalationAgent) {
      // Transfer ticket
      await this.manualAssign(ticketId, escalationAgent.agentId, currentAgentId);
      await this.decrementTicketCount(currentAgentId);

      logger.info('Ticket escalated', {
        ticketId,
        from: currentAgentId,
        to: escalationAgent.agentId
      });
    }

    return escalationAgent;
  }

  // ============================================
  // PERFORMANCE
  // ============================================

  async updatePerformance(agentId: string, metrics: {
    resolutionTime?: number;
    csatScore?: number;
    resolved?: boolean;
    firstContactResolved?: boolean;
  }): Promise<void> {
    await this.connect();

    const agent = await AgentModel.findOne({ agentId });
    if (!agent) return;

    // Update resolution time (rolling average)
    if (metrics.resolutionTime !== undefined) {
      const current = agent.performance.avgResolutionTime || metrics.resolutionTime;
      agent.performance.avgResolutionTime = (current + metrics.resolutionTime) / 2;
    }

    // Update CSAT (rolling average)
    if (metrics.csatScore !== undefined) {
      const current = agent.performance.csatScore || metrics.csatScore;
      agent.performance.csatScore = (current + metrics.csatScore) / 2;
    }

    // Increment resolved count
    if (metrics.resolved) {
      agent.performance.ticketsResolved += 1;
    }

    // Update FCR
    if (metrics.firstContactResolved !== undefined) {
      const current = agent.performance.firstContactResolution || 0;
      const increment = metrics.firstContactResolved ? 1 : 0;
      const total = agent.performance.ticketsResolved || 1;
      agent.performance.firstContactResolution = ((current * (total - 1)) + (increment * 100)) / total;
    }

    await agent.save();
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(agentId: string): Promise<any | null> {
    const agent = await AgentModel.findOne({ agentId });
    if (!agent) return null;

    return {
      agentId: agent.agentId,
      name: agent.name,
      role: agent.role,
      level: agent.level,
      status: agent.status,
      currentTickets: agent.currentTicketCount,
      performance: agent.performance,
      skills: agent.skills,
      platforms: agent.platforms
    };
  }

  /**
   * Get team performance
   */
  async getTeamPerformance(): Promise<{
    agents: any[];
    avgResolutionTime: number;
    avgCsat: number;
    totalResolved: number;
    avgFCR: number;
  }> {
    const agents = await AgentModel.find({ role: { $ne: 'manager' } });

    const performance = agents.map(a => ({
      agentId: a.agentId,
      name: a.name,
      status: a.status,
      performance: a.performance,
      tickets: a.currentTicketCount
    }));

    const avgResolutionTime = agents.reduce((sum, a) => sum + (a.performance.avgResolutionTime || 0), 0) / agents.length;
    const avgCsat = agents.reduce((sum, a) => sum + (a.performance.csatScore || 0), 0) / agents.length;
    const totalResolved = agents.reduce((sum, a) => sum + (a.performance.ticketsResolved || 0), 0);
    const avgFCR = agents.reduce((sum, a) => sum + (a.performance.firstContactResolution || 0), 0) / agents.length;

    return {
      agents: performance,
      avgResolutionTime: Math.round(avgResolutionTime),
      avgCsat: Math.round(avgCsat * 10) / 10,
      totalResolved,
      avgFCR: Math.round(avgFCR)
    };
  }

  // ============================================
  // SCHEDULING
  // ============================================

  /**
   * Get available agents based on shift schedule
   */
  async getAvailableAgents(): Promise<IAgent[]> {
    await this.connect();

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const agents = await AgentModel.find({ status: 'online' });

    // Filter by schedule
    return agents.filter(agent => {
      if (!agent.schedule) return true;

      // Check working day
      if (agent.schedule.workingDays?.length > 0) {
        if (!agent.schedule.workingDays.includes(currentDay)) {
          return false;
        }
      }

      // Check hours
      if (agent.schedule.shiftStart && agent.schedule.shiftEnd) {
        if (currentTime < agent.schedule.shiftStart || currentTime > agent.schedule.shiftEnd) {
          return false;
        }
      }

      return true;
    }) as any;
  }
}
