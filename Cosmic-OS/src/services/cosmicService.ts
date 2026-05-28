/**
 * Cosmic OS - Core Service
 *
 * AI Council of Agents, cosmic interpretation, spiritual abstraction
 */

import axios from 'axios';
import type {
  CosmicInput,
  CosmicContext,
  CosmicState,
  CosmicInsight,
  CouncilResponse,
  DailyCosmicReading,
  DomainGuidance,
  TimingGuidance,
  MoodCheckIn,
  MoodResponse,
  JournalEntry,
  AgentType,
  Agent,
  COSMIC_AGENTS,
  COSMIC_INTERPRETATIONS,
  LifeDomain,
} from '../types/index.js';

// ============================================
// SERVICE URLS
// ============================================

const SERVICE_URLS = {
  emotional: process.env.EMOTIONAL_SERVICE_URL || 'http://localhost:4160',
  lifePattern: process.env.LIFE_PATTERN_SERVICE_URL || 'http://localhost:4161',
  humanContext: process.env.HUMAN_CONTEXT_URL || 'http://localhost:4162',
  signalAggregator: process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4142',
};

// ============================================
// COSMIC INTERPRETATION ENGINE
// ============================================

export function interpretMoodToCosmicState(mood: string, energy: number): CosmicState {
  const moodMap: Record<string, { tone: string; social: number; focus: number }> = {
    very_positive: { tone: 'Radiant and expansive', social: 90, focus: 85 },
    positive: { tone: 'Warm and hopeful', social: 80, focus: 75 },
    neutral: { tone: 'Steady and centered', social: 60, focus: 70 },
    negative: { tone: 'Contemplative and reflective', social: 40, focus: 60 },
    very_negative: { tone: 'Quiet and introspective', social: 30, focus: 50 },
    anxious: { tone: 'Restless and searching', social: 50, focus: 30 },
    calm: { tone: 'Serene and content', social: 60, focus: 85 },
    energetic: { tone: 'Dynamic and vibrant', social: 80, focus: 70 },
    tired: { tone: 'Quiet and restorative', social: 30, focus: 50 },
    stressed: { tone: 'Intense and pressured', social: 40, focus: 40 },
    peaceful: { tone: 'Tranquil and harmonious', social: 50, focus: 90 },
  };

  const mapped = moodMap[mood] || { tone: 'Variable and nuanced', social: 50, focus: 60 };
  const energyLevel = energy > 70 ? 'high' : energy > 40 ? 'medium' : 'low';

  return {
    energyLevel,
    emotionalTone: mapped.tone,
    socialEnergy: mapped.social,
    focusScore: mapped.focus,
    relationshipEnergy: getRelationshipGuidance(mapped.social),
    financialFlow: getFinancialGuidance(energyLevel),
    growthInsight: getGrowthInsight(energyLevel),
  };
}

function getRelationshipGuidance(socialEnergy: number): string {
  if (socialEnergy > 80) return 'Strong connection energy - ideal for meaningful conversations';
  if (socialEnergy > 60) return 'Favorable for social engagement and networking';
  if (socialEnergy > 40) return 'Moderate social energy - quality over quantity';
  return 'Solitude may feel more restorative today';
}

function getFinancialGuidance(energyLevel: string): string {
  if (energyLevel === 'high') return 'Abundance mindset flows naturally - wise decisions favored';
  if (energyLevel === 'medium') return 'Balanced approach serves well - steady progress';
  return 'Conservation may feel wiser - avoid impulsive commitments';
}

function getGrowthInsight(energyLevel: string): string {
  if (energyLevel === 'high') return 'Momentum is building - this is a favorable time for new beginnings';
  if (energyLevel === 'medium') return 'Steady progress continues - consistency compounds';
  return 'This phase may be for integration rather than expansion';
}

// ============================================
// AI COUNCIL - AGENT INTERPRETATIONS
// ============================================

export function generateCouncilResponse(
  cosmicState: CosmicState,
  input: CosmicInput,
  activeAgents: AgentType[] = ['mystic', 'healer', 'strategist', 'oracle']
): CouncilResponse {
  const insights: CosmicInsight[] = [];

  // Generate insight for each active agent
  for (const agentType of activeAgents) {
    const insight = generateAgentInsight(agentType, cosmicState, input);
    insights.push(insight);
  }

  // Generate consensus
  const consensus = generateConsensus(insights, cosmicState);

  return {
    consensus,
    insights,
    agents: activeAgents,
    timestamp: new Date(),
  };
}

