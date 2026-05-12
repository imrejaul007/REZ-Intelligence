import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  infoAgent,
  InfoCategory,
  InfoResponse
} from '../services/infoAgent';
import {
  searchKnowledgeBase,
  getFaqs,
  getPolicies,
  getArticles,
  getGuides,
  getPolicyById,
  getFaqById,
  getArticleById,
  getGuideById,
  getFaqsByCategory,
  getPoliciesByCategory
} from '../services/knowledgeBase';
import { logger } from '../services/infoAgent';

const router = Router();

const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        });
      }
      next(error);
    }
  };
};

const querySchema = z.object({
  sessionId: z.string().optional(),
  query: z.string().min(1).max(500)
});

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  category: z.nativeEnum(InfoCategory).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional()
});

const categorySchema = z.object({
  category: z.nativeEnum(InfoCategory)
});

router.post('/query', validateRequest(querySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId: providedSessionId, query } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logger.info('Info query request received', { sessionId, queryLength: query.length });

    const response: InfoResponse = await infoAgent.processQuery(query, sessionId);

    res.json({
      success: true,
      data: {
        response: response.message,
        faqs: response.faqs,
        policies: response.policies,
        articles: response.articles,
        guides: response.guides,
        data: response.data
      },
      meta: {
        sessionId,
        processingTimeMs: response.processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Query endpoint error', { error });
    next(error);
  }
});

router.post('/search', validateRequest(searchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, category, tags, limit } = req.body;

    logger.info('Search request received', { query, category, limit });

    const results = await searchKnowledgeBase(query);

    let faqs = results.faqs;
    let articles = results.articles;
    let policies = results.policies;

    if (category) {
      faqs = faqs.filter(f => f.category === category);
      articles = articles.filter(a => a.category === category);
      policies = policies.filter(p => p.category === category);
    }

    if (tags && tags.length > 0) {
      faqs = faqs.filter(f => f.tags.some(t => tags.includes(t)));
      articles = articles.filter(a => a.tags.some(t => tags.includes(t)));
    }

    const finalLimit = limit || 20;
    faqs = faqs.slice(0, finalLimit);
    articles = articles.slice(0, finalLimit);
    policies = policies.slice(0, finalLimit);

    res.json({
      success: true,
      data: {
        faqs,
        articles,
        policies,
        counts: {
          faqs: faqs.length,
          articles: articles.length,
          policies: policies.length,
          total: faqs.length + articles.length + policies.length
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/faqs', validateRequest(searchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, category, tags, limit } = req.body;

    let faqs = await getFaqs(query);

    if (category) {
      faqs = faqs.filter(f => f.category === category);
    }

    if (tags && tags.length > 0) {
      faqs = faqs.filter(f => f.tags.some(t => tags.includes(t)));
    }

    const finalLimit = limit || 20;
    faqs = faqs.slice(0, finalLimit);

    res.json({
      success: true,
      data: {
        faqs,
        count: faqs.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/faqs/popular', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const faqs = await infoAgent.getPopularFaqs(limit);

    res.json({
      success: true,
      data: {
        faqs,
        count: faqs.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/faqs/category/:category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.params;
    const categoryEnum = category.toUpperCase() as InfoCategory;

    if (!Object.values(InfoCategory).includes(categoryEnum)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: `Invalid category: ${category}`
        }
      });
    }

    const faqs = getFaqsByCategory(categoryEnum);

    res.json({
      success: true,
      data: {
        faqs,
        count: faqs.length,
        category: categoryEnum
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/faqs/:faqId', async (req: Request, res: Response) => {
  const { faqId } = req.params;
  const faq = getFaqById(faqId);

  if (!faq) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `FAQ with ID ${faqId} not found`
      }
    });
  }

  infoAgent.trackFaqView(faqId);

  res.json({
    success: true,
    data: { faq }
  });
});

router.post('/faqs/:faqId/helpful', async (req: Request, res: Response) => {
  const { faqId } = req.params;
  const faq = getFaqById(faqId);

  if (!faq) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `FAQ with ID ${faqId} not found`
      }
    });
  }

  await infoAgent.markFaqHelpful(faqId);

  res.json({
    success: true,
    data: {
      message: 'Thank you for your feedback!'
    }
  });
});

router.post('/policies', validateRequest(searchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, category, tags, limit } = req.body;

    let policies = getPolicies(query);

    if (category) {
      policies = policies.filter(p => p.category === category);
    }

    const finalLimit = limit || 20;
    policies = policies.slice(0, finalLimit);

    res.json({
      success: true,
      data: {
        policies,
        count: policies.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/policies/category/:category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category } = req.params;
    const categoryEnum = category.toUpperCase() as InfoCategory;

    if (!Object.values(InfoCategory).includes(categoryEnum)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: `Invalid category: ${category}`
        }
      });
    }

    const policies = getPoliciesByCategory(categoryEnum);

    res.json({
      success: true,
      data: {
        policies,
        count: policies.length,
        category: categoryEnum
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/policies/:policyId', async (req: Request, res: Response) => {
  const { policyId } = req.params;
  const policy = getPolicyById(policyId);

  if (!policy) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Policy with ID ${policyId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { policy }
  });
});

router.post('/articles', validateRequest(searchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, category, tags, limit } = req.body;

    let articles = getArticles(query);

    if (category) {
      articles = articles.filter(a => a.category === category);
    }

    if (tags && tags.length > 0) {
      articles = articles.filter(a => a.tags.some(t => tags.includes(t)));
    }

    const finalLimit = limit || 20;
    articles = articles.slice(0, finalLimit);

    res.json({
      success: true,
      data: {
        articles,
        count: articles.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/articles/popular', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const articles = await infoAgent.getPopularArticles(limit);

    res.json({
      success: true,
      data: {
        articles,
        count: articles.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/articles/:articleId', async (req: Request, res: Response) => {
  const { articleId } = req.params;
  const article = getArticleById(articleId);

  if (!article) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Article with ID ${articleId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { article }
  });
});

router.post('/guides', validateRequest(searchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, category, tags, limit } = req.body;

    let guides = getGuides(query);

    if (category) {
      guides = guides.filter(g => g.category === category);
    }

    if (tags && tags.length > 0) {
      guides = guides.filter(g => g.tags.some(t => tags.includes(t)));
    }

    const finalLimit = limit || 20;
    guides = guides.slice(0, finalLimit);

    res.json({
      success: true,
      data: {
        guides,
        count: guides.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/guides/:guideId', async (req: Request, res: Response) => {
  const { guideId } = req.params;
  const guide = getGuideById(guideId);

  if (!guide) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Guide with ID ${guideId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { guide }
  });
});

router.get('/categories', async (req: Request, res: Response) => {
  const categories = Object.values(InfoCategory).map(cat => ({
    value: cat,
    label: formatCategoryLabel(cat),
    description: getCategoryDescription(cat)
  }));

  res.json({
    success: true,
    data: {
      categories
    }
  });
});

function formatCategoryLabel(category: InfoCategory): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getCategoryDescription(category: InfoCategory): string {
  const descriptions: Record<InfoCategory, string> = {
    [InfoCategory.BOOKING]: 'Information about booking trips and reservations',
    [InfoCategory.PAYMENT]: 'Payment methods, pricing, and currency information',
    [InfoCategory.CANCELLATION]: 'Cancellation policies and procedures',
    [InfoCategory.REFUND]: 'Refund eligibility, timelines, and requests',
    [InfoCategory.SHIPPING]: 'Delivery and shipping information',
    [InfoCategory.ACCOUNT]: 'Account management and settings',
    [InfoCategory.LOYALTY]: 'Loyalty program and rewards',
    [InfoCategory.TECHNICAL]: 'Technical support and troubleshooting',
    [InfoCategory.GENERAL]: 'General information and announcements',
    [InfoCategory.POLICIES]: 'Terms, privacy, and legal policies',
    [InfoCategory.CONTACT]: 'Contact information and support channels',
    [InfoCategory.FAQ]: 'Frequently asked questions'
  };
  return descriptions[category];
}

export { router as infoRouter };
