/**
 * Finance Expert Service
 * AI-powered financial planning, investment advice, and expense tracking
 */

import { Investment, Expense, FinancialPlan, FinancialGoal, InvestmentRecommendation, PortfolioAnalysis } from '../types';

// Mock data
const mockInvestments: Investment[] = [
  { id: 'inv-001', type: 'mutual_fund', name: 'HDFC Top 100', currentValue: 250000, purchaseValue: 200000, purchaseDate: '2024-01-15', expectedReturn: 12, riskLevel: 'medium', liquidity: 'high' },
  { id: 'inv-002', type: 'fixed_deposit', name: 'HDFC FD', currentValue: 100000, purchaseValue: 100000, purchaseDate: '2024-06-01', expectedReturn: 7.5, riskLevel: 'low', liquidity: 'low' },
  { id: 'inv-003', type: 'ppf', name: 'PPF Account', currentValue: 150000, purchaseValue: 120000, purchaseDate: '2023-01-01', expectedReturn: 8.2, riskLevel: 'low', liquidity: 'low' },
  { id: 'inv-004', type: 'stock', name: 'Reliance Industries', symbol: 'RELIANCE', currentValue: 80000, purchaseValue: 60000, purchaseDate: '2024-03-10', quantity: 50, expectedReturn: 15, riskLevel: 'high', liquidity: 'high' },
  { id: 'inv-005', type: 'gold', name: 'Sovereign Gold Bond', currentValue: 50000, purchaseValue: 45000, purchaseDate: '2024-02-20', expectedReturn: 10, riskLevel: 'medium', liquidity: 'medium' },
];

const mockExpenses: Expense[] = [
  { id: 'exp-001', category: 'housing', amount: 25000, date: '2026-06-01', description: 'Rent', recurring: true },
  { id: 'exp-002', category: 'food', amount: 8000, date: '2026-06-05', description: 'Groceries', recurring: true },
  { id: 'exp-003', category: 'transport', amount: 3000, date: '2026-06-10', description: 'Fuel', recurring: true },
  { id: 'exp-004', category: 'utilities', amount: 2000, date: '2026-06-15', description: 'Electricity Bill', recurring: true },
  { id: 'exp-005', category: 'entertainment', amount: 5000, date: '2026-06-20', description: 'Streaming subscriptions', recurring: true },
];

export class FinanceExpertService {
  /**
   * Analyze portfolio
   */
  async analyzePortfolio(investments?: Investment[]): Promise<PortfolioAnalysis> {
    const holdings = investments || mockInvestments;

    const totalValue = holdings.reduce((sum, inv) => sum + inv.currentValue, 0);
    const totalInvested = holdings.reduce((sum, inv) => sum + inv.purchaseValue, 0);
    const totalReturns = totalValue - totalInvested;
    const returnsPercent = (totalReturns / totalInvested) * 100;

    // Group by type
    const grouped = holdings.reduce((acc, inv) => {
      const type = inv.type;
      if (!acc[type]) acc[type] = { value: 0, count: 0, returns: 0 };
      acc[type].value += inv.currentValue;
      acc[type].returns += (inv.currentValue - inv.purchaseValue);
      acc[type].count++;
      return acc;
    }, {} as Record<string, { value: number; count: number; returns: number }>);

    const holdingSummaries = Object.entries(grouped).map(([type, data]) => ({
      type,
      value: data.value,
      allocation: (data.value / totalValue) * 100,
      returns: data.returns
    }));

    // Risk score (average weighted by allocation)
    const riskScores = { low: 1, medium: 2, high: 3 };
    const riskScore = holdings.reduce((sum, inv) => {
      const allocation = inv.currentValue / totalValue;
      return sum + (riskScores[inv.riskLevel] * allocation * 100);
    }, 0);

    // Diversification score (more types = better)
    const diversificationScore = Math.min(holdingSummaries.length * 15, 100);

    const recommendations: string[] = [];
    if (holdingSummaries.length < 5) recommendations.push('Consider diversifying across more asset classes');
    if (riskScore > 70) recommendations.push('Your portfolio has high risk - consider adding stable assets');
    if ((grouped['stock']?.value || 0) / totalValue > 0.5) recommendations.push('Stock exposure is high - consider rebalancing');

    return {
      totalValue,
      totalInvested,
      totalReturns,
      returnsPercent: Math.round(returnsPercent * 100) / 100,
      holdings: holdingSummaries,
      riskScore: Math.round(riskScore),
      diversificationScore: Math.round(diversificationScore),
      recommendations
    };
  }

