/**
 * REZ Memory Engine - Core Service
 *
 * Persistent Human Memory System - Remembers the journey, not just data
 * Port: 4165
 */

import mongoose, { Schema, Document } from 'mongoose';
import {
  EmotionalPhase,
  EmotionalPhaseRecord,
  LifeEvent,
  MemoryFragment,
  BehavioralPattern,
  TransitionMemory,
  HealingJourney,
  GrowthMoment,
  PersonalityEvolution,
  WisdomEntry,
  ConversationMemory,
  MemoryContext,
  MemoryInsight,
} from '../types/index.js';

// ============================================
// MONGODB MODELS
// ============================================

// Emotional Phase Model
export interface EmotionalPhaseDocument extends EmotionalPhaseRecord, Document {}
const emotionalPhaseSchema = new Schema<EmotionalPhaseDocument>({
  userId: { type: String, required: true, index: true },
  phase: { type: String, enum: ['stability', 'growth', 'transition', 'healing', 'expansion', 'contraction', 'crisis', 'breakthrough'], required: true },
  startDate: { type: Date, required: true },
  endDate: Date,
  duration: Number,
  intensity: { type: Number, default: 50 },
  context: String,
  triggers: [String],
  resolutions: [String],
  keyInsights: [String],
});
export const EmotionalPhaseModel = mongoose.model<EmotionalPhaseDocument>('EmotionalPhase', emotionalPhaseSchema);

// Life Event Model
export interface LifeEventDocument extends LifeEvent, Document {}
const lifeEventSchema = new Schema<LifeEventDocument>({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['career', 'relationship', 'health', 'financial', 'spiritual', 'family', 'personal', 'breakthrough', 'setback'], required: true },
  title: { type: String, required: true },
  description: String,
  startDate: { type: Date, required: true },
  endDate: Date,
  significance: { type: Number, default: 50 },
  emotionalImpact: {
    positive: Number,
    negative: Number,
    neutral: Number,
  },
  themes: [String],
  lessons: [String],
  connectedEvents: [String],
  memoryFragments: [{
    id: String,
    timestamp: Date,
    content: String,
    emotional: { tone: String, intensity: Number },
    context: { location: String, activity: String, people: [String] },
    importance: Number,
    type: String,
  }],
  growth: {
    before: String,
    after: String,
  },
});
export const LifeEventModel = mongoose.model<LifeEventDocument>('LifeEvent', lifeEventSchema);