function generateAgentInsight(
  agentType: AgentType,
  cosmicState: CosmicState,
  input: CosmicInput
): CosmicInsight {
  switch (agentType) {
    case 'mystic':
      return generateMysticInsight(cosmicState, input);
    case 'healer':
      return generateHealerInsight(cosmicState, input);
    case 'strategist':
      return generateStrategistInsight(cosmicState, input);
    case 'oracle':
      return generateOracleInsight(cosmicState, input);
    case 'connector':
      return generateConnectorInsight(cosmicState, input);
    case 'wealth_guide':
      return generateWealthGuideInsight(cosmicState, input);
    case 'explorer':
      return generateExplorerInsight(cosmicState, input);
    default:
      return {
        agent: 'mystic',
        category: 'guidance',
        title: 'Cosmic Guidance',
        interpretation: 'The universe speaks in gentle whispers today',
        symbolic: 'The current state invites reflection and presence',
        practical: 'Be mindful of your intentions and actions',
        confidence: 0.6,
      };
  }
}

function generateMysticInsight(state: CosmicState, input: CosmicInput): CosmicInsight {
  const energyMessages = {
    high: 'Your energy field is expansive today - like the sun at its peak',
    medium: 'Balance flows through your energy field - the middle path is clear',
    low: 'Your energy draws inward - like the quiet of deep night',
  };

  const themes = [
    'The cosmos reminds us that cycles are eternal',
    'What is hidden may now become visible',
    'The time between moments holds its own wisdom',
    'The inner and outer worlds reflect each other',
  ];

  return {
    agent: 'mystic',
    category: 'guidance',
    title: 'Cosmic Resonance',
    interpretation: energyMessages[state.energyLevel],
    symbolic: themes[Math.floor(Math.random() * themes.length)],
    practical: 'Pause and notice the subtle currents of change around you',
    timing: 'The present moment holds special significance',
    confidence: 0.75,
  };
}

function generateHealerInsight(state: CosmicState, input: CosmicInput): CosmicInsight {
  let guidance = 'Your emotional landscape is navigating its own path today';
  let practical = 'Honor your feelings without judgment - they are information, not commands';

  if (state.energyLevel === 'low') {
    guidance = 'Rest is a form of medicine - your body asks for gentleness';
    practical = 'Choose one light activity over ambitious pursuits. Small kindnesses to yourself matter.';
  } else if (state.energyLevel === 'high') {
    guidance = 'Your healing energy is potent today - share it wisely';
    practical = 'Channel vitality into nurturing yourself and others';
  }

  // Check for stress signals
  if (input.stress && input.stress > 70) {
    return {
      agent: 'healer',
      category: 'warning',
      title: 'Healing Attention',
      interpretation: 'Your system signals the need for gentle recovery',
      symbolic: 'The body speaks in whispers before it shouts',
      practical: 'Consider: What would kindness to yourself look like today?',
      timing: 'Now is the time for restoration, not pushing through',
      confidence: 0.85,
    };
  }

  return {
    agent: 'healer',
    category: 'guidance',
    title: 'Inner Healing',
    interpretation: guidance,
    symbolic: 'Healing is not linear - every step inward is also a step forward',
    practical,
    confidence: 0.8,
  };
}

function generateStrategistInsight(state: CosmicState, input: CosmicInput): CosmicInsight {
  let guidance = 'Focus finds its natural home today';
  let practical = 'Your concentration is a gift - use it on what truly matters';

  if (state.focusScore > 80) {
    guidance = 'Mental clarity peaks - strategic thinking is favored';
    practical = 'Tackle the work that requires deep thinking now';
  } else if (state.focusScore < 50) {
    guidance = 'Mental energy may be scattered - avoid high-stakes decisions';
    practical = 'Choose routine tasks over new initiatives';
  }

  // Career context
  if (input.careerStage) {
    const careerMessages: Record<string, string> = {
      early: 'The foundation you build now will support future growth',
      growth: 'Visibility and action serve you well in this phase',
      mid: 'Integration of experience brings new wisdom',
      senior: 'Your experience is an asset - share it',
    };
    guidance += `. ${careerMessages[input.careerStage] || ''}`;
  }

  return {
    agent: 'strategist',
    category: 'guidance',
    title: 'Strategic Alignment',
    interpretation: guidance,
    symbolic: 'Strategy without wisdom is just planning',
    practical,
    timing: 'Plan tomorrow\'s priorities today',
    confidence: 0.75,
  };
}

