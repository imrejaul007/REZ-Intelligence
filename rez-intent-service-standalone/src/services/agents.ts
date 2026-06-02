import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface AgentStatus {
  name: string;
  running: boolean;
  lastRun?: Date;
  interval: number;
  nextRun?: Date;
}

interface AgentResult {
  success: boolean;
  agent: string;
  processed: number;
  timestamp: Date;
}

// ============================================
// AI AGENT SERVICE (8 AGENTS)
// ============================================

export class AgentService {
  private agents: Map<string, NodeJS.Timeout> = new Map();
  private intervals: Map<string, number> = new Map();

  // Agent intervals (in milliseconds)
  private readonly AGENT_INTERVALS = {
    demandSignal: 5 * 60 * 1000,        // 5 min
    scarcity: 60 * 1000,               // 1 min
    personalization: 60 * 1000,           // 1 min
    attribution: 60 * 1000,              // 1 min
    adaptiveScoring: 60 * 60 * 1000,   // 1 hour
    feedbackLoop: 60 * 60 * 1000,      // 1 hour
    networkEffect: 24 * 60 * 60 * 1000, // 24 hours
    revenueAttribution: 15 * 60 * 1000   // 15 min
  };

  /**
   * Start all agents
   */
  async startAllAgents(): Promise<void> {
    console.log('Starting all AI agents...');

    // Demand Signal Agent
    this.startAgent('demandSignal', this.runDemandSignalAgent.bind(this));

    // Scarcity Agent
    this.startAgent('scarcity', this.runScarcityAgent.bind(this));

    // Personalization Agent
    this.startAgent('personalization', this.runPersonalizationAgent.bind(this));

    // Attribution Agent
    this.startAgent('attribution', this.runAttributionAgent.bind(this));

    // Adaptive Scoring Agent
    this.startAgent('adaptiveScoring', this.runAdaptiveScoringAgent.bind(this));

    // Feedback Loop Agent
    this.startAgent('feedbackLoop', this.runFeedbackLoopAgent.bind(this));

    // Network Effect Agent
    this.startAgent('networkEffect', this.runNetworkEffectAgent.bind(this));

    // Revenue Attribution Agent
    this.startAgent('revenueAttribution', this.runRevenueAttributionAgent.bind(this));

    console.log('All agents started');
  }

  /**
   * Start single agent
   */
  private startAgent(name: string, fn: () => Promise<void>): void {
    const interval = this.AGENT_INTERVALS[name as keyof typeof this.AGENT_INTERVALS] || 60000;

    // Run immediately
    fn().catch(console.error);

    // Schedule recurring
    const timer = setInterval(() => fn().catch(console.error), interval);
    this.agents.set(name, timer);
    this.intervals.set(name, interval);
  }

  /**
   * Get agent status
   */
  async getStatus(): Promise<AgentStatus[]> {
    const agents: AgentStatus[] = [];
    const lastRuns = await redis.hgetall('agent:lastRun');

    for (const [name, interval] of this.intervals) {
      const timer = this.agents.get(name);
      const lastRun = lastRuns[name];
      const nextRun = lastRun
        ? new Date(parseInt(lastRun) + interval)
        : undefined;

      agents.push({
        name,
        running: !!timer,
        lastRun: lastRun ? new Date(parseInt(lastRun)) : undefined,
        interval,
        nextRun
      });
    }

    return agents;
  }

  /**
   * Run single agent on-demand
   */
  async runAgent(name: string): Promise<AgentResult> {
    const fns: Record<string, () => Promise<number>> = {
      demandSignal: this.runDemandSignalAgent.bind(this),
      scarcity: this.runScarcityAgent.bind(this),
      personalization: this.runPersonalizationAgent.bind(this),
      attribution: this.runAttributionAgent.bind(this),
      adaptiveScoring: this.runAdaptiveScoringAgent.bind(this),
      feedbackLoop: this.runFeedbackLoopAgent.bind(this),
      networkEffect: this.runNetworkEffectAgent.bind(this),
      revenueAttribution: this.runRevenueAttributionAgent.bind(this)
    };

    const fn = fns[name];
    if (!fn) {
      throw new Error(`Agent ${name} not found`);
    }

    const processed = await fn();
    await redis.hset('agent:lastRun', name, Date.now().toString());

    return {
      success: true,
      agent: name,
      processed,
      timestamp: new Date()
    };
  }

