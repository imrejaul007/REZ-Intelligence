/**
 * REZ CorpPerks Bridge
 *
 * Integrates CorpPerks (enterprise/HR) with REZ Consumer ecosystem
 *
 * Flow:
 * CorpPerks Employee → Works → Earns Points → Sync to REZ Wallet
 *                    → Achievement → Sync to Karma Score
 *                    → Milestone → Cross-brand reward
 */

import express, { Request, Response } from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '4099', 10);

app.use(express.json());

// ============================================
// SERVICE URLs
// ============================================

const SERVICES = {
  loyalty: process.env.LOYALTY_URL || 'http://localhost:4097',
  wallet: process.env.WALLET_URL || 'http://localhost:4004',
  karma: process.env.KARMA_URL || 'http://localhost:3009',
  ecosystem: process.env.ECOSYSTEM_URL || 'http://localhost:4105',
};

// ============================================
// TYPES
// ============================================

interface Employee {
  id: string;
  corpperksId: string;
  email: string;
  company: string;
  department: string;
  rezuId?: string;
  karmaId?: string;
}

interface CorpperksEvent {
  employeeId: string;
  type: 'achievement' | 'milestone' | 'completion' | 'referral';
  data: Record<string, unknown>;
  timestamp: Date;
}

// In-memory stores
const employees = new Map<string, Employee>();
const events: CorpperksEvent[] = [];

// ============================================
// CORPPERKS → REZ SYNC
// ============================================

/**
 * Sync employee from CorpPerks to REZ
 */
async function syncEmployee(employee: Employee): Promise<void> {
  employees.set(employee.id, employee);

  // Send to ecosystem hub for unified profile
  await sendToService(`${SERVICES.ecosystem}/api/v1/signals`, {
    userId: employee.rezuId || employee.id,
    source: 'CORPPERKS',
    action: 'employee_sync',
    data: {
      company: employee.company,
      department: employee.department,
      corpperksId: employee.corpperksId
    }
  });
}

/**
 * Process CorpPerks event and sync to REZ
 */
async function processEvent(event: CorpperksEvent): Promise<void> {
  events.push(event);
  const employee = employees.get(event.employeeId);

  if (!employee) return;

  const userId = employee.rezuId || employee.id;

  switch (event.type) {
    case 'achievement':
      // Award loyalty coins
      await awardLoyaltyCoins(userId, 50, 'CorpPerks achievement');
      // Update karma score
      await updateKarmaScore(userId, 30);
      break;

    case 'milestone':
      // Award bonus coins
      await awardLoyaltyCoins(userId, 200, 'CorpPerks milestone');
      // Update karma
      await updateKarmaScore(userId, 100);
      break;

    case 'completion':
      // Small reward
      await awardLoyaltyCoins(userId, 25, 'Task completion');
      break;

    case 'referral':
      // Big reward for successful referral
      await awardLoyaltyCoins(userId, 500, 'Successful referral');
      await updateKarmaScore(userId, 150);
      break;
  }

  // Send to ecosystem
  await sendToService(`${SERVICES.ecosystem}/api/v1/signals`, {
    userId,
    source: 'CORPPERKS',
    action: event.type,
    data: event.data
  });
}

// ============================================
// LOYALTY OPERATIONS
// ============================================

async function awardLoyaltyCoins(userId: string, amount: number, description: string): Promise<void> {
  await sendToService(`${SERVICES.loyalty}/api/v1/earn`, {
    userId,
    amount,
    source: 'CORPPERKS',
    description
  });
}

async function updateKarmaScore(userId: string, points: number): Promise<void> {
  await sendToService(`${SERVICES.karma}/api/karma/earn`, {
    userId,
    points,
    source: 'corpperks'
  });
}

// ============================================
// HELPER
// ============================================

