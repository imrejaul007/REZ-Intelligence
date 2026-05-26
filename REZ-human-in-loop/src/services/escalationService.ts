import { v4 as uuidv4 } from 'uuid';
import { Escalation, CreateEscalation, EscalationStatus } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class EscalationService {
  private escalations: Map<string, Escalation> = new Map();
  private pendingByAgent: Map<string, Set<string>> = new Map();
  private pendingByCase: Map<string, Set<string>> = new Map();

  async create(data: CreateEscalation): Promise<Escalation> {
    logger.info('Creating escalation', { caseId: data.caseId, level: data.level });

    const id = uuidv4();
    const now = new Date();
    const expiresAt = data.timeoutMinutes
      ? new Date(now.getTime() + data.timeoutMinutes * 60 * 1000)
      : undefined;

    const escalation: Escalation = {
      id,
      caseId: data.caseId,
      agentId: data.agentId,
      level: data.level,
      title: data.title,
      description: data.description,
      context: data.context,
      suggestedActions: data.suggestedActions.map(a => ({ ...a, id: uuidv4() })),
      assignedTo: data.assignedTo,
      status: 'pending',
      createdAt: now,
      expiresAt,
    };

    this.escalations.set(id, escalation);

    if (data.agentId) {
      if (!this.pendingByAgent.has(data.agentId)) {
        this.pendingByAgent.set(data.agentId, new Set());
      }
      this.pendingByAgent.get(data.agentId)!.add(id);
    }

    if (data.caseId) {
      if (!this.pendingByCase.has(data.caseId)) {
        this.pendingByCase.set(data.caseId, new Set());
      }
      this.pendingByCase.get(data.caseId)!.add(id);
    }

    logger.info('Escalation created', { id, caseId: data.caseId });
    return escalation;
  }

  async get(id: string): Promise<Escalation | null> {
    return this.escalations.get(id) || null;
  }

  async resolve(id: string, resolvedBy: string, resolution: string, action: 'approved' | 'rejected'): Promise<Escalation | null> {
    const escalation = this.escalations.get(id);
    if (!escalation) return null;

    escalation.status = action;
    escalation.resolvedBy = resolvedBy;
    escalation.resolution = resolution;
    escalation.resolvedAt = new Date();

    this.pendingByAgent.get(escalation.agentId)?.delete(id);
    this.pendingByCase.get(escalation.caseId)?.delete(id);

    logger.info('Escalation resolved', { id, action, resolvedBy });
    return escalation;
  }

  async cancel(id: string): Promise<boolean> {
    const escalation = this.escalations.get(id);
    if (!escalation) return false;

    escalation.status = 'cancelled';
    this.pendingByAgent.get(escalation.agentId)?.delete(id);
    this.pendingByCase.get(escalation.caseId)?.delete(id);

    return true;
  }

  async query(params: {
    status?: EscalationStatus;
    assignedTo?: string;
    agentId?: string;
    caseId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Escalation[]; total: number }> {
    let items = Array.from(this.escalations.values());

    if (params.status) {
      items = items.filter(e => e.status === params.status);
    }
    if (params.assignedTo) {
      items = items.filter(e => e.assignedTo === params.assignedTo);
    }
    if (params.agentId) {
      items = items.filter(e => e.agentId === params.agentId);
    }
    if (params.caseId) {
      items = items.filter(e => e.caseId === params.caseId);
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    return {
      items: items.slice(offset, offset + limit),
      total,
    };
  }

  async getPendingForAgent(agentId: string): Promise<Escalation[]> {
    const ids = this.pendingByAgent.get(agentId) || new Set();
    return Array.from(ids)
      .map(id => this.escalations.get(id))
      .filter((e): e is Escalation => e !== undefined && e.status === 'pending');
  }

  async getPendingForCase(caseId: string): Promise<Escalation[]> {
    const ids = this.pendingByCase.get(caseId) || new Set();
    return Array.from(ids)
      .map(id => this.escalations.get(id))
      .filter((e): e is Escalation => e !== undefined);
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
  }> {
    const all = Array.from(this.escalations.values());
    return {
      total: all.length,
      pending: all.filter(e => e.status === 'pending').length,
      approved: all.filter(e => e.status === 'approved').length,
      rejected: all.filter(e => e.status === 'rejected').length,
      expired: all.filter(e => e.status === 'expired').length,
    };
  }

  async expireOld(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [id, escalation] of this.escalations) {
      if (escalation.status === 'pending' && escalation.expiresAt && escalation.expiresAt < now) {
        escalation.status = 'expired';
        this.pendingByAgent.get(escalation.agentId)?.delete(id);
        this.pendingByCase.get(escalation.caseId)?.delete(id);
        count++;
      }
    }

    return count;
  }
}

export const escalationService = new EscalationService();
