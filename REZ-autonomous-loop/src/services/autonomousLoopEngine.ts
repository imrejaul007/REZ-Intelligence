/**
 * REZ Autonomous Loop Engine - Implements OADA Loop
 * Observe → Think → Decide → Act → Learn → Repeat
 */
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { AutonomousLoop, Observation, Thought, Decision, AutonomousAction, Learning, ActivityFeedItem, IAutonomousLoop } from '../models/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('autonomous-loop-engine');

// Service URLs
const MEMORY_LAYER = process.env.REZ_MEMORY_LAYER_URL || 'http://localhost:4201';
const SIGNAL_AGGREGATOR = process.env.REZ_SIGNAL_AGGREGATOR_URL || 'http://localhost:4100';
const ACTION_ORCHESTRATOR = process.env.REZ_ACTION_ORCHESTRATOR_URL || 'http://localhost:4103';

export class AutonomousLoopEngine {
  private tenantId: string;
  private loopId: string;

  constructor(tenantId: string, loopId: string) {
    this.tenantId = tenantId;
    this.loopId = loopId;
  }

  /**
   * Execute one full OADA loop cycle
   */
  async executeCycle(): Promise<{ success: boolean; phases: Record<string, any>; actionsExecuted: number }> {
    const loop = await AutonomousLoop.findOne({ _id: this.loopId, tenant_id: this.tenantId });
    if (!loop) throw new Error('Loop not found');
    if (loop.status !== 'active') throw new Error('Loop is not active');

    const phases: Record<string, any> = {};
    let actionsExecuted = 0;

    try {
      // Phase 1: OBSERVE
      if (loop.config.observe_enabled) {
        phases.observe = await this.observe();
        await this.logActivity('observe', 'Observation complete', 'info');
      }

      // Phase 2: THINK
      if (loop.config.think_enabled) {
        phases.think = await this.think(phases.observe?.observations || []);
        await this.logActivity('think', `Analysis complete: ${phases.think?.conclusion?.substring(0, 50)}...`, 'info');
      }

      // Phase 3: DECIDE
      if (loop.config.decide_enabled) {
        phases.decide = await this.decide(phases.think);
        await this.logActivity('decide', `${phases.decide?.length || 0} decisions made`, 'info');
      }

      // Phase 4: ACT (if auto_execute is enabled)
      if (loop.config.act_enabled && loop.config.auto_execute) {
        phases.act = await this.act(phases.decide || []);
        actionsExecuted = phases.act?.executed || 0;
        await this.logActivity('act', `${actionsExecuted} actions executed`, actionsExecuted > 0 ? 'success' : 'info');
      }

      // Phase 5: LEARN
      if (loop.config.learn_enabled) {
        phases.learn = await this.learn(phases.act?.results || []);
        await this.logActivity('learn', 'Learning complete', 'info');
      }

      // Update loop stats
      await AutonomousLoop.updateOne({ _id: this.loopId }, {
        last_run: new Date(),
        next_run: new Date(Date.now() + loop.interval_seconds * 1000),
        run_count: loop.run_count + 1,
        success_count: loop.success_count + 1,
        phase: 'observe',
      });

      return { success: true, phases, actionsExecuted };
    } catch (error) {
      logger.error('loop_cycle_failed', { loopId: this.loopId, error: error instanceof Error ? error.message : 'Unknown' });
      await AutonomousLoop.updateOne({ _id: this.loopId }, { status: 'error', failure_count: loop.failure_count + 1 });
      await this.logActivity('observe', `Loop failed: ${error instanceof Error ? error.message : 'Unknown'}`, 'error');
      throw error;
    }
  }

