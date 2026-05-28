/**
 * CorpPerks - Cosmic OS Integration
 *
 * Emits career signals to Cosmic OS Human Context Graph
 */

import axios from 'axios';

// ============================================
// COSMIC OS CONFIGURATION
// ============================================

const COSMIC_OS_URL = process.env.COSMIC_OS_URL || 'http://localhost:4163';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'corpperks-internal-token';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
});

// ============================================
// CAREER SIGNAL TYPES
// ============================================

export interface CareerSignal {
  userId: string;
  layer: 'career';
  signal: string;
  value: number | string | Record<string, unknown>;
  source: string;
  confidence: number;
}

// ============================================
// SIGNAL EMISSION
// ============================================

export async function emitCareerSignal(signal: CareerSignal): Promise<boolean> {
  try {
    await axios.post(
      `${COSMIC_OS_URL}/api/signals`,
      signal,
      { headers: getHeaders(), timeout: 5000 }
    );
    return true;
  } catch (error) {
    console.error('Failed to emit career signal to Cosmic OS:', error);
    return false;
  }
}

// ============================================
// INTEGRATION HOOKS
// ============================================

/**
 * Call this after productivity session
 */
export async function onProductivitySession(
  userId: string,
  sessionData: {
    duration: number;
    tasks: number;
    completed: number;
    focus: number;
  }
): Promise<void> {
  await emitCareerSignal({
    userId,
    layer: 'career',
    signal: 'productivity_session',
    value: sessionData,
    source: 'corpperks',
    confidence: 0.85,
  });
}

/**
 * Call this after learning activity
 */
export async function onLearningActivity(
  userId: string,
  learningData: {
    course: string;
    duration: number;
    progress: number;
    type: 'course' | 'certification' | 'skill';
  }
): Promise<void> {
  await emitCareerSignal({
    userId,
    layer: 'career',
    signal: 'learning_activity',
    value: learningData,
    source: 'corpperks',
    confidence: 0.9,
  });
}

/**
 * Call this after work milestone
 */
export async function onWorkMilestone(
  userId: string,
  milestone: {
    type: 'project_complete' | 'promotion' | 'review' | 'achievement';
    title: string;
    impact: number;
  }
): Promise<void> {
  await emitCareerSignal({
    userId,
    layer: 'career',
    signal: 'career_milestone',
    value: milestone,
    source: 'corpperks',
    confidence: 0.95,
  });
}

/**
 * Call this after wellness check
 */
export async function onWorkWellnessCheck(
  userId: string,
  wellnessData: {
    burnoutRisk: number;
    stressLevel: number;
    satisfaction: number;
    workLifeBalance: number;
  }
): Promise<void> {
  await emitCareerSignal({
    userId,
    layer: 'career',
    signal: 'work_wellness',
    value: wellnessData,
    source: 'corpperks',
    confidence: 0.85,
  });
}

/**
 * Call this after networking activity
 */
export async function onNetworkingActivity(
  userId: string,
  activity: {
    type: 'meeting' | 'event' | 'referral' | 'collab';
    participants: number;
    value: 'low' | 'medium' | 'high';
  }
): Promise<void> {
  await emitCareerSignal({
    userId,
    layer: 'career',
    signal: 'networking',
    value: activity,
    source: 'corpperks',
    confidence: 0.8,
  });
}

/**
 * Call this after goal update
 */
export async function onCareerGoalUpdate(
  userId: string,
  goalData: {
    goal: string;
    progress: number;
    deadline: string;
    status: 'on_track' | 'at_risk' | 'completed';
  }
): Promise<void> {
  await emitCareerSignal({
    userId,
    layer: 'career',
    signal: 'career_goal',
    value: goalData,
    source: 'corpperks',
    confidence: 0.9,
  });
}

/**
 * Call this after feedback received
 */
export async function onFeedbackReceived(
  userId: string,
  feedback: {
    type: 'peer' | 'manager' | 'performance';
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number;
  }
): Promise<void> {
  await emitCareerSignal({
    userId,
    layer: 'career',
    signal: 'career_feedback',
    value: feedback,
    source: 'corpperks',
    confidence: 0.85,
  });
}
