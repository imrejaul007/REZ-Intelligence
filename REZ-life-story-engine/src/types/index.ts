/**
 * REZ Life Story Engine - Type Definitions
 *
 * Narrative Intelligence - Turning data into meaningful stories
 * Port: 4167
 */

import mongoose, { Document, Schema } from 'mongoose';

// ============================================
// NARRATIVE ARC TYPES
// ============================================

export type StoryArc =
  | 'hero_journey'
  | 'transformation'
  | 'reconnection'
  | 'rebirth'
  | 'quest'
  | 'fall_and_rise'
  | 'coming_of_age'
  | 'integration';

export interface StoryChapter {
  id: string;
  title: string;
  subtitle?: string;
  narrative: string;
  startDate: Date;
  endDate?: Date;
  themes: string[];
  characters?: StoryCharacter[];
  turningPoints: TurningPoint[];
  emotionalArc: {
    beginning: string;
    middle: string;
    end: string;
  };
  lessons: string[];
  connections?: string[];  // Connected chapter IDs
}

export interface TurningPoint {
  id: string;
  date: Date;
  title: string;
  description: string;
  type: 'choice' | 'challenge' | 'revelation' | 'loss' | 'gain' | 'transition';
  emotionalImpact: number;
  significance: number;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: 'mentor' | 'ally' | 'opponent' | 'love_interest' | 'shadow' | 'self';
  archetype: string;
  relationship: string;
}

// ============================================
// LIFE NARRATIVE TYPES
// ============================================

export interface LifeNarrative {
  userId: string;
  currentArc: StoryArc;
  chapters: StoryChapter[];
  themes: string[];
  motifs: string[];  // Recurring symbols
  values: string[];  // What matters to them
  fears: string[];
  desires: string[];
  growth: {
    before: string;
    evolution: string[];
    current: string;
  };
}

export interface NarrativeInsight {
  type: 'reflection' | 'connection' | 'growth' | 'pattern' | 'theme';
  statement: string;
  chapter?: string;
  evidence: string[];
  tone: 'encouraging' | 'reflective' | 'cautionary' | 'celebratory';
}

export interface ChapterUpdate {
  type: 'start' | 'continue' | 'turn' | 'conclude' | 'reflect';
  title: string;
  narrative: string;
  reflections?: string[];
  newUnderstanding?: string;
}

// ============================================
// EMOTIONAL RESONANCE
// ============================================

export interface EmotionalResonance {
  dimension: string;
  before: number;
  current: number;
  trend: 'growing' | 'stable' | 'declining';
  triggers: string[];
  resonance: number;  // How much this matters to them
}

export interface StoryResonance {
  narrative: string;
  emotionalDimensions: EmotionalResonance[];
  metaphoricalStrength: number;
  personalMeaning: number;
  growthAlignment: number;
}

// ============================================
// CONTEXT BRIDGES
// ============================================

export interface ContextBridge {
  fromChapter: string;
  toChapter: string;
  type: 'theme' | 'character' | 'lesson' | 'pattern' | 'feeling';
  description: string;
  insight: string;
}

export interface LifeConnections {
  bridges: ContextBridge[];
  patterns: string[];
  threads: string[];  // Continuing storylines
  emergingThemes: string[];
}

// ============================================
// COSMIC INTERPRETATION
// ============================================

export interface CosmicNarrative {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  chapter: string;
  theme: string;
  energy: 'expanding' | 'contracting' | 'integrating' | 'transforming';
  invitation: string;
  wisdom: string;
}

export interface SymbolicLayer {
  symbol: string;
  meaning: string;
  personalInterpretation?: string;
  frequency: number;
}

// ============================================
// PERSONAL MYTHOLOGY
// ============================================

export interface PersonalMythology {
  userId: string;
  originStory?: string;
  coreWounds?: string[];
  healingJourney?: string;
  gifts?: string[];
  sacredContracts?: string[];
  recurringSymbols: SymbolicLayer[];
  lifeMyth: {
    archetype: string;
    journey: string;
    purpose: string;
  };
}

export interface MythologicalPattern {
  pattern: string;
  mythReference: string;
  currentManifestation: string;
  growthOpportunity: string;
}

// ============================================
// TIMELINE NARRATIVE
// ============================================

