/**
 * Cosmic OS - Type Definitions
 *
 * AI-Powered Human Life Intelligence OS
 * Spiritual abstraction, emotional insights, cosmic guidance
 */

// ============================================
// AGENT TYPES
// ============================================

export type AgentType =
  | 'mystic'      // Spiritual/intuitive guidance
  | 'strategist'   // Career, productivity, decision timing
  | 'healer'       // Emotional wellness, recovery
  | 'oracle'       // Pattern recognition, future trends
  | 'connector'    // Relationships, social energy
  | 'wealth_guide' // Financial discipline, abundance
  | 'explorer';   // Travel, discovery, opportunity

export interface Agent {
  type: AgentType;
  name: string;
  persona: string;
  specialty: string[];
  voice: 'sage' | 'friend' | 'mentor' | 'counselor';
  active: boolean;
}

export const COSMIC_AGENTS: Agent[] = [
  {
    type: 'mystic',
    name: 'Cosmic Mystic',
    persona: 'Wise spiritual guide who sees patterns in the cosmos',
    specialty: ['intuition', 'timing', 'cycles', 'symbols', 'meaning'],
    voice: 'sage',
    active: true,
  },
  {
    type: 'strategist',
    name: 'Life Strategist',
    persona: 'Sharp career advisor who understands ambition and timing',
    specialty: ['career', 'productivity', 'decisions', 'goals', 'timing'],
    voice: 'mentor',
    active: true,
  },
  {
    type: 'healer',
    name: 'Inner Healer',
    persona: 'Compassionate wellness guide who understands emotional cycles',
    specialty: ['emotions', 'recovery', 'stress', 'wellness', 'balance'],
    voice: 'counselor',
    active: true,
  },
  {
    type: 'oracle',
    name: 'Pattern Oracle',
    persona: 'Ancient wisdom keeper who recognizes recurring patterns',
    specialty: ['patterns', 'trends', 'cycles', 'rhythms', 'signs'],
    voice: 'sage',
    active: true,
  },
  {
    type: 'connector',
    name: 'Social Connector',
    persona: 'Warm guide who understands relationships and connection',
    specialty: ['relationships', 'social', 'connection', 'community', 'belonging'],
    voice: 'friend',
    active: true,
  },
  {
    type: 'wealth_guide',
    name: 'Abundance Guide',
    persona: 'Enlightened advisor who understands financial energy',
    specialty: ['abundance', 'flow', 'investment', 'detachment', 'prosperity'],
    voice: 'sage',
    active: true,
  },
  {
    type: 'explorer',
    name: 'Path Explorer',
    persona: 'Adventurous guide who sees opportunities in the unknown',
    specialty: ['adventure', 'opportunity', 'discovery', 'growth', 'courage'],
    voice: 'mentor',
    active: true,
  },
];

// ============================================
// COSMIC STATE TYPES
// ============================================

export interface CosmicState {
  energyLevel: 'high' | 'medium' | 'low';
  emotionalTone: string;
  socialEnergy: number; // 0-100
  focusScore: number; // 0-100
  relationshipEnergy: string;
  financialFlow: string;
  growthInsight: string;
}

export interface DailyCosmicReading {
  date: string;
  cosmicState: CosmicState;
  primaryTheme: string;
  secondaryTheme: string;
  luckyElements: {
    color?: string;
    number?: string;
    direction?: string;
    time?: string;
  };
  affirmation: string;
  caution: string;
}

// ============================================
// INSIGHT TYPES
// ============================================

export interface CosmicInsight {
  agent: AgentType;
  category: 'guidance' | 'warning' | 'opportunity' | 'pattern' | 'connection';
  title: string;
  interpretation: string;
  symbolic: string;
  practical: string;
  timing?: string;
  confidence: number; // 0-1
}

export interface CouncilResponse {
  consensus: string;
  insights: CosmicInsight[];
  agents: AgentType[];
  timestamp: Date;
}

// ============================================
// CONTEXT TYPES
// ============================================

