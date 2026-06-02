/**
 * REZ Conversation Intelligence - Call Coaching Service
 *
 * Analyzes sales calls and provides coaching insights
 */

import logger from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface CallMetrics {
  duration: number; // seconds
  speakerTime: {
    agent: number;
    prospect: number;
    ratio: number;
  };
  talkSpeed: {
    agent: number; // words per minute
    prospect: number;
  };
  interruptions: number;
  questions: number;
  objections: number;
  discoveries: number;
  avgSentenceLength: number;
  fillerWords: number;
}

export interface CoachingInsight {
  type: 'strength' | 'improvement' | 'alert';
  category: 'talk_time' | 'questioning' | 'listening' | 'persuasion' | 'handling' | 'pace';
  title: string;
  description: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  score: number; // 0-100
}

export interface CoachingReport {
  callId: string;
  overallScore: number;
  metrics: CallMetrics;
  insights: CoachingInsight[];
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  comparedTo: {
    industryAvg: number;
    topPerformer: number;
  };
}

// ============================================================================
// Coaching Thresholds & Patterns
// ============================================================================

const FILLER_WORDS = [
  'um', 'uh', 'like', 'you know', 'basically', 'literally',
  'actually', 'honestly', 'so', 'well', 'right'
];

const OBJECTION_PATTERNS = [
  'not interested', 'too expensive', 'don\'t have time',
  'need to think', 'not now', 'already have', 'budget',
  'not a priority', 'call my manager', 'send me an email'
];

const DISCOVERY_PATTERNS = [
  'tell me about', 'help me understand', 'can you explain',
  'what challenges', 'how do you', 'what\'s your',
  'who is responsible', 'what does', 'when do you'
];

// ============================================================================
// Call Coaching Service
// ============================================================================