export interface TimelineNarrative {
  userId: string;
  era: {
    name: string;
    startDate: Date;
    endDate?: Date;
    significance: number;
  };
  chapters: {
    id: string;
    title: string;
    summary: string;
    emotional: string;
    keyMoment: string;
  }[];
  transitions: {
    from: string;
    to: string;
    trigger: string;
    narrative: string;
  }[];
  current: {
    position: string;
    movement: 'ascending' | 'descending' | 'stable' | 'transforming';
    momentum: number;
  };
}

// ============================================
// NARRATIVE GENERATION
// ============================================

export interface NarrativeGeneration {
  type: 'chapter' | 'reflection' | 'insight' | 'connection' | 'anticipation';
  tone: 'storyteller' | 'wise_friend' | 'mentor' | 'mirror';
  content: string;
  evidence?: string[];
  metaphor?: string;
  invitation?: string;
}

export interface DailyNarrative {
  date: Date;
  opening: string;
  mainContent: string;
  closing: string;
  theme: string;
  reflection: string;
  invitation: string;
  cosmic?: CosmicNarrative;
}

// ============================================
// STORY TEMPLATES
// ============================================

export interface StoryTemplate {
  arc: StoryArc;
  phases: {
    name: string;
    description: string;
    typicalDuration?: string;
    challenges: string[];
    growth: string[];
  }[];
  themes: string[];
  characterArcs: string[];
}

