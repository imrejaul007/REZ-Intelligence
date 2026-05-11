import { Router, Request, Response } from 'express';
import { financeIntelligence } from '../services/financeIntelligence';
import { validateRequest, z } from '../schemas';

const router = Router();

// Validation schemas
const userIdParams = z.object({
  userId: z.string().min(1),
});

const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

router.get('/finance/profile/:userId',
  validateRequest({ params: userIdParams }),
  async (req: Request, res: Response) => {
    try {
      const profile = await financeIntelligence.analyzeFinancialIntent(req.params.userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Analysis failed' });
    }
  }
);

router.get('/finance/ready-users',
  validateRequest({ query: paginationQuery }),
  async (req: Request, res: Response) => {
    try {
      const users = await financeIntelligence.identifyCreditReadyUsers();
      res.json({ success: true, data: { count: users.length, users } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Query failed' });
    }
  }
);

router.get('/finance/risk/:userId',
  validateRequest({ params: userIdParams }),
  async (req: Request, res: Response) => {
    try {
      const risk = await financeIntelligence.predictDefaultRisk(req.params.userId);
      res.json({ success: true, data: risk });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Risk prediction failed' });
    }
  }
);

export default router;