// Behavioral Pattern Model
export interface BehavioralPatternDocument extends Omit<BehavioralPattern, 'id'>, Document {}
const behavioralPatternSchema = new Schema<BehavioralPatternDocument>({
  userId: { type: String, required: true, index: true },
  pattern: {
    type: { type: String, enum: ['cyclical', 'progressive', 'reactive', 'seasonal'], required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'], required: true },
    regularity: Number,
  },
  triggers: [String],
  manifestations: [String],
  emotionalTone: String,
  firstObserved: Date,
  lastObserved: Date,
  occurrenceCount: { type: Number, default: 1 },
  contextFactors: [String],
  evolution: {
    trend: { type: String, enum: ['intensifying', 'stable', 'diminishing', 'transforming'] },
    rate: Number,
  },
});
export const BehavioralPatternModel = mongoose.model<BehavioralPatternDocument>('BehavioralPattern', behavioralPatternSchema);

// Transition Memory Model
export interface TransitionMemoryDocument extends Omit<TransitionMemory, 'id'>, Document {}
const transitionMemorySchema = new Schema<TransitionMemoryDocument>({
  userId: { type: String, required: true, index: true },
  transition: {
    from: String,
    to: String,
    type: { type: String, enum: ['gradual', 'sudden', 'chosen', 'imposed'] },
  },
  timeline: {
    recognition: Date,
    decision: Date,
    action: Date,
    stabilization: Date,
  },
  emotionalJourney: {
    anticipation: Number,
    anxiety: Number,
    excitement: Number,
    uncertainty: Number,
    adaptation: Number,
    integration: Number,
  },
  supportFactors: [String],
  resistancePoints: [String],
  keyMoments: [String],
  lessons: [String],
  wisdom: String,
});
export const TransitionMemoryModel = mongoose.model<TransitionMemoryDocument>('TransitionMemory', transitionMemorySchema);

// Healing Journey Model
export interface HealingJourneyDocument extends Omit<HealingJourney, 'id'>, Document {}
const healingJourneySchema = new Schema<HealingJourneyDocument>({
  userId: { type: String, required: true, index: true },
  wound: {
    type: String,
    origin: String,
    duration: String,
    severity: Number,
  },
  journey: {
    denial: Date,
    recognition: Date,
    acceptance: Date,
    processing: Date,
    integration: Date,
    release: Date,
  },
  progress: {
    current: Number,
    trend: { type: String, enum: ['improving', 'stable', 'regressing'] },
    milestones: [{
      date: Date,
      title: String,
      description: String,
      emotionalShift: String,
    }],
  },
  insights: [String],
  closure: {
    achieved: Boolean,
    date: Date,
    statement: String,
  },
});
export const HealingJourneyModel = mongoose.model<HealingJourneyDocument>('HealingJourney', healingJourneySchema);

// Growth Moment Model
export interface GrowthMomentDocument extends Omit<GrowthMoment, 'id'>, Document {}
const growthMomentSchema = new Schema<GrowthMomentDocument>({
  userId: { type: String, required: true, index: true },
  moment: {
    type: { type: String, enum: ['realization', 'breakthrough', 'achievement', 'connection', 'perspective_shift'] },
    trigger: String,
    context: String,
  },
  before: {
    belief: String,
    behavior: String,
    emotional: String,
  },
  after: {
    belief: String,
    behavior: String,
    emotional: String,
  },
  integration: {
    date: Date,
    difficulty: Number,
    supportNeeded: [String],
    reinforcement: [String],
  },
  rippleEffects: [String],
});
export const GrowthMomentModel = mongoose.model<GrowthMomentDocument>('GrowthMoment', growthMomentSchema);

// Personality Evolution Model
export interface PersonalityEvolutionDocument extends Omit<PersonalityEvolution, 'id'>, Document {}
const personalityEvolutionSchema = new Schema<PersonalityEvolutionDocument>({
  userId: { type: String, required: true, index: true },
  baseline: {
    date: Date,
    vectors: [{
      dimension: String,
      value: Number,
    }],
  },
  evolution: [{
    date: Date,
    vectors: [{
      dimension: String,
      before: Number,
      after: Number,
      change: Number,
      confidence: Number,
      triggers: [String],
    }],
    overallShift: Number,
    drivers: [String],
    blockers: [String],
  }],
  trajectory: {
    direction: String,
    consistency: Number,
    milestones: [{
      date: Date,
      change: String,
      impact: Number,
    }],
  },
});
export const PersonalityEvolutionModel = mongoose.model<PersonalityEvolutionDocument>('PersonalityEvolution', personalityEvolutionSchema);

// Wisdom Entry Model
export interface WisdomEntryDocument extends Omit<WisdomEntry, 'id'>, Document {}
const wisdomEntrySchema = new Schema<WisdomEntryDocument>({
  userId: { type: String, required: true, index: true },
  origin: {
    type: { type: String, enum: ['experience', 'lesson', 'failure', 'success', 'relationship', 'observation'] },
    context: String,
  },
  statement: String,
  abstraction: String,
  application: {
    when: [String],
    how: [String],
    barriers: [String],
  },
  integration: {
    level: { type: String, enum: ['aware', 'understood', 'practiced', 'embodied'] },
    since: Date,
    applicationCount: { type: Number, default: 0 },
    successRate: Number,
  },
});
export const WisdomEntryModel = mongoose.model<WisdomEntryDocument>('WisdomEntry', wisdomEntrySchema);

// Conversation Memory Model
export interface ConversationMemoryDocument extends Omit<ConversationMemory, 'id'>, Document {}
const conversationMemorySchema = new Schema<ConversationMemoryDocument>({
  userId: { type: String, required: true, index: true },
  conversation: {
    type: { type: String, enum: ['check_in', 'guidance', 'reflection', 'crisis', 'celebration'] },
    date: Date,
    summary: String,
    emotionalTone: String,
  },
  exchanges: [{
    role: { type: String, enum: ['user', 'cosmic'] },
    content: String,
    timestamp: Date,
    context: String,
  }],
  resolution: {
    achieved: Boolean,
    summary: String,
    followUpNeeded: Boolean,
  },
  followUps: [String],
});
export const ConversationMemoryModel = mongoose.model<ConversationMemoryDocument>('ConversationMemory', conversationMemorySchema);

// ============================================
// MEMORY SERVICE
// ============================================

export class MemoryService {
  /**
   * Get complete memory context for a user
   */
  async getMemoryContext(userId: string): Promise<MemoryContext> {
    const [
      recentPhases,
      activePatterns,
      currentTransitions,
      healingJourneys,
      recentGrowth,
      keyLifeEvents,
      accumulatedWisdom,
      personalityEvolution,
      significantMemories,
      conversationHistory,
    ] = await Promise.all([
      EmotionalPhaseModel.find({ userId }).sort({ startDate: -1 }).limit(5),
      BehavioralPatternModel.find({ userId, 'evolution.trend': { $ne: 'diminishing' } }).limit(10),
      TransitionMemoryModel.find({ userId }).sort({ 'timeline.stabilization': -1 }).limit(5),
      HealingJourneyModel.find({ userId }).sort({ 'progress.current': 1 }).limit(5),
      GrowthMomentModel.find({ userId }).sort({ 'integration.date': -1 }).limit(5),
      LifeEventModel.find({ userId }).sort({ startDate: -1 }).limit(10),
      WisdomEntryModel.find({ userId }).sort({ 'integration.level': -1 }).limit(10),
      PersonalityEvolutionModel.findOne({ userId }),
      MemoryFragmentModel.find({ userId, importance: { $gte: 70 } }).sort({ timestamp: -1 }).limit(20),
      ConversationMemoryModel.find({ userId }).sort({ 'conversation.date': -1 }).limit(10),
    ]);

    // Determine current phase
    const currentPhase = recentPhases[0]?.phase || 'stability';

    return {
      userId,
      currentPhase,
      recentPhases,
      activePatterns,
      currentTransitions,
      healingJourneys,
      recentGrowth,
      keyLifeEvents,
      accumulatedWisdom,
      personalityEvolution,
      significantMemories,
      conversationHistory,
    };
  }

  /**
   * Record an emotional phase
   */
  async recordEmotionalPhase(userId: string, phase: EmotionalPhase, data: Partial<EmotionalPhaseRecord>): Promise<EmotionalPhaseRecord> {
    // End any current phase
    await EmotionalPhaseModel.updateOne(
      { userId, endDate: null },
      { $set: { endDate: new Date() } }
    );

    // Create new phase
    const newPhase = new EmotionalPhaseModel({
      userId,
      phase,
      startDate: new Date(),
      intensity: data.intensity || 50,
      context: data.context,
      triggers: data.triggers || [],
      resolutions: [],
      keyInsights: [],
    });

    await newPhase.save();
    return newPhase;
  }

  /**
   * Detect phase transitions
   */
  async detectPhaseTransition(userId: string, currentMood: string, emotionalScores: Record<string, number>): Promise<EmotionalPhase | null> {
    const recentPhases = await EmotionalPhaseModel.find({ userId }).sort({ startDate: -1 }).limit(10);
    const currentPhase = recentPhases[0];

    if (!currentPhase) return null;

    // Analyze patterns
    const avgIntensity = recentPhases.slice(0, 5).reduce((sum, p) => sum + p.intensity, 0) / Math.min(recentPhases.length, 5);
    const volatility = this.calculateVolatility(recentPhases.slice(0, 10));

    // Detect transitions
    if (emotionalScores['stress'] > 70 && volatility > 30) {
      return 'crisis';
    }
    if (emotionalScores['growth'] > 70 && avgIntensity > 60) {
      return 'breakthrough';
    }
    if (emotionalScores['healing'] > 60) {
      return 'healing';
    }
    if (emotionalScores['expansion'] > 70) {
      return 'expansion';
    }
    if (volatility > 40) {
      return 'transition';
    }
    if (avgIntensity < 30) {
      return 'contraction';
    }
    if (avgIntensity > 50 && volatility < 20) {
      return 'stability';
    }

    return null;
  }

  /**
   * Record a life event
   */
  async recordLifeEvent(userId: string, event: Partial<LifeEvent>): Promise<LifeEvent> {
    const newEvent = new LifeEventModel({
      userId,
      ...event,
      startDate: event.startDate || new Date(),
    });
    await newEvent.save();

    // Check if this triggers a transition
    if (event.significance && event.significance > 70) {
      await this.recordTransitionFromEvent(userId, newEvent);
    }

    return newEvent;
  }

  /**
   * Record transition from life event
   */
  async recordTransitionFromEvent(userId: string, event: LifeEventDocument): Promise<void> {
    const transition = new TransitionMemoryModel({
      userId,
      transition: {
        from: 'previous_state',
        to: event.title,
        type: 'sudden',
      },
      timeline: {
        recognition: event.startDate,
        decision: event.startDate,
        action: event.startDate,
        stabilization: event.endDate,
      },
      emotionalJourney: {
        anticipation: event.emotionalImpact?.positive || 50,
        anxiety: event.emotionalImpact?.negative || 50,
        excitement: event.emotionalImpact?.positive || 50,
        uncertainty: 50,
        adaptation: 50,
        integration: 50,
      },
      supportFactors: [],
      resistancePoints: [],
      keyMoments: [event.title],
      lessons: event.lessons || [],
      wisdom: '',
    });
    await transition.save();
  }

  /**
   * Record healing journey
   */
  async recordHealingJourney(userId: string, data: Partial<HealingJourney>): Promise<HealingJourney> {
    const journey = new HealingJourneyModel({
      userId,
      ...data,
      progress: {
        current: data.progress?.current || 0,
        trend: 'improving',
        milestones: [],
      },
    });
    await journey.save();
    return journey;
  }

  /**
   * Record growth moment
   */
  async recordGrowthMoment(userId: string, data: Partial<GrowthMoment>): Promise<GrowthMoment> {
    const growth = new GrowthMomentModel({
      userId,
      moment: data.moment || { type: 'realization', trigger: '', context: '' },
      before: data.before || { belief: '', behavior: '', emotional: '' },
      after: data.after || { belief: '', behavior: '', emotional: '' },
      integration: {
        date: new Date(),
        difficulty: 50,
        supportNeeded: [],
        reinforcement: [],
      },
      rippleEffects: [],
    });
    await growth.save();

    // Record as wisdom if significant
    if (data.after?.belief) {
      await this.recordWisdom(userId, {
        origin: { type: 'experience', context: 'growth moment' },
        statement: data.after.belief,
        abstraction: this.abstractWisdom(data.after.belief),
        application: { when: [], how: [], barriers: [] },
        integration: { level: 'aware', since: new Date(), applicationCount: 0, successRate: 0 },
      });
    }

    return growth;
  }

  /**
   * Record wisdom
   */
  async recordWisdom(userId: string, data: Partial<WisdomEntry>): Promise<WisdomEntry> {
    const wisdom = new WisdomEntryModel({
      userId,
      ...data,
    });
    await wisdom.save();
    return wisdom;
  }

  /**
   * Generate memory-based insight
   */
  async generateMemoryInsight(userId: string, currentContext: Record<string, unknown>): Promise<MemoryInsight> {
    const memoryContext = await this.getMemoryContext(userId);

    // Find relevant patterns
    const matchingPatterns = memoryContext.activePatterns.filter(p =>
      p.pattern.type === 'cyclical' && p.triggers.some(t => currentContext[t])
    );

    // Find similar past situations
    const similarEvents = memoryContext.keyLifeEvents.filter(e =>
      memoryContext.currentTransitions.some(t =>
        t.transition.to === e.title
      )
    );

    // Generate insight
    if (matchingPatterns.length > 0) {
      const pattern = matchingPatterns[0];
      return {
        type: 'pattern',
        statement: this.generatePatternInsight(pattern, memoryContext),
        reasoning: `This feels similar to patterns observed ${pattern.firstObserved.toLocaleDateString()}.`,
        memoryReferences: [pattern.id],
        confidence: pattern.pattern.regularity,
        tone: 'reflective',
      };
    }

    if (similarEvents.length > 0) {
      const event = similarEvents[0];
      return {
        type: 'transition',
        statement: this.generateTransitionInsight(event, memoryContext),
        reasoning: `Your past experience with similar situations shows a path forward.`,
        memoryReferences: [event.id],
        confidence: 0.7,
        tone: 'encouraging',
      };
    }

    // Default to wisdom-based insight
    if (memoryContext.accumulatedWisdom.length > 0) {
      const wisdom = memoryContext.accumulatedWisdom[0];
      return {
        type: 'wisdom',
        statement: this.applyWisdom(wisdom, currentContext),
        reasoning: 'Drawing from your accumulated understanding.',
        memoryReferences: [wisdom.id],
        confidence: wisdom.integration.level === 'embodied' ? 0.9 : 0.6,
        tone: 'reflective',
      };
    }

    return {
      type: 'pattern',
      statement: 'You are writing your own story.',
      reasoning: 'Trust the process of becoming.',
      memoryReferences: [],
      confidence: 0.5,
      tone: 'encouraging',
    };
  }

  /**
   * Record conversation
   */
  async recordConversation(userId: string, conversation: Partial<ConversationMemory>): Promise<ConversationMemory> {
    const record = new ConversationMemoryModel({
      userId,
      conversation: {
        type: conversation.conversation?.type || 'check_in',
        date: new Date(),
        summary: conversation.conversation?.summary || '',
        emotionalTone: conversation.conversation?.emotionalTone || 'neutral',
      },
      exchanges: conversation.exchanges || [],
      followUps: [],
    });
    await record.save();
    return record;
  }

  /**
   * Add memory fragment
   */
  async addMemoryFragment(userId: string, fragment: Partial<MemoryFragment>): Promise<MemoryFragment> {
    const record = {
      id: `mf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: fragment.timestamp || new Date(),
      content: fragment.content || '',
      emotional: fragment.emotional || { tone: 'neutral', intensity: 50 },
      context: fragment.context || {},
      importance: fragment.importance || 50,
      type: fragment.type || 'note',
    };

    // Store in LifeEvent for now (could be separate collection)
    await LifeEventModel.updateOne(
      { userId, _id: (await LifeEventModel.findOne({ userId }).sort({ startDate: -1 }))?._id },
      { $push: { memoryFragments: record } }
    );

    return record;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private calculateVolatility(phases: EmotionalPhaseRecord[]): number {
    if (phases.length < 2) return 0;
    const intensities = phases.map(p => p.intensity);
    const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
    const variance = intensities.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intensities.length;
    return Math.sqrt(variance);
  }

  private generatePatternInsight(pattern: BehavioralPattern, context: MemoryContext): string {
    const templates = [
      `You tend to experience "${pattern.emotionalTone}" feelings during ${pattern.triggers[0] || 'similar situations'}. This has happened ${pattern.occurrenceCount} times before.`,
      `There's a rhythm here. Similar to patterns from ${pattern.firstObserved.toLocaleDateString()}, you're entering a phase of ${pattern.manifestations[0] || 'reflection'}.`,
      `This feels familiar. Your history shows "${pattern.emotionalTone}" tends to emerge when ${pattern.triggers[0] || 'circumstances shift'}.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateTransitionInsight(event: LifeEventDocument, context: MemoryContext): string {
    const templates = [
      `You've navigated something similar before. "${event.title}" taught you that transitions, though challenging, lead to growth.`,
      `Your past experience with "${event.title}" shows your resilience. This current phase echoes that journey.`,
      `Remember "${event.title}"? You emerged stronger from that transition. Trust your proven capacity to adapt.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private applyWisdom(wisdom: WisdomEntry, context: Record<string, unknown>): string {
    return `"${wisdom.statement}" - A truth you've been learning to embody.`;
  }

  private abstractWisdom(statement: string): string {
    // Simple abstraction - in production would use AI
    return statement.replace(/specific/, 'meaningful')
      .replace(/\d+/, 'this')
      .replace(/I/me)
      .replace(/my/your');
  }
}

// Memory Fragment Model
export interface MemoryFragmentDocument extends Omit<MemoryFragment, 'id'>, Document {}
const memoryFragmentSchema = new Schema<MemoryFragmentDocument>({
  userId: { type: String, required: true, index: true },
  timestamp: Date,
  content: String,
  emotional: { tone: String, intensity: Number },
  context: { location: String, activity: String, people: [String] },
  importance: { type: Number, default: 50 },
  type: { type: String, enum: ['note', 'insight', 'pattern', 'achievement', 'struggle', 'connection'] },
});
export const MemoryFragmentModel = mongoose.model<MemoryFragmentDocument>('MemoryFragment', memoryFragmentSchema);

export default new MemoryService();