export interface CosmicInput {
  userId?: string;
  // From Emotional Intelligence
  mood?: string;
  energy?: number;
  stress?: number;
  wellness?: number;
  // From Life Pattern Engine
  routines?: string[];
  lifeStage?: string;
  recentEvents?: string[];
  // From other layers
  careerStage?: string;
  financialStress?: number;
  socialEnergy?: number;
  travelFrequency?: number;
  healthStatus?: string;
  // Temporal
  date?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface CosmicContext {
  userId: string;
  timestamp: Date;

  // Cosmic state
  cosmicState: CosmicState;

  // The AI Council response
  council: CouncilResponse;

  // Daily reading
  dailyReading: DailyCosmicReading;

  // Suggested actions
  suggestedActions: string[];
  avoidedActions: string[];

  // Abstract insights (privacy-safe)
  abstractInsights: string[];

  // Data sources used (for transparency)
  dataSources: string[];
}

// ============================================
// MOOD CHECK-IN TYPES
// ============================================

export interface MoodCheckIn {
  userId: string;
  mood: 'radiant' | 'bright' | 'balanced' | 'clouded' | 'stormy' | 'peaceful' | 'restless' | 'tired';
  energy: 1 | 2 | 3 | 4 | 5;
  note?: string;
  gratitude?: string;
  intent?: string;
}

export interface MoodResponse {
  recorded: boolean;
  cosmicInterpretation: CosmicInsight;
  affirmation: string;
  action: string;
}

// ============================================
// JOURNAL TYPES
// ============================================

export interface JournalEntry {
  userId: string;
  prompt: string;
  reflection: string;
  mood?: string;
  timestamp: Date;
}

export interface JournalInsight {
  theme: string;
  pattern: string;
  growth: string;
  cosmicConnection: string;
}

// ============================================
// TIMING GUIDANCE
// ============================================

export interface TimingGuidance {
  favorable: {
    activities: string[];
    timeWindows: string[];
    description: string;
  };
  unfavorable: {
    activities: string[];
    timeWindows: string[];
    description: string;
  };
  neutral: {
    activities: string[];
    description: string;
  };
}

// ============================================
// LIFE DOMAIN TYPES
// ============================================

export type LifeDomain =
  | 'career'
  | 'health'
  | 'relationships'
  | 'finances'
  | 'growth'
  | 'creativity'
  | 'family'
  | 'social'
  | 'spiritual'
  | 'adventure';

export interface DomainGuidance {
  domain: LifeDomain;
  currentState: string;
  guidance: string;
  symbolic: string;
  practicalSteps: string[];
  timingAdvice: string;
}

// ============================================
// API TYPES
// ============================================

export interface GetCosmicContextRequest {
  userId: string;
  includeCouncil?: boolean;
  domains?: LifeDomain[];
}

export interface DailyReadingRequest {
  userId: string;
  date?: string;
}

export interface CouncilConsultationRequest {
  userId: string;
  question: string;
  context?: CosmicInput;
}

export interface JournalPromptRequest {
  userId: string;
  domain?: LifeDomain;
  mood?: string;
}

// ============================================
// COSMIC INTERPRETATION PATTERNS
// ============================================

export const COSMIC_INTERPRETATIONS = {
  // Mood to Cosmic State mapping
  moodToCosmicState: {
    radiant: { energy: 'high', tone: 'Radiant and expansive', social: 90, focus: 85 },
    bright: { energy: 'high', tone: 'Warm and hopeful', social: 80, focus: 75 },
    balanced: { energy: 'medium', tone: 'Steady and centered', social: 60, focus: 80 },
    clouded: { energy: 'medium', tone: 'Contemplative and reflective', social: 40, focus: 60 },
    stormy: { energy: 'low', tone: 'Intense and transformative', social: 30, focus: 40 },
    peaceful: { energy: 'low', tone: 'Serene and content', social: 50, focus: 90 },
    restless: { energy: 'high', tone: 'Eager and searching', social: 70, focus: 30 },
    tired: { energy: 'low', tone: 'Quiet and introspective', social: 30, focus: 50 },
  },

  // Energy level guidance
  energyGuidance: {
    high: {
      actions: ['initiate projects', 'connect with others', 'tackle challenges', 'create'],
      avoid: ['procrastination', 'overthinking', 'isolation'],
      affirmation: 'Your energy is a gift - use it wisely and with purpose',
    },
    medium: {
      actions: ['maintain momentum', 'build on existing work', 'nurture connections'],
      avoid: ['major changes', 'overcommitment', 'rushing'],
      affirmation: 'Balance is your strength - honor the middle path',
    },
    low: {
      actions: ['rest and restore', 'light activities', 'reflection', 'planning'],
      avoid: ['high-pressure decisions', 'burning bridges', 'forced productivity'],
      affirmation: 'Rest is not retreat - it is how the soil is renewed for new growth',
    },
  },

  // Theme mappings
  themes: [
    'transformation', 'integration', 'manifestation', 'release',
    'connection', 'exploration', 'restoration', 'illumination',
    'harmony', 'breakthrough', 'completion', 'beginning',
  ],

  // Affirmations by mood
  affirmations: {
    radiant: 'The light within you illuminates the path for others',
    bright: 'Today brings opportunities aligned with your highest good',
    balanced: 'In equilibrium, all things become possible',
    clouded: 'Even clouds have a silver lining - look for the gift in the challenge',
    stormy: 'After the storm comes clarity - breathe through the intensity',
    peaceful: 'This peace is a foundation - build upon it with gratitude',
    restless: 'The search is the journey - trust where curiosity leads',
    tired: 'Your body speaks wisdom - listen and honor its need for restoration',
  },
};