function generateOracleInsight(state: CosmicState, input: CosmicInput): CosmicInsight {
  const patterns = [
    'You may notice recurring themes or messages appearing',
    'Patterns from the past may offer guidance for today',
    'The rhythm of your life reveals its own wisdom',
    'What feels familiar may hold a new lesson',
  ];

  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  return {
    agent: 'oracle',
    category: 'pattern',
    title: 'Pattern Recognition',
    interpretation: pattern,
    symbolic: 'The oracle sees threads connecting moments across time',
    practical: 'Look for what repeats - it carries meaning',
    timing: 'Past insights may illuminate present choices',
    confidence: 0.7,
  };
}

function generateConnectorInsight(state: CosmicState, input: CosmicInput): CosmicInsight {
  const socialMessages = {
    high: 'Connection energy flows freely - meaningful exchanges are favored',
    medium: 'Selective connection serves you well',
    low: 'Quality connection matters more than quantity today',
  };

  return {
    agent: 'connector',
    category: 'connection',
    title: 'Social Harmony',
    interpretation: socialMessages[state.energyLevel],
    symbolic: 'Every connection shifts both parties - this is the nature of relationship',
    practical: state.socialEnergy > 60
      ? 'Reach out to someone who matters - your warmth is felt'
      : 'A meaningful conversation, even brief, may carry weight today',
    confidence: 0.75,
  };
}

function generateWealthGuideInsight(state: CosmicState, input: CosmicInput): CosmicInsight {
  let guidance = 'Financial decisions made with clarity serve long-term wellbeing';
  let practical = 'Abundance is a mindset as much as a material condition';

  if (input.financialStress && input.financialStress > 60) {
    return {
      agent: 'wealth_guide',
      category: 'warning',
      title: 'Financial Sensitivity',
      interpretation: 'Financial energy may feel restricted - this too is temporary',
      symbolic: 'True wealth includes peace of mind',
      practical: 'Avoid major financial commitments. Small, mindful choices matter.',
      timing: 'Restraint now creates freedom later',
      confidence: 0.85,
    };
  }

  if (state.energyLevel === 'high') {
    guidance = 'Investment mindset is favorable - but wisdom over excitement';
    practical = 'New opportunities may appear - evaluate with care, not urgency';
  }

  return {
    agent: 'wealth_guide',
    category: 'guidance',
    title: 'Abundance Flow',
    interpretation: guidance,
    symbolic: 'Money is energy - it flows toward where attention goes',
    practical,
    confidence: 0.7,
  };
}

function generateExplorerInsight(state: CosmicState, input: CosmicInput): CosmicInsight {
  if (state.energyLevel === 'high') {
    return {
      agent: 'explorer',
      category: 'opportunity',
      title: 'Discovery Awaits',
      interpretation: 'New horizons may reveal themselves',
      symbolic: 'The explorer knows that the most important journey is internal',
      practical: 'Stay open to unexpected invitations or ideas',
      timing: 'Novelty favors the curious today',
      confidence: 0.7,
    };
  }

  return {
    agent: 'explorer',
    category: 'guidance',
    title: 'Inner Exploration',
    interpretation: 'The greatest discoveries often begin with looking inward',
    symbolic: 'You carry within you all the worlds you seek',
    practical: 'A moment of reflection may reveal more than rushing forward',
    confidence: 0.75,
  };
}

function generateConsensus(insights: CosmicInsight[], state: CosmicState): string {
  const categories = insights.map(i => i.category);
  const warnings = categories.filter(c => c === 'warning').length;

  if (warnings > 0) {
    return `The council notes ${warnings} area${warnings > 1 ? 's' : ''} requiring gentle attention. Take time for reflection and self-care.`;
  }

  if (state.energyLevel === 'high') {
    return 'The council sees favorable conditions for action, connection, and new beginnings. Your energy serves you well today.';
  }

  if (state.energyLevel === 'low') {
    return 'The council recommends honoring the quiet. Rest, reflection, and gentle activities are favored. Tomorrow brings renewed energy.';
  }

  return 'The council observes balance. Steady progress and mindful choices serve you well today.';
}

