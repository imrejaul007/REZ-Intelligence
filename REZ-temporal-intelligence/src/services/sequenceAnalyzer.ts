import { v4 as uuidv4 } from 'uuid';
import type {
  ActionType,
  BehaviorEvent,
  MarkovChainModel,
  SequencePattern,
  SequenceAnalysisResult,
  MarkovTrainingData
} from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * SequenceAnalyzer - Analyzes user behavior sequences using Markov chains
 * 
 * Implements:
 * - First and higher-order Markov chain models
 * - Transition probability calculation
 * - Sequence pattern detection
 * - Funnel analysis
 */
export class SequenceAnalyzer {
  private order: number;
  private minFrequency: number;
  private maxSequenceLength: number;

  constructor(options?: {
    order?: number;
    minFrequency?: number;
    maxSequenceLength?: number;
  }) {
    this.order = options?.order || 1;
    this.minFrequency = options?.minFrequency || 2;
    this.maxSequenceLength = options?.maxSequenceLength || 10;
  }

  /**
   * Build a Markov chain model from training data
   */
  public buildMarkovModel(data: MarkovTrainingData): MarkovChainModel {
    const startTime = Date.now();
    const { userId, sequences } = data;

    // Collect all unique states
    const states = new Set<ActionType>();
    sequences.forEach(seq => seq.forEach(action => states.add(action)));

    // Initialize matrices
    const transitionMatrix: Record<ActionType, Record<ActionType, number>> = {} as Record<ActionType, Record<ActionType, number>>;
    const initialProbabilities: Record<ActionType, number> = {} as Record<ActionType, number>;
    
    // Initialize all state combinations
    states.forEach(from => {
      transitionMatrix[from] = {} as Record<ActionType, number>;
      states.forEach(to => {
        transitionMatrix[from][to] = 0;
      });
    });

    // Count transitions
    const transitionCounts: Record<string, number> = {};
    const initialCounts: Record<ActionType, number> = {} as Record<ActionType, number>;

    sequences.forEach((sequence, seqIndex) => {
      const weight = data.weights?.[seqIndex] || 1;

      // Count initial states
      if (sequence.length > 0) {
        const initialState = sequence[0];
        initialCounts[initialState] = (initialCounts[initialState] || 0) + weight;
      }

      // Count transitions based on order
      for (let i = 0; i < sequence.length - this.order; i++) {
        const key = sequence.slice(i, i + this.order + 1).join('->');
        transitionCounts[key] = (transitionCounts[key] || 0) + weight;
      }
    });

    // Calculate probabilities
    const totalInitial = Object.values(initialCounts).reduce((a, b) => a + b, 0);
    const statesArray = Array.from(states);
    statesArray.forEach(state => {
      (initialProbabilities as Record<string, number>)[state] = totalInitial > 0 ? (initialCounts[state] || 0) / totalInitial : 0;
    });

    // Calculate transition probabilities
    for (let i = 0; i < sequences.length; i++) {
      const sequence = sequences[i];
      const weight = data.weights?.[i] || 1;

      for (let j = 0; j < sequence.length - this.order; j++) {
        const fromState = sequence[j] as ActionType;
        const toState = sequence[j + this.order] as ActionType;
        
        if (fromState && toState) {
          transitionMatrix[fromState][toState] += weight;
        }
      }
    }

    // Normalize rows
    states.forEach(from => {
      const rowSum = Object.values(transitionMatrix[from]).reduce((a, b) => a + b, 0);
      if (rowSum > 0) {
        states.forEach(to => {
          transitionMatrix[from][to] = transitionMatrix[from][to] / rowSum;
        });
      }
    });

    // Calculate entropy (measure of predictability)
    const entropy = this.calculateEntropy(transitionMatrix, states);

    const totalEvents = sequences.reduce((sum, seq) => sum + seq.length, 0);

    logger.info('Markov model built', {
      userId,
      states: states.size,
      totalEvents,
      order: this.order,
      durationMs: Date.now() - startTime
    });

    return {
      userId,
      states: Array.from(states),
      transitionMatrix,
      initialProbabilities,
      order: this.order,
      trainedAt: new Date(),
      eventCount: totalEvents,
      entropy
    };
  }

  /**
   * Predict next action based on current state
   */
  public predictNextAction(
    model: MarkovChainModel,
    currentState: ActionType,
    context?: ActionType[]
  ): Array<{ action: ActionType; probability: number }> {
    const predictions: Array<{ action: ActionType; probability: number }> = [];

    if (context && context.length >= this.order - 1) {
      // Use context for higher-order prediction
      const contextKey = context.slice(-this.order + 1).join('->');
      const contextTransitions = model.transitionMatrix[contextKey as ActionType];
      
      if (contextTransitions) {
        Object.entries(contextTransitions).forEach(([action, prob]) => {
          if (prob > 0) {
            predictions.push({ action: action as ActionType, probability: prob });
          }
        });
      }
    }

    // Fall back to current state
    if (predictions.length === 0) {
      const transitions = model.transitionMatrix[currentState];
      if (transitions) {
        Object.entries(transitions).forEach(([action, prob]) => {
          if (prob > 0) {
            predictions.push({ action: action as ActionType, probability: prob });
          }
        });
      }
    }

    // Sort by probability
    predictions.sort((a, b) => b.probability - a.probability);

    return predictions;
  }

