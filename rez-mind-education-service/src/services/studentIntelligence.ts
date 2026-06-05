import { v4 as uuidv4 } from 'uuid';
import {
  CourseCategory,
  CourseRecommendation,
  DropoutRisk,
  PerformancePrediction,
  PerformanceMetrics,
} from '../types';
import { COURSE_CATEGORIES, COURSE_RECOMMENDATION_CRITERIA, STUDENT_SEGMENTS } from '../config/knowledge';
import { logger } from '../utils/logger';

interface ConfidenceContext {
  hasStudentId: boolean;
  hasGrades: boolean;
  hasContext: boolean;
}

export class StudentIntelligence {
  /**
   * Get course recommendations for a student
   */
  async getCourseRecommendations(
    institutionId: string,
    studentId?: string
  ): Promise<CourseRecommendation[]> {
    logger.debug('Getting course recommendations', { institutionId, studentId });

    const recommendations: CourseRecommendation[] = [];
    const categories = Object.keys(COURSE_CATEGORIES) as CourseCategory[];

    categories.forEach((category, catIndex) => {
      const courseData = COURSE_CATEGORIES[category];

      recommendations.push({
        courseId: `course-${category}-${catIndex}`,
        courseName: courseData.name,
        category,
        relevanceScore: 60 + Math.random() * 30,
        confidence: 0.7 + Math.random() * 0.2,
        reasoning: `Based on curriculum alignment and skill development needs`,
        prerequisitesMet: Math.random() > 0.3,
        careerAlignment: this.getCareerAlignment(category),
      });
    });

    return recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Assess dropout risk for a student
   */
  async assessDropoutRisk(
    institutionId: string,
    studentId?: string
  ): Promise<DropoutRisk[]> {
    logger.debug('Assessing dropout risk', { institutionId, studentId });

    // Generate mock at-risk students
    const atRiskStudents: DropoutRisk[] = [];
    const riskLevels = ['critical', 'high', 'medium', 'low'] as const;

    for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
      const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];
      const riskScore = riskLevel === 'critical' ? 85 + Math.random() * 15 :
        riskLevel === 'high' ? 65 + Math.random() * 20 :
        riskLevel === 'medium' ? 40 + Math.random() * 25 : 10 + Math.random() * 30;

      atRiskStudents.push({
        riskId: uuidv4(),
        studentId: studentId || `student-${i}`,
        institutionId,
        riskScore: Math.round(riskScore),
        riskLevel,
        contributingFactors: this.getContributingFactors(riskLevel),
        recommendations: this.getRecommendations(riskLevel),
        assessmentDate: new Date(),
        status: riskLevel === 'critical' ? 'active' : 'monitored',
      });
    }

    return atRiskStudents.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Predict student performance
   */
  async predictPerformance(
    institutionId: string,
    studentId?: string
  ): Promise<PerformancePrediction[]> {
    logger.debug('Predicting performance', { institutionId, studentId });

    const predictions: PerformancePrediction[] = [];
    const grades = ['A', 'B', 'C', 'D', 'F'];
    const categories = Object.keys(COURSE_CATEGORIES) as CourseCategory[];

    for (let i = 0; i < Math.min(5, categories.length); i++) {
      const grade = grades[Math.floor(Math.random() * grades.length)];
      const confidence = 0.65 + Math.random() * 0.3;

      predictions.push({
        predictionId: uuidv4(),
        studentId: studentId || 'student-0',
        institutionId,
        courseId: `course-${i}`,
        predictedGrade: grade,
        confidence: Math.round(confidence * 100) / 100,
        riskFactors: this.getRiskFactors(grade),
        recommendations: this.getGradeRecommendations(grade),
        predictionDate: new Date(),
      });
    }

    return predictions;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(context: ConfidenceContext): number {
    const { hasStudentId, hasGrades, hasContext } = context;

    let confidence = 0.5;

    if (hasStudentId) confidence += 0.2;
    if (hasGrades) confidence += 0.2;
    if (hasContext) confidence += 0.1;

    return Math.min(0.95, Math.max(0.5, confidence));
  }

  /**
   * Get career alignment for course category
   */
  private getCareerAlignment(category: CourseCategory): string[] {
    const alignments: Record<CourseCategory, string[]> = {
      [CourseCategory.MATHEMATICS]: ['Engineering', 'Data Science', 'Finance'],
      [CourseCategory.SCIENCES]: ['Healthcare', 'Research', 'Biotechnology'],
      [CourseCategory.LANGUAGES]: ['Education', 'Communication', 'Media'],
      [CourseCategory.HUMANITIES]: ['Social Work', 'Public Service', 'Counseling'],
      [CourseCategory.BUSINESS]: ['Management', 'Entrepreneurship', 'Consulting'],
      [CourseCategory.TECHNOLOGY]: ['Software Engineering', 'IT', 'Cybersecurity'],
      [CourseCategory.ARTS]: ['Design', 'Creative Industries', 'Marketing'],
      [CourseCategory.PROFESSIONAL]: ['Healthcare Administration', 'Project Management'],
    };
    return alignments[category] || [];
  }

  /**
   * Get contributing factors based on risk level
   */
  private getContributingFactors(riskLevel: string): DropoutRisk['contributingFactors'] {
    if (riskLevel === 'critical') {
      return [
        { category: 'academic', factor: 'failing_courses', weight: 30, description: 'Currently failing multiple courses' },
        { category: 'engagement', factor: 'low_attendance', weight: 25, description: 'Attendance below 60%' },
        { category: 'external', factor: 'financial_difficulties', weight: 20, description: 'Payment issues affecting enrollment' },
      ];
    }
    if (riskLevel === 'high') {
      return [
        { category: 'academic', factor: 'declining_grades', weight: 25, description: 'Grades have been declining' },
        { category: 'engagement', factor: 'limited_participation', weight: 15, description: 'Rarely participates in class' },
      ];
    }
    return [
      { category: 'engagement', factor: 'low_interaction', weight: 10, description: 'Limited interaction with instructors' },
    ];
  }

  /**
   * Get recommendations based on risk level
   */
  private getRecommendations(riskLevel: string): string[] {
    if (riskLevel === 'critical') {
      return [
        'Schedule immediate meeting with academic advisor',
        'Consider reducing course load',
        'Connect with counseling services',
        'Review financial aid options',
      ];
    }
    if (riskLevel === 'high') {
      return [
        'Enroll in study support program',
        'Schedule regular check-ins with instructor',
        'Join peer study group',
      ];
    }
    return [
      'Monitor progress closely',
      'Consider tutoring services',
    ];
  }

  /**
   * Get risk factors based on predicted grade
   */
  private getRiskFactors(grade: string): string[] {
    if (grade === 'F') {
      return ['Low assignment completion', 'Poor exam performance', 'Attendance issues'];
    }
    if (grade === 'D') {
      return ['Inconsistent performance', 'Missing assignments'];
    }
    if (grade === 'C') {
      return ['Average engagement levels', 'Room for improvement'];
    }
    return ['Good academic standing'];
  }

  /**
   * Get grade-based recommendations
   */
  private getGradeRecommendations(grade: string): string[] {
    if (grade === 'F') {
      return ['Attend all remaining classes', 'Schedule office hours', 'Consider tutoring'];
    }
    if (grade === 'D') {
      return ['Increase study time', 'Complete all assignments', 'Seek help early'];
    }
    if (grade === 'C') {
      return ['Focus on exam preparation', 'Review lecture materials'];
    }
    return ['Maintain current study habits'];
  }
}

export default StudentIntelligence;