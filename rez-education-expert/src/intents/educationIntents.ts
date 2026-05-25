import { z } from 'zod';
import { EducationIntent } from '../types/tone';

export enum IntentType {
  COURSE_RECOMMENDATION = 'COURSE_RECOMMENDATION',
  LEARNING_PATH = 'LEARNING_PATH',
  COURSE_SEARCH = 'COURSE_SEARCH',
  ENROLL = 'ENROLL',
  PROGRESS_CHECK = 'PROGRESS_CHECK',
  CERTIFICATION_INFO = 'CERTIFICATION_INFO',
  STUDY_TIPS = 'STUDY_TIPS',
  SKILL_ASSESSMENT = 'SKILL_ASSESSMENT',
  COURSE_COMPARE = 'COURSE_COMPARE',
  COMPLETION_CELEBRATE = 'COMPLETION_CELEBRATE',
  DOMAIN_EXPLORE = 'DOMAIN_EXPLORE',
  TIME_ESTIMATE = 'TIME_ESTIMATE',
  CAREER_GUIDANCE = 'CAREER_GUIDANCE',
  COURSE_DIFFICULTY = 'COURSE_DIFFICULTY',
  LEARNING_STYLE = 'LEARNING_STYLE',
  MOTIVATION = 'MOTIVATION',
  ACHIEVEMENT_VIEW = 'ACHIEVEMENT_VIEW',
  SCHEDULE_PLANNING = 'SCHEDULE_PLANNING',
  CERTIFICATION_TRACK = 'CERTIFICATION_TRACK'
}

const InterestSchema = z.object({
  domains: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional()
});

const LearningPathSchema = z.object({
  targetSkills: z.array(z.string()),
  currentLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  timeCommitment: z.enum(['full-time', 'part-time', 'casual']).optional(),
  duration: z.string().optional()
});

const CourseSearchSchema = z.object({
  query: z.string().optional(),
  domain: z.string().optional(),
  level: z.string().optional(),
  format: z.array(z.string()).optional(),
  certification: z.boolean().optional(),
  sortBy: z.enum(['relevance', 'rating', 'duration', 'popularity']).optional()
});

const EnrollSchema = z.object({
  courseId: z.string(),
  userId: z.string()
});

const ProgressCheckSchema = z.object({
  userId: z.string(),
  courseId: z.string().optional()
});

const CertificationInfoSchema = z.object({
  certificationName: z.string().optional(),
  provider: z.string().optional(),
  domain: z.string().optional()
});

const SkillAssessmentSchema = z.object({
  userId: z.string(),
  skills: z.array(z.string()),
  targetRole: z.string().optional()
});

const CourseCompareSchema = z.object({
  courseIds: z.array(z.string()).min(2).max(5)
});

export interface IntentHandler {
  type: IntentType;
  schema: z.ZodSchema;
  examples: string[];
  description: string;
  priority: number;
}