// ============================================
// DAILY READING GENERATION
// ============================================

export function generateDailyReading(state: CosmicState, userId: string): DailyCosmicReading {
  const date = new Date().toISOString().split('T')[0];

  // Determine primary theme
  const themes = [
    { theme: 'New Beginnings', condition: state.energyLevel === 'high' },
    { theme: 'Integration', condition: state.energyLevel === 'low' },
    { theme: 'Connection', condition: state.socialEnergy > 70 },
    { theme: 'Reflection', condition: state.focusScore > 80 },
    { theme: 'Balance', condition: true },
    { theme: 'Growth', condition: state.energyLevel === 'medium' },
  ];

  const primaryTheme = themes.find(t => t.condition)?.theme || 'Balance';
  const secondaryThemes = themes.filter(t => t.theme !== primaryTheme);
  const secondaryTheme = secondaryThemes[Math.floor(Math.random() * secondaryThemes.length)]?.theme || 'Harmony';

  // Lucky elements based on cosmic state
  const colors = ['blue', 'green', 'gold', 'white', 'purple'];
  const luckyColor = state.energyLevel === 'high' ? 'gold' : state.energyLevel === 'low' ? 'blue' : 'green';

  return {
    date,
    cosmicState: state,
    primaryTheme,
    secondaryTheme,
    luckyElements: {
      color: luckyColor,
      number: String(Math.floor(Math.random() * 9) + 1),
      direction: state.energyLevel === 'high' ? 'forward' : 'inward',
      time: state.energyLevel === 'high' ? 'morning' : 'evening',
    },
    affirmation: getAffirmation(state),
    caution: getCaution(state),
  };
}

function getAffirmation(state: CosmicState): string {
  const affirmations: Record<string, string> = {
    high: 'Today I embrace the energy within me and use it with intention and care',
    medium: 'I find balance in the middle path - neither too much nor too little',
    low: 'I honor my need for rest - in stillness, I find my center',
  };
  return affirmations[state.energyLevel] || affirmations.medium;
}

function getCaution(state: CosmicState): string {
  const cautions: Record<string, string> = {
    high: 'Avoid spreading yourself too thin - channel energy wisely',
    medium: 'Watch for the temptation to maintain the status quo when change is needed',
    low: 'Avoid harsh self-judgment for needing rest - it is a gift',
  };
  return cautions[state.energyLevel] || cautions.medium;
}

// ============================================
// DOMAIN GUIDANCE
// ============================================

