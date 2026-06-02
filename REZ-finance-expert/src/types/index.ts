/**
 * Type definitions for Finance Expert
 */

export interface Investment {
  id: string;
  type: 'stock' | 'mutual_fund' | 'fixed_deposit' | 'ppf' | 'nps' | 'gold' | 'real_estate' | 'crypto' | 'bond';
  name: string;
  symbol?: string;
  currentValue: number;
  purchaseValue: number;
  purchaseDate: string;
  quantity?: number;
  expectedReturn: number;
  riskLevel: 'low' | 'medium' | 'high';
  liquidity: 'high' | 'medium' | 'low';
}

export interface Expense {
  id: string;
  category: 'housing' | 'food' | 'transport' | 'utilities' | 'entertainment' | 'healthcare' | 'education' | 'shopping' | 'travel' | 'other';
  amount: number;
  date: string;
  description: string;
  recurring: boolean;
  tags?: string[];
}

export interface FinancialPlan {
  id: string;
  userId: string;
  goals: FinancialGoal[];
  monthlyIncome: number;
  monthlyExpenses: number;
  savings: number;
  savingsRate: number;
  investments: InvestmentRecommendation[];
  emergencyFund: { target: number; current: number; months: number };
  retirementAge: number;
  riskAppetite: 'conservative' | 'moderate' | 'aggressive';
  createdAt: string;
  updatedAt: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  type: 'retirement' | 'house' | 'education' | 'marriage' | 'emergency' | 'travel' | 'other';
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  monthlyContribution: number;
  priority: 'high' | 'medium' | 'low';
}

export interface InvestmentRecommendation {
  type: Investment['type'];
  allocation: number;
  expectedReturn: number;
  reason: string;
  riskLevel: Investment['riskLevel'];
}

export interface PortfolioAnalysis {
  totalValue: number;
  totalInvested: number;
  totalReturns: number;
  returnsPercent: number;
  holdings: { type: string; value: number; allocation: number; returns: number }[];
  riskScore: number;
  diversificationScore: number;
  recommendations: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