export const EDUCATION_INTENTS: IntentHandler[] = [
  {
    type: IntentType.COURSE_RECOMMENDATION,
    schema: InterestSchema,
    examples: [
      'recommend courses for me',
      'what courses should I take',
      'show me some good courses',
      'what can I learn about Python',
      'find courses for web development',
      'suggest courses for beginners',
      'recommend something in data science'
    ],
    description: 'Get personalized course recommendations based on interests and skill level',
    priority: 10
  },
  {
    type: IntentType.LEARNING_PATH,
    schema: LearningPathSchema,
    examples: [
      'create a learning path for me',
      'how do I become a data scientist',
      'what should I learn to become a frontend developer',
      'build a roadmap for learning machine learning',
      'make a study plan for cybersecurity',
      'how do I learn cloud computing from scratch'
    ],
    description: 'Get a structured learning path with courses and milestones',
    priority: 9
  },
  {
    type: IntentType.COURSE_SEARCH,
    schema: CourseSearchSchema,
    examples: [
      'search for JavaScript courses',
      'find courses about React',
      'search for beginner Python courses',
      'look up AWS training',
      'find certification courses',
      'show me all UX design courses'
    ],
    description: 'Search and filter courses by various criteria',
    priority: 8
  },
  {
    type: IntentType.ENROLL,
    schema: EnrollSchema,
    examples: [
      'enroll me in this course',
      'I want to start learning',
      'sign me up for the Python course',
      'start my enrollment',
      'begin this course for me'
    ],
    description: 'Enroll or start a course',
    priority: 7
  },
  {
    type: IntentType.PROGRESS_CHECK,
    schema: ProgressCheckSchema,
    examples: [
      'what is my progress',
      'how far am I in the course',
      'check my learning status',
      'show my course progress',
      'what have I completed'
    ],
    description: 'Check progress on enrolled courses',
    priority: 7
  },
  {
    type: IntentType.CERTIFICATION_INFO,
    schema: CertificationInfoSchema,
    examples: [
      'tell me about AWS certification',
      'what certifications are available',
      'how do I get certified in PMP',
      'what exams do I need',
      'certification requirements'
    ],
    description: 'Get information about certifications and exams',
    priority: 7
  },
  {
    type: IntentType.STUDY_TIPS,
    schema: z.object({}),
    examples: [
      'give me study tips',
      'how can I learn faster',
      'study strategies',
      'tips for staying focused',
      'how to retain information'
    ],
    description: 'Get study tips and learning strategies',
    priority: 6
  },
  {
    type: IntentType.SKILL_ASSESSMENT,
    schema: SkillAssessmentSchema,
    examples: [
      'assess my skills',
      'what is my skill level',
      'evaluate my knowledge',
      'how good am I at Python',
      'skill gap analysis'
    ],
    description: 'Assess current skills and identify gaps',
    priority: 6
  },
  {
    type: IntentType.COURSE_COMPARE,
    schema: CourseCompareSchema,
    examples: [
      'compare these courses',
      'which is better',
      'differences between courses',
      'which course should I choose',
      'compare React vs Vue'
    ],
    description: 'Compare multiple courses side by side',
    priority: 6
  },
  {
    type: IntentType.COMPLETION_CELEBRATE,
    schema: ProgressCheckSchema,
    examples: [
      'I finished the course',
      'I completed it',
      'I passed the exam',
      'I am done with the course'
    ],
    description: 'Celebrate course or milestone completion',
    priority: 5
  },
  {
    type: IntentType.DOMAIN_EXPLORE,
    schema: z.object({ domain: z.string().optional() }),
    examples: [
      'what domains are available',
      'explore technology courses',
      'what can I learn in business',
      'show me all categories',
      'what areas do you cover'
    ],
    description: 'Explore available learning domains and categories',
    priority: 5
  },
  {
    type: IntentType.TIME_ESTIMATE,
    schema: z.object({ skill: z.string() }),
    examples: [
      'how long does it take',
      'time needed to learn Python',
      'study duration',
      'how many hours to master'
    ],
    description: 'Get time estimates for learning a skill',
    priority: 5
  },
  {
    type: IntentType.CAREER_GUIDANCE,
    schema: z.object({ targetCareer: z.string() }),
    examples: [
      'how do I become a developer',
      'career path for data science',
      'what jobs can I get',
      'career advice',
      'jobs after learning ML'
    ],
    description: 'Get career guidance and job market insights',
    priority: 5
  },
  {
    type: IntentType.COURSE_DIFFICULTY,
    schema: z.object({ courseId: z.string().optional(), skill: z.string().optional() }),
    examples: [
      'is this course hard',
      'difficulty level',
      'is Python hard for beginners',
      'what level is this'
    ],
    description: 'Understand course difficulty levels',
    priority: 4
  },
  {
    type: IntentType.LEARNING_STYLE,
    schema: z.object({ style: z.enum(['visual', 'auditory', 'reading', 'kinesthetic', 'mixed']) }),
    examples: [
      'I learn best visually',
      'video courses for me',
      'hands-on learning',
      'interactive tutorials',
      'reading materials'
    ],
    description: 'Get recommendations based on learning style',
    priority: 4
  },
  {
    type: IntentType.MOTIVATION,
    schema: z.object({}),
    examples: [
      'motivate me',
      'I feel stuck',
      'encourage me',
      'I am losing focus',
      'need inspiration'
    ],
    description: 'Get motivational messages and encouragement',
    priority: 3
  },
  {
    type: IntentType.ACHIEVEMENT_VIEW,
    schema: z.object({ userId: z.string() }),
    examples: [
      'show my achievements',
      'what badges have I earned',
      'my accomplishments',
      'badges and rewards'
    ],
    description: 'View learning achievements and badges',
    priority: 3
  },
  {
    type: IntentType.SCHEDULE_PLANNING,
    schema: z.object({
      targetSkills: z.array(z.string()),
      weeklyHours: z.number()
    }),
    examples: [
      'plan my study schedule',
      'how should I organize my time',
      'weekly study plan',
      'time management for learning'
    ],
    description: 'Create a personalized study schedule',
    priority: 3
  },
  {
    type: IntentType.CERTIFICATION_TRACK,
    schema: z.object({
      targetCertification: z.string(),
      currentLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional()
    }),
    examples: [
      'track my certification progress',
      'PMP certification roadmap',
      'AWS certification journey',
      'certification milestones'
    ],
    description: 'Track progress toward a certification',
    priority: 3
  }
];