  /**
   * Create financial plan
   */
  async createPlan(params: {
    monthlyIncome: number;
    age: number;
    goals: Omit<FinancialGoal, 'id'>[];
    riskAppetite: 'conservative' | 'moderate' | 'aggressive';
  }): Promise<FinancialPlan> {
    const { monthlyIncome, age, goals, riskAppetite } = params;
    const monthlyExpenses = monthlyIncome * 0.6;
    const savings = monthlyIncome - monthlyExpenses;
    const savingsRate = (savings / monthlyIncome) * 100;

    // Emergency fund (6 months expenses)
    const emergencyFund = {
      target: monthlyExpenses * 6,
      current: 0,
      months: 0
    };

    // Investment allocation based on risk appetite
    const allocationMap = {
      conservative: [
        { type: 'fixed_deposit' as const, allocation: 30, expectedReturn: 7.5, reason: 'Stable returns', riskLevel: 'low' as const },
        { type: 'ppf' as const, allocation: 25, expectedReturn: 8.2, reason: 'Tax efficient, safe', riskLevel: 'low' as const },
        { type: 'mutual_fund' as const, allocation: 20, expectedReturn: 10, reason: 'Growth with stability', riskLevel: 'medium' as const },
        { type: 'gold' as const, allocation: 15, expectedReturn: 8, reason: 'Hedge against inflation', riskLevel: 'medium' as const },
        { type: 'stock' as const, allocation: 10, expectedReturn: 15, reason: 'High growth potential', riskLevel: 'high' as const },
      ],
      moderate: [
        { type: 'mutual_fund' as const, allocation: 35, expectedReturn: 12, reason: 'Core growth engine', riskLevel: 'medium' as const },
        { type: 'stock' as const, allocation: 25, expectedReturn: 15, reason: 'High returns, higher risk', riskLevel: 'high' as const },
        { type: 'fixed_deposit' as const, allocation: 15, expectedReturn: 7.5, reason: 'Stability anchor', riskLevel: 'low' as const },
        { type: 'gold' as const, allocation: 10, expectedReturn: 8, reason: 'Portfolio hedge', riskLevel: 'medium' as const },
        { type: 'nps' as const, allocation: 15, expectedReturn: 10, reason: 'Retirement focused', riskLevel: 'medium' as const },
      ],
      aggressive: [
        { type: 'stock' as const, allocation: 50, expectedReturn: 18, reason: 'Maximum growth', riskLevel: 'high' as const },
        { type: 'mutual_fund' as const, allocation: 30, expectedReturn: 14, reason: 'Diversified equity', riskLevel: 'high' as const },
        { type: 'crypto' as const, allocation: 10, expectedReturn: 25, reason: 'Speculative high growth', riskLevel: 'high' as const },
        { type: 'gold' as const, allocation: 10, expectedReturn: 8, reason: 'Hedge only', riskLevel: 'medium' as const },
      ]
    };

    const investments: InvestmentRecommendation[] = allocationMap[riskAppetite];
    const retirementAge = 60;
    const yearsToRetirement = retirementAge - age;

    return {
      id: `plan-${Date.now()}`,
      userId: 'current-user',
      goals: goals.map((g, i) => ({ ...g, id: `goal-${i}` })) as FinancialGoal[],
      monthlyIncome,
      monthlyExpenses,
      savings,
      savingsRate: Math.round(savingsRate * 100) / 100,
      investments,
      emergencyFund,
      retirementAge,
      riskAppetite,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Track expenses
   */
  async trackExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const newExpense = { ...expense, id: `exp-${Date.now()}` };
    mockExpenses.push(newExpense);
    return newExpense;
  }

  /**
   * Get expense summary
   */
  async getExpenseSummary(month?: number, year?: number): Promise<{
    total: number;
    byCategory: Record<string, number>;
    recurring: number;
    oneTime: number;
  }> {
    const monthExpenses = mockExpenses.filter(e => {
      if (!month || !year) return true;
      const d = new Date(e.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const byCategory = monthExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const recurring = monthExpenses.filter(e => e.recurring).reduce((sum, e) => sum + e.amount, 0);
    const oneTime = monthExpenses.filter(e => !e.recurring).reduce((sum, e) => sum + e.amount, 0);

    return {
      total: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      byCategory,
      recurring,
      oneTime
    };
  }

  /**
   * Get investment recommendations
   */
  async getRecommendations(investmentAmount: number, riskAppetite: 'low' | 'medium' | 'high'): Promise<InvestmentRecommendation[]> {
    const recommendations: InvestmentRecommendation[] = [];

    if (riskAppetite === 'low') {
      recommendations.push(
        { type: 'fixed_deposit', allocation: 40, expectedReturn: 7.5, reason: 'Capital protection', riskLevel: 'low' },
        { type: 'ppf', allocation: 30, expectedReturn: 8.2, reason: 'Tax benefits + safety', riskLevel: 'low' },
        { type: 'mutual_fund', allocation: 20, expectedReturn: 10, reason: 'Balanced growth', riskLevel: 'medium' },
        { type: 'gold', allocation: 10, expectedReturn: 8, reason: 'Inflation hedge', riskLevel: 'medium' }
      );
    } else if (riskAppetite === 'medium') {
      recommendations.push(
        { type: 'mutual_fund', allocation: 40, expectedReturn: 12, reason: 'Core equity allocation', riskLevel: 'medium' },
        { type: 'stock', allocation: 25, expectedReturn: 15, reason: 'High growth potential', riskLevel: 'high' },
        { type: 'fixed_deposit', allocation: 15, expectedReturn: 7.5, reason: 'Emergency cushion', riskLevel: 'low' },
        { type: 'nps', allocation: 20, expectedReturn: 10, reason: 'Retirement planning', riskLevel: 'medium' }
      );
    } else {
      recommendations.push(
        { type: 'stock', allocation: 50, expectedReturn: 18, reason: 'Maximum alpha generation', riskLevel: 'high' },
        { type: 'mutual_fund', allocation: 30, expectedReturn: 14, reason: 'Diversified exposure', riskLevel: 'high' },
        { type: 'crypto', allocation: 10, expectedReturn: 25, reason: 'High risk, high reward', riskLevel: 'high' },
        { type: 'gold', allocation: 10, expectedReturn: 8, reason: 'Portfolio hedge', riskLevel: 'medium' }
      );
    }

    return recommendations;
  }

  /**
   * AI chat response
   */
  async chat(message: string, context?: { monthlyIncome?: number; goals?: string[] }): Promise<string> {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('invest') || lowerMsg.includes('where to put money')) {
      const risk = context?.monthlyIncome && context.monthlyIncome > 100000 ? 'medium' : 'low';
      return `Based on your profile, I'd recommend a ${risk} risk portfolio. For ${risk} risk tolerance: 40% mutual funds, 25-30% stocks, 15% fixed income, 10-15% gold. Want me to create a detailed investment plan?`;
    }

    if (lowerMsg.includes('save') || lowerMsg.includes('savings')) {
      const targetRate = context?.monthlyIncome ? Math.round(context.monthlyIncome * 0.2) : 20000;
      return `Aim to save at least 20% of your income. On your income, that's ₹${targetRate.toLocaleString()}/month. Follow the 50-30-20 rule: 50% needs, 30% wants, 20% savings/investments.`;
    }

    if (lowerMsg.includes('retire') || lowerMsg.includes('retirement')) {
      return `For retirement planning: 1) Start SIPs early, 2) Maximize PPF/NPS contributions, 3) Build 6-month emergency fund, 4) Consider term insurance. The power of compounding is strongest when you start early.`;
    }

    if (lowerMsg.includes('tax') || lowerMsg.includes('deduct')) {
      return `Maximize tax savings with: 80C (₹1.5L) - PPF, ELSS, insurance, 80D (₹25K-100K) - health insurance, 80E - education loan interest, NPS 80CCD(1B) - ₹50K extra, HRA exemption if renting.`;
    }

    if (lowerMsg.includes('emergency') || lowerMsg.includes('fund')) {
      const target = context?.monthlyIncome ? context.monthlyIncome * 6 : 300000;
      return `Build an emergency fund of 6 months expenses (₹${target.toLocaleString()} ideally). Keep it in liquid form - savings account or short-term FD. This is your financial safety net.`;
    }

    return `I'm your AI finance advisor. I can help with:\n- Investment planning & portfolio analysis\n- Expense tracking & budgeting\n- Tax optimization strategies\n- Retirement planning\n- Financial goal setting\n\nJust ask me anything about managing your finances!`;
  }
}

export const financeExpertService = new FinanceExpertService();
