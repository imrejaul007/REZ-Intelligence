/**
 * Career Routes
 * API endpoints for Career Graph operations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { careerGraphService } from '../../services/careerGraph.js';
import { logger } from '../../logger.js';

const router = Router();

// ─── Validation Schemas ────────────────────────────────────────────────────────

const educationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().min(1),
  level: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  grade: z.string().optional(),
  activities: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const experienceSchema = z.object({
  company: z.string().min(1),
  companyId: z.string().optional(),
  title: z.string().min(1),
  type: z.string(),
  location: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  salary: z.object({
    amount: z.number(),
    currency: z.string().default('INR'),
    period: z.enum(['monthly', 'yearly']).default('yearly'),
  }).optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

const skillSchema = z.object({
  name: z.string().min(1),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('intermediate'),
  yearsOfExperience: z.number().optional(),
  verified: z.boolean().default(false),
  endorsements: z.number().default(0),
});

const certificationSchema = z.object({
  name: z.string().min(1),
  issuer: z.string().min(1),
  issueDate: z.string(),
  expiryDate: z.string().optional(),
  credentialId: z.string().optional(),
  credentialUrl: z.string().url().optional(),
  verified: z.boolean().default(false),
});

const internshipSchema = z.object({
  company: z.string().min(1),
  companyId: z.string().optional(),
  role: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  stipend: z.number().optional(),
  offer: z.enum(['pre_conversion', 'conversion', 'rejected', 'pending']).optional(),
  converted: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
});

const updatePreferencesSchema = z.object({
  desiredRoles: z.array(z.string()).optional(),
  desiredIndustries: z.array(z.string()).optional(),
  desiredLocations: z.array(z.string()).optional(),
  workType: z.array(z.string()).optional(),
  remote: z.boolean().optional(),
  willingToRelocate: z.boolean().optional(),
  noticePeriod: z.string().optional(),
  jobSearchStatus: z.enum(['active', 'passive', 'not_looking']).optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/career/:userId
 * Get career graph for a user
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const career = await careerGraphService.getCareerGraph(userId);

    if (!career) {
      return res.status(404).json({ error: 'Career profile not found' });
    }

    return res.json({ success: true, data: career });
  } catch (error) {
    logger.error('Error getting career graph:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/career/:userId/analytics
 * Get career analytics
 */
router.get('/:userId/analytics', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const analytics = await careerGraphService.getCareerAnalytics(userId);

    return res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error('Error getting career analytics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/career/:userId/profile
 * Update career profile
 */
router.post('/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const validation = updateProfileSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const career = await careerGraphService.updateCareerProfile(userId, validation.data);

    return res.json({ success: true, data: career });
  } catch (error) {
    logger.error('Error updating career profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/career/:userId/preferences
 * Update career preferences
 */
router.post('/:userId/preferences', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const validation = updatePreferencesSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const career = await careerGraphService.updatePreferences(userId, validation.data);

    return res.json({ success: true, data: career });
  } catch (error) {
    logger.error('Error updating preferences:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/career/:userId/education
 * Add education
 */
router.post('/:userId/education', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const validation = educationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const career = await careerGraphService.addEducation(userId, validation.data);

    return res.json({
      success: true,
      data: career,
      message: 'Education added successfully',
    });
  } catch (error) {
    logger.error('Error adding education:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/career/:userId/experience
 * Add experience
 */
router.post('/:userId/experience', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const validation = experienceSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const career = await careerGraphService.addExperience(userId, validation.data);

    return res.json({
      success: true,
      data: career,
      message: 'Experience added successfully',
    });
  } catch (error) {
    logger.error('Error adding experience:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/career/:userId/skills
 * Add skill
 */
router.post('/:userId/skills', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const validation = skillSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const career = await careerGraphService.addSkill(userId, validation.data);

    return res.json({
      success: true,
      data: career,
      message: 'Skill added successfully',
    });
  } catch (error) {
    logger.error('Error adding skill:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/career/:userId/certifications
 * Add certification
 */
router.post('/:userId/certifications', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const validation = certificationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const career = await careerGraphService.addCertification(userId, validation.data);

    return res.json({
      success: true,
      data: career,
      message: 'Certification added successfully',
    });
  } catch (error) {
    logger.error('Error adding certification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/career/:userId/internships
 * Add internship
 */
router.post('/:userId/internships', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const validation = internshipSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const career = await careerGraphService.addInternship(userId, validation.data);

    return res.json({
      success: true,
      data: career,
      message: 'Internship added successfully',
    });
  } catch (error) {
    logger.error('Error adding internship:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/career/search/skills
 * Search candidates by skills
 */
router.get('/search/skills', async (req: Request, res: Response) => {
  try {
    const { skills, limit, skip, verifiedOnly } = req.query;

    if (!skills) {
      return res.status(400).json({ error: 'Skills parameter required' });
    }

    const skillList = (skills as string).split(',').map((s) => s.trim());

    const candidates = await careerGraphService.findBySkills(skillList, {
      limit: limit ? parseInt(limit as string) : undefined,
      skip: skip ? parseInt(skip as string) : undefined,
      verifiedOnly: verifiedOnly === 'true',
    });

    return res.json({ success: true, data: candidates });
  } catch (error) {
    logger.error('Error searching by skills:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