export const STORY_TEMPLATES: Record<StoryArc, StoryTemplate> = {
  hero_journey: {
    arc: 'hero_journey',
    phases: [
      { name: 'Ordinary World', description: 'The familiar, comfortable space', challenges: ['Complacency', 'Unaware of potential'], growth: ['Self-awareness begins'] },
      { name: 'Call to Adventure', description: 'Something disrupts the status quo', challenges: ['Resistance to change', 'Fear of unknown'], growth: ['Courage awakens'] },
      { name: 'Crossing the Threshold', description: 'Committed to the journey', challenges: ['Leaving comfort', 'Facing uncertainty'], growth: ['Determination forms'] },
      { name: 'Tests and Allies', description: 'Learning the rules, meeting helpers', challenges: ['Adaptation', 'Trust building'], growth: ['Wisdom accumulates'] },
      { name: 'Approach the Cave', description: 'Preparing for major challenge', challenges: ['Prejudice', 'Old patterns resurface'], growth: ['Clarity emerges'] },
      { name: 'Ordeal', description: 'The central crisis or challenge', challenges: ['Fear', 'Self-doubt'], growth: ['Inner strength revealed'] },
      { name: 'Reward', description: 'Gaining what was sought', challenges: ['Responsibility', 'Wisdom to use it'], growth: ['Humility grows'] },
      { name: 'The Return', description: 'Returning with newfound wisdom', challenges: ['Integration', 'Helping others understand'], growth: ['Mastery achieved'] },
    ],
    themes: ['Courage', 'Transformation', 'Self-discovery', 'Sacrifice', 'Return'],
    characterArcs: ['From unaware to aware', 'From fearful to courageous', 'From isolated to connected'],
  },
  transformation: {
    arc: 'transformation',
    phases: [
      { name: 'Dissolution', description: 'Old self begins to break down', challenges: ['Grief', 'Resistance'], growth: ['Letting go'] },
      { name: 'Liminal Space', description: 'Between worlds, identity uncertain', challenges: ['Disorientation', 'Faith'], growth: ['Openness'] },
      { name: 'Emergence', description: 'New self begins to form', challenges: ['Integration', 'Stability'], growth: ['New identity solidifies'] },
    ],
    themes: ['Change', 'Renewal', 'Death and rebirth', 'Metamorphosis'],
    characterArcs: ['From rigid to flexible', 'From certain to open', 'From defended to authentic'],
  },
  reconnection: {
    arc: 'reconnection',
    phases: [
      { name: 'Separation', description: 'Distance or disconnection occurred', challenges: ['Pain', 'Pride'], growth: ['Self-reflection'] },
      { name: 'Longing', description: 'Recognition of what is missing', challenges: ['Vulnerability', 'Fear of rejection'], growth: ['Honesty with self'] },
      { name: 'Bridge Building', description: 'Steps toward reconnection', challenges: ['Risk', 'Patience'], growth: ['Courage', 'Compassion'] },
      { name: 'Renewal', description: 'Connection restored or redefined', challenges: ['Maintenance', 'Growth together'], growth: ['Deeper intimacy'] },
    ],
    themes: ['Reunion', 'Forgiveness', 'Relationships', 'Healing'],
    characterArcs: ['From distant to close', 'From guarded to open', 'From isolated to connected'],
  },
  rebirth: {
    arc: 'rebirth',
    phases: [
      { name: 'Death', description: 'End of a significant phase', challenges: ['Grief', 'Loss'], growth: ['Acceptance'] },
      { name: 'Waiting', description: 'In the darkness before dawn', challenges: ['Patience', 'Hope'], growth: ['Faith'] },
      { name: 'Awakening', description: 'New life emerges', challenges: ['Adjustment', 'Identity'], growth: ['Joy', 'Renewed purpose'] },
    ],
    themes: ['Renewal', 'Hope', 'Resurrection', 'New beginnings'],
    characterArcs: ['From dead to alive', 'From hopeless to hopeful', 'From stuck to moving'],
  },
  quest: {
    arc: 'quest',
    phases: [
      { name: 'Quest Declared', description: 'A mission is accepted', challenges: ['Commitment', 'Preparation'], growth: ['Purpose clarity'] },
      { name: 'Journey', description: 'The actual quest unfolds', challenges: ['Obstacles', 'Temptations'], growth: ['Wisdom', 'Skill'] },
      { name: 'Goal Achieved', description: 'The destination is reached', challenges: ['What now?', 'Meaning'], growth: ['Achievement', 'New purpose'] },
    ],
    themes: ['Purpose', 'Adventure', 'Discovery', 'Achievement'],
    characterArcs: ['From passive to active', 'From follower to leader', 'From dreamer to achiever'],
  },
  fall_and_rise: {
    arc: 'fall_and_rise',
    phases: [
      { name: 'Peak', description: 'Height of success or happiness', challenges: ['Overconfidence', 'Blind spots'], growth: ['Gratitude'] },
      { name: 'Fall', description: 'Sudden decline or setback', challenges: ['Shock', 'Humiliation'], growth: ['Resilience'] },
      { name: 'Dark Night', description: 'Deepest point of struggle', challenges: ['Hopelessness', 'Isolation'], growth: ['Inner strength'] },
      { name: 'Choice Point', description: 'Deciding how to move forward', challenges: ['Despair', 'Temptation'], growth: ['Free will', 'Determination'] },
      { name: 'Rising', description: 'Climbing back up', challenges: ['Slow progress', 'Doubt'], growth: ['Perseverance', 'Wisdom'] },
    ],
    themes: ['Resilience', 'Humility', 'Recovery', 'Triumph'],
    characterArcs: ['From top to bottom to top', 'From proud to humble', 'From defeated to victorious'],
  },
  coming_of_age: {
    arc: 'coming_of_age',
    phases: [
      { name: 'Innocence', description: 'Unaware of life\'s complexities', challenges: ['Naivety', 'Protection'], growth: ['Curiosity'] },
      { name: 'Injury', description: 'First major disappointment or loss', challenges: ['Betrayal', 'Pain'], growth: ['Realism'] },
      { name: 'Understanding', description: 'Making sense of experience', challenges: ['Confusion', 'Questions'], growth: ['Wisdom'] },
      { name: 'Initiation', description: 'Proving readiness for next stage', challenges: ['Tests', 'Responsibility'], growth: ['Maturity'] },
    ],
    themes: ['Growing up', 'Innocence lost', 'Wisdom gained', 'Independence'],
    characterArcs: ['From child to adult', 'From naive to wise', 'From dependent to independent'],
  },
  integration: {
    arc: 'integration',
    phases: [
      { name: 'Wholeness Recognized', description: 'Accepting all parts of self', challenges: ['Shadow work', 'Self-acceptance'], growth: ['Wholeness'] },
      { name: 'Synthesis', description: 'Combining disparate experiences', challenges: ['Complexity', 'Contradictions'], growth: ['Unity'] },
      { name: 'Expression', description: 'Living from integrated self', challenges: ['Relevance', 'Authenticity'], growth: ['Freedom', 'Peace'] },
    ],
    themes: ['Wholeness', 'Acceptance', 'Synthesis', 'Peace'],
    characterArcs: ['From fragmented to whole', 'From conflicted to peaceful', 'From performing to being'],
  },
};
