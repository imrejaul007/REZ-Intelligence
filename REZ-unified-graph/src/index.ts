/**
 * REZ Unified Graph
 * Single API for complete Customer 360 Profile
 *
 * Aggregates all graph services into one unified view:
 * - Identity Graph
 * - Consumer Graph
 * - Commerce Graph
 * - Loyalty Graph
 * - Trust Graph
 * - Behavioral Graph
 * - Memory Layer
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 4100;

app.use(express.json());
app.use(cors());
app.use(helmet());

// External service URLs
const IDENTITY_GRAPH_URL = process.env.IDENTITY_GRAPH_URL || 'http://localhost:4050';
const CONSUMER_GRAPH_URL = process.env.CONSUMER_GRAPH_URL || 'http://localhost:4110';
const MERCHANT_GRAPH_URL = process.env.MERCHANT_GRAPH_URL || 'http://localhost:4122';
const MEMORY_LAYER_URL = process.env.MEMORY_LAYER_URL || 'http://localhost:4201';
const WALLET_URL = process.env.WALLET_URL || 'http://localhost:4004';
const PROFILE_URL = process.env.PROFILE_URL || 'http://localhost:4013';

// ============================================
// TYPES
// ============================================

interface UnifiedProfile {
  // Identity
  identity: {
    unifiedId: string;
    primaryPhone: string;
    primaryEmail?: string;
    name: string;
    ciScore: number;
    trustTier: string;
    verified: boolean;
    sources: string[];
    createdAt: Date;
  };

  // Demographics
  demographics: {
    age?: number;
    gender?: string;
    city?: string;
    state?: string;
    pincode?: string;
    language: string[];
  };

  // Commerce
  commerce: {
    lifetimeValue: number;
    totalOrders: number;
    avgOrderValue: number;
    lastOrderDate?: Date;
    firstOrderDate?: Date;
    preferredPaymentMethod?: string;
    preferredCategories: string[];
    brands: string[];
  };

  // Loyalty
  loyalty: {
    coins: number;
    points: number;
    tier: string;
    memberSince: Date;
    totalCashback: number;
    referrals: number;
    referralCode?: string;
  };

  // Trust
  trust: {
    ciScore: number;
    trustScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    verificationStatus: string;
    badges: string[];
  };

  // Behavior
  behavior: {
    engagementScore: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    lastActive: Date;
    sessionCount: number;
    preferredChannels: string[];
    preferredTimeSlots: string[];
  };

  // Financial
  financial: {
    walletBalance: number;
    pendingPayments: number;
    creditLimit?: number;
    creditUsed?: number;
  };

  // Segments
  segments: string[];

  // Relationships
  relationships: {
    familyMembers: number;
    connections: number;
    referrals: number;
  };

  // Timeline (recent activity)
  timeline: {
    type: string;
    title: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }[];

  // Unified score
  unifiedScore: number;

  // Last updated
  updatedAt: Date;
}

// ============================================
// MOCK DATA (In production, would fetch from actual services)
// ============================================

function getMockUnifiedProfile(userId: string): UnifiedProfile {
  return {
    identity: {
      unifiedId: userId,
      primaryPhone: '+919876543210',
      primaryEmail: 'user@example.com',
      name: 'John Doe',
      ciScore: 720,
      trustTier: 'L3',
      verified: true,
      sources: ['rez', 'corpid'],
      createdAt: new Date('2024-01-15')
    },
    demographics: {
      age: 32,
      gender: 'male',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      language: ['en', 'hi']
    },
    commerce: {
      lifetimeValue: 45000,
      totalOrders: 127,
      avgOrderValue: 354,
      lastOrderDate: new Date('2026-05-28'),
      firstOrderDate: new Date('2023-06-20'),
      preferredPaymentMethod: 'UPI',
      preferredCategories: ['food', 'groceries', 'electronics'],
      brands: ['Samsung', 'Apple', 'Nestle']
    },
    loyalty: {
      coins: 2340,
      points: 5670,
      tier: 'Gold',
      memberSince: new Date('2023-06-20'),
      totalCashback: 4500,
      referrals: 12,
      referralCode: 'JOHN720'
    },
    trust: {
      ciScore: 720,
      trustScore: 85,
      riskLevel: 'low',
      verificationStatus: 'fully_verified',
      badges: ['verified', 'premium', 'early_adopter', 'referrer']
    },
    behavior: {
      engagementScore: 78,
      sentiment: 'positive',
      lastActive: new Date('2026-05-30T10:30:00'),
      sessionCount: 342,
      preferredChannels: ['app', 'whatsapp'],
      preferredTimeSlots: ['morning', 'evening']
    },
    financial: {
      walletBalance: 2340,
      pendingPayments: 0,
      creditLimit: 10000,
      creditUsed: 2500
    },
    segments: ['premium_user', 'food_lover', 'tech_enthusiast', 'frequent_buyer'],
    relationships: {
      familyMembers: 3,
      connections: 45,
      referrals: 12
    },
    timeline: [
      { type: 'order', title: 'Ordered from Domino\'s', timestamp: new Date('2026-05-29T19:30:00'), metadata: { amount: 450 } },
      { type: 'cashback', title: 'Earned ₹45 cashback', timestamp: new Date('2026-05-29T19:30:00'), metadata: { coins: 450 } },
      { type: 'review', title: 'Reviewed BigBasket order', timestamp: new Date('2026-05-28T14:20:00'), metadata: { rating: 5 } },
      { type: 'payment', title: 'Paid via UPI', timestamp: new Date('2026-05-28T12:00:00'), metadata: { amount: 1200 } },
      { type: 'referral', title: 'Friend signed up', timestamp: new Date('2026-05-27T16:45:00'), metadata: { bonus: 100 } }
    ],
    unifiedScore: 720,
    updatedAt: new Date()
  };
}

// ============================================
// APIS
// ============================================

// Health check
app.get('/health', (_req, res) => {
  res.json({
    service: 'rez-unified-graph',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedServices: [
      { name: 'identity-graph', url: IDENTITY_GRAPH_URL, status: 'connected' },
      { name: 'consumer-graph', url: CONSUMER_GRAPH_URL, status: 'connected' },
      { name: 'memory-layer', url: MEMORY_LAYER_URL, status: 'connected' },
      { name: 'wallet', url: WALLET_URL, status: 'connected' }
    ]
  });
});

// ============================================
// UNIFIED PROFILE APIs
// ============================================

/**
 * GET /api/profile/:userId
 * Get complete unified customer profile (Customer 360)
 *
 * This is the MAIN endpoint that aggregates ALL graphs into one response.
 * In production, it would call:
 * - Identity Graph for identity
 * - Consumer Graph for commerce data
 * - Loyalty Graph for loyalty
 * - Trust Graph for trust scores
 * - Memory Layer for timeline
 * - Wallet for financial data
 */
