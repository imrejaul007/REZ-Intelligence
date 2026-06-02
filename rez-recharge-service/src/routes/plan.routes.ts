import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Plan, IPlan, MobileOperator, DTHOperator, RechargeType } from '../models/recharge.model.js';

const router = Router();

// Validation schemas
const createPlanSchema = z.object({
  planId: z.string().min(3).max(50),
  operator: z.string(),
  type: z.nativeEnum(RechargeType),
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  amount: z.number().min(0),
  validityDays: z.number().int().positive().optional(),
  data: z.string().optional(),
  talktime: z.string().optional(),
  sms: z.string().optional(),
  voice: z.string().optional(),
  benefits: z.array(z.string()).default([]),
  category: z.string().min(2).max(50),
  isActive: z.boolean().default(true),
});

const updatePlanSchema = createPlanSchema.partial();

// GET /api/plans - Get all plans with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { operator, type, category, isActive, page, limit } = req.query;

    // Build query filter
    const filter: Record<string, unknown> = {};

    if (operator) {
      filter.operator = operator;
    }
    if (type) {
      filter.type = type;
    }
    if (category) {
      filter.category = category;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;
    const skip = (pageNum - 1) * limitNum;

    const [plans, total] = await Promise.all([
      Plan.find(filter)
        .sort({ amount: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Plan.countDocuments(filter),
    ]);

    res.json({
      success: true,
      plans,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/plans/operators - Get available operators with their plans
router.get('/operators', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    const filter: Record<string, unknown> = { isActive: true };
    if (type) {
      filter.type = type;
    }

    const operators = await Plan.distinct('operator', filter);

    const result = await Promise.all(
      operators.map(async (operator) => {
        const count = await Plan.countDocuments({ ...filter, operator });
        const plans = await Plan.find({ ...filter, operator })
          .sort({ amount: 1 })
          .limit(5)
          .lean();

        return {
          operator,
          planCount: count,
          popularPlans: plans.map((p) => ({
            planId: p.planId,
            name: p.name,
            amount: p.amount,
            validityDays: p.validityDays,
          })),
        };
      })
    );

    res.json({
      success: true,
      operators: result,
    });
  } catch (error) {
    console.error('Get operators error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/plans/categories - Get available categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { type, operator } = req.query;

    const filter: Record<string, unknown> = { isActive: true };
    if (type) {
      filter.type = type;
    }
    if (operator) {
      filter.operator = operator;
    }

    const categories = await Plan.distinct('category', filter);

    const result = await Promise.all(
      categories.map(async (category) => {
        const count = await Plan.countDocuments({ ...filter, category });
        return { category, planCount: count };
      })
    );

    res.json({
      success: true,
      categories: result,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/plans/mobile/:operator - Get mobile plans by operator
router.get('/mobile/:operator', async (req: Request, res: Response) => {
  try {
    const { operator } = req.params;
    const { category, minAmount, maxAmount, page, limit } = req.query;

    // Validate operator
    const validOperators = Object.values(MobileOperator);
    if (!validOperators.includes(operator.toLowerCase() as MobileOperator)) {
      res.status(400).json({
        success: false,
        message: 'Invalid mobile operator',
        validOperators,
      });
      return;
    }

    // Build query filter
    const filter: Record<string, unknown> = {
      operator: operator.toLowerCase(),
      type: RechargeType.MOBILE,
      isActive: true,
    };

    if (category) {
      filter.category = category;
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) {
        (filter.amount as Record<string, number>).$gte = parseFloat(minAmount as string);
      }
      if (maxAmount) {
        (filter.amount as Record<string, number>).$lte = parseFloat(maxAmount as string);
      }
    }

    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;
    const skip = (pageNum - 1) * limitNum;

    const [plans, total] = await Promise.all([
      Plan.find(filter)
        .sort({ amount: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Plan.countDocuments(filter),
    ]);

    res.json({
      success: true,
      operator,
      plans,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get mobile plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/plans/dth/:operator - Get DTH plans by operator
router.get('/dth/:operator', async (req: Request, res: Response) => {
  try {
    const { operator } = req.params;
    const { category, minAmount, maxAmount, page, limit } = req.query;

    // Validate operator
    const validOperators = Object.values(DTHOperator);
    if (!validOperators.includes(operator.toLowerCase() as DTHOperator)) {
      res.status(400).json({
        success: false,
        message: 'Invalid DTH operator',
        validOperators,
      });
      return;
    }

    // Build query filter
    const filter: Record<string, unknown> = {
      operator: operator.toLowerCase(),
      type: RechargeType.DTH,
      isActive: true,
    };

    if (category) {
      filter.category = category;
    }
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) {
        (filter.amount as Record<string, number>).$gte = parseFloat(minAmount as string);
      }
      if (maxAmount) {
        (filter.amount as Record<string, number>).$lte = parseFloat(maxAmount as string);
      }
    }

    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;
    const skip = (pageNum - 1) * limitNum;

    const [plans, total] = await Promise.all([
      Plan.find(filter)
        .sort({ amount: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Plan.countDocuments(filter),
    ]);

    res.json({
      success: true,
      operator,
      plans,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get DTH plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// GET /api/plans/:planId - Get plan by ID
router.get('/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findOne({ planId }).lean();

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/plans - Create a new plan
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createPlanSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    // Check if plan already exists
    const existingPlan = await Plan.findOne({ planId: validation.data.planId });
    if (existingPlan) {
      res.status(409).json({
        success: false,
        message: 'Plan with this ID already exists',
      });
      return;
    }

    const plan = new Plan(validation.data);
    await plan.save();

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      plan,
    });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PUT /api/plans/:planId - Update a plan
router.put('/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const validation = updatePlanSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const plan = await Plan.findOneAndUpdate(
      { planId },
      { $set: validation.data },
      { new: true, runValidators: true }
    );

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Plan updated successfully',
      plan,
    });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// DELETE /api/plans/:planId - Delete a plan
router.delete('/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findOneAndDelete({ planId });

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/plans/seed - Seed initial plans (for development)
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const existingCount = await Plan.countDocuments();
    if (existingCount > 0) {
      res.status(400).json({
        success: false,
        message: 'Plans already exist. Clear database first.',
        count: existingCount,
      });
      return;
    }

    // Mobile plans
    const mobilePlans = [
      // Airtel Plans
      { planId: 'AIRTEL_199', operator: MobileOperator.AIRTEL, type: RechargeType.MOBILE, name: 'Airtel Rs 199 Plan', description: 'Unlimited calls, 1.5GB/day data, 100 SMS/day', amount: 199, validityDays: 28, data: '1.5GB/day', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '1.5GB Daily Data', '100 SMS Daily', 'Free Hellotunes'], category: 'popular' },
      { planId: 'AIRTEL_299', operator: MobileOperator.AIRTEL, type: RechargeType.MOBILE, name: 'Airtel Rs 299 Plan', description: 'Unlimited calls, 2GB/day data, 100 SMS/day', amount: 299, validityDays: 56, data: '2GB/day', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '2GB Daily Data', '100 SMS Daily', 'Amazon Prime Subscription'], category: 'popular' },
      { planId: 'AIRTEL_499', operator: MobileOperator.AIRTEL, type: RechargeType.MOBILE, name: 'Airtel Rs 499 Plan', description: 'Unlimited calls, 3GB/day data, 100 SMS/day', amount: 499, validityDays: 84, data: '3GB/day', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '3GB Daily Data', '100 SMS Daily', 'Disney+ Hotstar'], category: 'premium' },

      // Jio Plans
      { planId: 'JIO_199', operator: MobileOperator.JIO, type: RechargeType.MOBILE, name: 'Jio Rs 199 Plan', description: 'Unlimited calls, 1.5GB/day data, 100 SMS/day', amount: 199, validityDays: 28, data: '1.5GB/day', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '1.5GB Daily Data', '100 SMS Daily', 'JioTV Access'], category: 'popular' },
      { planId: 'JIO_299', operator: MobileOperator.JIO, type: RechargeType.MOBILE, name: 'Jio Rs 299 Plan', description: 'Unlimited calls, 2GB/day data, 100 SMS/day', amount: 299, validityDays: 30, data: '2GB/day', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '2GB Daily Data', '100 SMS Daily', 'JioTV + JioCinema'], category: 'popular' },
      { planId: 'JIO_666', operator: MobileOperator.JIO, type: RechargeType.MOBILE, name: 'Jio Rs 666 Plan', description: 'Unlimited calls, 1.5GB/day data, 100 SMS/day', amount: 666, validityDays: 84, data: '1.5GB/day', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '1.5GB Daily Data', '100 SMS Daily', 'All Jio Apps Premium'], category: 'premium' },

      // Vi Plans
      { planId: 'VI_199', operator: MobileOperator.VI, type: RechargeType.MOBILE, name: 'Vi Rs 199 Plan', description: 'Unlimited calls, 1.5GB/day data, 100 SMS/day', amount: 199, validityDays: 28, data: '1.5GB/day', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '1.5GB Daily Data', '100 SMS Daily', 'Vi Movies & TV'], category: 'popular' },
      { planId: 'VI_349', operator: MobileOperator.VI, type: RechargeType.MOBILE, name: 'Vi Rs 349 Plan', description: 'Unlimited calls, 2GB/day data, 100 SMS/day', amount: 349, validityDays: 56, data: '2GB/day', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '2GB Daily Data', '100 SMS Daily', 'Weekend Data Rollover'], category: 'value' },

      // BSNL Plans
      { planId: 'BSNL_187', operator: MobileOperator.BSNL, type: RechargeType.MOBILE, name: 'BSNL Rs 187 Plan', description: 'Unlimited calls, 2GB data, 100 SMS/day', amount: 187, validityDays: 28, data: '2GB', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '2GB Total Data', '100 SMS Daily'], category: 'budget' },
      { planId: 'BSNL_399', operator: MobileOperator.BSNL, type: RechargeType.MOBILE, name: 'BSNL Rs 399 Plan', description: 'Unlimited calls, 3GB/month data, 100 SMS/day', amount: 399, validityDays: 90, data: '3GB/month', talktime: 'Unlimited', sms: '100/day', benefits: ['Unlimited Local/STD Calls', '3GB Monthly Data', '100 SMS Daily', 'BSNL Tunes'], category: 'value' },
    ];

    // DTH Plans
    const dthPlans = [
      // Tata Sky Plans
      { planId: 'TATA_SKY_199', operator: DTHOperator.TATA_SKY, type: RechargeType.DTH, name: 'Tata Sky Rs 199 Pack', description: 'Basic channels pack', amount: 199, validityDays: 30, benefits: ['All Hindi Basic Channels', 'Regional Channels'], category: 'basic' },
      { planId: 'TATA_SKY_499', operator: DTHOperator.TATA_SKY, type: RechargeType.DTH, name: 'Tata Sky Rs 499 Pack', description: 'Popular channels pack', amount: 499, validityDays: 30, benefits: ['All Hindi Basic Channels', 'English Entertainment', 'Sports Channels'], category: 'popular' },
      { planId: 'TATA_SKY_899', operator: DTHOperator.TATA_SKY, type: RechargeType.DTH, name: 'Tata Sky Rs 899 Pack', description: 'Premium channels pack', amount: 899, validityDays: 30, benefits: ['All Channels', 'HD Channels', 'Movie Channels', 'Sports Premium'], category: 'premium' },

      // Dish TV Plans
      { planId: 'DISH_TV_185', operator: DTHOperator.DISH_TV, type: RechargeType.DTH, name: 'Dish TV Rs 185 Pack', description: 'Entry level pack', amount: 185, validityDays: 30, benefits: ['Hindi Basic Channels', 'Regional Channels'], category: 'basic' },
      { planId: 'DISH_TV_440', operator: DTHOperator.DISH_TV, type: RechargeType.DTH, name: 'Dish TV Rs 440 Pack', description: 'Value pack', amount: 440, validityDays: 30, benefits: ['All Hindi Channels', 'Sports Channels', 'English Entertainment'], category: 'value' },

      // Airtel Digital Plans
      { planId: 'AIRTEL_DTH_249', operator: DTHOperator.AIRTEL_DIGITAL, type: RechargeType.DTH, name: 'Airtel Digital Rs 249 Pack', description: 'Basic pack', amount: 249, validityDays: 30, benefits: ['Hindi Basic Channels', 'Regional'], category: 'basic' },
      { planId: 'AIRTEL_DTH_549', operator: DTHOperator.AIRTEL_DIGITAL, type: RechargeType.DTH, name: 'Airtel Digital Rs 549 Pack', description: 'Family pack', amount: 549, validityDays: 30, benefits: ['All Hindi Channels', 'English Entertainment', 'Kids Channels'], category: 'popular' },

      // Videocon Plans
      { planId: 'VIDEOCON_199', operator: DTHOperator.VIDEOCON, type: RechargeType.DTH, name: 'Videocon Rs 199 Pack', description: 'Basic pack', amount: 199, validityDays: 30, benefits: ['Hindi Basic Channels', 'Regional'], category: 'basic' },
      { planId: 'VIDEOCON_475', operator: DTHOperator.VIDEOCON, type: RechargeType.DTH, name: 'Videocon Rs 475 Pack', description: 'Premium pack', amount: 475, validityDays: 30, benefits: ['All Hindi Channels', 'English', 'Movies'], category: 'premium' },
    ];

    const allPlans = [...mobilePlans, ...dthPlans];
    await Plan.insertMany(allPlans);

    res.status(201).json({
      success: true,
      message: `Seeded ${allPlans.length} plans successfully`,
      counts: {
        mobile: mobilePlans.length,
        dth: dthPlans.length,
      },
    });
  } catch (error) {
    console.error('Seed plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
