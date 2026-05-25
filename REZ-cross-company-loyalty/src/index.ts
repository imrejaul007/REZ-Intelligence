/**
 * REZ Cross-Company Loyalty Service
 * Universal loyalty and rewards across all REZ companies
 */

import express, { Request, Response } import logger from './utils/logger';
import from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '4151', 10);

app.use(express.json());

// ============================================
// TYPES
// ============================================

interface LoyaltyAccount {
  id: string;
  userId: string;
  companies: string[];
  points: number;
  lifetimePoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  createdAt: Date;
  updatedAt: Date;
}

interface Transaction {
  id: string;
  accountId: string;
  company: string;
  type: 'earn' | 'redeem' | 'transfer';
  points: number;
  description: string;
  timestamp: Date;
}

interface Reward {
  id: string;
  company: string;
  name: string;
  pointsCost: number;
  type: 'discount' | 'cashback' | 'voucher' | 'freebie';
  active: boolean;
}

// In-memory store (use MongoDB in production)
const accounts = new Map<string, LoyaltyAccount>();
const transactions: Transaction[] = [];
const rewards: Reward[] = [];

// ============================================
// TIER CALCULATION
// ============================================

function calculateTier(lifetimePoints: number): LoyaltyAccount['tier'] {
  if (lifetimePoints >= 50000) return 'platinum';
  if (lifetimePoints >= 20000) return 'gold';
  if (lifetimePoints >= 5000) return 'silver';
  return 'bronze';
}

// ============================================
// ENDPOINTS
// ============================================

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'cross-company-loyalty', timestamp: new Date().toISOString() });
});