  /**
   * Detect sequential patterns in event sequences
   */
  public detectPatterns(
    events: BehaviorEvent[],
    minFrequency: number = 2
  ): SequencePattern[] {
    const patterns: SequencePattern[] = [];
    const patternMap = new Map<string, {
      sequence: ActionType[];
      count: number;
      totalDuration: number;
      hasConversion: boolean;
      firstOccurrence: Date;
      lastOccurrence: Date;
    }>();

    // Group events by session
    const sessions = this.groupBySession(events);

    // Analyze each session for patterns
    sessions.forEach(sessionEvents => {
      // Sort by timestamp
      const sorted = sessionEvents.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const sequence = sorted.map(e => e.action);

      // Find subsequences of length 2 to maxSequenceLength
      for (let len = 2; len <= Math.min(this.maxSequenceLength, sequence.length); len++) {
        for (let start = 0; start <= sequence.length - len; start++) {
          const subSequence = sequence.slice(start, start + len);
          const key = subSequence.join('->');
          
          const sessionStart = new Date(sorted[start].timestamp).getTime();
          const sessionEnd = new Date(sorted[start + len - 1].timestamp).getTime();
          const duration = sessionEnd - sessionStart;

          const hasConversion = subSequence.includes('complete_purchase');

          const existing = patternMap.get(key);
          if (existing) {
            existing.count++;
            existing.totalDuration += duration;
            existing.hasConversion = existing.hasConversion || hasConversion;
            if (new Date(sorted[start].timestamp) < existing.firstOccurrence) {
              existing.firstOccurrence = new Date(sorted[start].timestamp);
            }
            if (new Date(sorted[start + len - 1].timestamp) > existing.lastOccurrence) {
              existing.lastOccurrence = new Date(sorted[start + len - 1].timestamp);
            }
          } else {
            patternMap.set(key, {
              sequence: subSequence,
              count: 1,
              totalDuration: duration,
              hasConversion,
              firstOccurrence: new Date(sorted[start].timestamp),
              lastOccurrence: new Date(sorted[start + len - 1].timestamp)
            });
          }
        }
      }
    });

    // Convert to SequencePattern array
    patternMap.forEach((value, key) => {
      if (value.count >= minFrequency) {
        const conversionRate = value.hasConversion ? 
          (value.count > 0 ? 1 / value.count : 0) : 0;

        patterns.push({
          patternId: uuidv4(),
          userId: events[0]?.userId || '',
          sequence: value.sequence,
          frequency: value.count,
          averageDuration: value.totalDuration / value.count,
          conversionRate,
          firstOccurrence: value.firstOccurrence,
          lastOccurrence: value.lastOccurrence,
          confidence: Math.min(value.count / 10, 1) // Cap at 1.0
        });
      }
    });

    // Sort by frequency
    patterns.sort((a, b) => b.frequency - a.frequency);

    return patterns.slice(0, 100); // Limit to top 100 patterns
  }

  /**
   * Analyze conversion funnel
   */
  public analyzeFunnel(events: BehaviorEvent[]): SequenceAnalysisResult['conversionFunnel'] {
    // Define typical funnel stages
    const funnelStages: ActionType[] = [
      'browse',
      'view_product',
      'add_to_cart',
      'initiate_checkout',
      'complete_purchase'
    ];

    const stageCounts: Record<ActionType, number> = {} as Record<ActionType, number>;
    funnelStages.forEach(stage => stageCounts[stage] = 0);

    // Count occurrences of each stage
    events.forEach(event => {
      if (funnelStages.includes(event.action)) {
        stageCounts[event.action]++;
      }
    });

    const totalStarted = stageCounts['browse'] || 1;

    return funnelStages.map(stage => ({
      stage,
      count: stageCounts[stage],
      percentage: totalStarted > 0 ? (stageCounts[stage] / totalStarted) * 100 : 0
    }));
  }

