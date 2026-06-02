/**
 * REZ Life Story Engine - Core Service
 *
 * Narrative Intelligence - Turning data into meaningful stories
 * Port: 4167
 */

import {
  StoryArc,
  StoryChapter,
  LifeNarrative,
  NarrativeInsight,
  ChapterUpdate,
  StoryResonance,
  CosmicNarrative,
  PersonalMythology,
  TimelineNarrative,
  NarrativeGeneration,
  DailyNarrative,
  STORY_TEMPLATES,
} from '../types/index.js';

// ============================================
// NARRATIVE TEMPLATES
// ============================================

const NARRATIVE_OPENINGS = [
  "In the quiet spaces between moments...",
  "There's a rhythm to your days...",
  "Something is stirring...",
  "In the pattern of your recent weeks...",
  "A thread connects your recent experiences...",
];

const NARRATIVE_CLOSINGS = [
  "Trust the unfolding.",
  "This is part of your story.",
  "The next chapter awaits.",
  "You are writing your own narrative.",
  "Let the story unfold.",
];

const COSMIC_OPENINGS = {
  spring: "New growth emerges...",
  summer: "Your energy expands...",
  autumn: "A season of harvest approaches...",
  winter: "Rest prepares you for renewal...",
};

const THEMATIC_BRIDGES = {
  career: {
    growth: "Your ambitions are finding new form.",
    transition: "Professional seasons are shifting.",
    struggle: "Work challenges are teaching important lessons.",
  },
  health: {
    growth: "Your relationship with your body deepens.",
    recovery: "Wellness returns in gentle waves.",
    awareness: "You're becoming more attuned to your needs.",
  },
  relationships: {
    deepening: "Connections are finding new depth.",
    expansion: "New faces enter your circle.",
    reflection: "Relationships mirror your inner state.",
  },
  personal: {
    growth: "You're becoming more yourself.",
    exploration: "New territories of understanding open.",
    integration: "Parts of you are finding harmony.",
  },
};

const EMOTIONAL_RESONANCE_TEMPLATES = {
  joy: "There's lightness in your step lately.",
  growth: "Progress feels tangible and real.",
  challenge: "Difficulties are sculpting your resilience.",
  transition: "Change whispers at the edges of your days.",
  reflection: "Something deeper is asking for attention.",
  expansion: "Your world feels larger than before.",
  contraction: "A time of gathering before the next leap.",
  healing: "Old patterns are releasing their grip.",
};

// ============================================
// LIFE STORY SERVICE
// ============================================

export class LifeStoryService {
  /**
   * Generate a daily narrative
   */
  generateDailyNarrative(
    context: {
      userId: string;
      currentPhase: string;
      recentThemes: string[];
      emotionalState: string;
      momentum: 'ascending' | 'descending' | 'stable' | 'transforming';
      season?: 'spring' | 'summer' | 'autumn' | 'winter';
    }
  ): DailyNarrative {
    const opening = this.generateOpening(context);
    const mainContent = this.generateMainContent(context);
    const closing = this.generateClosing(context);
    const theme = this.identifyTheme(context);
    const reflection = this.generateReflection(context);
    const invitation = this.generateInvitation(context);

    return {
      date: new Date(),
      opening,
      mainContent,
      closing,
      theme,
      reflection,
      invitation,
      cosmic: this.generateCosmicNarrative(context),
    };
  }

  /**
   * Identify the current story arc
   */
  identifyStoryArc(
    events: Array<{ type: string; significance: number; emotional: string }>,
    transitions: Array<{ from: string; to: string }>
  ): StoryArc {
    // Analyze patterns to determine arc type

    const hasMajorTransition = transitions.some(t => t.to.includes('growth') || t.to.includes('change'));
    const hasLossAndRecovery = events.some(e => e.type === 'loss') && events.some(e => e.type === 'recovery');
    const hasBreakthrough = events.some(e => e.type === 'breakthrough');
    const emotionalJourney = events.map(e => e.emotional);

    // Check for hero's journey pattern
    if (events.length > 10 && hasMajorTransition) {
      return 'hero_journey';
    }

    // Check for transformation
    if (hasBreakthrough && events.some(e => e.emotional === 'healing')) {
      return 'transformation';
    }

    // Check for fall and rise
    if (hasLossAndRecovery) {
      return 'fall_and_rise';
    }

    // Check for rebirth
    if (events.some(e => e.type === 'ending') && events.some(e => e.type === 'new_beginning')) {
      return 'rebirth';
    }

    // Check for reconnection
    if (events.some(e => e.type === 'separation') && events.some(e => e.type === 'reunion')) {
      return 'reconnection';
    }

    // Check for quest
    if (events.some(e => e.type === 'goal') && events.some(e => e.type === 'adventure')) {
      return 'quest';
    }

    // Default to integration
    return 'integration';
  }