export function getDomainGuidance(domain: LifeDomain, state: CosmicState, input: CosmicInput): DomainGuidance {
  const domainMap: Record<LifeDomain, DomainGuidance> = {
    career: {
      domain,
      currentState: state.focusScore > 70 ? 'Clarity favors career decisions' : 'Reflection may serve better than action',
      guidance: state.focusScore > 70 ? 'Strategic moves favored' : 'Strategic planning time',
      symbolic: 'Career is a marathon, not a sprint',
      practicalSteps: state.focusScore > 70
        ? ['Take decisive action', 'Initiate important conversations', 'Focus on priority work']
        : ['Review career goals', 'Update resume or portfolio', 'Plan next quarter'],
      timingAdvice: state.focusScore > 70 ? 'Now is favorable for career action' : 'Wait for clearer energy',
    },
    health: {
      domain,
      currentState: state.energyLevel === 'high' ? 'Energy supports physical activity' : 'Rest serves better',
      guidance: state.energyLevel === 'high' ? 'Physical activity favored' : 'Gentle movement or rest',
      symbolic: 'The body is a temple - treat it with reverence',
      practicalSteps: state.energyLevel === 'high'
        ? ['Exercise with vigor', 'Try a new physical activity', 'Stretch and strengthen']
        : ['Gentle yoga', 'Mindful walking', 'Adequate hydration and rest'],
      timingAdvice: state.energyLevel === 'high' ? 'Morning or afternoon ideal for exercise' : 'Evening rest beneficial',
    },
    relationships: {
      domain,
      currentState: state.socialEnergy > 60 ? 'Social energy favors connection' : 'Solitude may restore',
      guidance: state.socialEnergy > 60 ? 'Reach out and connect' : 'Honor quiet time',
      symbolic: 'Relationships are mirrors reflecting our inner state',
      practicalSteps: state.socialEnergy > 60
        ? ['Call a friend', 'Make plans for connection', 'Express appreciation']
        : ['Self-reflection time', 'Journal about relationships', 'Peaceful solitude'],
      timingAdvice: state.socialEnergy > 60 ? 'Evening social energy peaks' : 'Morning solitude most restorative',
    },
    finances: {
      domain,
      currentState: state.energyLevel === 'high' ? 'Mental clarity favors financial decisions' : 'Conservative approach recommended',
      guidance: state.energyLevel === 'high' ? 'Review and optimize finances' : 'Avoid major financial commitments',
      symbolic: 'Abundance flows to those who steward wisely',
      practicalSteps: state.energyLevel === 'high'
        ? ['Review budgets', 'Consider investments', 'Plan savings strategy']
        : ['Continue current habits', 'Avoid impulse purchases', 'Track spending'],
      timingAdvice: state.energyLevel === 'high' ? 'Good time for financial planning' : 'Maintain current approach',
    },
    growth: {
      domain,
      currentState: state.energyLevel === 'high' ? 'Growth energy is potent' : 'Integration time',
      guidance: state.energyLevel === 'high' ? 'Learn something new' : 'Reflect on lessons learned',
      symbolic: 'Growth happens in spirals - returning to themes at higher levels',
      practicalSteps: state.energyLevel === 'high'
        ? ['Start a new course', 'Read something challenging', 'Try a new skill']
        : ['Journal about growth', 'Meditate on lessons', 'Practice gratitude for progress'],
      timingAdvice: state.energyLevel === 'high' ? 'Morning learning most effective' : 'Evening reflection ideal',
    },
    creativity: {
      domain,
      currentState: state.energyLevel === 'high' ? 'Creative energy flows freely' : 'Creative energy rests',
      guidance: state.energyLevel === 'high' ? 'Create and express' : 'Gather inspiration quietly',
      symbolic: 'Creativity is the soul speaking its language',
      practicalSteps: state.energyLevel === 'high'
        ? ['Work on creative projects', 'Express yourself through art', 'Write or compose']
        : ['Visit galleries or museums', 'Read inspiring work', 'Observe beauty around you'],
      timingAdvice: state.energyLevel === 'high' ? 'Uninterrupted creative time most productive' : 'Passive inspiration gathering',
    },
    family: {
      domain,
      currentState: 'Family connections hold meaning today',
      guidance: state.socialEnergy > 50 ? 'Family engagement favored' : 'Quiet family time serves well',
      symbolic: 'Family is where we learn love\'s first lessons',
      practicalSteps: state.socialEnergy > 50
        ? ['Plan family activity', 'Call family members', 'Share a meal together']
        : ['Quiet presence with family', 'Small acts of care', 'Thoughtful gestures'],
      timingAdvice: 'Evening family time most meaningful',
    },
    social: {
      domain,
      currentState: state.socialEnergy > 60 ? 'Social energy is strong' : 'Selective socializing favored',
      guidance: state.socialEnergy > 60 ? 'Expand your social circles' : 'Quality over quantity',
      symbolic: 'Every soul we meet teaches us something about ourselves',
      practicalSteps: state.socialEnergy > 60
        ? ['Attend social events', 'Meet new people', 'Host gatherings']
        : ['Deepen existing friendships', 'Meaningful one-on-one time', 'Community involvement'],
      timingAdvice: state.socialEnergy > 60 ? 'Social gatherings most energizing in evening' : 'Small gatherings most fulfilling',
    },
    spiritual: {
      domain,
      currentState: 'Spiritual connection is available',
      guidance: 'Inner work yields rich insights',
      symbolic: 'The divine speaks in the silence between thoughts',
      practicalSteps: ['Meditation or prayer', 'Nature connection', 'Mindful practices', 'Gratitude ritual'],
      timingAdvice: 'Early morning or late evening most conducive to spiritual practice',
    },
    adventure: {
      domain,
      currentState: state.energyLevel === 'high' ? 'Adventure energy peaks' : 'Adventure energy rests',
      guidance: state.energyLevel === 'high' ? 'New experiences await' : 'Plan adventures for later',
      symbolic: 'Life is an adventure - each moment offers new horizons',
      practicalSteps: state.energyLevel === 'high'
        ? ['Say yes to new experiences', 'Travel or explore locally', 'Try something unfamiliar']
        : ['Plan future adventures', 'Research destinations', 'Dream and imagine'],
      timingAdvice: state.energyLevel === 'high' ? 'Seize spontaneous opportunities now' : 'Prepare for future adventures',
    },
  };

  return domainMap[domain] || domainMap.growth;
}

