export interface ToneConfig {
  primary: string;
  secondary: string;
  tertiary: string;
  responsePatterns: {
    greeting: string[];
    encouragement: string[];
    progress: string[];
    celebration: string[];
    guidance: string[];
    patience: string[];
  };
  emoji: {
    useEmoji: boolean;
    mappings: Record<string, string>;
  };
  formality: string;
  detailLevel: string;
}

export interface EducationIntent {
  type: string;
  confidence: number;
  entities: Record<string, unknown>;
  parameters: Record<string, unknown>;
}

export interface CourseRecommendation {
  courseId: string;
  title: string;
  description: string;
  provider: string;
  rating: number;
  duration: string;
  level: string;
  skills: string[];
  certification?: string;
  url?: string;
  matchScore: number;
  reason: string;
}

export interface LearningPath {
  pathId: string;
  title: string;
  description: string;
  totalDuration: string;
  skillLevel: string;
  steps: LearningPathStep[];
  certifications: string[];
  careerOutcomes: string[];
}

export interface LearningPathStep {
  order: number;
  courseId: string;
  title: string;
  duration: string;
  skills: string[];
  isRequired: boolean;
}

export interface UserProgress {
  userId: string;
  courseId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  lastAccessedAt?: Date;
  timeSpent: number;
  achievements: string[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  criteria: {
    type: string;
    value: number;
  };
}

export interface SkillProfile {
  userId: string;
  currentSkills: SkillRating[];
  targetSkills: string[];
  assessedAt: Date;
}

export interface SkillRating {
  skillId: string;
  skillName: string;
  level: number;
  endorsements: number;
}

export interface CourseSearchParams {
  query?: string;
  domain?: string;
  category?: string;
  level?: string;
  format?: string[];
  duration?: { min?: number; max?: number };
  certification?: boolean;
  sortBy?: 'relevance' | 'rating' | 'duration' | 'popularity';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  courses: CourseRecommendation[];
  total: number;
  page: number;
  totalPages: number;
  filters: {
    availableDomains: string[];
    availableLevels: string[];
    availableFormats: string[];
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  sessionId: string;
  userId: string;
  messages: ChatMessage[];
  context: {
    interests: string[];
    skillLevel: string;
    goals: string[];
    completedCourses: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}