  /**
   * Generate chapter content
   */
  generateChapterContent(
    arc: StoryArc,
    phase: string,
    context: {
      recentEvents: string[];
      emotionalState: string;
      themes: string[];
      growth: string[];
    }
  ): StoryChapter {
    const template = STORY_TEMPLATES[arc];
    const phaseData = template.phases.find(p => p.name.toLowerCase().includes(phase.toLowerCase()));

    const narrative = this.composeChapterNarrative(arc, phase, context);

    return {
      id: `chapter_${Date.now()}`,
      title: this.generateChapterTitle(arc, phase),
      subtitle: phaseData?.description || '',
      narrative,
      startDate: new Date(),
      themes: context.themes,
      turningPoints: this.generateTurningPoints(context.recentEvents),
      emotionalArc: {
        beginning: this.getEmotionalBeginning(context),
        middle: this.getEmotionalMiddle(context),
        end: this.getEmotionalEnd(context),
      },
      lessons: context.growth,
    };
  }

  /**
   * Generate narrative insight
   */
  generateNarrativeInsight(
    type: NarrativeInsight['type'],
    context: {
      recentChapter?: string;
      themes?: string[];
      emotionalState?: string;
      patterns?: string[];
    }
  ): NarrativeInsight {
    const templates = this.getInsightTemplates(type);

    switch (type) {
      case 'reflection':
        return {
          type: 'reflection',
          statement: templates.statement.replace('{theme}', context.themes?.[0] || 'growth'),
          chapter: context.recentChapter,
          evidence: [`Based on your recent ${context.themes?.[0] || 'journey'}`],
          tone: 'reflective',
        };

      case 'connection':
        return {
          type: 'connection',
          statement: this.generateConnectionInsight(context),
          chapter: context.recentChapter,
          evidence: context.patterns || [],
          tone: 'encouraging',
        };

      case 'growth':
        return {
          type: 'growth',
          statement: templates.statement.replace('{pattern}', context.patterns?.[0] || 'your journey'),
          chapter: context.recentChapter,
          evidence: [`You're learning {lesson}`],
          tone: 'celebratory',
        };

      case 'pattern':
        return {
          type: 'pattern',
          statement: templates.statement.replace('{pattern}', context.patterns?.[0] || 'this rhythm'),
          chapter: context.recentChapter,
          evidence: context.patterns || [],
          tone: 'reflective',
        };

      case 'theme':
        return {
          type: 'theme',
          statement: templates.statement.replace('{theme}', context.themes?.[0] || 'this phase'),
          chapter: context.recentChapter,
          evidence: [`${context.themes?.[0] || 'This theme'} appears in your recent experiences`],
          tone: 'encouraging',
        };

      default:
        return {
          type: 'reflection',
          statement: 'Your story continues to unfold.',
          evidence: [],
          tone: 'reflective',
        };
    }
  }

  /**
   * Generate story resonance
   */
  generateStoryResonance(
    narrative: string,
    context: {
      personalValues: string[];
      emotionalState: string;
      growth: string[];
    }
  ): StoryResonance {
    const dimensions = [
      { dimension: 'authenticity', resonance: this.calculateResonance(narrative, context.personalValues) },
      { dimension: 'meaning', resonance: this.calculateResonance(narrative, context.growth) },
      { dimension: 'continuity', resonance: 75 },
      { dimension: 'agency', resonance: this.calculateAgency(narrative) },
    ];

    return {
      narrative,
      emotionalDimensions: dimensions.map(d => ({
        dimension: d.dimension,
        before: 50,
        current: d.resonance,
        trend: d.resonance > 60 ? 'growing' : d.resonance < 40 ? 'declining' : 'stable',
        triggers: [],
        resonance: d.resonance,
      })),
      metaphoricalStrength: this.calculateMetaphorStrength(narrative),
      personalMeaning: this.calculateMeaning(narrative, context),
      growthAlignment: this.calculateGrowthAlignment(narrative, context.growth),
    };
  }

