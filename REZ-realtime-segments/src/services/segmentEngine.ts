import type {
  SegmentRule,
  SegmentDefinition,
  UserData,
  SegmentEvaluationResult,
  SegmentOperator
} from '../types/index.js';

// Default segment definitions
export const DEFAULT_SEGMENTS: SegmentDefinition[] = [
  {
    segmentId: 'high_spender',
    name: 'High Spenders',
    description: 'Users with high lifetime spend and average order value',
    rules: [
      { field: 'lifetime.totalSpend', operator: 'gte', value: 10000 },
      { field: 'lifetime.avgOrderValue', operator: 'gte', value: 1000 }
    ],
    refreshInterval: 60
  },
  {
    segmentId: 'at_risk',
    name: 'At Risk',
    description: 'Users with high competitor switch risk and low recent activity',
    rules: [
      { field: 'signals.competitor.switchRisk', operator: 'eq', value: 'HIGH' },
      { field: 'activity.last30Days.orders', operator: 'lte', value: 1 }
    ],
    refreshInterval: 30
  },
  {
    segmentId: 'loyal_customer',
    name: 'Loyal Customers',
    description: 'Users with many orders and high loyalty scores',
    rules: [
      { field: 'lifetime.totalOrders', operator: 'gte', value: 10 },
      { field: 'signals.competitor.loyaltyScore', operator: 'gte', value: 80 }
    ],
    refreshInterval: 60
  },
  {
    segmentId: 'power_user',
    name: 'Power Users',
    description: 'Users with long tenure and high engagement',
    rules: [
      { field: 'lifetime.tenureDays', operator: 'gte', value: 180 },
      { field: 'activity.engagement.engagementIndex', operator: 'gte', value: 80 }
    ],
    refreshInterval: 60
  },
  {
    segmentId: 'discount_sensitive',
    name: 'Discount Sensitive',
    description: 'Users who are highly sensitive to cashback and deals',
    rules: [
      { field: 'signals.behavioral.cashbackSensitivity', operator: 'gte', value: 70 },
      { field: 'signals.behavioral.dealSeeking', operator: 'gte', value: 70 }
    ],
    refreshInterval: 120
  },
  {
    segmentId: 'luxury_buyer',
    name: 'Luxury Buyers',
    description: 'Users with luxury affinity and high average order value',
    rules: [
      { field: 'signals.behavioral.luxuryAffinity', operator: 'gte', value: 70 },
      { field: 'lifetime.avgOrderValue', operator: 'gte', value: 2000 }
    ],
    refreshInterval: 120
  },
  {
    segmentId: 'influencer',
    name: 'Influencers',
    description: 'Users with social influence across tiers',
    rules: [
      { field: 'signals.social.influenceTier', operator: 'in', value: ['micro', 'mid', 'macro'] }
    ],
    refreshInterval: 60
  },
  {
    segmentId: 'new_customer',
    name: 'New Customers',
    description: 'Users with tenure of 30 days or less',
    rules: [
      { field: 'lifetime.tenureDays', operator: 'lte', value: 30 }
    ],
    refreshInterval: 30
  },
  {
    segmentId: 'dormant',
    name: 'Dormant',
    description: 'Users who were active but have had no orders in 30 days',
    rules: [
      { field: 'activity.last30Days.orders', operator: 'eq', value: 0 },
      { field: 'lifetime.totalOrders', operator: 'gt', value: 0 }
    ],
    refreshInterval: 15
  },
  {
    segmentId: 'frequent_visitor',
    name: 'Frequent Visitors',
    description: 'Users who visit frequently and are food enthusiasts',
    rules: [
      { field: 'activity.last30Days.visits', operator: 'gte', value: 8 },
      { field: 'signals.location.segments', operator: 'contains', value: 'food_enthusiast' }
    ],
    refreshInterval: 60
  }
];

// Operator evaluation functions
const operators: Record<SegmentOperator, (fieldValue: unknown, ruleValue: unknown) => boolean> = {
  eq: (fieldValue, ruleValue) => fieldValue === ruleValue,
  ne: (fieldValue, ruleValue) => fieldValue !== ruleValue,
  gt: (fieldValue, ruleValue) => Number(fieldValue) > Number(ruleValue),
  lt: (fieldValue, ruleValue) => Number(fieldValue) < Number(ruleValue),
  gte: (fieldValue, ruleValue) => Number(fieldValue) >= Number(ruleValue),
  lte: (fieldValue, ruleValue) => Number(fieldValue) <= Number(ruleValue),
  in: (fieldValue, ruleValue) => {
    if (Array.isArray(ruleValue)) {
      return ruleValue.includes(fieldValue);
    }
    return false;
  },
  contains: (fieldValue, ruleValue) => {
    if (typeof fieldValue === 'string') {
      return fieldValue.includes(String(ruleValue));
    }
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(ruleValue);
    }
    return false;
  }
};

// Get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

// Evaluate a single rule against user data
export function evaluateRule(rule: SegmentRule, userData: UserData): boolean {
  const fieldValue = getNestedValue(userData as unknown as Record<string, unknown>, rule.field);
  const ruleValue = rule.value;

  // Handle undefined/null field values
  if (fieldValue === undefined || fieldValue === null) {
    return false;
  }

  const operatorFn = operators[rule.operator];
  if (!operatorFn) {
    console.warn(`Unknown operator: ${rule.operator}`);
    return false;
  }

  return operatorFn(fieldValue, ruleValue);
}

