import { v4 as uuidv4 } from 'uuid';
import { BatchOptimization } from '../types';
import { BATCH_OPTIMIZATION } from '../config/knowledge';
import { logger } from '../utils/logger';

interface BatchOptimizationInput {
  courseId: string;
  institutionId: string;
  targetEnrollment: number;
  constraints?: {
    maxSize?: number;
    minSize?: number;
    preferredTimes?: string[];
    instructorIds?: string[];
  };
}

export class BatchOptimizer {
  /**
   * Optimize batch configuration
   */
  async optimizeBatch(input: BatchOptimizationInput): Promise<BatchOptimization> {
    logger.debug('Optimizing batch configuration', { courseId: input.courseId });

    const { constraints, targetEnrollment } = input;

    // Determine optimal batch size
    const optimalSize = this.determineOptimalSize(targetEnrollment, constraints);

    // Determine optimal timing
    const optimalTiming = this.determineOptimalTiming(constraints);

    // Calculate success probability
    const successProbability = this.calculateSuccessProbability(optimalSize, optimalTiming);

    // Identify key success factors
    const keyFactors = this.identifySuccessFactors(optimalSize, optimalTiming);

    return {
      batchId: uuidv4(),
      courseId: input.courseId,
      institutionId: input.institutionId,
      recommendedSize: optimalSize,
      optimalTiming,
      successProbability,
      keyFactors,
      createdAt: new Date(),
    };
  }

  /**
   * Determine optimal batch size
   */
  private determineOptimalSize(
    targetEnrollment: number,
    constraints?: BatchOptimizationInput['constraints']
  ): number {
    const { optimal_sizes } = BATCH_OPTIMIZATION;

    let recommendedSize: number;

    // Base on target enrollment
    if (targetEnrollment <= 20) {
      recommendedSize = optimal_sizes.small.max;
    } else if (targetEnrollment <= 35) {
      recommendedSize = optimal_sizes.medium.max;
    } else {
      recommendedSize = optimal_sizes.large.max;
    }

    // Adjust for constraints
    if (constraints) {
      if (constraints.minSize && recommendedSize < constraints.minSize) {
        recommendedSize = constraints.minSize;
      }
      if (constraints.maxSize && recommendedSize > constraints.maxSize) {
        recommendedSize = constraints.maxSize;
      }
    }

    return recommendedSize;
  }

  /**
   * Determine optimal timing
   */
  private determineOptimalTiming(
    constraints?: BatchOptimizationInput['constraints']
  ): BatchOptimization['optimalTiming'] {
    const { optimal_timing } = BATCH_OPTIMIZATION;

    // Default to morning if no constraints
    if (!constraints?.preferredTimes) {
      return {
        startTime: optimal_timing.morning.start,
        endTime: optimal_timing.morning.end,
        dayOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
      };
    }

    // Find matching time slot
    const preferredTimes = constraints.preferredTimes;
    if (preferredTimes.some(t => t.includes('morning'))) {
      return {
        startTime: optimal_timing.morning.start,
        endTime: optimal_timing.morning.end,
        dayOfWeek: [1, 2, 3, 4, 5],
      };
    }
    if (preferredTimes.some(t => t.includes('afternoon'))) {
      return {
        startTime: optimal_timing.afternoon.start,
        endTime: optimal_timing.afternoon.end,
        dayOfWeek: [1, 2, 3, 4, 5],
      };
    }

    return {
      startTime: optimal_timing.evening.start,
      endTime: optimal_timing.evening.end,
      dayOfWeek: [1, 2, 3, 4, 5, 6],
    };
  }

  /**
   * Calculate success probability
   */
  private calculateSuccessProbability(
    size: number,
    timing: BatchOptimization['optimalTiming']
  ): number {
    const { success_factors } = BATCH_OPTIMIZATION;

    // Base probability
    let probability = 0.8;

    // Adjust for size
    if (size >= 15 && size <= 40) {
      probability += 0.1;
    } else if (size > 60) {
      probability -= 0.15;
    }

    // Adjust for timing
    if (timing.startTime === '08:00') {
      probability += 0.05;
    }

    // Simulate instructor experience factor
    const instructorFactor = 0.05 + Math.random() * 0.1;
    probability += instructorFactor;

    return Math.min(0.98, Math.max(0.5, probability));
  }

  /**
   * Identify key success factors
   */
  private identifySuccessFactors(
    size: number,
    timing: BatchOptimization['optimalTiming']
  ): string[] {
    const factors: string[] = [];

    if (size >= 15 && size <= 40) {
      factors.push('Optimal class size for engagement and participation');
    }

    if (timing.startTime === '08:00') {
      factors.push('Morning classes show better concentration');
    }

    factors.push('Strong instructor facilitation');
    factors.push('Regular interactive activities');
    factors.push('Clear learning objectives');

    return factors;
  }

  /**
   * Generate multiple batch options
   */
  async generateBatchOptions(input: BatchOptimizationInput): Promise<BatchOptimization[]> {
    logger.debug('Generating batch options', { courseId: input.courseId });

    const options: BatchOptimization[] = [];

    // Morning option
    options.push(await this.optimizeBatch({
      ...input,
      constraints: {
        ...input.constraints,
        preferredTimes: ['morning'],
      },
    }));

    // Afternoon option
    options.push(await this.optimizeBatch({
      ...input,
      constraints: {
        ...input.constraints,
        preferredTimes: ['afternoon'],
      },
    }));

    // Weekend option
    options.push({
      batchId: uuidv4(),
      courseId: input.courseId,
      institutionId: input.institutionId,
      recommendedSize: input.targetEnrollment,
      optimalTiming: {
        startTime: '09:00',
        endTime: '17:00',
        dayOfWeek: [6], // Saturday
      },
      successProbability: 0.75,
      keyFactors: ['Weekend format', 'Full day intensive', 'Flexible for working students'],
      createdAt: new Date(),
    });

    return options;
  }
}

export default BatchOptimizer;