  /**
   * Generate personal mythology
   */
  generatePersonalMythology(
    context: {
      recurringSymbols: string[];
      lifePatterns: string[];
      wounds?: string[];
      gifts?: string[];
    }
  ): PersonalMythology {
    return {
      recurringSymbols: context.recurringSymbols.map((symbol, i) => ({
        symbol,
        meaning: this.interpretSymbol(symbol),
        frequency: 3 - i, // Placeholder
      })),
      coreWounds: context.wounds || [],
      healingJourney: 'Your journey involves integrating these wounds into wisdom.',
      gifts: context.gifts || ['Resilience', 'Intuition', 'Compassion'],
      lifeMyth: {
        archetype: this.determineArchetype(context),
        journey: 'The journey of becoming more fully yourself.',
        purpose: 'To embody your unique gifts in service of your own evolution.',
      },
    };
  }

  /**
   * Generate timeline narrative
   */
  generateTimelineNarrative(
    chapters: Array<{
      title: string;
      summary: string;
      startDate: Date;
      emotional: string;
    }>
  ): TimelineNarrative {
    const currentChapter = chapters[chapters.length - 1];

    return {
      userId: '',
      era: {
        name: this.determineEra(chapters),
        startDate: chapters[0]?.startDate || new Date(),
        significance: this.calculateEraSignificance(chapters),
      },
      chapters: chapters.map((c, i) => ({
        id: `chapter_${i}`,
        title: c.title,
        summary: c.summary,
        emotional: c.emotional,
        keyMoment: this.extractKeyMoment(c),
      })),
      transitions: this.generateTransitions(chapters),
      current: {
        position: currentChapter?.title || 'Current Chapter',
        movement: this.determineMovement(chapters),
        momentum: this.calculateMomentum(chapters),
      },
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private generateOpening(context: {
    currentPhase: string;
    recentThemes: string[];
    emotionalState: string;
  }): string {
    const baseOpening = NARRATIVE_OPENINGS[Math.floor(Math.random() * NARRATIVE_OPENINGS.length)];

    if (context.recentThemes.includes('growth')) {
      return `Growth whispers through your recent days. ${baseOpening}`;
    }

    if (context.recentThemes.includes('transition')) {
      return `Something is shifting in your world. ${baseOpening}`;
    }

    return baseOpening;
  }

  private generateMainContent(context: {
    currentPhase: string;
    emotionalState: string;
    momentum: string;
  }): string {
    const template = EMOTIONAL_RESONANCE_TEMPLATES[context.emotionalState as keyof typeof EMOTIONAL_RESONANCE_TEMPLATES] ||
      EMOTIONAL_RESONANCE_TEMPLATES.transition;

    const momentumAddendum = context.momentum === 'ascending'
      ? "Your energy builds with quiet confidence."
      : context.momentum === 'descending'
      ? "A gentle turning inward is occurring."
      : "Steady presence marks these days.";

    return `${template} ${momentumAddendum}`;
  }

  private generateClosing(context: { momentum: string }): string {
    const closing = NARRATIVE_CLOSINGS[Math.floor(Math.random() * NARRATIVE_CLOSINGS.length)];
    return closing;
  }

  private generateCosmicNarrative(context: {
    season?: string;
    currentPhase: string;
    momentum: string;
  }): CosmicNarrative {
    const season = (context.season || this.determineCurrentSeason()) as CosmicNarrative['season'];

    return {
      season,
      chapter: this.getCosmicChapter(season),
      theme: this.getCosmicTheme(season),
      energy: this.getCosmicEnergy(context.momentum),
      invitation: this.getCosmicInvitation(season),
      wisdom: this.getCosmicWisdom(season),
    };
  }

  private determineCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  private getCosmicChapter(season: string): string {
    const chapters: Record<string, string> = {
      spring: 'A Season of New Beginnings',
      summer: 'The Fullness of Being',
      autumn: 'Harvest and Reflection',
      winter: 'The Quiet of Renewal',
    };
    return chapters[season] || chapters.spring;
  }

  private getCosmicTheme(season: string): string {
    const themes: Record<string, string> = {
      spring: 'Growth emerges from rest',
      summer: 'Energy finds expression',
      autumn: 'Wisdom crystallizes',
      winter: 'Depth邀请s contemplation',
    };
    return themes[season] || themes.spring;
  }

  private getCosmicEnergy(momentum: string): CosmicNarrative['energy'] {
    const map: Record<string, CosmicNarrative['energy']> = {
      ascending: 'expanding',
      descending: 'contracting',
      stable: 'integrating',
      transforming: 'transforming',
    };
    return map[momentum] || 'integrating';
  }

  private getCosmicInvitation(season: string): string {
    const invitations: Record<string, string> = {
      spring: 'Plant seeds of intention',
      summer: 'Fully inhabit your joy',
      autumn: 'Gather your wisdom',
      winter: 'Rest in your depths',
    };
    return invitations[season] || invitations.spring;
  }

  private getCosmicWisdom(season: string): string {
    const wisdoms: Record<string, string> = {
      spring: 'What wants to begin in you?',
      summer: 'How does your light serve?',
      autumn: 'What have you grown?',
      winter: 'What remains when you rest?',
    };
    return wisdoms[season] || wisdoms.spring;
  }

  private identifyTheme(context: {
    recentThemes: string[];
    momentum: string;
  }): string {
    if (context.recentThemes.length > 0) {
      return context.recentThemes[0];
    }

    const themeMap: Record<string, string> = {
      ascending: 'Expansion',
      descending: 'Integration',
      stable: 'Steadiness',
      transforming: 'Change',
    };

    return themeMap[context.momentum] || 'Presence';
  }

  private generateReflection(context: {
    currentPhase: string;
    emotionalState: string;
  }): string {
    const reflections = [
      `What has this ${context.currentPhase} taught you?`,
      `How are you showing up differently these days?`,
      `What matters most in this chapter?`,
      `What are you learning about yourself?`,
      `What wants your attention?`,
    ];

    return reflections[Math.floor(Math.random() * reflections.length)];
  }

  private generateInvitation(context: {
    momentum: string;
    emotionalState: string;
  }): string {
    const invitations: Record<string, string[]> = {
      ascending: [
        'Take one bold step forward',
        'Share your light with others',
        'Expand into your growing edge',
      ],
      descending: [
        'Allow the slowing',
        'Simplify your focus',
        'Honor what is completing',
      ],
      stable: [
        'Deepen what is working',
        'Appreciate the steadiness',
        'Find peace in the present',
      ],
      transforming: [
        'Embrace the uncertainty',
        'Trust what is emerging',
        'Let the old shapes dissolve',
      ],
    };

    const options = invitations[context.momentum] || invitations.stable;
    return options[Math.floor(Math.random() * options.length)];
  }

  private getInsightTemplates(type: string): { statement: string } {
    const templates: Record<string, { statement: string }> = {
      reflection: { statement: 'There\'s wisdom in how {theme} has been unfolding.' },
      connection: { statement: 'Your journey shows a meaningful pattern.' },
      growth: { statement: 'You\'re learning something profound about {pattern}.' },
      pattern: { statement: 'The rhythm of {pattern} reveals something true about you.' },
      theme: { statement: '{theme} has been a teacher on your path.' },
    };
    return templates[type] || templates.reflection;
  }

  private generateConnectionInsight(context: {
    patterns?: string[];
    themes?: string[];
  }): string {
    if (context.patterns && context.patterns.length > 1) {
      return `The pattern of ${context.patterns[0]} and ${context.patterns[1]} tells a connected story.`;
    }
    if (context.themes && context.themes.length > 0) {
      return `Your experiences with ${context.themes[0]} weave a meaningful thread.`;
    }
    return 'Threads of meaning connect your journey.';
  }

  private composeChapterNarrative(arc: string, phase: string, context: {
    recentEvents: string[];
    themes: string[];
  }): string {
    const template = STORY_TEMPLATES[arc as StoryArc];
    const phaseData = template.phases.find(p => p.name.toLowerCase().includes(phase.toLowerCase()));

    let narrative = phaseData?.description || 'Your story continues to unfold.';

    if (context.themes.length > 0) {
      narrative += ` Themes of ${context.themes.slice(0, 2).join(' and ')} shape this chapter.`;
    }

    return narrative;
  }

  private generateChapterTitle(arc: string, phase: string): string {
    return `${this.capitalizeFirst(phase)}: The ${this.capitalizeFirst(arc.replace('_', ' '))} Continues`;
  }

  private generateTurningPoints(events: string[]): Array<{
    id: string;
    date: Date;
    title: string;
    description: string;
    type: string;
    emotionalImpact: number;
    significance: number;
  }> {
    return events.slice(0, 3).map((event, i) => ({
      id: `turning_${i}`,
      date: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
      title: this.capitalizeFirst(event),
      description: `A significant moment involving ${event}`,
      type: 'revelation',
      emotionalImpact: 70,
      significance: 80,
    }));
  }

  private getEmotionalBeginning(context: { emotionalState: string }): string {
    return `Beginnings felt ${context.emotionalState}`;
  }

  private getEmotionalMiddle(_context: { emotionalState: string }): string {
    return 'Middle chapters bring depth and texture.';
  }

  private getEmotionalEnd(context: { momentum: string }): string {
    const ends: Record<string, string> = {
      ascending: 'Ends build toward something',
      descending: 'Ends honor what is completing',
      stable: 'Ends find their natural close',
      transforming: 'Ends open into new beginnings',
    };
    return ends[context.momentum] || ends.stable;
  }

  private calculateResonance(text: string, values: string[]): number {
    if (values.length === 0) return 50;
    const matches = values.filter(v => text.toLowerCase().includes(v.toLowerCase())).length;
    return Math.min(100, 50 + matches * 15);
  }

  private calculateAgency(text: string): number {
    const agencyWords = ['choosing', 'creating', 'building', 'growing', 'becoming'];
    const matches = agencyWords.filter(w => text.toLowerCase().includes(w)).length;
    return Math.min(100, 40 + matches * 15);
  }

  private calculateMetaphorStrength(text: string): number {
    // Simple placeholder - would use NLP in production
    const metaphorIndicators = ['like', 'as if', 'mirrors', 'reflects', 'symbol'];
    const matches = metaphorIndicators.filter(m => text.toLowerCase().includes(m)).length;
    return Math.min(100, 30 + matches * 20);
  }

  private calculateMeaning(_text: string, context: { growth: string[] }): number {
    return Math.min(100, 40 + context.growth.length * 15);
  }

  private calculateGrowthAlignment(_text: string, growth: string[]): number {
    return Math.min(100, 50 + growth.length * 10);
  }

  private interpretSymbol(symbol: string): string {
    const interpretations: Record<string, string> = {
      water: 'Flow, emotion, purification, adaptability',
      fire: 'Transformation, passion, destruction, renewal',
      earth: 'Stability, grounding, abundance, patience',
      air: 'Thought, communication, freedom, clarity',
      tree: 'Growth, rootedness, seasons, life cycles',
      mountain: 'Challenge, achievement, perspective, permanence',
      journey: 'Path, growth, discovery, transformation',
      circle: 'Wholeness, cycles, completion, continuity',
    };

    return interpretations[symbol] || 'A unique symbol of your inner world';
  }

  private determineArchetype(context: { wounds?: string[]; gifts?: string[] }): string {
    if (context.wounds?.includes('abandonment')) return 'The Orphan who becomes The Sage';
    if (context.wounds?.includes('betrayal')) return 'The Warrior who becomes The Peaceful One';
    if (context.gifts?.includes('intuition')) return 'The Seer who guides others';
    return 'The Whole Person on the journey of integration';
  }

  private determineEra(chapters: Array<{ startDate: Date }>): string {
    if (chapters.length < 2) return 'A New Era Begins';
    const firstDate = chapters[0]?.startDate;
    if (!firstDate) return 'The Present Chapter';

    const years = Math.floor((Date.now() - firstDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
    if (years < 1) return 'Recent Chapters';
    if (years < 3) return 'The Early Journey';
    if (years < 10) return 'The Middle Passage';
    return 'A Long Arc';
  }

  private calculateEraSignificance(chapters: Array<{ summary: string }>): number {
    return Math.min(100, chapters.length * 10 + 50);
  }

  private extractKeyMoment(chapter: { summary: string }): string {
    const words = chapter.summary.split(' ').slice(0, 10).join(' ');
    return words + (chapter.summary.split(' ').length > 10 ? '...' : '');
  }

  private generateTransitions(chapters: Array<{ title: string }>): Array<{
    from: string;
    to: string;
    trigger: string;
    narrative: string;
  }> {
    const transitions = [];
    for (let i = 0; i < chapters.length - 1; i++) {
      transitions.push({
        from: chapters[i].title,
        to: chapters[i + 1].title,
        trigger: 'A natural evolution',
        narrative: 'Something shifted, and the story moved forward.',
      });
    }
    return transitions;
  }

  private determineMovement(chapters: Array<{ emotional: string }>): 'ascending' | 'descending' | 'stable' | 'transforming' {
    const emotionals = chapters.map(c => c.emotional);
    const recent = emotionals.slice(-3);

    if (recent.includes('growth')) return 'ascending';
    if (recent.includes('challenge')) return 'transforming';
    if (recent.includes('stable')) return 'stable';
    return 'stable';
  }

  private calculateMomentum(chapters: Array<{ emotional: string }>): number {
    const emotionals = chapters.map(c => c.emotional);
    const growthCount = emotionals.filter(e => e === 'growth').length;
    return Math.min(100, 30 + growthCount * 15);
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default new LifeStoryService();
