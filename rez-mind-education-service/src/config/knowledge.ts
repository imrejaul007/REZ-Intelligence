/**
 * Education Industry Knowledge Base
 * Contains course categories, performance indicators, risk factors, and patterns
 */

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

export interface CourseData {
  name: string;
  category: CourseCategory;
  difficulty: number;
  creditHours: number;
  prerequisites: string[];
  averageGpa: number;
  passRate: number;
}

export interface PerformanceIndicator {
  name: string;
  weight: number;
  thresholds: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
}

// Course categories with metadata
export const COURSE_CATEGORIES: Record<CourseCategory, CourseData> = {
  [CourseCategory.MATHEMATICS]: {
    name: 'Mathematics',
    category: CourseCategory.MATHEMATICS,
    difficulty: 7,
    creditHours: 4,
    prerequisites: [],
    averageGpa: 2.8,
    passRate: 75,
  },
  [CourseCategory.SCIENCES]: {
    name: 'Sciences',
    category: CourseCategory.SCIENCES,
    difficulty: 8,
    creditHours: 4,
    prerequisites: ['mathematics'],
    averageGpa: 2.7,
    passRate: 72,
  },
  [CourseCategory.LANGUAGES]: {
    name: 'Languages & Literature',
    category: CourseCategory.LANGUAGES,
    difficulty: 5,
    creditHours: 3,
    prerequisites: [],
    averageGpa: 3.1,
    passRate: 85,
  },
  [CourseCategory.HUMANITIES]: {
    name: 'Humanities & Social Sciences',
    category: CourseCategory.HUMANITIES,
    difficulty: 4,
    creditHours: 3,
    prerequisites: [],
    averageGpa: 3.2,
    passRate: 88,
  },
  [CourseCategory.BUSINESS]: {
    name: 'Business & Economics',
    category: CourseCategory.BUSINESS,
    difficulty: 6,
    creditHours: 3,
    prerequisites: ['mathematics'],
    averageGpa: 3.0,
    passRate: 80,
  },
  [CourseCategory.TECHNOLOGY]: {
    name: 'Technology & Engineering',
    category: CourseCategory.TECHNOLOGY,
    difficulty: 8,
    creditHours: 4,
    prerequisites: ['mathematics', 'sciences'],
    averageGpa: 2.9,
    passRate: 78,
  },
  [CourseCategory.ARTS]: {
    name: 'Arts & Design',
    category: CourseCategory.ARTS,
    difficulty: 4,
    creditHours: 3,
    prerequisites: [],
    averageGpa: 3.4,
    passRate: 92,
  },
  [CourseCategory.PROFESSIONAL]: {
    name: 'Professional Studies',
    category: CourseCategory.PROFESSIONAL,
    difficulty: 6,
    creditHours: 3,
    prerequisites: [],
    averageGpa: 3.0,
    passRate: 82,
  },
};

// Performance indicators with weights
export const PERFORMANCE_INDICATORS: Record<string, PerformanceIndicator> = {
  attendance: {
    name: 'Attendance Rate',
    weight: 0.15,
    thresholds: { excellent: 95, good: 85, average: 75, poor: 65 },
  },
  assignment_completion: {
    name: 'Assignment Completion',
    weight: 0.2,
    thresholds: { excellent: 95, good: 85, average: 75, poor: 65 },
  },
  quiz_performance: {
    name: 'Quiz Performance',
    weight: 0.2,
    thresholds: { excellent: 90, good: 80, average: 70, poor: 60 },
  },
  exam_performance: {
    name: 'Exam Performance',
    weight: 0.3,
    thresholds: { excellent: 85, good: 75, average: 65, poor: 55 },
  },
  participation: {
    name: 'Class Participation',
    weight: 0.15,
    thresholds: { excellent: 80, good: 70, average: 60, poor: 50 },
  },
};