export class EducationIntentParser {
  private intentPatterns: Map<IntentType, RegExp[]> = new Map();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    for (const intent of EDUCATION_INTENTS) {
      const patterns = intent.examples.map(example => {
        const words = example.split(' ').map(w => w.toLowerCase());
        return new RegExp(words.join('.*'), 'i');
      });
      this.intentPatterns.set(intent.type, patterns);
    }
  }

  parseIntent(message: string): EducationIntent {
    const normalizedMessage = message.toLowerCase();

    let bestMatch: { type: IntentType; confidence: number; handler: IntentHandler } | null = null;

    for (const handler of EDUCATION_INTENTS) {
      const confidence = this.calculateConfidence(normalizedMessage, handler);

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { type: handler.type, confidence, handler };
      }
    }

    return {
      type: bestMatch?.type || IntentType.COURSE_RECOMMENDATION,
      confidence: bestMatch?.confidence || 0.1,
      entities: this.extractEntities(normalizedMessage),
      parameters: this.extractParameters(normalizedMessage, bestMatch?.handler)
    };
  }

  private calculateConfidence(message: string, handler: IntentHandler): number {
    let maxConfidence = 0;

    for (const pattern of handler.examples) {
      const patternLower = pattern.toLowerCase();

      if (message.includes(patternLower)) {
        return 0.95;
      }

      const patternWords = patternLower.split(' ');
      const messageWords = message.split(' ');

      let matchCount = 0;
      for (const pWord of patternWords) {
        if (messageWords.some(mWord => mWord.includes(pWord) || pWord.includes(mWord))) {
          matchCount++;
        }
      }

      const confidence = matchCount / patternWords.length;
      maxConfidence = Math.max(maxConfidence, confidence);
    }

    return maxConfidence;
  }

  private extractEntities(message: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    const skillKeywords = [
      'python', 'javascript', 'react', 'node', 'aws', 'docker', 'kubernetes',
      'sql', 'machine learning', 'data science', 'web development', 'ux design',
      'project management', 'cybersecurity', 'cloud', 'html', 'css'
    ];

    const foundSkills = skillKeywords.filter(skill =>
      message.includes(skill) || message.split(' ').some(word => word.includes(skill))
    );

    if (foundSkills.length > 0) {
      entities.skills = foundSkills;
    }

    const levels = ['beginner', 'intermediate', 'advanced'];
    const foundLevel = levels.find(level => message.includes(level));
    if (foundLevel) {
      entities.level = foundLevel;
    }

    const domains = ['technology', 'business', 'design', 'language'];
    const foundDomain = domains.find(domain => message.includes(domain));
    if (foundDomain) {
      entities.domain = foundDomain;
    }

    return entities;
  }

  private extractParameters(message: string, handler?: IntentHandler): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (handler) {
      try {
        const result = handler.schema.parse(this.extractEntities(message));
        Object.assign(params, result);
      } catch {
        // Schema validation failed, use raw entities
      }
    }

    const timePatterns = [
      { pattern: /(\d+)\s*hours?\s*per\s*week/i, key: 'hoursPerWeek' },
      { pattern: /(\d+)\s*weeks?/i, key: 'weeks' },
      { pattern: /(\d+)\s*months?/i, key: 'months' }
    ];

    for (const { pattern, key } of timePatterns) {
      const match = message.match(pattern);
      if (match) {
        params[key] = parseInt(match[1]);
      }
    }

    return params;
  }
}

export const intentParser = new EducationIntentParser();