app.get('/api/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const { fields, segments } = req.query;

  try {
    // Get unified profile
    let profile = getMockUnifiedProfile(userId);

    // Filter fields if specified
    if (fields) {
      const fieldList = String(fields).split(',');
      const filtered: Partial<UnifiedProfile> = {};
      fieldList.forEach(field => {
        if (field in profile) {
          (filtered as any)[field] = (profile as any)[field];
        }
      });
      profile = filtered as UnifiedProfile;
    }

    // Include segment details if requested
    if (segments === 'true') {
      profile.segments = profile.segments.map(seg => {
        // Add segment metadata
        const segmentMeta: Record<string, { description: string; value: number }> = {
          premium_user: { description: 'High-value customer', value: 85 },
          food_lover: { description: 'Frequently orders food', value: 92 },
          tech_enthusiast: { description: 'Buys tech products', value: 78 },
          frequent_buyer: { description: 'High purchase frequency', value: 88 }
        };
        return `${seg}:${segmentMeta[seg]?.value || 50}`;
      });
    }

    res.json({
      success: true,
      data: profile,
      meta: {
        unifiedId: profile.identity.unifiedId,
        unifiedScore: profile.unifiedScore,
        segments: profile.segments.length,
        lastUpdated: profile.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching unified profile:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch unified profile' }
    });
  }
});

/**
 * GET /api/profile/:userId/summary
 * Quick summary of customer profile
 */
app.get('/api/profile/:userId/summary', (req, res) => {
  const { userId } = req.params;

  const profile = getMockUnifiedProfile(userId);

  res.json({
    success: true,
    data: {
      unifiedId: profile.identity.unifiedId,
      name: profile.identity.name,
      ciScore: profile.identity.ciScore,
      trustTier: profile.identity.trustTier,
      lifetimeValue: profile.commerce.lifetimeValue,
      loyaltyTier: profile.loyalty.tier,
      coins: profile.loyalty.coins,
      segments: profile.segments.slice(0, 3),
      lastActive: profile.behavior.lastActive,
      riskLevel: profile.trust.riskLevel
    }
  });
});

/**
 * GET /api/profile/:userId/commerce
 * Get commerce-specific data
 */
app.get('/api/profile/:userId/commerce', (req, res) => {
  const { userId } = req.params;

  const profile = getMockUnifiedProfile(userId);

  res.json({
    success: true,
    data: {
      lifetimeValue: profile.commerce.lifetimeValue,
      totalOrders: profile.commerce.totalOrders,
      avgOrderValue: profile.commerce.avgOrderValue,
      lastOrderDate: profile.commerce.lastOrderDate,
      preferredCategories: profile.commerce.preferredCategories,
      brands: profile.commerce.brands,
      paymentMethod: profile.commerce.preferredPaymentMethod,
      segments: profile.segments.filter(s => ['premium_user', 'frequent_buyer', 'food_lover'].includes(s))
    }
  });
});

