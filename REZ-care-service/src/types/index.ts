// REZ Care Service - Types
// Core type definitions for unified customer support intelligence

export interface Customer360 {
  customerId: string;
  searchedAt: Date;

  // Identity
  identity: {
    phone: string;
    email?: string;
    name: string;
    avatar?: string;
    registeredAt: Date;
    verified: boolean;
  };

  // Value
  value: {
    lifetimeValue: number;
    totalOrders: number;
    avgOrderValue: number;
    totalSpent: number;
    firstOrderDate?: Date;
    lastOrderDate?: Date;
    orderFrequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  };

  // Loyalty
  loyalty: {
    karmaTier: 'bronze' | 'silver' | 'gold' | 'platinum';
    karmaPoints: number;
    pointsValue: number;
    memberSince: Date;
    benefits: string[];
    nextTierProgress: number;
  };

  // Risk
  risk: {
    churnProbability: number;
    fraudScore: number;
    refundRiskScore: number;
    vipStatus: boolean;
    flaggedStatus: boolean;
    riskReasons: string[];
  };

  // Engagement
  engagement: {
    lastActiveDate: Date;
    appOpenFrequency: 'daily' | 'weekly' | 'monthly' | 'rarely';
    preferredChannel: 'whatsapp' | 'sms' | 'email' | 'inapp';
    pushOptIn: boolean;
    totalInteractions: number;
  };

  // Wallet
  wallet: {
    currentBalance: number;
    totalEarned: number;
    totalSpent: number;
    pendingCashback: number;
    expiringPoints: { amount: number; expiresAt: Date }[];
  };

  // Summary
  summary: {
    status: 'happy' | 'neutral' | 'concerned' | 'angry' | 'vip' | 'at_risk';
    priorityLevel: 'low' | 'medium' | 'high' | 'critical';
    lastInteractionDate: Date;
    lastInteractionType: string;
    openTickets: number;
    pendingRefunds: number;
    sentiment: number;
    sentimentTrend: 'improving' | 'stable' | 'declining';
  };
}

export interface CSATSurvey {
  _id: string;
  ticketId: string;
  customerId: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'inapp';
  status: 'pending' | 'sent' | 'completed' | 'expired';
  sentAt?: Date;
  completedAt?: Date;
  expiresAt: Date;

  // Ratings
  overallRating?: number; // 1-5
  npsScore?: number; // 0-10
  cesScore?: number; // 1-7 (Customer Effort Score)
  feedback?: string;

  // Metadata
  agentId?: string;
  resolutionTime?: number; // minutes
  language: 'en' | 'hi' | 'hinglish';
}

export interface CSATMetrics {
  period: { start: Date; end: Date };
  totalResponses: number;
  responseRate: number;
  overallCSAT: number; // 1-5 scale
  nps: number; // -100 to 100
  ces: number; // 1-7 scale
  byChannel: Record<string, number>;
  byAgent: Record<string, number>;
  byCategory: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining';
  lowScoreCount: number;
  averageResolutionTime: number;
}

export interface ProactiveAlert {
  _id: string;
  type: 'payment' | 'qr' | 'app' | 'delivery' | 'merchant' | 'fraud' | 'sentiment';
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'active' | 'investigating' | 'resolved' | 'auto_resolved';

  // Detection
  detectedAt: Date;
  triggeredBy: string;
  description: string;

  // Impact
  affectedUsers: string[];
  affectedMerchants?: string[];
  estimatedImpact: number;

  // Actions taken
  actions: {
    type: 'notification' | 'compensation' | 'ticket' | 'escalation' | 'auto_resolve';
    timestamp: Date;
    details: string;
  }[];

  // Resolution
  resolvedAt?: Date;
  resolution?: string;
  resolvedBy?: string;
}

export interface SelfServiceAction {
  id: string;
  type: 'cashback_retry' | 'payment_retry' | 'refund_check' | 'wallet_sync' | 'booking_reschedule' | 'qr_troubleshoot';
  title: string;
  description: string;
  eligible: boolean;
  eligibilityReason?: string;
  actionData?: Record<string, unknown>;
}

export interface SelfServiceResult {
  success: boolean;
  action: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface AutoTicket {
  _id: string;
  ticketId: string;
  type: 'payment' | 'qr' | 'app' | 'delivery' | 'booking' | 'merchant' | 'technical';
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'created' | 'assigned' | 'in_progress' | 'resolved' | 'auto_resolved';

  // Detection
  detectedAt: Date;
  ruleId: string;
  description: string;

  // Context
  customerId?: string;
  merchantId?: string;
  orderId?: string;

  // Auto actions
  autoActions: {
    type: string;
    timestamp: Date;
    result: string;
  }[];

  // Assignment
  assignedTo?: string;
  assignedAt?: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface SentimentAnalysis {
  score: number; // 1-5
  trend: 'improving' | 'stable' | 'declining';
  detectedEmotions: ('angry' | 'frustrated' | 'neutral' | 'happy' | 'excited')[];
  keyPhrases: string[];
  escalationRecommended: boolean;
  churnRisk: boolean;
}

export interface SupportMetrics {
  period: { start: Date; end: Date };

  // Volume
  totalTickets: number;
  openTickets: number;
  resolvedToday: number;

  // Speed
  avgFirstResponseTime: number; // minutes
  avgResolutionTime: number; // minutes
  sloCompliance: number; // percentage

  // Quality
  csatScore: number;
  firstContactResolution: number;
  escalationRate: number;

  // By channel
  byChannel: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;

  // Trends
  ticketTrend: number; // percentage change
  resolutionTrend: number;
}
