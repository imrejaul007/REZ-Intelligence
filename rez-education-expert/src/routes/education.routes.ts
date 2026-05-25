import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { expertiseService } from '../services/expertise';
import { courseService } from '../services/courseService';
import { progressService } from '../services/progressService';
import { recommendationsService } from '../services/recommendations';
import { intentParser, IntentType, EDUCATION_INTENTS } from '../intents/educationIntents';
import { ApiResponse, CourseSearchParams } from '../types/tone';
import { EDUCATION_KNOWLEDGE } from '../config/knowledge';

const router = Router();

// Validation schemas
const CourseSearchSchema = z.object({
  query: z.string().optional(),
  domain: z.string().optional(),
  category: z.string().optional(),
  level: z.string().optional(),
  format: z.array(z.string()).optional(),
  certification: z.boolean().optional(),
  sortBy: z.enum(['relevance', 'rating', 'duration', 'popularity']).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional()
});

const LearningPathSchema = z.object({
  targetSkills: z.array(z.string()),
  currentLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  timeCommitment: z.enum(['full-time', 'part-time', 'casual']).optional()
});

const ProgressUpdateSchema = z.object({
  userId: z.string(),
  courseId: z.string(),
  progress: z.number().min(0).max(100).optional(),
  timeSpentMinutes: z.number().optional()
});

const CompareCoursesSchema = z.object({
  courseIds: z.array(z.string()).min(2).max(5)
});

const ChatMessageSchema = z.object({
  userId: z.string(),
  message: z.string().min(1).max(1000),
  context: z.object({
    interests: z.array(z.string()).optional(),
    skillLevel: z.string().optional(),
    goals: z.array(z.string()).optional()
  }).optional()
});

// Health check
router.get('/health', (_req: Request, res: Response) => {
  const response: ApiResponse<{ status: string; timestamp: string }> = {
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: _req.headers['x-request-id'] as string || 'unknown'
    }
  };
  res.json(response);
});

// Course search and browse
router.get('/courses', async (req: Request, res: Response) => {
  try {
    const params = CourseSearchSchema.parse(req.query);

    const searchParams: CourseSearchParams = {
      query: params.query,
      domain: params.domain,
      category: params.category,
      level: params.level,
      format: params.format,
      certification: params.certification,
      sortBy: params.sortBy,
      page: params.page || 1,
      limit: params.limit || 10
    };

    const result = await courseService.searchCourses(searchParams);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Invalid request parameters'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(400).json(response);
  }
});