// ============================================
// MOOD CHECK-IN PROCESSING
// ============================================

export function processMoodCheckIn(checkIn: MoodCheckIn): MoodResponse {
  const moodMap: Record<string, { state: CosmicState; insight: CosmicInsight }> = {
    radiant: {
      state: { energyLevel: 'high', emotionalTone: 'Radiant', socialEnergy: 90, focusScore: 85, relationshipEnergy: 'Strong', financialFlow: 'Abundant', growthInsight: 'Expanding' },
      insight: { agent: 'mystic' as AgentType, category: 'opportunity' as const, title: 'Radiant Energy', interpretation: 'This light is meant to be shared', symbolic: 'Your radiance touches all you encounter', practical: 'Channel this energy into meaningful pursuits', confidence: 0.9 },
    },
    bright: {
      state: { energyLevel: 'high', emotionalTone: 'Bright', socialEnergy: 80, focusScore: 75, relationshipEnergy: 'Warm', financialFlow: 'Positive', growthInsight: 'Building' },
      insight: { agent: 'mystic' as AgentType, category: 'guidance' as const, title: 'Bright Outlook', interpretation: 'Optimism creates its own momentum', symbolic: 'Light reveals what darkness hides', practical: 'Act on positive impulses with wisdom', confidence: 0.85 },
    },
    balanced: {
      state: { energyLevel: 'medium', emotionalTone: 'Balanced', socialEnergy: 60, focusScore: 80, relationshipEnergy: 'Harmonious', financialFlow: 'Stable', growthInsight: 'Steady' },
      insight: { agent: 'healer' as AgentType, category: 'guidance' as const, title: 'Centered Balance', interpretation: 'Equilibrium is its own wisdom', symbolic: 'Balance is the foundation of all growth', practical: 'Maintain this equilibrium with gentle awareness', confidence: 0.9 },
    },
    clouded: {
      state: { energyLevel: 'medium', emotionalTone: 'Clouded', socialEnergy: 40, focusScore: 60, relationshipEnergy: 'Quiet', financialFlow: 'Cautious', growthInsight: 'Processing' },
      insight: { agent: 'healer' as AgentType, category: 'guidance' as const, title: 'Clouds Before Rain', interpretation: 'Even clouds carry gifts of nourishment', symbolic: 'The rain that follows will bring new growth', practical: 'Be gentle with yourself - clarity returns', confidence: 0.8 },
    },
    stormy: {
      state: { energyLevel: 'low', emotionalTone: 'Stormy', socialEnergy: 30, focusScore: 40, relationshipEnergy: 'Intense', financialFlow: 'Uncertain', growthInsight: 'Transforming' },
      insight: { agent: 'healer' as AgentType, category: 'warning' as const, title: 'Storm Passing', interpretation: 'The storm cleanses as it passes through', symbolic: 'After every storm comes the calm', practical: 'Breathe through intensity - this too shall pass', confidence: 0.85 },
    },
    peaceful: {
      state: { energyLevel: 'low', emotionalTone: 'Peaceful', socialEnergy: 50, focusScore: 90, relationshipEnergy: 'Content', financialFlow: 'Peaceful', growthInsight: 'Integrating' },
      insight: { agent: 'healer' as AgentType, category: 'guidance' as const, title: 'Inner Peace', interpretation: 'This peace is a treasure - savor it', symbolic: 'Peace is the destination of all journeys', practical: 'Share this calm energy gently with others', confidence: 0.9 },
    },
    restless: {
      state: { energyLevel: 'high', emotionalTone: 'Restless', socialEnergy: 70, focusScore: 30, relationshipEnergy: 'Seeking', financialFlow: 'Undecided', growthInsight: 'Searching' },
      insight: { agent: 'explorer' as AgentType, category: 'opportunity' as const, title: 'Restless Seeking', interpretation: 'This restlessness points toward something important', symbolic: 'The search itself is part of the finding', practical: 'Channel restlessness into curiosity rather than anxiety', confidence: 0.75 },
    },
    tired: {
      state: { energyLevel: 'low', emotionalTone: 'Tired', socialEnergy: 30, focusScore: 50, relationshipEnergy: 'Quiet', financialFlow: 'Stable', growthInsight: 'Resting' },
      insight: { agent: 'healer' as AgentType, category: 'guidance' as const, title: 'Honoring Fatigue', interpretation: 'Tiredness asks for listening, not pushing', symbolic: 'The deepest roots grow in darkness', practical: 'Prioritize rest above productivity today', confidence: 0.9 },
    },
  };

  const mapped = moodMap[checkIn.mood] || moodMap.balanced;

  // Adjust based on energy level
  const energyMultiplier = checkIn.energy / 3;
  const adjustedState = {
    ...mapped.state,
    energyLevel: checkIn.energy >= 4 ? 'high' as const : checkIn.energy >= 2 ? 'medium' as const : 'low' as const,
  };

  return {
    recorded: true,
    cosmicInterpretation: mapped.insight,
    affirmation: getAffirmation(adjustedState),
    action: mapped.insight.practical,
  };
}

