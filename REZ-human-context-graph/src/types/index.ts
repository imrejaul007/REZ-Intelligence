/**
 * REZ Human Context Graph - Type Definitions
 *
 * Unified context from all 15 life layers
 */

// ============================================
// LIFE LAYER DEFINITIONS
// ============================================

export type LifeLayer =
  | 'health'           // RisaCare - wellness, sleep, stress, recovery
  | 'commerce'         // REZ Consumer - lifestyle, spending, food habits
  | 'relationship'      // Rendez - emotional compatibility, social activity
  | 'karma'            // REZ Media - generosity, community, social contribution
  | 'career'           // CorpPerks, TalentAI - burnout, ambition, productivity
  | 'business'         // REZ Merchant, RABTUL - business health, expansion
  | 'mobility'        // ReZ Ride, Airzy - movement, routines, travel
  | 'spiritual'        // Cosmic OS - emotional state, aspirations
  | 'financial'        // RidZa - financial stress, risk, savings
  | 'realestate'       // RisnaEstate - family growth, relocation
  | 'hospitality'      // StayOwn - travel style, lifestyle
  | 'daily'            // Habixo - routines, habits, home behavior
  | 'hyperlocal'      // BuzzLocal - city activity, communities
  | 'events'           // Z-Events - interests, social energy
  | 'student';         // Insight Campus - education, ambition

export const ALL_LIFE_LAYERS: LifeLayer[] = [
  'health', 'commerce', 'relationship', 'karma', 'career', 'business',
  'mobility', 'spiritual', 'financial', 'realestate', 'hospitality',
  'daily', 'hyperlocal', 'events', 'student'
];

// ============================================
// UNIFIED CONTEXT TYPES
// ============================================

export interface LayerSignal {
  layer: LifeLayer;
  source: string; // service or app name
  signal: string;
  value: unknown;
  confidence: number; // 0-1
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface LayerContext {
  layer: LifeLayer;
  status: 'active' | 'inactive' | 'limited';
  lastUpdated: Date;
  signals: LayerSignal[];
  summary?: string;
  dataPoints: number;
}

// ============================================
// HEALTH LAYER
// ============================================

export interface HealthContext {
  layer: 'health';
  wellnessScore: number; // 0-100
  sleepQuality: number; // 0-100
  stressLevel: number; // 0-100
  recoveryStatus: 'recovering' | 'stable' | 'depleted';
  fitnessLevel: number; // 0-100
  healthGoals: string[];
  recentHealthEvents: string[];
}

// ============================================
// COMMERCE LAYER
// ============================================

export interface CommerceContext {
  layer: 'commerce';
  spendingLevel: number; // 0-100
  purchaseFrequency: number; // per week
  categoryAffinities: Record<string, number>;
  diningPreferences: string[];
  brandPreferences: string[];
  priceSensitivity: number; // 0-100
  impulseScore: number; // 0-100
}

// ============================================
// RELATIONSHIP LAYER
// ============================================

export interface RelationshipContext {
  layer: 'relationship';
  socialEnergy: number; // 0-100
  relationshipStatus: 'single' | 'dating' | 'committed' | 'married';
  socialFrequency: number; // social interactions per week
  communicationPattern: 'frequent' | 'moderate' | 'rare';
  emotionalSupport: number; // 0-100
}

// ============================================
// KARMA LAYER
// ============================================

export interface KarmaContext {
  layer: 'karma';
  karmaScore: number;
  generosityLevel: number; // 0-100
  communityEngagement: number; // 0-100
  socialContribution: number; // 0-100
  recentImpactActions: string[];
}

// ============================================
// CAREER LAYER
// ============================================

export interface CareerContext {
  layer: 'career';
  burnoutRisk: number; // 0-100
  ambitionLevel: number; // 0-100
  productivityScore: number; // 0-100
  workSatisfaction: number; // 0-100
  careerStage: 'early' | 'growth' | 'mid' | 'senior' | 'executive';
  workLifeBalance: number; // 0-100
}

// ============================================
// BUSINESS LAYER
// ============================================

export interface BusinessContext {
  layer: 'business';
  businessHealth: number; // 0-100
  expansionIntent: number; // 0-100
  cashflowStatus: 'healthy' | 'tight' | 'stressed';
  operationalEfficiency: number; // 0-100
  customerGrowth: number; // 0-100
}

// ============================================
// MOBILITY LAYER
// ============================================

export interface MobilityContext {
  layer: 'mobility';
  travelFrequency: number; // trips per week
  commutePattern: 'daily' | 'occasional' | 'remote';
  explorationLevel: number; // 0-100
  mobilityStress: number; // 0-100
  preferredTransport: string[];
  frequentDestinations: string[];
}

// ============================================
// SPIRITUAL LAYER (from Cosmic OS)
// ============================================

export interface SpiritualContext {
  layer: 'spiritual';
  emotionalState: string;
  stressLevel: number; // 0-100
  mindfulnessPractice: number; // 0-100
  meaningClarity: number; // 0-100
  innerPeace: number; // 0-100
  gratitudeLevel: number; // 0-100
}

// ============================================
// FINANCIAL LAYER
// ============================================

export interface FinancialContext {
  layer: 'financial';
  financialStress: number; // 0-100
  savingsRate: number; // 0-100
  riskAppetite: 'conservative' | 'moderate' | 'aggressive';
  investmentActivity: number; // 0-100
  spendingControl: number; // 0-100
}

// ============================================
// REAL ESTATE LAYER
// ============================================

export interface RealEstateContext {
  layer: 'realestate';
  housingStability: number; // 0-100
  relocationIntent: number; // 0-100
  familyGrowthStage: 'start' | 'growing' | 'established';
  propertyInterests: string[];
  wealthStage: 'accumulating' | 'preserving' | 'growing';
}

// ============================================
// HOSPITALITY LAYER
// ============================================

export interface HospitalityContext {
  layer: 'hospitality';
  travelStyle: 'budget' | 'mid' | 'premium' | 'luxury';
  travelFrequency: number; // trips per month
  accommodationPreferences: string[];
  explorationAppetite: number; // 0-100
}

// ============================================
// DAILY LIVING LAYER
// ============================================

export interface DailyLivingContext {
  layer: 'daily';
  routineConsistency: number; // 0-100
  homeBehavior: 'productive' | 'relaxed' | 'chaotic';
  sleepSchedule: 'consistent' | 'variable' | 'irregular';
  productivityCycles: number; // 0-100
}

// ============================================
// HYPERLOCAL LAYER
// ============================================

export interface HyperlocalContext {
  layer: 'hyperlocal';
  neighborhoodEngagement: number; // 0-100
  communityInvolvement: number; // 0-100
  localBusinessPatronage: number; // 0-100
  activeCommunities: string[];
}

// ============================================
// EVENTS LAYER
// ============================================

export interface EventsContext {
  layer: 'events';
  eventInterest: string[];
  socialEnergy: number; // 0-100
  networkingAppetite: number; // 0-100
  eventFrequency: number; // events per month
  entertainmentPreferences: string[];
}

// ============================================
// STUDENT LAYER
// ============================================

export interface StudentContext {
  layer: 'student';
  educationLevel: string;
  academicPerformance: number; // 0-100
  careerTrajectory: number; // 0-100
  skillGrowth: number; // 0-100
  networkingActivity: number; // 0-100
}

// ============================================
// UNIFIED HUMAN CONTEXT
// ============================================

export interface HumanContext {
  userId: string;
  timestamp: Date;
  universalId: string;

