/**
 * ReZ Mind Education Service - TypeScript Interfaces
 */

// ==================== Enums ====================

export enum CourseCategory {
  MATHEMATICS = 'mathematics',
  SCIENCES = 'sciences',
  LANGUAGES = 'languages',
  HUMANITIES = 'humanities',
  BUSINESS = 'business',
  TECHNOLOGY = 'technology',
  ARTS = 'arts',
  PROFESSIONAL = 'professional',
}

export enum GradeLevel {
  FRESHMAN = 'freshman',
  SOPHOMORE = 'sophomore',
  JUNIOR = 'junior',
  SENIOR = 'senior',
  GRADUATE = 'graduate',
}

export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
}

export enum AnomalySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum PredictionType {
  GRADE = 'grade',
  DROPOUT = 'dropout',
  ATTENDANCE = 'attendance',
  ENGAGEMENT = 'engagement',
}

// ==================== Core Types ====================

export interface StudentProfile {
  studentId: string;
  institutionId: string;
  name: string;
  email: string;
  gradeLevel: GradeLevel;
  gpa: number;
  enrollmentDate: Date;
  status: 'active' | 'inactive' | 'graduated' | 'dropped_out';
}

export interface AcademicRecord {
  courseId: string;
  courseName: string;
  category: CourseCategory;
  credits: number;
  grade?: string;
  completedDate?: Date;
  status: 'completed' | 'in_progress' | 'failed' | 'withdrawn';
}

export interface PerformanceMetrics {
  attendanceRate: number;
  assignmentCompletion: number;
  quizAverage: number;
  examAverage: number;
  participationScore: number;
  overallGpa: number;
}

export interface PerformancePrediction {
  predictionId: string;
  studentId: string;
  institutionId: string;
  courseId?: string;
  predictedGrade: string;
  confidence: number;
  riskFactors: string[];
  recommendations: string[];
  predictionDate: Date;
  actualGrade?: string;
  accuracy?: number;
}

export interface AttendanceRecord {
  studentId: string;
  courseId: string;
  date: Date;
  status: AttendanceStatus;
  arrivalTime?: Date;
  departureTime?: Date;
}

export interface AttendanceAnomaly {
  anomalyId: string;
  studentId: string;
  institutionId: string;
  type: 'sudden_drop' | 'chronic_absence' | 'pattern_absence' | 'late_arrivals';
  severity: AnomalySeverity;
  description: string;
  possibleCause: string;
  recommendedAction: string;
  detectedDate: Date;
  resolved: boolean;
}

export interface DropoutRisk {
  riskId: string;
  studentId: string;
  institutionId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  contributingFactors: RiskFactor[];
  recommendations: string[];
  assessmentDate: Date;
  status: 'active' | 'monitored' | 'resolved';
}

export interface RiskFactor {
  category: 'academic' | 'engagement' | 'external';
  factor: string;
  weight: number;
  description: string;
}

export interface CourseRecommendation {
  courseId: string;
  courseName: string;
  category: CourseCategory;
  relevanceScore: number;
  confidence: number;
  reasoning: string;
  prerequisitesMet: boolean;
  careerAlignment: string[];
}

export interface BatchOptimization {
  batchId: string;
  courseId: string;
  institutionId: string;
  recommendedSize: number;
  optimalTiming: {
    startTime: string;
    endTime: string;
    dayOfWeek: number[];
  };
  successProbability: number;
  keyFactors: string[];
  createdAt: Date;
}

export interface FeePaymentPrediction {
  studentId: string;
  paymentProbability: number;
  riskFactors: string[];
  recommendedPlan?: string;
  confidence: number;
}

// ==================== Session Types ====================

export interface EducationMindSessionData {
  sessionId: string;
  institutionId: string;
  studentId?: string;
  intent: string;
  context: {
    courseId?: string;
    semester?: string;
    grades?: AcademicRecord[];
  };
  analysis: {
    recommendations: CourseRecommendation[];
    riskAssessments: DropoutRisk[];
    performancePredictions: PerformancePrediction[];
  };
  sentiment?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== API Request/Response Types ====================

export interface ConsultRequest {
  institutionId: string;
  studentId?: string;
  context?: {
    courseId?: string;
    semester?: string;
    grades?: AcademicRecord[];
  };
}

export interface ConsultResponse {
  sessionId: string;
  recommendations: CourseRecommendation[];
  riskAssessments: DropoutRisk[];
  performancePredictions: PerformancePrediction[];
  confidence: number;
}

export interface PerformancePredictionRequest {
  studentId: string;
  courseId?: string;
  metrics: PerformanceMetrics;
}

export interface AttendanceAnalysisRequest {
  studentId?: string;
  courseId?: string;
  startDate: Date;
  endDate: Date;
}

export interface CourseRecommendationRequest {
  studentId: string;
  careerGoals?: string[];
  completedCourses?: string[];
  preferredCategories?: CourseCategory[];
}

export interface BatchOptimizationRequest {
  courseId: string;
  targetEnrollment: number;
  constraints?: {
    maxSize?: number;
    minSize?: number;
    preferredTimes?: string[];
    instructorIds?: string[];
  };
}

// ==================== Analytics Types ====================

export interface InstitutionAnalytics {
  institutionId: string;
  totalStudents: number;
  avgGpa: number;
  attendanceRate: number;
  dropoutRiskDistribution: Record<RiskLevel, number>;
  coursePassRates: Record<string, number>;
  generatedAt: Date;
}

export interface StudentTrendAnalysis {
  studentId: string;
  performanceTrend: 'improving' | 'stable' | 'declining';
  engagementTrend: 'improving' | 'stable' | 'declining';
  riskTrend: 'increasing' | 'stable' | 'decreasing';
  weeksAnalyzed: number;
}

// ==================== Health Check Types ====================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
}

export interface DependencyHealth {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}