  /**
   * Stop all agents
   */
  async stopAllAgents(): Promise<void> {
    for (const [name, timer] of this.agents) {
      clearInterval(timer);
      console.log(`Stopped ${name} agent`);
    }
    this.agents.clear();
    this.intervals.clear();
  }

  // ============================================
  // DEMAND SIGNAL AGENT
  // ============================================
  private async runDemandSignalAgent(): Promise<number> {
    console.log('Running Demand Signal Agent...');
    // Generate demand signals
    const signals = await redis.lrange('demand:candidates', 0, -1);
    for (const signal of signals) {
      await redis.lpush('demand:signals', signal);
    }
    await redis.del('demand:candidates');
    return signals.length;
  }

  // ============================================
  // SCARCITY AGENT
  // ============================================
  private async runScarcityAgent(): Promise<number> {
    console.log('Running Scarcity Agent...');
    const candidates = await redis.lrange('scarcity:candidates', 0, -1);
    for (const candidate of candidates) {
      await redis.lpush('scarcity:signals', candidate);
    }
    await redis.del('scarcity:candidates');
    return candidates.length;
  }

  // ============================================
  // PERSONALIZATION AGENT
  // ============================================
  private async runPersonalizationAgent(): Promise<number> {
    console.log('Running Personalization Agent...');
    const events = await redis.lrange('personalization:events', 0, 99);
    for (const event of events) {
      await redis.lpush('personalization:processed', event);
    }
    await redis.del('personalization:events');
    return events.length;
  }

  // ============================================
  // ATTRIBUTION AGENT
  // ============================================
  private async runAttributionAgent(): Promise<number> {
    console.log('Running Attribution Agent...');
    const conversions = await redis.lrange('attribution:pending', 0, -1);
    for (const conversion of conversions) {
      await redis.lpush('attribution:processed', conversion);
    }
    await redis.del('attribution:pending');
    return conversions.length;
  }

  // ============================================
  // ADAPTIVE SCORING AGENT
  // ============================================
  private async runAdaptiveScoringAgent(): Promise<number> {
    console.log('Running Adaptive Scoring Agent...');
    // Retrain model with recent predictions
    const predictions = await redis.lrange('scoring:predictions', 0, 999);
    if (predictions.length > 0) {
      await redis.del('scoring:predictions');
      return predictions.length;
    }
    return 0;
  }

  // ============================================
  // FEEDBACK LOOP AGENT
  // ============================================
  private async runFeedbackLoopAgent(): Promise<number> {
    console.log('Running Feedback Loop Agent...');
    const feedback = await redis.lrange('feedback:loop', 0, 99);
    for (const item of feedback) {
      await redis.lpush('feedback:processed', item);
    }
    await redis.del('feedback:loop');
    return feedback.length;
  }

  // ============================================
  // NETWORK EFFECT AGENT
  // ============================================
  private async runNetworkEffectAgent(): Promise<number> {
    console.log('Running Network Effect Agent...');
    const cohorts = await redis.lrange('network:cohorts', 0, 49);
    for (const cohort of cohorts) {
      await redis.lpush('network:processed', cohort);
    }
    await redis.del('network:cohorts');
    return cohorts.length;
  }

  // ============================================
  // REVENUE ATTRIBUTION AGENT
  // ============================================
  private async runRevenueAttributionAgent(): Promise<number> {
    console.log('Running Revenue Attribution Agent...');
    const revenue = await redis.lrange('revenue:attribution', 0, 999);
    await redis.del('revenue:attribution');
    return revenue.length;
  }

  /**
   * Stop service
   */
  async stop(): Promise<void> {
    await this.stopAllAgents();
  }
}

export const agentService = new AgentService();