export class CallCoachingService {
  /**
   * Analyze a sales call transcript
   */
  static analyzeCall(
    callId: string,
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string; timestamp?: number }>
  ): CoachingReport {
    logger.info('Analyzing call for coaching', { callId, messages: transcript.length });

    // Calculate metrics
    const metrics = this.calculateMetrics(transcript);

    // Generate insights
    const insights = this.generateInsights(metrics, transcript);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(metrics, insights);

    // Get strengths and improvements
    const strengths = insights
      .filter(i => i.type === 'strength')
      .map(i => i.title);

    const improvements = insights
      .filter(i => i.type === 'improvement')
      .map(i => i.title);

    // Generate next steps
    const nextSteps = this.generateNextSteps(insights);

    return {
      callId,
      overallScore,
      metrics,
      insights,
      strengths,
      improvements,
      nextSteps,
      comparedTo: {
        industryAvg: 65,
        topPerformer: 85,
      },
    };
  }

  /**
   * Calculate call metrics from transcript
   */
  private static calculateMetrics(
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string }>
  ): CallMetrics {
    const agentMessages = transcript.filter(m => m.speaker === 'agent');
    const prospectMessages = transcript.filter(m => m.speaker === 'prospect');

    // Calculate speaking time (estimated based on word count)
    const agentWords = agentMessages.reduce((sum, m) => sum + this.countWords(m.text), 0);
    const prospectWords = prospectMessages.reduce((sum, m) => sum + this.countWords(m.text), 0);
    const totalWords = agentWords + prospectWords;

    const speakerTime = {
      agent: agentWords,
      prospect: prospectWords,
      ratio: totalWords > 0 ? (agentWords / totalWords) * 100 : 50,
    };

    // Calculate talk speed (words per minute, assuming 1 word = 0.3 seconds)
    const duration = totalWords * 0.3; // seconds
    const durationMinutes = duration / 60;
    const talkSpeed = {
      agent: durationMinutes > 0 ? Math.round(agentWords / durationMinutes) : 0,
      prospect: durationMinutes > 0 ? Math.round(prospectWords / durationMinutes) : 0,
    };

    // Count interruptions (short messages from opposite speaker)
    const interruptions = this.countInterruptions(transcript);

    // Count questions
    const questions = this.countQuestions(transcript);

    // Count objections
    const objections = this.countObjections(transcript);

    // Count discoveries
    const discoveries = this.countDiscoveries(transcript);

    // Average sentence length
    const avgSentenceLength = this.calculateAvgSentenceLength(transcript);

    // Count filler words
    const fillerWords = this.countFillerWords(transcript);

    return {
      duration: Math.round(duration),
      speakerTime,
      talkSpeed,
      interruptions,
      questions,
      objections,
      discoveries,
      avgSentenceLength,
      fillerWords,
    };
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Count interruptions
   */
  private static countInterruptions(
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string }>
  ): number {
    let count = 0;
    for (let i = 1; i < transcript.length; i++) {
      const prev = transcript[i - 1];
      const curr = transcript[i];

      // If next message is very short and from different speaker
      if (prev.speaker !== curr.speaker && this.countWords(curr.text) < 10) {
        count++;
      }
    }
    return count;
  }

  /**
   * Count questions
   */
  private static countQuestions(
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string }>
  ): number {
    return transcript.reduce((count, m) => {
      const questionCount = (m.text.match(/\?/g) || []).length;
      return count + questionCount;
    }, 0);
  }

  /**
   * Count objections
   */
  private static countObjections(
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string }>
  ): number {
    const lowerText = transcript.map(m => m.text.toLowerCase()).join(' ');
    let count = 0;

    for (const pattern of OBJECTION_PATTERNS) {
      if (lowerText.includes(pattern)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Count discovery questions
   */
  private static countDiscoveries(
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string }>
  ): number {
    const agentText = transcript
      .filter(m => m.speaker === 'agent')
      .map(m => m.text.toLowerCase())
      .join(' ');

    let count = 0;
    for (const pattern of DISCOVERY_PATTERNS) {
      const matches = agentText.match(new RegExp(pattern, 'gi'));
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Calculate average sentence length
   */
  private static calculateAvgSentenceLength(
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string }>
  ): number {
    const agentText = transcript
      .filter(m => m.speaker === 'agent')
      .map(m => m.text)
      .join(' ');

    const sentences = agentText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    const totalWords = sentences.reduce((sum, s) => sum + this.countWords(s), 0);
    return Math.round(totalWords / sentences.length);
  }

  /**
   * Count filler words
   */
  private static countFillerWords(
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string }>
  ): number {
    const agentText = transcript
      .filter(m => m.speaker === 'agent')
      .map(m => m.text.toLowerCase())
      .join(' ');

    let count = 0;
    for (const filler of FILLER_WORDS) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = agentText.match(regex);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Generate coaching insights
   */
  private static generateInsights(
    metrics: CallMetrics,
    transcript: Array<{ speaker: 'agent' | 'prospect'; text: string }>
  ): CoachingInsight[] {
    const insights: CoachingInsight[] = [];

    // Talk time ratio
    if (metrics.speakerTime.ratio > 70) {
      insights.push({
        type: 'improvement',
        category: 'talk_time',
        title: 'Dominating the Conversation',
        description: `You spoke ${Math.round(metrics.speakerTime.ratio)}% of the time.`,
        recommendation: 'Try the 50/30/20 rule: 50% listening, 30% questioning, 20% responding.',
        priority: 'high',
        score: 30,
      });
    } else if (metrics.speakerTime.ratio < 40) {
      insights.push({
        type: 'strength',
        category: 'talk_time',
        title: 'Excellent Listening',
        description: `You spoke ${Math.round(metrics.speakerTime.ratio)}% of the time, showing good listening habits.`,
        recommendation: 'Great job! Continue letting the prospect share their thoughts.',
        priority: 'low',
        score: 85,
      });
    }

    // Questions
    if (metrics.questions < 5) {
      insights.push({
        type: 'improvement',
        category: 'questioning',
        title: 'Ask More Questions',
        description: `You asked ${metrics.questions} questions. Top performers ask 10-15 questions per call.`,
        recommendation: 'Use the SPIN method: Situation, Problem, Implication, Need-payoff.',
        priority: 'medium',
        score: 50,
      });
    } else {
      insights.push({
        type: 'strength',
        category: 'questioning',
        title: 'Good Discovery',
        description: `You asked ${metrics.questions} questions, showing active engagement.`,
        recommendation: 'Consider adding more follow-up questions to dig deeper.',
        priority: 'low',
        score: 80,
      });
    }

    // Objections handling
    if (metrics.objections > 0) {
      insights.push({
        type: 'alert',
        category: 'handling',
        title: 'Objections Detected',
        description: `${metrics.objections} objection(s) were raised during the call.`,
        recommendation: 'Always acknowledge, clarify, and address objections with empathy.',
        priority: 'high',
        score: 40,
      });
    }

    // Talk speed
    if (metrics.talkSpeed.agent > 150) {
      insights.push({
        type: 'improvement',
        category: 'pace',
        title: 'Speaking Too Fast',
        description: `You spoke at ${metrics.talkSpeed.agent} words per minute.`,
        recommendation: 'Slow down to 120-140 WPM for better comprehension.',
        priority: 'medium',
        score: 55,
      });
    } else if (metrics.talkSpeed.agent < 100) {
      insights.push({
        type: 'improvement',
        category: 'pace',
        title: 'Consider Speaking Faster',
        description: `You spoke at ${metrics.talkSpeed.agent} words per minute.`,
        recommendation: 'Speed up slightly to maintain engagement and energy.',
        priority: 'low',
        score: 60,
      });
    } else {
      insights.push({
        type: 'strength',
        category: 'pace',
        title: 'Good Pace',
        description: `You maintained a good speaking pace of ${metrics.talkSpeed.agent} WPM.`,
        recommendation: 'Continue at this pace for optimal engagement.',
        priority: 'low',
        score: 90,
      });
    }

    // Filler words
    if (metrics.fillerWords > 10) {
      insights.push({
        type: 'improvement',
        category: 'persuasion',
        title: 'Reduce Filler Words',
        description: `You used ${metrics.fillerWords} filler words or phrases.`,
        recommendation: 'Practice pausing instead of using filler words.',
        priority: 'medium',
        score: 50,
      });
    }

    // Discovery questions
    if (metrics.discoveries < 3) {
      insights.push({
        type: 'improvement',
        category: 'questioning',
        title: 'Needs More Discovery',
        description: `Only ${metrics.discoveries} discovery questions detected.`,
        recommendation: 'Ask more "what challenges" and "tell me about" questions.',
        priority: 'high',
        score: 40,
      });
    }

    // Positive sentiment detection
    const agentText = transcript
      .filter(m => m.speaker === 'agent')
      .map(m => m.text.join(' '))
      .join(' ');

    if (agentText.includes('great') || agentText.includes('excellent') || agentText.includes('perfect')) {
      insights.push({
        type: 'strength',
        category: 'persuasion',
        title: 'Positive Language',
        description: 'You used positive language to build rapport.',
        recommendation: 'Continue using positive reinforcement.',
        priority: 'low',
        score: 85,
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return insights;
  }

  /**
   * Calculate overall score
   */
  private static calculateOverallScore(
    metrics: CallMetrics,
    insights: CoachingInsight[]
  ): number {
    let score = 70; // Base score

    // Adjust for talk time
    if (metrics.speakerTime.ratio >= 40 && metrics.speakerTime.ratio <= 60) {
      score += 10;
    } else if (metrics.speakerTime.ratio < 30 || metrics.speakerTime.ratio > 75) {
      score -= 15;
    }

    // Adjust for questions
    if (metrics.questions >= 8) score += 10;
    else if (metrics.questions < 4) score -= 10;

    // Adjust for discoveries
    if (metrics.discoveries >= 5) score += 10;
    else if (metrics.discoveries < 2) score -= 10;

    // Adjust for filler words
    if (metrics.fillerWords <= 5) score += 5;
    else if (metrics.fillerWords > 15) score -= 10;

    // Adjust for talk speed
    if (metrics.talkSpeed.agent >= 110 && metrics.talkSpeed.agent <= 145) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate next steps from insights
   */
  private static generateNextSteps(insights: CoachingInsight[]): string[] {
    const steps: string[] = [];

    const highPriority = insights.filter(i => i.priority === 'high');
    const improvements = insights.filter(i => i.type === 'improvement');

    if (highPriority.length > 0) {
      steps.push(`Focus on: ${highPriority[0].recommendation}`);
    }

    if (improvements.length > 1) {
      steps.push('Practice the 50/30/20 rule in your next call.');
    }

    if (insights.some(i => i.category === 'questioning' && i.type === 'improvement')) {
      steps.push('Review SPIN selling methodology before your next call.');
    }

    if (steps.length === 0) {
      steps.push('Keep up the great work! Maintain your current approach.');
    }

    return steps;
  }

  /**
   * Compare two calls
   */
  static compareCalls(
    baseline: CoachingReport,
    current: CoachingReport
  ): {
    overallChange: number;
    metricChanges: Record<string, { before: number; after: number; change: number }>;
    improvements: string[];
    regressions: string[];
  } {
    const overallChange = current.overallScore - baseline.overallScore;

    const metricChanges: Record<string, { before: number; after: number; change: number }> = {};

    // Talk time
    metricChanges.speakerTimeRatio = {
      before: baseline.metrics.speakerTime.ratio,
      after: current.metrics.speakerTime.ratio,
      change: current.metrics.speakerTime.ratio - baseline.metrics.speakerTime.ratio,
    };

    // Questions
    metricChanges.questions = {
      before: baseline.metrics.questions,
      after: current.metrics.questions,
      change: current.metrics.questions - baseline.metrics.questions,
    };

    // Filler words
    metricChanges.fillerWords = {
      before: baseline.metrics.fillerWords,
      after: current.metrics.fillerWords,
      change: current.metrics.fillerWords - baseline.metrics.fillerWords,
    };

    const improvements: string[] = [];
    const regressions: string[] = [];

    if (metricChanges.questions.change > 0) {
      improvements.push(`+${metricChanges.questions.change} more questions asked`);
    } else if (metricChanges.questions.change < 0) {
      regressions.push(`${metricChanges.questions.change} fewer questions asked`);
    }

    if (metricChanges.fillerWords.change < 0) {
      improvements.push(`${Math.abs(metricChanges.fillerWords.change)} fewer filler words`);
    } else if (metricChanges.fillerWords.change > 0) {
      regressions.push(`${metricChanges.fillerWords.change} more filler words`);
    }

    if (overallChange > 5) {
      improvements.push(`Overall score improved by ${overallChange} points`);
    } else if (overallChange < -5) {
      regressions.push(`Overall score decreased by ${Math.abs(overallChange)} points`);
    }

    return {
      overallChange,
      metricChanges,
      improvements,
      regressions,
    };
  }
}

export default CallCoachingService;