/**
 * GET /api/profile/:userId/loyalty
 * Get loyalty-specific data
 */
app.get('/api/profile/:userId/loyalty', (req, res) => {
  const { userId } = req.params;

  const profile = getMockUnifiedProfile(userId);

  res.json({
    success: true,
    data: {
      coins: profile.loyalty.coins,
      points: profile.loyalty.points,
      tier: profile.loyalty.tier,
      memberSince: profile.loyalty.memberSince,
      totalCashback: profile.loyalty.totalCashback,
      referrals: profile.loyalty.referrals,
      referralCode: profile.loyalty.referralCode
    }
  });
});

/**
 * GET /api/profile/:userId/trust
 * Get trust-specific data
 */
app.get('/api/profile/:userId/trust', (req, res) => {
  const { userId } = req.params;

  const profile = getMockUnifiedProfile(userId);

  res.json({
    success: true,
    data: {
      ciScore: profile.trust.ciScore,
      trustScore: profile.trust.trustScore,
      trustTier: profile.identity.trustTier,
      riskLevel: profile.trust.riskLevel,
      verificationStatus: profile.trust.verificationStatus,
      badges: profile.trust.badges
    }
  });
});

/**
 * GET /api/profile/:userId/timeline
 * Get activity timeline
 */
app.get('/api/profile/:userId/timeline', (req, res) => {
  const { userId } = req.params;
  const { type, limit = 20 } = req.query;

  const profile = getMockUnifiedProfile(userId);
  let timeline = profile.timeline;

  if (type) {
    timeline = timeline.filter(t => t.type === String(type));
  }

  res.json({
    success: true,
    data: timeline.slice(0, Number(limit)),
    meta: { total: timeline.length }
  });
});

/**
 * GET /api/profile/:userId/segments
 * Get segment memberships
 */
app.get('/api/profile/:userId/segments', (req, res) => {
  const { userId } = req.params;

  const profile = getMockUnifiedProfile(userId);

  // Segment definitions
  const segmentDetails = [
    {
      id: 'premium_user',
      name: 'Premium User',
      description: 'High-value customer with ₹45K+ lifetime value',
      criteria: { minLTV: 45000 },
      value: profile.commerce.lifetimeValue >= 45000 ? 85 : 0
    },
    {
      id: 'food_lover',
      name: 'Food Lover',
      description: 'Frequently orders food and groceries',
      criteria: { categories: ['food', 'groceries'] },
      value: profile.commerce.preferredCategories.includes('food') ? 92 : 0
    },
    {
      id: 'tech_enthusiast',
      name: 'Tech Enthusiast',
      description: 'Buys electronics and gadgets',
      criteria: { categories: ['electronics'] },
      value: profile.commerce.preferredCategories.includes('electronics') ? 78 : 0
    },
    {
      id: 'frequent_buyer',
      name: 'Frequent Buyer',
      description: 'Places orders regularly',
      criteria: { minOrders: 50 },
      value: profile.commerce.totalOrders >= 50 ? 88 : 0
    },
    {
      id: 'trusted_customer',
      name: 'Trusted Customer',
      description: 'Verified and high trust score',
      criteria: { ciScore: 700 },
      value: profile.identity.ciScore >= 700 ? 95 : 0
    }
  ];

  const activeSegments = segmentDetails.filter(s => s.value > 50);

  res.json({
    success: true,
    data: {
      primarySegment: activeSegments[0]?.name || 'New User',
      segments: activeSegments.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        score: s.value,
        active: s.value > 50
      })),
      segmentScores: profile.segments.map(s => ({
        id: s,
        score: segmentDetails.find(d => d.id === s)?.value || 50
      }))
    }
  });
});

// ============================================
// SEARCH APIs
// ============================================

/**
 * GET /api/search
 * Search users with filters
 */
app.get('/api/search', (req, res) => {
  const { query, segment, minLTV, maxRisk, verified, limit = 20 } = req.query;

  // Mock search results
  const results = [
    {
      unifiedId: 'user-001',
      name: 'John Doe',
      phone: '+919876543210',
      ciScore: 720,
      trustTier: 'L3',
      lifetimeValue: 45000,
      segments: ['premium_user', 'food_lover']
    },
    {
      unifiedId: 'user-002',
      name: 'Jane Smith',
      phone: '+919876543211',
      ciScore: 680,
      trustTier: 'L2',
      lifetimeValue: 23000,
      segments: ['frequent_buyer']
    }
  ];

  let filtered = results;

  if (query) {
    const q = String(query).toLowerCase();
    filtered = filtered.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      r.unifiedId.toLowerCase().includes(q)
    );
  }

  if (minLTV) {
    filtered = filtered.filter(r => r.lifetimeValue >= Number(minLTV));
  }

  if (verified === 'true') {
    filtered = filtered.filter(r => r.ciScore >= 700);
  }

  res.json({
    success: true,
    data: filtered.slice(0, Number(limit)),
    meta: { total: filtered.length }
  });
});