// Evaluate all rules for a segment
export function evaluateRules(
  rules: SegmentRule[],
  userData: UserData
): { matches: boolean; matchedRules: string[]; failedRules: string[] } {
  const matchedRules: string[] = [];
  const failedRules: string[] = [];

  // Group rules by logic type
  let currentLogic: 'AND' | 'OR' = 'AND';
  let overallMatch = true;
  let orMatchFound = false;

  for (const rule of rules) {
    const result = evaluateRule(rule, userData);
    const ruleStr = `${rule.field} ${rule.operator} ${JSON.stringify(rule.value)}`;

    if (result) {
      matchedRules.push(ruleStr);
      if (currentLogic === 'OR') {
        orMatchFound = true;
      }
    } else {
      failedRules.push(ruleStr);
      if (currentLogic === 'AND') {
        overallMatch = false;
      }
    }

    // Update logic for next rule
    if (rule.logic) {
      currentLogic = rule.logic;
    }
  }

  // Determine final match
  const matches = currentLogic === 'AND' ? overallMatch : orMatchFound;

  return { matches, matchedRules, failedRules };
}

// Evaluate a user against a segment definition
export function evaluateSegment(
  segment: SegmentDefinition,
  userData: UserData
): SegmentEvaluationResult {
  const startTime = performance.now();

  const { matches, matchedRules, failedRules } = evaluateRules(segment.rules, userData);

  const evaluationTimeMs = Math.round(performance.now() - startTime);

  return {
    segmentId: segment.segmentId,
    segmentName: segment.name,
    userId: userData.userId,
    matches,
    evaluatedAt: new Date().toISOString(),
    evaluationTimeMs,
    matchedRules,
    failedRules
  };
}

// Evaluate a user against all segments
export function evaluateAllSegments(
  segments: SegmentDefinition[],
  userData: UserData
): SegmentEvaluationResult[] {
  return segments.map(segment => evaluateSegment(segment, userData));
}

// Get segments where user qualifies
export function getQualifyingSegments(
  results: SegmentEvaluationResult[]
): SegmentEvaluationResult[] {
  return results.filter(r => r.matches);
}

// Get segments where user no longer qualifies
export function getExitingSegments(
  currentSegments: string[],
  newResults: SegmentEvaluationResult[]
): SegmentEvaluationResult[] {
  const currentSet = new Set(currentSegments);
  return newResults.filter(r => !r.matches && currentSet.has(r.segmentId));
}

// Get segments user newly qualifies for
export function getEnteringSegments(
  currentSegments: string[],
  newResults: SegmentEvaluationResult[]
): SegmentEvaluationResult[] {
  const currentSet = new Set(currentSegments);
  return newResults.filter(r => r.matches && !currentSet.has(r.segmentId));
}

// Find segment by ID
export function findSegmentById(
  segmentId: string,
  segments: SegmentDefinition[] = DEFAULT_SEGMENTS
): SegmentDefinition | undefined {
  return segments.find(s => s.segmentId === segmentId);
}

// Get all segment IDs
export function getAllSegmentIds(segments: SegmentDefinition[] = DEFAULT_SEGMENTS): string[] {
  return segments.map(s => s.segmentId);
}

// Validate segment definition
export function validateSegment(segment: Partial<SegmentDefinition>): string[] {
  const errors: string[] = [];

  if (!segment.segmentId || segment.segmentId.trim() === '') {
    errors.push('segmentId is required');
  }

  if (!segment.name || segment.name.trim() === '') {
    errors.push('name is required');
  }

  if (!segment.rules || segment.rules.length === 0) {
    errors.push('At least one rule is required');
  }

  if (segment.rules) {
    segment.rules.forEach((rule, index) => {
      if (!rule.field || rule.field.trim() === '') {
        errors.push(`Rule ${index}: field is required`);
      }
      if (!rule.operator) {
        errors.push(`Rule ${index}: operator is required`);
      } else if (!['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains'].includes(rule.operator)) {
        errors.push(`Rule ${index}: invalid operator "${rule.operator}"`);
      }
      if (rule.value === undefined) {
        errors.push(`Rule ${index}: value is required`);
      }
    });
  }

  return errors;
}

// Create mock user data for testing
export function createMockUserData(overrides: Partial<UserData> = {}): UserData {
  return {
    userId: 'test-user-001',
    lifetime: {
      totalSpend: 15000,
      totalOrders: 15,
      avgOrderValue: 1000,
      tenureDays: 365
    },
    activity: {
      last30Days: {
        orders: 3,
        visits: 12
      },
      engagement: {
        engagementIndex: 85
      }
    },
    signals: {
      competitor: {
        switchRisk: 'LOW',
        loyaltyScore: 85
      },
      behavioral: {
        cashbackSensitivity: 60,
        dealSeeking: 55,
        luxuryAffinity: 75
      },
      social: {
        influenceTier: 'micro'
      },
      location: {
        segments: ['food_enthusiast', 'urban_dweller']
      }
    },
    ...overrides
  };
}

export default {
  DEFAULT_SEGMENTS,
  evaluateRule,
  evaluateRules,
  evaluateSegment,
  evaluateAllSegments,
  getQualifyingSegments,
  getExitingSegments,
  getEnteringSegments,
  findSegmentById,
  getAllSegmentIds,
  validateSegment,
  createMockUserData
};
