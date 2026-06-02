/**
 * REZ Company Memory Service
 */
import { v4 as uuidv4 } from 'uuid';
import { CompanyMemory, MemoryEvent, BusinessKnowledge, ICompanyMemory } from '../models/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('company-memory');

export class CompanyMemoryService {
  async create(tenantId: string, data: { entity_type: string; entity_id: string; name: string; preferences?: any }): Promise<ICompanyMemory> {
    const memory = await CompanyMemory.findOneAndUpdate(
      { tenant_id: tenantId, entity_id: data.entity_id },
      { tenant_id: tenantId, ...data, health_score: 50, health_trend: 'stable', active_goals: [], recent_decisions: [], metrics: { custom_metrics: {} } },
      { upsert: true, new: true }
    );
    logger.info('company_memory_created', { tenantId, entityId: data.entity_id });
    return memory;
  }

  async get(tenantId: string, entityId: string): Promise<ICompanyMemory | null> {
    return CompanyMemory.findOne({ tenant_id: tenantId, entity_id: entityId });
  }

  async updateMetrics(tenantId: string, entityId: string, metrics: Record<string, number>): Promise<ICompanyMemory | null> {
    const memory = await CompanyMemory.findOne({ tenant_id: tenantId, entity_id: entityId });
    if (!memory) return null;

    const updates: any = {};
    for (const [key, value] of Object.entries(metrics)) {
      const current = (memory.metrics as any)[key];
      const previousValue = current?.value || value;
      const changePercent = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
      (updates as any)[`metrics.${key}`] = {
        value, previous_value: previousValue, change_percent: changePercent,
        trend: value > previousValue ? 'up' : value < previousValue ? 'down' : 'stable',
        period: 'daily',
      };
    }

    await CompanyMemory.updateOne({ _id: memory._id }, updates);
    await this.logEvent(tenantId, entityId, 'metric_change', 'Metrics updated', metrics, 'company-memory');

    return CompanyMemory.findOne({ tenant_id: tenantId, entity_id: entityId });
  }

  async addGoal(tenantId: string, entityId: string, goal: { description: string; target_metric?: string; target_value?: number; deadline?: Date }): Promise<ICompanyMemory | null> {
    const memory = await CompanyMemory.findOne({ tenant_id: tenantId, entity_id: entityId });
    if (!memory) return null;

    memory.active_goals.push({
      id: uuidv4(), description: goal.description, target_metric: goal.target_metric,
      target_value: goal.target_value, progress: 0, deadline: goal.deadline,
      status: 'active', created_at: new Date(),
    });
    await memory.save();
    await this.logEvent(tenantId, entityId, 'goal_updated', `Goal added: ${goal.description}`, { goal }, 'company-memory');
    return memory;
  }

  async updateGoalProgress(tenantId: string, entityId: string, goalId: string, progress: number): Promise<ICompanyMemory | null> {
    const memory = await CompanyMemory.findOne({ tenant_id: tenantId, entity_id: entityId });
    if (!memory) return null;

    const goal = memory.active_goals.find(g => g.id === goalId);
    if (goal) {
      goal.progress = Math.min(100, Math.max(0, progress));
      if (goal.progress >= 100) goal.status = 'completed';
    }
    await memory.save();
    return memory;
  }

  async recordDecision(tenantId: string, entityId: string, decision: { type: string; description: string; outcome: string; impact_score: number }): Promise<ICompanyMemory | null> {
    const memory = await CompanyMemory.findOne({ tenant_id: tenantId, entity_id: entityId });
    if (!memory) return null;

    memory.recent_decisions.unshift({
      id: uuidv4(), type: decision.type, description: decision.description,
      outcome: decision.outcome, impact_score: decision.impact_score, date: new Date(),
    });
    memory.recent_decisions = memory.recent_decisions.slice(0, 20); // Keep last 20
    await memory.save();
    await this.logEvent(tenantId, entityId, 'decision_made', decision.description, decision, 'company-memory');
    return memory;
  }

  async updateHealthScore(tenantId: string, entityId: string, score: number): Promise<ICompanyMemory | null> {
    const memory = await CompanyMemory.findOne({ tenant_id: tenantId, entity_id: entityId });
    if (!memory) return null;

    const previousScore = memory.health_score;
    memory.health_score = Math.min(100, Math.max(0, score));
    memory.health_trend = score > previousScore ? 'improving' : score < previousScore ? 'declining' : 'stable';
    await memory.save();
    return memory;
  }

  async addKnowledge(tenantId: string, entityId: string, knowledge: { category: string; topic: string; content: string; source?: string }): Promise<any> {
    return BusinessKnowledge.create({
      tenant_id: tenantId, entity_id: entityId,
      category: knowledge.category, topic: knowledge.topic, content: knowledge.content,
      source: knowledge.source || 'ai_generated', confidence: 0.7,
    });
  }

  async getKnowledge(tenantId: string, entityId: string, category?: string): Promise<any[]> {
    const query: any = { tenant_id: tenantId, entity_id: entityId };
    if (category) query.category = category;
    return BusinessKnowledge.find(query);
  }

  async searchKnowledge(tenantId: string, entityId: string, query: string): Promise<any[]> {
    return BusinessKnowledge.find({
      tenant_id: tenantId, entity_id: entityId,
      $or: [{ topic: { $regex: query, $options: 'i' } }, { content: { $regex: query, $options: 'i' } }],
    });
  }

  async logEvent(tenantId: string, entityId: string, eventType: string, description: string, data: any, source: string, importance: string = 'medium'): Promise<void> {
    await MemoryEvent.create({ tenant_id: tenantId, entity_id: entityId, event_type: eventType, description, data, source, importance });
  }

  async getEvents(tenantId: string, entityId: string, limit: number = 50): Promise<any[]> {
    return MemoryEvent.find({ tenant_id: tenantId, entity_id: entityId }).sort({ timestamp: -1 }).limit(limit);
  }

  async getAllMemories(tenantId: string, entityType?: string): Promise<ICompanyMemory[]> {
    const query: any = { tenant_id: tenantId };
    if (entityType) query.entity_type = entityType;
    return CompanyMemory.find(query);
  }
}

let instance: CompanyMemoryService | null = null;
export function getCompanyMemoryService(): CompanyMemoryService {
  if (!instance) instance = new CompanyMemoryService();
  return instance;
}