  /**
   * OBSERVE: Collect signals and data
   */
  private async observe(): Promise<{ observations: any[]; sources: string[] }> {
    const loop = await AutonomousLoop.findById(this.loopId);
    const observations: any[] = [];
    const sources: string[] = [];

    // Fetch from memory layer
    try {
      if (!loop) return { observations: [], sources: [] };
      const memoryRes = await axios.get(`${MEMORY_LAYER}/api/timeline/latest`, {
        headers: { 'X-Tenant-Id': this.tenantId },
        params: { entity_id: loop.entity_id, entity_type: loop.entity_type, limit: 20 },
        timeout: 5000,
      });
      if (memoryRes.data?.data) {
        observations.push(...memoryRes.data.data.map((e: any) => ({
          source: 'memory-layer', type: 'event', data: e, timestamp: e.created_at,
        })));
        sources.push('memory-layer');
      }
    } catch (e) { /* Memory layer may not have data */ }

    // Fetch from signal aggregator
    try {
      if (!loop) return { observations: [], sources: [] };
      const signalsRes = await axios.get(`${SIGNAL_AGGREGATOR}/api/signals`, {
        headers: { 'X-Tenant-Id': this.tenantId },
        params: { entity_id: loop.entity_id, limit: 10 },
        timeout: 5000,
      });
      if (signalsRes.data?.data) {
        observations.push(...signalsRes.data.data.map((s: any) => ({
          source: 'signal-aggregator', type: 'signal', data: s, timestamp: new Date(),
        })));
        sources.push('signal-aggregator');
      }
    } catch (e) { /* Signal aggregator may not have data */ }

    // Store observations
    for (const obs of observations) {
      await Observation.create({
        loop_id: this.loopId, tenant_id: this.tenantId, source: obs.source,
        type: obs.type, data: obs.data, summary: JSON.stringify(obs.data).substring(0, 200),
        priority: 'medium', processed: false, timestamp: obs.timestamp || new Date(),
      });
    }

    logger.info('observe_complete', { loopId: this.loopId, observations: observations.length, sources });
    return { observations, sources };
  }

  /**
   * THINK: Analyze observations and generate insights
   */
  private async think(observations: any[]): Promise<{ reasoning: string; conclusion: string; confidence: number }> {
    if (observations.length === 0) {
      return { reasoning: 'No new observations to analyze', conclusion: 'Continue monitoring', confidence: 0.5 };
    }

    // Simple pattern analysis (in production, call LLM here)
    const patterns = this.detectPatterns(observations);
    const anomalies = this.detectAnomalies(observations);
    const trends = this.detectTrends(observations);

    const reasoning = `Analyzed ${observations.length} observations. Found ${patterns.length} patterns, ${anomalies.length} anomalies, ${trends.length} trends.`;

    let conclusion = 'Current state is normal. ';
    if (anomalies.length > 0) {
      conclusion += `WARNING: ${anomalies.length} anomalies detected. `;
    }
    if (patterns.length > 0) {
      conclusion += `OPPORTUNITY: ${patterns.length} patterns identified. `;
    }
    if (trends.length > 0) {
      conclusion += `TREND: ${trends[0]}. `;
    }

    // Store thought
    const thought = await Thought.create({
      loop_id: this.loopId, tenant_id: this.tenantId,
      observation_ids: observations.map((o: any) => o.id).filter(Boolean),
      reasoning, context_used: ['memory-layer', 'signal-aggregator'],
      confidence: observations.length > 10 ? 0.8 : 0.6,
      conclusion,
    });

    logger.info('think_complete', { loopId: this.loopId, patterns: patterns.length, anomalies: anomalies.length });
    return { reasoning, conclusion, confidence: thought.confidence };
  }

  private detectPatterns(observations: any[]): string[] {
    // Simple pattern detection
    const patterns: string[] = [];
    const eventCounts: Record<string, number> = {};
    observations.forEach((o: any) => {
      const key = o.type || o.source;
      eventCounts[key] = (eventCounts[key] || 0) + 1;
    });
    Object.entries(eventCounts).forEach(([key, count]) => {
      if (count >= 3) patterns.push(`Frequent ${key} events (${count}x)`);
    });
    return patterns;
  }

  private detectAnomalies(observations: any[]): string[] {
    // Simple anomaly detection
    return observations.filter((o: any) => o.priority === 'high' || o.data?.anomaly).map((o: any) => o.summary || o.source);
  }

  private detectTrends(observations: any[]): string[] {
    // Simple trend detection
    return observations.length > 5 ? ['Increasing activity volume'] : [];
  }