// Create/Get account
app.post('/api/accounts', (req: Request, res: Response) => {
  const { userId, company } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const existingAccount = Array.from(accounts.values()).find(a => a.userId === userId);
  if (existingAccount) {
    return res.json({ account: existingAccount, isNew: false });
  }

  const account: LoyaltyAccount = {
    id: `acc_${Date.now()}`,
    userId,
    companies: company ? [company] : [],
    points: 0,
    lifetimePoints: 0,
    tier: 'bronze',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  accounts.set(account.id, account);
  res.status(201).json({ account, isNew: true });
});

app.get('/api/accounts/:userId', (req: Request, res: Response) => {
  const account = Array.from(accounts.values()).find(a => a.userId === req.params.userId);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  res.json({ account });
});

// Earn points
app.post('/api/earn', (req: Request, res: Response) => {
  const { userId, company, points, description } = req.body;

  if (!userId || !points) {
    return res.status(400).json({ error: 'userId and points are required' });
  }

  let account = Array.from(accounts.values()).find(a => a.userId === userId);

  if (!account) {
    account = {
      id: `acc_${Date.now()}`,
      userId,
      companies: [],
      points: 0,
      lifetimePoints: 0,
      tier: 'bronze',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    accounts.set(account.id, account);
  }

  // Company multiplier
  const companyMultipliers: Record<string, number> = {
    'REZ-Media': 1.5, // Media engagement bonus
    'CorpPerks': 1.25, // Corporate bonus
    default: 1.0,
  };

  const multiplier = companyMultipliers[company] || 1.0;
  const earnedPoints = Math.floor(points * multiplier);

  account.points += earnedPoints;
  account.lifetimePoints += earnedPoints;
  account.tier = calculateTier(account.lifetimePoints);
  account.updatedAt = new Date();

  if (company && !account.companies.includes(company)) {
    account.companies.push(company);
  }

  const transaction: Transaction = {
    id: `txn_${Date.now()}`,
    accountId: account.id,
    company: company || 'system',
    type: 'earn',
    points: earnedPoints,
    description: description || `Earned from ${company}`,
    timestamp: new Date(),
  };

  transactions.push(transaction);
  accounts.set(account.id, account);

  res.json({
    transaction,
    account,
    message: `Earned ${earnedPoints} points!`,
  });
});

// Redeem points
app.post('/api/redeem', (req: Request, res: Response) => {
  const { userId, points, description } = req.body;

  if (!userId || !points) {
    return res.status(400).json({ error: 'userId and points are required' });
  }

  const account = Array.from(accounts.values()).find(a => a.userId === userId);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (account.points < points) {
    return res.status(400).json({ error: 'Insufficient points' });
  }

  account.points -= points;
  account.updatedAt = new Date();

  const transaction: Transaction = {
    id: `txn_${Date.now()}`,
    accountId: account.id,
    company: 'REZ',
    type: 'redeem',
    points: -points,
    description: description || 'Redemption',
    timestamp: new Date(),
  };

  transactions.push(transaction);
  accounts.set(account.id, account);

  res.json({
    transaction,
    account,
    message: `Redeemed ${points} points!`,
  });
});

// Transfer between users
app.post('/api/transfer', (req: Request, res: Response) => {
  const { fromUserId, toUserId, points } = req.body;

  if (!fromUserId || !toUserId || !points) {
    return res.status(400).json({ error: 'fromUserId, toUserId, and points are required' });
  }

  const fromAccount = Array.from(accounts.values()).find(a => a.userId === fromUserId);
  const toAccount = Array.from(accounts.values()).find(a => a.userId === toUserId);

  if (!fromAccount || !toAccount) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (fromAccount.points < points) {
    return res.status(400).json({ error: 'Insufficient points' });
  }

  // Deduct from sender
  fromAccount.points -= points;
  fromAccount.updatedAt = new Date();

  // Add to receiver with small bonus
  const receiverBonus = Math.floor(points * 0.05); // 5% bonus
  toAccount.points += points + receiverBonus;
  toAccount.lifetimePoints += receiverBonus;
  toAccount.updatedAt = new Date();

  // Record transactions
  transactions.push({
    id: `txn_${Date.now()}_from`,
    accountId: fromAccount.id,
    company: 'REZ',
    type: 'transfer',
    points: -points,
    description: `Transferred to ${toUserId}`,
    timestamp: new Date(),
  });

  transactions.push({
    id: `txn_${Date.now()}_to`,
    accountId: toAccount.id,
    company: 'REZ',
    type: 'earn',
    points: points + receiverBonus,
    description: `Received from ${fromUserId}`,
    timestamp: new Date(),
  });

  accounts.set(fromAccount.id, fromAccount);
  accounts.set(toAccount.id, toAccount);

  res.json({
    fromAccount,
    toAccount,
    bonus: receiverBonus,
    message: `Transferred ${points} points (+${receiverBonus} bonus)`,
  });
});

// Get transactions
app.get('/api/transactions/:userId', (req: Request, res: Response) => {
  const account = Array.from(accounts.values()).find(a => a.userId === req.params.userId);

  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const userTransactions = transactions.filter(t => t.accountId === account.id);

  res.json({
    transactions: userTransactions,
    total: userTransactions.length,
  });
});

// Get leaderboard
app.get('/api/leaderboard', (_req: Request, res: Response) => {
  const leaderboard = Array.from(accounts.values())
    .sort((a, b) => b.lifetimePoints - a.lifetimePoints)
    .slice(0, 100)
    .map((account, index) => ({
      rank: index + 1,
      userId: account.userId,
      points: account.lifetimePoints,
      tier: account.tier,
      companies: account.companies,
    }));

  res.json({ leaderboard });
});

// Rewards endpoints
app.post('/api/rewards', (req: Request, res: Response) => {
  const { company, name, pointsCost, type } = req.body;

  const reward: Reward = {
    id: `reward_${Date.now()}`,
    company: company || 'REZ',
    name,
    pointsCost,
    type: type || 'voucher',
    active: true,
  };

  rewards.push(reward);
  res.status(201).json({ reward });
});

app.get('/api/rewards', (req: Request, res: Response) => {
  const { company } = req.query;

  let availableRewards = rewards.filter(r => r.active);

  if (company) {
    availableRewards = availableRewards.filter(r =>
      r.company === company || r.company === 'REZ'
    );
  }

  res.json({ rewards: availableRewards });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Cross-Company Loyalty running on port ${PORT}`);
  logger.info('  Companies: All REZ companies supported');
  logger.info('  Features: Universal points, cross-company rewards');
});

export { app };