// ============================================
// FULL CONTEXT GENERATION
// ============================================

export async function generateCosmicContext(userId: string): Promise<CosmicContext> {
  // Try to fetch from upstream services
  let cosmicInput: CosmicInput = {
    userId,
    mood: 'neutral',
    energy: 50,
    stress: 50,
  };

  // Fetch from emotional intelligence
  try {
    const response = await axios.post(
      `${SERVICE_URLS.emotional}/api/context`,
      { userId, includeCosmic: true },
      { timeout: 3000 }
    );
    if (response.data.context) {
      cosmicInput.mood = response.data.context.currentMood;
      cosmicInput.energy = response.data.context.currentEnergy;
      cosmicInput.stress = 100 - (response.data.context.currentEnergy || 50);
      cosmicInput.wellness = response.data.context.wellnessScore?.overall;
    }
  } catch {
    // Continue with defaults
  }

  // Generate cosmic state
  const cosmicState = interpretMoodToCosmicState(cosmicInput.mood || 'neutral', cosmicInput.energy || 50);

  // Generate council response
  const council = generateCouncilResponse(cosmicState, cosmicInput);

  // Generate daily reading
  const dailyReading = generateDailyReading(cosmicState, userId);

  // Generate suggested actions
  const suggestedActions = generateSuggestedActions(cosmicState, council);
  const avoidedActions = generateAvoidedActions(cosmicState);

  // Generate abstract insights
  const abstractInsights = council.insights.map(i => i.symbolic);

  return {
    userId,
    timestamp: new Date(),
    cosmicState,
    council,
    dailyReading,
    suggestedActions,
    avoidedActions,
    abstractInsights,
    dataSources: ['REZ Emotional Intelligence', 'REZ Life Pattern Engine', 'User Input'],
  };
}

function generateSuggestedActions(state: CosmicState, council: CouncilResponse): string[] {
  const actions: string[] = [];

  // Based on energy level
  if (state.energyLevel === 'high') {
    actions.push('Channel this energy into meaningful action');
    actions.push('Start that project you\'ve been contemplating');
    actions.push('Connect with someone who inspires you');
  } else if (state.energyLevel === 'low') {
    actions.push('Prioritize rest and restoration');
    actions.push('Choose gentle activities over ambitious pursuits');
    actions.push('Practice self-compassion');
  } else {
    actions.push('Maintain your current balance');
    actions.push('Build steadily on existing efforts');
    actions.push('Stay present with what is');
  }

  // From council insights
  const opportunity = council.insights.find(i => i.category === 'opportunity');
  if (opportunity) {
    actions.push(opportunity.practical);
  }

  return actions.slice(0, 5);
}

function generateAvoidedActions(state: CosmicState): string[] {
  const avoided: string[] = [];

  if (state.energyLevel === 'high') {
    avoided.push('Spreading yourself too thin');
    avoided.push('Making impulsive decisions');
  } else if (state.energyLevel === 'low') {
    avoided.push('Pushing through exhaustion');
    avoided.push('Major commitments when depleted');
    avoided.push('Harsh self-criticism');
  }

  // From warnings
  avoided.push('Ignoring signs of overwhelm');

  return [...new Set(avoided)].slice(0, 3);
}
