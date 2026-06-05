import { v4 as uuidv4 } from 'uuid';
import {
  PerformancePrediction,
  PerformanceMetrics,
  CourseCategory,
} from '../types';
import { PERFORMANCE_INDICATORS, COURSE_CATEGORIES } from '../config/knowledge';
import { logger } from '../utils/logger';

interface PredictionInput {
  studentId: string;
  institutionId: string;
  courseId?: string;
  courseName?: string;
  category?: CourseCategory;
  metrics: PerformanceMetrics;
}

export class PerformancePredictor {
  /**
   * Predict student performance based on metrics
   */
  async predictStudentPerformance(input: PredictionInput): Promise<PerformancePrediction> {
    logger.debug('Predicting student performance', {
      studentId: input.studentId,
      courseId: input.courseId,
    });

    const { metrics } = input;

    // Calculate weighted performance score
    const performanceScore = this.calculatePerformanceScore(metrics);

    // Determine predicted grade
    const predictedGrade = this.getPredictedGrade(performanceScore);

    // Calculate confidence
    const confidence = this.calculateConfidence(metrics);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(predictedGrade, metrics);

    return {
      predictionId: uuidv4(),
      studentId: input.studentId,
      institutionId: input.institutionId,
      courseId: input.courseId,
      courseName: input.courseName,
      predictedGrade,
      confidence,
      riskFactors,
      recommendations,
      predictionDate: new Date(),
    };
  }

  /**
   * Calculate weighted performance score
   */
  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    const weights = PERFORMANCE_INDICATORS;

    const attendanceScore = metrics.attendanceRate * weights.attendance.weight;
    const assignmentScore = metrics.assignmentCompletion * weights.assignment_completion.weight;
    const quizScore = metrics.quizAverage * weights.quiz_performance.weight;
    const examScore = metrics.examAverage * weights.exam_performance.weight;
    const participationScore = metrics.participationScore * weights.participation.weight;

    return attendanceScore + assignmentScore + quizScore + examScore + participationScore;
  }

  /**
   * Convert performance score to predicted grade
   */
  private getPredictedGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 85) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'B-';
    if (score >= 65) return 'C+';
    if (score >= 60) return 'C';
    if (score >= 55) return 'C-';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(metrics: PerformanceMetrics): number {
    // Base confidence
    let confidence = 0.65;

    // Adjust for data completeness
    if (metrics.assignmentCompletion > 0) confidence += 0.1;
    if (metrics.quizAverage > 0) confidence += 0.1;
    if (metrics.examAverage > 0) confidence += 0.1;

    // Adjust for consistency
    const variation = Math.abs(
      metrics.attendanceRate - metrics.assignmentCompletion +
      metrics.quizAverage - metrics.examAverage
    ) / 4;

    if (variation < 10) confidence += 0.05;
    else if (variation > 20) confidence -= 0.05;

    return Math.min(0.95, Math.max(0.5, confidence));
  }

  /**
   * Identify risk factors based on metrics
   */
  private identifyRiskFactors(metrics: PerformanceMetrics): string[] {
    const riskFactors: string[] = [];

    // Check attendance
    if (metrics.attendanceRate < PERFORMANCE_INDICATORS.attendance.thresholds.average) {
      riskFactors.push(`Low attendance rate: ${metrics.attendanceRate}%`);
    }

    // Check assignment completion
    if (metrics.assignmentCompletion < PERFORMANCE_INDICATORS.assignment_completion.thresholds.average) {
      riskFactors.push(`Assignment completion below target: ${metrics.assignmentCompletion}%`);
    }

    // Check quiz performance
    if (metrics.quizAverage < PERFORMANCE_INDICATORS.quiz_performance.thresholds.average) {
      riskFactors.push(`Quiz performance below average: ${metrics.quizAverage}%`);
    }

    // Check exam performance
    if (metrics.examAverage < PERFORMANCE_INDICATORS.exam_performance.thresholds.average) {
      riskFactors.push(`Exam scores need improvement: ${metrics.examAverage}%`);
    }

    // Check participation
    if (metrics.participationScore < PERFORMANCE_INDICATORS.participation.thresholds.average) {
      riskFactors.push(`Limited class participation: ${metrics.participationScore}%`);
    }

    return riskFactors;
  }

  /**
   * Generate recommendations based on predicted grade and metrics
   */
  private generateRecommendations(grade: string, metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    // Grade-specific recommendations
    if (grade === 'F' || grade === 'D') {
      recommendations.push('Schedule meeting with academic advisor immediately');
      recommendations.push('Consider attending all remaining classes');
      recommendations.push('Seek tutoring or study group support');
    }

    // Attendance recommendation
    if (metrics.attendanceRate < 85) {
      recommendations.push('Improve attendance to at least 90%');
    }

    // Assignment recommendation
    if (metrics.assignmentCompletion < 80) {
      recommendations.push('Complete all remaining assignments');
    }

    // Exam recommendation
    if (metrics.examAverage < 70) {
      recommendations.push('Schedule exam preparation sessions');
    }

    // General recommendation
    if (recommendations.length === 0) {
      recommendations.push('Maintain current study habits');
      if (metrics.overallGpa > 3.0) {
        recommendations.push('Consider taking on leadership roles');
      }
    }

    return recommendations;
  }

  /**
   * Predict course pass probability
   */
  async predictPassProbability(
    metrics: PerformanceMetrics,
    courseCategory?: CourseCategory
  ): Promise<{
    probability: number;
    riskLevel: string;
    factors: string[];
  }> {
    const score = this.calculatePerformanceScore(metrics);
    let probability = score / 100;

    // Adjust for course difficulty if category provided
    if (courseCategory) {
      const courseData = COURSE_CATEGORIES[courseCategory];
      if (courseData.difficulty > 7) {
        probability *= 0.9;
      } else if (courseData.difficulty < 5) {
        probability *= 1.1;
      }
    }

    probability = Math.min(0.99, Math.max(0.1, probability));

    let riskLevel = 'low';
    if (probability < 0.5) riskLevel = 'high';
    else if (probability < 0.7) riskLevel = 'medium';

    const factors: string[] = [];
    if (metrics.attendanceRate < 80) factors.push('Attendance below 80%');
    if (metrics.assignmentCompletion < 75) factors.push('Assignment completion below 75%');
    if (metrics.examAverage < 60) factors.push('Exam scores below 60%');

    return {
      probability: Math.round(probability * 100) / 100,
      riskLevel,
      factors,
    };
  }
}

export default PerformancePredictor;