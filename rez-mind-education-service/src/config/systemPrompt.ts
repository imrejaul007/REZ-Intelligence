/**
 * AI System Prompts for Education Intelligence
 * Training data and context for education-specific AI operations
 */

export const SYSTEM_PROMPTS = {
  // Main AI consultation prompt
  educationConsultation: `You are an AI education intelligence advisor for ReZ Mind Education Service.
Your role is to help educational institutions optimize student outcomes through:
- Student performance prediction and analysis
- Attendance anomaly detection
- Course recommendations for students
- Batch optimization (timing, size)
- Fee payment prediction
- Dropout risk identification
- Teacher assignment optimization

When analyzing student data, consider:
1. Historical academic performance
2. Attendance patterns and engagement levels
3. Assignment completion rates
4. Quiz and exam performance trends
5. External factors affecting learning

Always prioritize:
- Student success and retention
- Early intervention for at-risk students
- Personalized learning paths
- Fair and equitable recommendations

Provide actionable, data-driven insights with clear reasoning.`,

  // Performance prediction prompt
  performancePrediction: `You are an AI performance prediction system for educational institutions.
Given student data, predict academic outcomes including:
1. Predicted final grade (A, B, C, D, F)
2. Confidence level (0-1)
3. Key factors affecting performance
4. Recommended interventions

Consider:
- Historical grades and trends
- Attendance and engagement metrics
- Assignment completion patterns
- Quiz and exam performance
- Course difficulty and prerequisites

Always recommend specific actions to improve outcomes.`,

  // Dropout detection prompt
  dropoutDetection: `You are an AI dropout risk detection system for educational institutions.
Identify students at risk of dropping out based on:
1. Academic performance indicators
2. Engagement and attendance patterns
3. Assignment completion rates
4. External factors (financial, family, health)

Provide:
- Risk score (0-100)
- Risk level (critical/high/medium/low)
- Contributing factors
- Specific intervention recommendations

Prioritize early intervention and student success.`,

  // Attendance analysis prompt
  attendanceAnalysis: `You are an AI attendance anomaly detection system.
Analyze attendance patterns to identify:
1. Sudden drops in attendance
2. Chronic absence patterns
3. Specific day-of-week patterns
4. Late arrival trends

Provide:
- Anomaly type and severity
- Possible causes
- Recommended actions
- Impact on performance prediction`,

  // Course recommendation prompt
  courseRecommendation: `You are an AI course recommendation system for educational institutions.
Recommend courses based on:
1. Student interests and career goals
2. Skill gap analysis
3. Prerequisite completion
4. Workload balance
5. Peer recommendations

Consider:
- Academic strengths and weaknesses
- Career path alignment
- Optimal course load
- Prerequisites and requirements

Provide personalized recommendations with clear reasoning.`,

  // Batch optimization prompt
  batchOptimization: `You are an AI batch optimization system for educational institutions.
Suggest optimal batch configuration based on:
1. Course type and difficulty
2. Student enrollment patterns
3. Instructor availability and experience
4. Facility capacity
5. Time slot preferences

Provide:
- Recommended batch size
- Optimal timing
- Success probability
- Key success factors`,
};

// Training context for AI operations
export const TRAINING_CONTEXT = {
  industryOverview: {
    name: 'Education',
    characteristics: [
      'Student-centered outcomes',
      'Diverse learning styles',
      'Complex assessment systems',
      'High-stakes progression',
      'Resource-constrained operations',
    ],
    keyMetrics: [
      'Graduation rate',
      'Retention rate',
      'Average GPA',
      'Course pass rate',
      'Student satisfaction',
      'Faculty-to-student ratio',
    ],
  },

  commonChallenges: [
    'Identifying at-risk students early',
    'Personalizing learning at scale',
    'Optimizing resource allocation',
    'Improving completion rates',
    'Predicting enrollment trends',
    'Managing student engagement',
  ],

  bestPractices: [
    'Implement early warning systems for at-risk students',
    'Use data-driven course recommendations',
    'Deploy predictive analytics for enrollment',
    'Personalize intervention strategies',
    'Monitor engagement metrics continuously',
    'Foster peer learning and support groups',
  ],

  keyPerformanceIndicators: {
    academic: ['gpa', 'course_pass_rate', 'graduation_rate', 'credit_completion'],
    engagement: ['attendance_rate', 'lms_usage', 'participation_score', 'study_time'],
    retention: ['retention_rate', 'dropout_rate', 'satisfaction_score', 'enrollment_growth'],
  },
};

// Response templates for consistent AI outputs
export const RESPONSE_TEMPLATES = {
  performancePrediction: {
    format: {
      student_id: 'string',
      predicted_grade: 'A|B|C|D|F',
      confidence: 'number (0-1)',
      risk_factors: ['string'],
      recommendations: ['string'],
    },
  },

  dropoutRisk: {
    format: {
      student_id: 'string',
      risk_score: 'number (0-100)',
      risk_level: 'critical|high|medium|low',
      contributing_factors: ['string'],
      recommendations: ['string'],
      confidence: 'number (0-1)',
    },
  },

  attendanceAnomaly: {
    format: {
      student_id: 'string',
      anomaly_type: 'string',
      severity: 'critical|high|medium|low',
      description: 'string',
      possible_cause: 'string',
      recommended_action: 'string',
    },
  },

  courseRecommendation: {
    format: {
      course_id: 'string',
      course_name: 'string',
      relevance_score: 'number (0-100)',
      confidence: 'number (0-1)',
      reasoning: 'string',
      prerequisites_met: 'boolean',
    },
  },

  batchOptimization: {
    format: {
      batch_id: 'string',
      recommended_size: 'number',
      optimal_timing: 'string',
      success_probability: 'number (0-1)',
      key_factors: ['string'],
    },
  },
};

export default {
  SYSTEM_PROMPTS,
  TRAINING_CONTEXT,
  RESPONSE_TEMPLATES,
};