  // Optional cosmic state (populated after cosmic context generation)
  cosmicState?: {
    energyLevel: 'high' | 'medium' | 'low';
    emotionalTone: string;
    socialEnergy: number;
    focusScore: number;
    growthMomentum: 'accelerating' | 'steady' | 'challenging';
  };

  // All layer contexts
  health?: HealthContext;
  commerce?: CommerceContext;
  relationship?: RelationshipContext;
  karma?: KarmaContext;
  career?: CareerContext;
  business?: BusinessContext;
  mobility?: MobilityContext;
  spiritual?: SpiritualContext;
  financial?: FinancialContext;
  realestate?: RealEstateContext;
  hospitality?: HospitalityContext;
  daily?: DailyLivingContext;
  hyperlocal?: HyperlocalContext;
  events?: EventsContext;
  student?: StudentContext;

  // Cross-layer insights
  crossLayerInsights: CrossLayerInsight[];

  // Life stage assessment
  lifeStage: LifeStageAssessment;

  // Risk factors
  riskFactors: RiskFactor[];

  // Opportunities
  opportunities: Opportunity[];

  // Data completeness
  dataCompleteness: Record<LifeLayer, number>; // 0-100 for each layer
}

export interface CrossLayerInsight {
  type: 'correlation' | 'causation' | 'pattern';
  description: string;
  layers: LifeLayer[];
  confidence: number;
  action?: string;
}

export interface LifeStageAssessment {
  current: string;
  confidence: number;
  indicators: string[];
  transitionSignals?: {
    to: string;
    confidence: number;
    timeline: string;
  };
}

export interface RiskFactor {
  category: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  layers: LifeLayer[];
  recommendation?: string;
}

export interface Opportunity {
  category: string;
  description: string;
  layers: LifeLayer[];
  potential: number; // 0-100
  recommendation?: string;
}

// ============================================
// COSMIC CONTEXT (for Cosmic OS)
// ============================================

export interface CosmicContext {
  userId: string;
  timestamp: Date;

  // Cosmic interpretation of layers
  cosmicState: {
    energyLevel: 'high' | 'medium' | 'low';
    emotionalTone: string;
    socialEnergy: number;
    focusScore: number;
    growthMomentum: 'accelerating' | 'steady' | 'challenging';
  };

  // Symbolic interpretations
  interpretations: {
    healthSymbol: string;
    careerSymbol: string;
    relationshipSymbol: string;
    financialSymbol: string;
    spiritualSymbol: string;
  };

  // Guidance
  suggestedActions: string[];
  timingAdvice: string;
  avoidedActions: string[];

  // Privacy-safe insights
  abstractInsights: string[];
}

// ============================================
// API TYPES
// ============================================

export interface GetContextRequest {
  userId: string;
  layers?: LifeLayer[];
  includeCosmic?: boolean;
}

export interface UpdateLayerSignalRequest {
  userId: string;
  layer: LifeLayer;
  signal: string;
  value: unknown;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface CrossLayerAnalysisRequest {
  userId: string;
  layerA: LifeLayer;
  layerB: LifeLayer;
}