  /**
   * DECIDE: Generate actionable decisions
   */
  private async decide(thought: { conclusion: string; confidence: number }): Promise<Decision[]> {
    const loop = await AutonomousLoop.findById(this.loopId);
    const decisions: Decision[] = [];

    // Decision logic based on conclusions
    if (thought.conclusion.includes('WARNING')) {
      const decision = await Decision.create({
        loop_id: this.loopId, tenant_id: this.tenantId,
        decision_type: 'intervention',
        action_type: 'send_alert',
        parameters: { message: 'Anomalies detected requiring attention', priority: 'high' },
        confidence: thought.confidence,
        reasoning: thought.conclusion,
        risk_level: 'medium',
        requires_approval: thought.confidence < loop.config.confidence_threshold,
        status: 'pending',
      });
      decisions.push(decision);
    }

    if (thought.conclusion.includes('OPPORTUNITY')) {
      const decision = await Decision.create({
        loop_id: this.loopId, tenant_id: this.tenantId,
        decision_type: 'optimization',
        action_type: 'trigger_campaign',
        parameters: { campaign_type: 'retargeting', segment: 'active_users' },
        confidence: thought.confidence * 0.8,
        reasoning: 'Opportunity detected for optimization',
        risk_level: 'low',
        requires_approval: thought.confidence < loop.config.confidence_threshold,
        status: 'pending',
      });
      decisions.push(decision);
    }

    logger.info('decide_complete', { loopId: this.loopId, decisions: decisions.length });
    return decisions;
  }

  /**
   * ACT: Execute decisions autonomously
   */
  private async act(decisions: Decision[]): Promise<{ executed: number; results: any[] }> {
    const loop = await AutonomousLoop.findById(this.loopId);
    const results: any[] = [];
    let executed = 0;

    for (const decision of decisions.slice(0, loop.config.max_actions_per_run)) {
      // Skip if requires approval
      if (decision.requires_approval) {
        await this.logActivity('decide', `Decision ${decision._id} requires approval`, 'warning');
        continue;
      }

      // Execute action
      try {
        const action = await AutonomousAction.create({
          loop_id: this.loopId, decision_id: decision._id.toString(),
          tenant_id: this.tenantId, action_type: decision.action_type!,
          parameters: decision.parameters, status: 'executing',
          execution_start: new Date(),
        });

        // Call action orchestrator
        const result = await this.executeAction(decision);
        action.status = 'completed';
        action.execution_end = new Date();
        action.result = result;
        await action.save();

        // Update decision status
        decision.status = 'executed';
        await decision.save();

        results.push({ decision_id: decision._id, action_id: action._id, result });
        executed++;
      } catch (error) {
        logger.error('action_execution_failed', { decisionId: decision._id, error });
        await AutonomousAction.create({
          loop_id: this.loopId, decision_id: decision._id.toString(),
          tenant_id: this.tenantId, action_type: decision.action_type!,
          parameters: decision.parameters, status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown',
        });
        decision.status = 'failed';
        await decision.save();
      }
    }

    logger.info('act_complete', { loopId: this.loopId, executed, total: decisions.length });
    return { executed, results };
  }

  private async executeAction(decision: Decision): Promise<any> {
    // In production, call actual services based on action_type
    switch (decision.action_type) {
      case 'send_alert':
        // Call notification service
        logger.info('executing_alert', { params: decision.parameters });
        return { sent: true, channel: 'whatsapp' };

      case 'trigger_campaign':
        // Call campaign service
        logger.info('executing_campaign', { params: decision.parameters });
        return { campaign_id: uuidv4(), status: 'launched' };

      case 'adjust_pricing':
        // Call pricing service
        logger.info('executing_pricing', { params: decision.parameters });
        return { price_updated: true };

      default:
        logger.warn('unknown_action_type', { actionType: decision.action_type });
        return { executed: true, note: 'Generic execution' };
    }
  }