async function sendToService(url: string, data: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error(`Failed to send to ${url}:`, error);
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'corpperks-bridge',
    connectedServices: Object.keys(SERVICES),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// CORPPERKS WEBHOOKS
// ============================================

// Receive employee sync from CorpPerks
app.post('/api/v1/webhooks/employee', async (req: Request, res: Response) => {
  const { id, corpperksId, email, company, department, rezuId, karmaId } = req.body;

  const employee: Employee = {
    id: id || `emp_${Date.now()}`,
    corpperksId,
    email,
    company,
    department,
    rezuId,
    karmaId
  };

  await syncEmployee(employee);

  res.json({ success: true, employee });
});

// Receive events from CorpPerks
app.post('/api/v1/webhooks/event', async (req: Request, res: Response) => {
  const { employeeId, type, data } = req.body;

  const event: CorpperksEvent = {
    employeeId,
    type,
    data: data || {},
    timestamp: new Date()
  };

  await processEvent(event);

  res.json({ success: true, event });
});

// Batch sync employees
app.post('/api/v1/sync/batch', async (req: Request, res: Response) => {
  const { employees: employeeList } = req.body as { employees: Employee[] };

  await Promise.all(employeeList.map(syncEmployee));

  res.json({ success: true, synced: employeeList.length });
});

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

// Get employee
app.get('/api/v1/employees/:id', (req: Request, res: Response) => {
  const employee = employees.get(req.params.id);

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  res.json({ employee });
});

// Get employee events
app.get('/api/v1/employees/:id/events', (req: Request, res: Response) => {
  const employeeEvents = events.filter(e => e.employeeId === req.params.id);

  res.json({
    employeeId: req.params.id,
    events: employeeEvents,
    total: employeeEvents.length
  });
});

// Get all employees
app.get('/api/v1/employees', (_req: Request, res: Response) => {
  res.json({
    employees: Array.from(employees.values()),
    total: employees.size
  });
});

// ============================================
// CROSS-BRAND REWARDS
// ============================================

interface CrossBrandReward {
  id: string;
  corpperksTier: string;
  rezTier: string;
  benefit: string;
  multiplier: number;
}

const CROSS_BRAND_REWARDS: CrossBrandReward[] = [
  { id: 'c1', corpperksTier: 'basic', rezTier: 'BRONZE', benefit: 'Standard earning', multiplier: 1.0 },
  { id: 'c2', corpperksTier: 'premium', rezTier: 'SILVER', benefit: '+25% earning', multiplier: 1.25 },
  { id: 'c3', corpperksTier: 'enterprise', rezTier: 'GOLD', benefit: '+50% earning + free delivery', multiplier: 1.5 },
  { id: 'c4', corpperksTier: 'corporate', rezTier: 'PLATINUM', benefit: '+100% earning + VIP access', multiplier: 2.0 },
];

// Get cross-brand reward for employee
app.get('/api/v1/rewards/:employeeId', async (req: Request, res: Response) => {
  const employee = employees.get(req.params.employeeId);

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  // Find matching reward
  const reward = CROSS_BRAND_REWARDS.find(r => r.corpperksTier === employee.company.toLowerCase());

  res.json({
    employeeId: req.params.employeeId,
    company: employee.company,
    reward: reward || CROSS_BRAND_REWARDS[0],
    message: reward
      ? `Your ${employee.company} plan gives you ${reward.benefit}`
      : 'Contact your admin for plan upgrade'
  });
});

// ============================================
// CORPORATE OFFERS
// ============================================

interface CorporateOffer {
  id: string;
  company: string;
  title: string;
  description: string;
  discount: number;
  partners: string[];
}

const CORPORATE_OFFERS: CorporateOffer[] = [
  {
    id: 'co1',
    company: 'all',
    title: '10% off REZ Now',
    description: 'Use your REZ coins for 10% extra discount',
    discount: 10,
    partners: ['REZ Now']
  },
  {
    id: 'co2',
    company: 'premium',
    title: '15% off at partner restaurants',
    description: 'Premium corporate discount',
    discount: 15,
    partners: ['Restaurant partners']
  },
  {
    id: 'co3',
    company: 'enterprise',
    title: 'Free delivery + priority support',
    description: 'Enterprise benefits',
    discount: 100,
    partners: ['All REZ services']
  }
];

// Get offers for employee
app.get('/api/v1/offers/:employeeId', (req: Request, res: Response) => {
  const employee = employees.get(req.params.employeeId);

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const companyLevel = employee.company.toLowerCase();
  const offers = CORPORATE_OFFERS.filter(o =>
    o.company === 'all' || o.company === companyLevel
  );

  res.json({
    employeeId: req.params.employeeId,
    company: employee.company,
    offers
  });
});

// ============================================
// ANALYTICS
// ============================================

// Get employee engagement summary
app.get('/api/v1/analytics/:employeeId', (req: Request, res: Response) => {
  const employee = employees.get(req.params.employeeId);

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  const employeeEvents = events.filter(e => e.employeeId === req.params.employeeId);
  const achievements = employeeEvents.filter(e => e.type === 'achievement').length;
  const milestones = employeeEvents.filter(e => e.type === 'milestone').length;

  // Calculate estimated rewards
  const estimatedCoins = (achievements * 50) + (milestones * 200);
  const estimatedKarma = (achievements * 30) + (milestones * 100);

  res.json({
    employeeId: req.params.employeeId,
    company: employee.company,
    summary: {
      totalEvents: employeeEvents.length,
      achievements,
      milestones,
      referrals: employeeEvents.filter(e => e.type === 'referral').length,
      estimatedRezCoins: estimatedCoins,
      estimatedKarmaScore: estimatedKarma
    }
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`CorpPerks Bridge running on port ${PORT}`);
  console.log('');
  console.log('Features:');
  console.log('  • Employee sync from CorpPerks');
  console.log('  • Event processing');
  console.log('  • Cross-brand rewards');
  console.log('  • Corporate offers');
  console.log('  • Analytics');
  console.log('');
  console.log('Connected Services:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });
});

export { app };