  /**
   * Find drop-off points in sequences
   */
  public findDropOffPoints(events: BehaviorEvent[]): SequenceAnalysisResult['funnelDropOffPoints'] {
    const dropOffPoints: SequenceAnalysisResult['funnelDropOffPoints'] = [];
    
    // Group by session
    const sessions = this.groupBySession(events);

    // Analyze transitions
    const transitionCounts: Record<string, number> = {};
    const possibleTransitions: Record<string, number> = {};

    sessions.forEach(sessionEvents => {
      const sorted = sessionEvents.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i].action;
        const to = sorted[i + 1].action;
        
        const key = `${from}->${to}`;
        transitionCounts[key] = (transitionCounts[key] || 0) + 1;
        possibleTransitions[from] = (possibleTransitions[from] || 0) + 1;
      }
    });

    // Calculate drop-off rates
    Object.keys(possibleTransitions).forEach(from => {
      const expectedNext = ['view_product', 'add_to_cart', 'view_cart'];
      const expectedTotal = expectedNext.reduce((sum, action) => 
        sum + (possibleTransitions[action] || 0), 0
      );
      
      const actualNext = Object.keys(transitionCounts)
        .filter(key => key.startsWith(`${from}->`))
        .reduce((sum, key) => sum + transitionCounts[key], 0);

      if (expectedTotal > 0 && actualNext < expectedTotal) {
        const toActions = expectedNext.filter(a => a !== from);
        toActions.forEach(to => {
          const key = `${from}->${to}`;
          const notTaken = possibleTransitions[from] - (transitionCounts[key] || 0);
          
          if (notTaken > 0) {
            dropOffPoints.push({
              from: from as ActionType,
              to: to as ActionType,
              dropOffRate: notTaken / possibleTransitions[from]
            });
          }
        });
      }
    });

    return dropOffPoints;
  }

  /**
   * Perform complete sequence analysis
   */
  public analyzeSequence(
    userId: string,
    events: BehaviorEvent[],
    options?: {
      includeMarkovModel?: boolean;
      minEvents?: number;
    }
  ): SequenceAnalysisResult {
    const startTime = Date.now();
    const minEvents = options?.minEvents || 10;

    if (events.length < minEvents) {
      logger.warn('Insufficient events for analysis', { userId, eventCount: events.length });
    }

    const sessions = this.groupBySession(events);
    
    // Detect patterns
    const patterns = this.detectPatterns(events, this.minFrequency);

    // Analyze funnel
    const conversionFunnel = this.analyzeFunnel(events);

    // Find drop-off points
    const funnelDropOffPoints = this.findDropOffPoints(events);

    // Build Markov model if requested and we have enough data
    let markovModel: MarkovChainModel | undefined;
    if (options?.includeMarkovModel && events.length >= minEvents) {
      const sequences = sessions.map(s => s.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ).map(e => e.action));

      markovModel = this.buildMarkovModel({ userId, sequences });
    }

    // Calculate unique paths
    const uniquePaths = new Set(
      sessions.map(s => s.map(e => e.action).join('->'))
    ).size;

    // Find most common sequence
    const sequenceCounts: Record<string, number> = {};
    sessions.forEach(s => {
      const path = s.map(e => e.action).join('->');
      sequenceCounts[path] = (sequenceCounts[path] || 0) + 1;
    });

    const sortedPaths = Object.entries(sequenceCounts)
      .sort((a, b) => b[1] - a[1]);
    
    const mostCommonSequence = sortedPaths.length > 0 
      ? sortedPaths[0][0].split('->') as ActionType[]
      : [];

    // Calculate average sequence length
    const avgSequenceLength = sessions.reduce(
      (sum, s) => sum + s.length, 0
    ) / Math.max(sessions.length, 1);

    // Generate insights
    const insights: string[] = [];

    // Check for common abandonment
    const abandonmentCount = sessions.filter(s => 
      s.some(e => e.action === 'add_to_cart') && 
      !s.some(e => e.action === 'complete_purchase')
    ).length;

    if (abandonmentCount > 0) {
      insights.push(`${abandonmentCount} sessions had cart additions without purchase`);
    }

    // Check for quick exits
    const quickExits = sessions.filter(s => s.length <= 2).length;
    if (quickExits > sessions.length * 0.5) {
      insights.push('High rate of single-page sessions detected');
    }

    logger.logSequenceAnalysis(
      userId,
      events.length,
      patterns.length,
      Date.now() - startTime
    );

    return {
      userId,
      analyzedAt: new Date(),
      totalEvents: events.length,
      totalSessions: sessions.length,
      uniquePaths,
      mostCommonSequence,
      averageSequenceLength: avgSequenceLength,
      funnelDropOffPoints,
      conversionFunnel,
      markovModel,
      patterns,
      insights
    };
  }

  /**
   * Group events by session
   */
  private groupBySession(events: BehaviorEvent[]): BehaviorEvent[][] {
    const sessionMap = new Map<string, BehaviorEvent[]>();

    events.forEach(event => {
      const existing = sessionMap.get(event.sessionId);
      if (existing) {
        existing.push(event);
      } else {
        sessionMap.set(event.sessionId, [event]);
      }
    });

    return Array.from(sessionMap.values());
  }

  /**
   * Calculate entropy of the Markov chain
   */
  private calculateEntropy(
    transitionMatrix: Record<ActionType, Record<ActionType, number>>,
    states: Set<ActionType>
  ): number {
    let totalEntropy = 0;
    let stateCount = 0;

    states.forEach(from => {
      const row = transitionMatrix[from];
      if (row) {
        let rowEntropy = 0;
        states.forEach(to => {
          const p = row[to] || 0;
          if (p > 0) {
            rowEntropy -= p * Math.log2(p);
          }
        });
        totalEntropy += rowEntropy;
        stateCount++;
      }
    });

    return stateCount > 0 ? totalEntropy / stateCount : 0;
  }
}

export default SequenceAnalyzer;