  /**
   * LEARN: Record outcomes and adjust
   */
  private async learn(results: any[]): Promise<{ improvements: string[] }> {
    const improvements: string[] = [];

    for (const result of results) {
      const outcome = result.result?.success ? 'success' : 'failure';
      await Learning.create({
        loop_id: this.loopId, tenant_id: this.tenantId,
        action_id: result.action_id,
        outcome, metrics: { accuracy: 0.8 },
        feedback: `Action ${outcome}`,
        confidence_adjustment: outcome === 'success' ? 0.05 : -0.05,
      });
      improvements.push(`Recorded ${outcome} outcome`);
    }

    logger.info('learn_complete', { loopId: this.loopId, improvements: improvements.length });
    return { improvements };
  }

  private async logActivity(phase: string, description: string, status: 'info' | 'success' | 'warning' | 'error'): Promise<void> {
    const loop = await AutonomousLoop.findById(this.loopId);
    await ActivityFeedItem.create({
      loop_id: this.loopId, tenant_id: this.tenantId,
      entity_type: loop.entity_type, entity_id: loop.entity_id,
      phase: phase as any, action: phase, description, status,
      timestamp: new Date(),
    });
  }
}

// CRUD Operations
export class LoopService {
  async createLoop(tenantId: string, data: {
    name: string; description?: string; entity_type: string; entity_id: string;
    interval_seconds?: number; config?: any;
  }): Promise<IAutonomousLoop> {
    return AutonomousLoop.create({
      tenant_id: tenantId, ...data,
      status: 'active', phase: 'observe',
      next_run: new Date(Date.now() + (data.interval_seconds || 300) * 1000),
      run_count: 0, success_count: 0, failure_count: 0,
    });
  }

  async getLoops(tenantId: string, entityId?: string): Promise<IAutonomousLoop[]> {
    const query: Record<string, unknown> = { tenant_id: tenantId };
    if (entityId) query.entity_id = entityId;
    return AutonomousLoop.find(query);
  }

  async getLoop(tenantId: string, loopId: string): Promise<IAutonomousLoop | null> {
    return AutonomousLoop.findOne({ _id: loopId, tenant_id: tenantId });
  }

  async pauseLoop(tenantId: string, loopId: string): Promise<void> {
    await AutonomousLoop.updateOne({ _id: loopId, tenant_id: tenantId }, { status: 'paused' });
  }

  async resumeLoop(tenantId: string, loopId: string): Promise<void> {
    await AutonomousLoop.updateOne({ _id: loopId, tenant_id: tenantId }, { status: 'active' });
  }

  async deleteLoop(tenantId: string, loopId: string): Promise<void> {
    await AutonomousLoop.deleteOne({ _id: loopId, tenant_id: tenantId });
    await Observation.deleteMany({ loop_id: loopId });
    await Thought.deleteMany({ loop_id: loopId });
    await Decision.deleteMany({ loop_id: loopId });
    await AutonomousAction.deleteMany({ loop_id: loopId });
    await Learning.deleteMany({ loop_id: loopId });
  }

  async getPendingDecisions(tenantId: string): Promise<Decision[]> {
    return Decision.find({ tenant_id: tenantId, status: 'pending', requires_approval: true });
  }

  async approveDecision(tenantId: string, decisionId: string, approvedBy: string): Promise<void> {
    await Decision.updateOne({ _id: decisionId, tenant_id: tenantId }, {
      status: 'approved', approved_by: approvedBy, approved_at: new Date(),
    });
  }

  async rejectDecision(tenantId: string, decisionId: string): Promise<void> {
    await Decision.updateOne({ _id: decisionId, tenant_id: tenantId }, { status: 'rejected' });
  }

  async getActivityFeed(tenantId: string, entityId?: string, limit: number = 50): Promise<IActivityFeedItem[]> {
    const query: Record<string, unknown> = { tenant_id: tenantId };
    if (entityId) query.entity_id = entityId;
    return ActivityFeedItem.find(query).sort({ timestamp: -1 }).limit(limit);
  }
}

let loopServiceInstance: LoopService | null = null;
export function getLoopService(): LoopService {
  if (!loopServiceInstance) loopServiceInstance = new LoopService();
  return loopServiceInstance;
}