// Risk factors for dropout prediction
export const DROPOUT_RISK_FACTORS = {
  academic: {
    declining_grades: { weight: 25, description: 'Grades declining over last 3 months' },
    low_assignment_completion: { weight: 20, description: 'Completion rate below 70%' },
    failing_courses: { weight: 30, description: 'Currently failing 2+ courses' },
    poor_exam_scores: { weight: 15, description: 'Exam scores consistently below 60%' },
  },
  engagement: {
    low_attendance: { weight: 20, description: 'Attendance below 75%' },
    limited_participation: { weight: 15, description: 'Rarely participates in class' },
    rare_course_access: { weight: 10, description: 'Infrequent LMS access' },
    low_interaction: { weight: 10, description: 'Low interaction with instructors' },
  },
  external: {
    financial_difficulties: { weight: 25, description: 'Has payment issues' },
    family_issues: { weight: 20, description: 'Family problems affecting studies' },
    health_problems: { weight: 20, description: 'Health issues impacting attendance' },
    distance_learning: { weight: 10, description: 'Distance from institution' },
  },
};

// Attendance anomaly patterns
export const ATTENDANCE_ANOMALY_PATTERNS = {
  sudden_drop: {
    threshold: 20,
    description: 'Attendance dropped by more than 20% in a week',
    severity: 'high',
  },
  chronic_absence: {
    threshold: 3,
    description: 'More than 3 consecutive absences',
    severity: 'critical',
  },
  pattern_absence: {
    pattern: 'same_day',
    description: 'Regularly absent on specific days',
    severity: 'medium',
  },
  late_arrivals: {
    threshold: 5,
    description: 'More than 5 late arrivals in a month',
    severity: 'low',
  },
};

// Batch optimization parameters
export const BATCH_OPTIMIZATION = {
  optimal_sizes: {
    small: { min: 15, max: 25, description: 'Interactive sessions' },
    medium: { min: 25, max: 40, description: 'Standard lectures' },
    large: { min: 40, max: 100, description: 'Large auditorium' },
  },
  optimal_timing: {
    morning: { start: '08:00', end: '12:00', description: 'Best for complex subjects' },
    afternoon: { start: '13:00', end: '17:00', description: 'Good for practical subjects' },
    evening: { start: '18:00', end: '21:00', description: 'Flexible learning' },
  },
  success_factors: {
    student_engagement: 0.3,
    instructor_experience: 0.25,
    class_size_fit: 0.2,
    time_of_day: 0.15,
    facilities: 0.1,
  },
};

// Course recommendation criteria weights
export const COURSE_RECOMMENDATION_CRITERIA = {
  interest_alignment: 0.25,
  skill_gap_analysis: 0.25,
  career_path_matching: 0.2,
  prerequisite_completion: 0.15,
  workload_balance: 0.1,
  peer_recommendations: 0.05,
};

// Student segment profiles
export const STUDENT_SEGMENTS = {
  high_performer: {
    gpa_range: [3.5, 4.0],
    engagement_score: 85,
    risk_level: 'low',
    recommendations: ['advanced_courses', 'leadership_roles', 'research_opportunities'],
  },
  average_performer: {
    gpa_range: [2.5, 3.49],
    engagement_score: 65,
    risk_level: 'medium',
    recommendations: ['support_services', 'study_groups', 'tutoring'],
  },
  at_risk: {
    gpa_range: [0, 2.49],
    engagement_score: 40,
    risk_level: 'high',
    recommendations: ['intervention_programs', 'counseling', 'academic_plan'],
  },
  struggling: {
    gpa_range: [0, 2.0],
    engagement_score: 25,
    risk_level: 'critical',
    recommendations: ['intensive_support', 'course_reduction', 'retake_options'],
  },
};

// Fee payment prediction patterns
export const FEE_PAYMENT_PATTERNS = {
  on_time_indicators: [
    'previous_on_time_payments',
    'stable_income',
    'enrollment_status',
  ],
  late_payment_indicators: [
    'previous_late_payments',
    'payment_plan_active',
    'scholarship_pending',
  ],
  default_risk_factors: [
    'repeated_late_payments',
    'financial_aid_issues',
    'low_account_balance',
  ],
};

export default {
  COURSE_CATEGORIES,
  PERFORMANCE_INDICATORS,
  DROPOUT_RISK_FACTORS,
  ATTENDANCE_ANOMALY_PATTERNS,
  BATCH_OPTIMIZATION,
  COURSE_RECOMMENDATION_CRITERIA,
  STUDENT_SEGMENTS,
  FEE_PAYMENT_PATTERNS,
};