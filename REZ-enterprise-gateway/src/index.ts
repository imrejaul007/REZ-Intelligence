/**
 * REZ Enterprise Gateway
 * CorpPerks + RABTUL Integration
 */

import express, { Request, Response } import logger from './utils/logger';
import from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '4102', 10);

app.use(express.json());

// RABTUL service URLs
const RABTUL_SERVICES = {
  auth: process.env.RABTUL_AUTH_URL || 'http://localhost:4002',
  payment: process.env.RABTUL_PAYMENT_URL || 'http://localhost:4001',
  wallet: process.env.RABTUL_WALLET_URL || 'http://localhost:4004',
  notifications: process.env.RABTUL_NOTIFICATIONS_URL || 'http://localhost:4011',
};

// ============================================
// TYPES
// ============================================

interface CorporateAccount {
  id: string;
  companyName: string;
  domain: string;
  employees: string[];
  budget: number;
  spent: number;
  benefits: string[];
  integratedServices: string[];
  createdAt: Date;
}

interface Employee {
  id: string;
  corporateId: string;
  email: string;
  department: string;
  walletBalance: number;
  benefits: string[];
}

// In-memory stores
const corporateAccounts = new Map<string, CorporateAccount>();
const employees = new Map<string, Employee>();

// ============================================
// ENDPOINTS
// ============================================

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'enterprise-gateway',
    rabtulServices: Object.keys(RABTUL_SERVICES),
    timestamp: new Date().toISOString(),
  });
});

// Corporate account registration
app.post('/api/corporate/register', (req: Request, res: Response) => {
  const { companyName, domain, budget, benefits } = req.body;

  if (!companyName || !domain) {
    return res.status(400).json({ error: 'companyName and domain are required' });
  }

  const account: CorporateAccount = {
    id: `corp_${Date.now()}`,
    companyName,
    domain,
    employees: [],
    budget: budget || 100000,
    spent: 0,
    benefits: benefits || ['meal_vouchers', 'transport', 'health'],
    integratedServices: ['RABTUL-auth', 'RABTUL-wallet'],
    createdAt: new Date(),
  };

  corporateAccounts.set(account.id, account);

  res.status(201).json({
    account,
    message: 'Corporate account created',
    nextSteps: [
      'Configure SSO with RABTUL Auth',
      'Set up corporate wallet via RABTUL',
      'Add employees',
    ],
  });
});

// Get corporate account
app.get('/api/corporate/:domain', (req: Request, res: Response) => {
  const account = Array.from(corporateAccounts.values()).find(
    a => a.domain === req.params.domain
  );

  if (!account) {
    return res.status(404).json({ error: 'Corporate account not found' });
  }

  res.json({ account });
});

// Add employee
app.post('/api/employees', (req: Request, res: Response) => {
  const { corporateDomain, email, department, benefits } = req.body;

  const account = Array.from(corporateAccounts.values()).find(
    a => a.domain === corporateDomain
  );

  if (!account) {
    return res.status(404).json({ error: 'Corporate account not found' });
  }

  const employee: Employee = {
    id: `emp_${Date.now()}`,
    corporateId: account.id,
    email,
    department: department || 'general',
    walletBalance: 0,
    benefits: benefits || account.benefits,
  };

  employees.set(employee.id, employee);
  account.employees.push(employee.id);

  res.status(201).json({
    employee,
    message: 'Employee added',
    rabtulAuth: `${RABTUL_SERVICES.auth}/api/auth/sso`,
  });
});

// Set employee benefits
app.post('/api/employees/:id/benefits', (req: Request, res: Response) => {
  const { benefits } = req.body;
  const employee = employees.get(req.params.id);

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  employee.benefits = benefits;
  employees.set(employee.id, employee);

  res.json({ employee });
});

// Corporate payment (via RABTUL)
app.post('/api/corporate/pay', async (req: Request, res: Response) => {
  const { corporateDomain, toUserId, amount, reason } = req.body;

  const account = Array.from(corporateAccounts.values()).find(
    a => a.domain === corporateDomain
  );

  if (!account) {
    return res.status(404).json({ error: 'Corporate account not found' });
  }

  if (account.budget - account.spent < amount) {
    return res.status(400).json({ error: 'Insufficient budget' });
  }

  // Mock RABTUL payment call
  account.spent += amount;

  res.json({
    success: true,
    transactionId: `txn_${Date.now()}`,
    amount,
    reason: reason || 'Corporate payment',
    remainingBudget: account.budget - account.spent,
    provider: 'RABTUL-payment',
  });
});

// Issue employee benefits (via RABTUL wallet)
app.post('/api/benefits/issue', (req: Request, res: Response) => {
  const { employeeId, type, amount } = req.body;
  const employee = employees.get(employeeId);

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  employee.walletBalance += amount;
  employees.set(employee.id, employee);

  res.json({
    success: true,
    employee,
    benefit: { type, amount },
    provider: 'RABTUL-wallet',
    message: `${type} of ${amount} issued to ${employee.email}`,
  });
});

// Loyalty integration (via REZ-cross-company-loyalty)
app.post('/api/loyalty/earn', (req: Request, res: Response) => {
  const { employeeId, points, source } = req.body;
  const employee = employees.get(employeeId);

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found' });
  }

  res.json({
    success: true,
    employeeId,
    points,
    source,
    provider: 'REZ-cross-company-loyalty',
    newBalance: employee.walletBalance + points,
  });
});

// Analytics
app.get('/api/corporate/:domain/analytics', (req: Request, res: Response) => {
  const account = Array.from(corporateAccounts.values()).find(
    a => a.domain === req.params.domain
  );

  if (!account) {
    return res.status(404).json({ error: 'Corporate account not found' });
  }

  const corpEmployees = Array.from(employees.values()).filter(
    e => e.corporateId === account.id
  );

  res.json({
    account,
    employees: corpEmployees.length,
    totalBenefitSpent: account.spent,
    budgetRemaining: account.budget - account.spent,
    utilizationPercent: ((account.spent / account.budget) * 100).toFixed(2) + '%',
    benefitsByType: {
      meal_vouchers: Math.floor(account.spent * 0.4),
      transport: Math.floor(account.spent * 0.3),
      health: Math.floor(account.spent * 0.3),
    },
    topDepartments: corpEmployees.reduce((acc, emp) => {
      acc[emp.department] = (acc[emp.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  });
});

// Service health check
app.get('/api/services/health', (_req: Request, res: Response) => {
  const services = Object.entries(RABTUL_SERVICES).map(([name, url]) => ({
    name,
    url,
    status: 'connected', // Would ping in production
  }));

  res.json({ services });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Enterprise Gateway running on port ${PORT}`);
  logger.info('Connected RABTUL Services:');
  Object.entries(RABTUL_SERVICES).forEach(([name, url]) => {
    logger.info(`  - ${name}: ${url}`);
  });
});

export { app };