// ============================================
// AGGREGATION APIs
// ============================================

/**
 * GET /api/analytics/overview
 * Platform-wide analytics
 */
app.get('/api/analytics/overview', (_req, res) => {
  res.json({
    success: true,
    data: {
      totalUsers: 125000,
      activeUsers: 45000,
      newUsersToday: 234,
      totalLTV: 45000000000,
      avgLTV: 360000,
      avgCIScore: 650,
      segmentDistribution: [
        { segment: 'premium_user', count: 12500, percentage: 10 },
        { segment: 'frequent_buyer', count: 37500, percentage: 30 },
        { segment: 'occasional', count: 50000, percentage: 40 },
        { segment: 'new_user', count: 25000, percentage: 20 }
      ],
      trustDistribution: [
        { tier: 'L4', count: 12500, percentage: 10 },
        { tier: 'L3', count: 37500, percentage: 30 },
        { tier: 'L2', count: 50000, percentage: 40 },
        { tier: 'L1', count: 25000, percentage: 20 }
      ]
    }
  });
});

/**
 * GET /api/analytics/segments
 * Segment analytics
 */
app.get('/api/analytics/segments', (_req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'premium_user',
        name: 'Premium Users',
        count: 12500,
        avgLTV: 85000,
        avgOrders: 156,
        conversionRate: 8.5
      },
      {
        id: 'frequent_buyer',
        name: 'Frequent Buyers',
        count: 37500,
        avgLTV: 45000,
        avgOrders: 89,
        conversionRate: 6.2
      },
      {
        id: 'occasional',
        name: 'Occasional',
        count: 50000,
        avgLTV: 12000,
        avgOrders: 23,
        conversionRate: 3.1
      },
      {
        id: 'new_user',
        name: 'New Users',
        count: 25000,
        avgLTV: 3500,
        avgOrders: 5,
        conversionRate: 1.2
      }
    ]
  });
});

// ============================================
// LINKING APIs
// ============================================

/**
 * POST /api/link
 * Link two unified profiles (e.g., family members)
 */
app.post('/api/link', (req, res) => {
  const { primaryId, secondaryId, relationship } = req.body;

  if (!primaryId || !secondaryId || !relationship) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'primaryId, secondaryId, and relationship are required' }
    });
    return;
  }

  // In production, would call Identity Graph to create link
  res.json({
    success: true,
    data: {
      primaryId,
      secondaryId,
      relationship,
      linkedAt: new Date(),
      status: 'active'
    }
  });
});

/**
 * POST /api/merge
 * Merge two unified profiles
 */
app.post('/api/merge', (req, res) => {
  const { primaryId, secondaryId, reason } = req.body;

  if (!primaryId || !secondaryId) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'primaryId and secondaryId are required' }
    });
    return;
  }

  // In production, would call Identity Graph to merge
  res.json({
    success: true,
    data: {
      mergedInto: primaryId,
      mergedFrom: secondaryId,
      reason: reason || 'user_request',
      mergedAt: new Date(),
      status: 'completed'
    }
  });
});

// ============================================
// GRAPH TRAVERSAL
// ============================================

/**
 * GET /api/graph/:userId/connections
 * Get user's direct connections
 */
app.get('/api/graph/:userId/connections', (req, res) => {
  const { userId } = req.params;
  const { type } = req.query;

  // Mock connections
  const connections = [
    { id: 'user-002', name: 'Jane Smith', relationship: 'spouse', trustScore: 95 },
    { id: 'user-003', name: 'Jack Doe', relationship: 'sibling', trustScore: 88 },
    { id: 'user-004', name: 'Office Team', relationship: 'organization', trustScore: 72 }
  ];

  let filtered = connections;
  if (type) {
    filtered = filtered.filter(c => c.relationship === String(type));
  }

  res.json({
    success: true,
    data: filtered
  });
});

/**
 * GET /api/graph/:userId/path/:targetId
 * Find shortest path between two users
 */
app.get('/api/graph/:userId/path/:targetId', (req, res) => {
  const { userId, targetId } = req.params;

  // Mock path
  res.json({
    success: true,
    data: {
      source: userId,
      target: targetId,
      distance: 2,
      path: [
        { id: userId, name: 'You' },
        { id: 'user-005', name: 'Mutual Connection' },
        { id: targetId, name: 'Target User' }
      ]
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`REZ Unified Graph running on port ${PORT}`);
  console.log(`🔗 Aggregates: Identity, Consumer, Loyalty, Trust, Memory`);
});

export default app;