router.get('/courses/trending', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const trending = await courseService.getTrendingCourses(limit);

    const response: ApiResponse<typeof trending> = {
      success: true,
      data: trending,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get trending courses'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

router.get('/courses/:courseId', async (req: Request, res: Response) => {
  try {
    const course = await courseService.getCourseById(req.params.courseId);

    if (!course) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Course not found'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof course> = {
      success: true,
      data: course,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get course'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

// Recommendations
router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { userId, interests, currentSkills, skillLevel, goals, completedCourses, timeCommitment } = req.body;

    const recommendations = await recommendationsService.getPersonalizedRecommendations({
      userId,
      interests: interests || [],
      currentSkills: currentSkills || [],
      skillLevel: skillLevel || 'beginner',
      goals: goals || [],
      completedCourses: completedCourses || [],
      timeCommitment: timeCommitment || 'part-time'
    });

    const response: ApiResponse<typeof recommendations> = {
      success: true,
      data: recommendations,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get recommendations'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

// Learning paths
router.post('/learning-paths', async (req: Request, res: Response) => {
  try {
    const params = LearningPathSchema.parse(req.body);

    const path = await expertiseService.createLearningPath(
      params.targetSkills,
      params.currentLevel,
      params.timeCommitment || 'part-time'
    );

    const response: ApiResponse<typeof path> = {
      success: true,
      data: path,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Invalid learning path parameters'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(400).json(response);
  }
});

// Progress tracking
router.post('/progress/start', async (req: Request, res: Response) => {
  try {
    const { userId, courseId } = req.body;

    if (!userId || !courseId) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId and courseId are required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(response);
    }

    const progress = await progressService.startCourse(userId, courseId);

    const response: ApiResponse<typeof progress> = {
      success: true,
      data: progress,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to start course'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

router.put('/progress', async (req: Request, res: Response) => {
  try {
    const params = ProgressUpdateSchema.parse(req.body);

    const progress = await progressService.updateProgress(
      params.userId,
      params.courseId,
      params.progress || 0,
      params.timeSpentMinutes
    );

    const response: ApiResponse<typeof progress> = {
      success: true,
      data: progress,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Invalid progress update'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(400).json(response);
  }
});

router.get('/progress/:userId', async (req: Request, res: Response) => {
  try {
    const progress = await progressService.getUserAllProgress(req.params.userId);

    const response: ApiResponse<typeof progress> = {
      success: true,
      data: progress,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get progress'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

router.get('/progress/:userId/stats', async (req: Request, res: Response) => {
  try {
    const stats = await progressService.getLearningStats(req.params.userId);

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get stats'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

// Achievements
router.get('/achievements/:userId', async (req: Request, res: Response) => {
  try {
    const achievements = await progressService.getAchievements(req.params.userId);

    const response: ApiResponse<typeof achievements> = {
      success: true,
      data: achievements,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get achievements'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

// Course comparison
router.post('/courses/compare', async (req: Request, res: Response) => {
  try {
    const params = CompareCoursesSchema.parse(req.body);

    const comparison = await expertiseService.compareCourses(params.courseIds);

    const response: ApiResponse<typeof comparison> = {
      success: true,
      data: comparison,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Invalid comparison request'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(400).json(response);
  }
});

// Skill assessment
router.post('/skills/assess', async (req: Request, res: Response) => {
  try {
    const { userId, skills, targetRole } = req.body;

    if (!userId || !skills || !Array.isArray(skills)) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId and skills array are required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(response);
    }

    const assessment = await recommendationsService.assessSkillLevel(userId, skills);

    const response: ApiResponse<typeof assessment> = {
      success: true,
      data: assessment,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to assess skills'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

// Skill gap analysis
router.post('/skills/gap-analysis', async (req: Request, res: Response) => {
  try {
    const { userId, targetRole } = req.body;

    if (!userId || !targetRole) {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId and targetRole are required'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        }
      };
      return res.status(400).json(response);
    }

    const analysis = await recommendationsService.getSkillGapAnalysis(userId, targetRole);

    const response: ApiResponse<typeof analysis> = {
      success: true,
      data: analysis,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to perform gap analysis'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

// Chat/Intent handling
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const params = ChatMessageSchema.parse(req.body);

    const intent = intentParser.parseIntent(params.message);

    let response: unknown = {
      intent: intent.type,
      confidence: intent.confidence,
      message: ''
    };

    switch (intent.type) {
      case IntentType.COURSE_RECOMMENDATION:
        const recommendations = await recommendationsService.getPersonalizedRecommendations({
          userId: params.userId,
          interests: params.context?.interests || intent.entities.skills || [],
          currentSkills: [],
          skillLevel: params.context?.skillLevel || 'beginner',
          goals: params.context?.goals || [],
          completedCourses: []
        });
        response.data = recommendations;
        response.message = `Based on your interests, here are some courses I recommend.`;
        break;

      case IntentType.LEARNING_PATH:
        const path = await expertiseService.createLearningPath(
          intent.entities.skills || params.context?.interests || [],
          params.context?.skillLevel as unknown || 'beginner',
          'part-time'
        );
        response.data = path;
        response.message = `Here's a personalized learning path for you.`;
        break;

      case IntentType.COURSE_SEARCH:
        const searchResult = await courseService.searchCourses({
          query: params.message,
          limit: 10
        });
        response.data = searchResult;
        response.message = `I found ${searchResult.total} courses matching your search.`;
        break;

      case IntentType.CERTIFICATION_INFO:
        response.data = { certifications: EDUCATION_KNOWLEDGE.domains };
        response.message = `Here's information about certifications available.`;
        break;

      case IntentType.STUDY_TIPS:
        response.data = { tips: EDUCATION_KNOWLEDGE.studyTips };
        response.message = `Here are some study tips to help you succeed!`;
        break;

      case IntentType.MOTIVATION:
        response.message = `Remember, every expert was once a beginner! Keep going - you're doing amazing!`;
        break;

      default:
        response.message = `I'm here to help with your learning journey. Ask me about courses, learning paths, or certifications!`;
    }

    const apiResponse: ApiResponse<typeof response> = {
      success: true,
      data: response,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(apiResponse);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process message'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

// Domains listing
router.get('/domains', async (_req: Request, res: Response) => {
  try {
    const domains = await courseService.getDomains();

    const response: ApiResponse<typeof domains> = {
      success: true,
      data: domains,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: _req.headers['x-request-id'] as string || 'unknown'
      }
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get domains'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: _req.headers['x-request-id'] as string || 'unknown'
      }
    };
    res.status(500).json(response);
  }
});

// Intents listing
router.get('/intents', (_req: Request, res: Response) => {
  const intents = EDUCATION_INTENTS.map(intent => ({
    type: intent.type,
    description: intent.description,
    examples: intent.examples.slice(0, 3)
  }));

  const response: ApiResponse<typeof intents> = {
    success: true,
    data: intents,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: _req.headers['x-request-id'] as string || 'unknown'
    }
  };

  res.json(response);
});

export default router;
