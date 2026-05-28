import crypto from 'crypto';
import { logger } from './utils/logger.js';

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
// mongoose types are optional - this file can work without MongoDB
// import mongoose from 'mongoose';

// Environment configuration
const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:4001';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const USE_REAL_API = process.env.USE_REAL_IDENTITY === 'true';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-identity';

// PRODUCTION: MongoDB connection flag
let dbConnected = false;

// Real API helper
async function fetchFromIdentityService<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  if (!USE_REAL_API) return null;

  try {
    const response = await fetch(`${IDENTITY_SERVICE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
        ...options?.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as T;
  } catch (error) {
    console.error(`Identity Service API error (${endpoint}):`, error);
    return null;
  }
}

// ============================================================================
// MongoDB Schema (PRODUCTION) - Disabled, using in-memory store
// ============================================================================
// To enable MongoDB persistence:
// 1. Install mongoose: npm install mongoose
// 2. Uncomment the mongoose import above
// 3. Uncomment the schema definitions below
// 4. Uncomment the MongoDB-related code in resolveIdentity()

// const IdentitySchema = new mongoose.Schema({...});
// const UnifiedProfileSchema = new mongoose.Schema({...});
// const UnifiedProfile = mongoose.models.UnifiedProfile || mongoose.model('UnifiedProfile', UnifiedProfileSchema);
// async function connectToDatabase(): Promise<void> {...}

// ============================================================================
// Types
// ============================================================================

interface Identity {
  id: string;
  type: 'email' | 'phone' | 'device' | 'oauth';
  value: string;
  verified: boolean;
  createdAt: string;
}

interface AppProfile {
  appId: string;
  appName: string;
  userId: string;
  attributes: Record<string, unknown>;
  firstSeen: string;
  lastSeen: string;
}

interface UnifiedProfile {
  userId: string;
  createdAt: string;
  updatedAt: string;
  identities: Identity[];
  profiles: AppProfile[];
  relatedUserIds: string[];
  confidence: number;
}

interface Device {
  deviceId: string;
  type: 'mobile' | 'tablet' | 'desktop';
  userIds: string[];
  lastActive: string;
}

interface IdentityGraph {
  userId: string;
  nodes: Array<{
    id: string;
    type: 'user' | 'identity' | 'device';
    label: string;
    properties: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label: string;
    properties: Record<string, unknown>;
  }>;
}

// ============================================================================
// Mock Data Store
// ============================================================================

const mockUsers: Map<string, UnifiedProfile> = new Map([
  [
    'user_001',
    {
      userId: 'user_001',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2025-05-10T14:22:00Z',
      identities: [
        {
          id: 'id_001',
          type: 'email',
          value: 'rahul.sharma@email.com',
          verified: true,
          createdAt: '2024-01-15T10:30:00Z',
        },
        {
          id: 'id_002',
          type: 'phone',
          value: '+919876543210',
          verified: true,
          createdAt: '2024-01-15T10:35:00Z',
        },
        {
          id: 'id_003',
          type: 'device',
          value: 'device_mobile_001',
          verified: true,
          createdAt: '2024-01-20T08:00:00Z',
        },
        {
          id: 'id_004',
          type: 'oauth',
          value: 'google_rahul_123',
          verified: true,
          createdAt: '2024-02-01T12:00:00Z',
        },
      ],
      profiles: [
        {
          appId: 'rez-commerce',
          appName: 'REZ Commerce',
          userId: 'commerce_user_001',
          attributes: {
            name: 'Rahul Sharma',
            loyaltyTier: 'gold',
            totalOrders: 47,
            spendAmount: 28500,
          },
          firstSeen: '2024-01-15T10:30:00Z',
          lastSeen: '2025-05-10T14:22:00Z',
        },
        {
          appId: 'rez-merchant',
          appName: 'REZ Merchant',
          userId: 'merchant_user_001',
          attributes: {
            businessName: 'Sharma Enterprises',
            businessType: 'retail',
            rating: 4.5,
          },
          firstSeen: '2024-03-20T09:00:00Z',
          lastSeen: '2025-05-08T11:30:00Z',
        },
        {
          appId: 'rez-hotel',
          appName: 'StayOwn Hospitality',
          userId: 'hotel_user_001',
          attributes: {
            memberId: 'STAYOWN-2024-001',
            membershipTier: 'silver',
            bookings: 5,
          },
          firstSeen: '2024-06-01T15:00:00Z',
          lastSeen: '2025-04-22T10:00:00Z',
        },
      ],
      relatedUserIds: ['user_002', 'user_003'],
      confidence: 1.0,
    },
  ],
  [
    'user_002',
    {
      userId: 'user_002',
      createdAt: '2024-06-10T11:00:00Z',
      updatedAt: '2025-05-12T09:15:00Z',
      identities: [
        {
          id: 'id_005',
          type: 'email',
          value: 'priya.sharma@email.com',
          verified: true,
          createdAt: '2024-06-10T11:00:00Z',
        },
        {
          id: 'id_006',
          type: 'phone',
          value: '+919876543211',
          verified: true,
          createdAt: '2024-06-10T11:05:00Z',
        },
        {
          id: 'id_007',
          type: 'device',
          value: 'device_mobile_001',
          verified: true,
          createdAt: '2024-06-10T11:10:00Z',
        },
      ],
      profiles: [
        {
          appId: 'rez-commerce',
          appName: 'REZ Commerce',
          userId: 'commerce_user_002',
          attributes: {
            name: 'Priya Sharma',
            loyaltyTier: 'silver',
            totalOrders: 23,
            spendAmount: 12800,
          },
          firstSeen: '2024-06-10T11:00:00Z',
          lastSeen: '2025-05-12T09:15:00Z',
        },
        {
          appId: 'rez-hotel',
          appName: 'StayOwn Hospitality',
          userId: 'hotel_user_002',
          attributes: {
            memberId: 'STAYOWN-2024-002',
            membershipTier: 'bronze',
            bookings: 2,
          },
          firstSeen: '2024-07-15T14:00:00Z',
          lastSeen: '2025-03-10T16:00:00Z',
        },
      ],
      relatedUserIds: ['user_001', 'user_003'],
      confidence: 0.98,
    },
  ],
  [
    'user_003',
    {
      userId: 'user_003',
      createdAt: '2024-09-05T16:20:00Z',
      updatedAt: '2025-05-01T20:45:00Z',
      identities: [
        {
          id: 'id_008',
          type: 'email',
          value: 'arjun.sharma@email.com',
          verified: true,
          createdAt: '2024-09-05T16:20:00Z',
        },
        {
          id: 'id_009',
          type: 'phone',
          value: '+919876543212',
          verified: false,
          createdAt: '2024-09-05T16:25:00Z',
        },
        {
          id: 'id_010',
          type: 'device',
          value: 'device_tablet_001',
          verified: true,
          createdAt: '2024-09-08T10:00:00Z',
        },
      ],
      profiles: [
        {
          appId: 'rez-commerce',
          appName: 'REZ Commerce',
          userId: 'commerce_user_003',
          attributes: {
            name: 'Arjun Sharma',
            loyaltyTier: 'bronze',
            totalOrders: 8,
            spendAmount: 3200,
          },
          firstSeen: '2024-09-05T16:20:00Z',
          lastSeen: '2025-05-01T20:45:00Z',
        },
      ],
      relatedUserIds: ['user_001', 'user_002'],
      confidence: 0.85,
    },
  ],
  [
    'user_004',
    {
      userId: 'user_004',
      createdAt: '2025-01-10T09:00:00Z',
      updatedAt: '2025-05-14T18:30:00Z',
      identities: [
        {
          id: 'id_011',
          type: 'email',
          value: 'anita.verma@company.com',
          verified: true,
          createdAt: '2025-01-10T09:00:00Z',
        },
        {
          id: 'id_012',
          type: 'phone',
          value: '+919988776655',
          verified: true,
          createdAt: '2025-01-10T09:05:00Z',
        },
        {
          id: 'id_013',
          type: 'device',
          value: 'device_mobile_002',
          verified: true,
          createdAt: '2025-01-12T11:00:00Z',
        },
      ],
      profiles: [
        {
          appId: 'rez-merchant',
          appName: 'REZ Merchant',
          userId: 'merchant_user_004',
          attributes: {
            businessName: 'Verma Retail Store',
            businessType: 'retail',
            rating: 4.8,
          },
          firstSeen: '2025-01-10T09:00:00Z',
          lastSeen: '2025-05-14T18:30:00Z',
        },
        {
          appId: 'corpperks',
          appName: 'CorpPerks',
          userId: 'corp_user_004',
          attributes: {
            company: 'Tech Solutions Ltd',
            department: 'Operations',
            role: 'Manager',
          },
          firstSeen: '2025-02-01T10:00:00Z',
          lastSeen: '2025-05-13T17:00:00Z',
        },
      ],
      relatedUserIds: [],
      confidence: 1.0,
    },
  ],
  [
    'user_005',
    {
      userId: 'user_005',
      createdAt: '2025-03-22T14:00:00Z',
      updatedAt: '2025-05-15T08:00:00Z',
      identities: [
        {
          id: 'id_014',
          type: 'oauth',
          value: 'google_new_user_456',
          verified: true,
          createdAt: '2025-03-22T14:00:00Z',
        },
        {
          id: 'id_015',
          type: 'email',
          value: 'new.user@gmail.com',
          verified: true,
          createdAt: '2025-03-22T14:00:00Z',
        },
        {
          id: 'id_016',
          type: 'device',
          value: 'device_mobile_003',
          verified: true,
          createdAt: '2025-03-25T09:00:00Z',
        },
      ],
      profiles: [
        {
          appId: 'rez-commerce',
          appName: 'REZ Commerce',
          userId: 'commerce_user_005',
          attributes: {
            name: 'New User',
            loyaltyTier: 'new',
            totalOrders: 2,
            spendAmount: 450,
          },
          firstSeen: '2025-03-22T14:00:00Z',
          lastSeen: '2025-05-15T08:00:00Z',
        },
      ],
      relatedUserIds: [],
      confidence: 0.95,
    },
  ],
]);

// Device mapping
const mockDevices: Map<string, Device> = new Map([
  [
    'device_mobile_001',
    {
      deviceId: 'device_mobile_001',
      type: 'mobile',
      userIds: ['user_001', 'user_002'],
      lastActive: '2025-05-12T09:15:00Z',
    },
  ],
  [
    'device_tablet_001',
    {
      deviceId: 'device_tablet_001',
      type: 'tablet',
      userIds: ['user_001', 'user_003'],
      lastActive: '2025-05-01T20:45:00Z',
    },
  ],
  [
    'device_mobile_002',
    {
      deviceId: 'device_mobile_002',
      type: 'mobile',
      userIds: ['user_004'],
      lastActive: '2025-05-14T18:30:00Z',
    },
  ],
  [
    'device_mobile_003',
    {
      deviceId: 'device_mobile_003',
      type: 'mobile',
      userIds: ['user_005'],
      lastActive: '2025-05-15T08:00:00Z',
    },
  ],
]);

// Identity to user mapping
const identityIndex: Map<string, string> = new Map();
mockUsers.forEach((user, userId) => {
  user.identities.forEach((identity) => {
    identityIndex.set(`${identity.type}:${identity.value}`, userId);
  });
});

// ============================================================================
// Tool Handlers
// ============================================================================

async function resolveIdentity(params: {
  identifier: string;
  type?: 'email' | 'phone' | 'device';
}): Promise<{ success: boolean; userId?: string; confidence?: number; matchedOn?: string; source?: string }> {
  const { identifier, type } = params;

  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromIdentityService<{ success: boolean; userId?: string; confidence?: number; matchedOn?: string }>(
      `/api/identity/resolve?identifier=${encodeURIComponent(identifier)}&type=${type || ''}`
    );
    if (result && result.success) {
      return { success: result.success, userId: result.userId, confidence: result.confidence, matchedOn: result.matchedOn, source: 'remote' };
    }
  }

  // MongoDB persistence disabled - using in-memory store only
  // To enable MongoDB, install mongoose and uncomment the mongoose imports above
  // try {
  //   await connectToDatabase();
  //   const query = type
  //     ? { 'identities.type': type, 'identities.value': identifier }
  //     : { 'identities.value': identifier };
  //   const profile = await UnifiedProfile.findOne(query).lean();
  //   if (profile) {
  //     return {
  //       success: true,
  //       userId: profile.userId,
  //       confidence: 1.0,
  //       matchedOn: `${type || 'any'}:${identifier}`,
  //       source: 'database'
  //     };
  //   }
  // } catch (error) {
  //   logger.error('[Identity MCP] MongoDB lookup failed:', error);
  // }

  // Fall back to in-memory search only if DB fails
  if (type) {
    const key = `${type}:${identifier}`;
    const userId = identityIndex.get(key);
    if (userId) {
      return { success: true, userId, confidence: 1.0, matchedOn: key, source: 'memory' };
    }
  }

  const normalizedIdentifier = identifier.toLowerCase().trim();
  for (const [key, userId] of identityIndex.entries()) {
    const [, value] = key.split(':');
    if (value.toLowerCase().includes(normalizedIdentifier)) {
      return { success: true, userId, confidence: 0.9, matchedOn: key, source: 'memory' };
    }
  }

  return { success: false, source: 'local' };
}

async function getUnifiedProfile(userId: string): Promise<UnifiedProfile | null> {
  // Try real API first if enabled
  if (USE_REAL_API) {
    const result = await fetchFromIdentityService<UnifiedProfile>(`/api/identity/profile/${userId}`);
    if (result) {
      return result;
    }
  }

  // Fall back to local
  return mockUsers.get(userId) || null;
}

function linkIdentities(params: {
  userId: string;
  identities: Array<{ type: 'email' | 'phone' | 'device'; value: string }>;
}): {
  success: boolean;
  userId: string;
  linkedIdentities: string[];
  message: string;
  source: 'local';
} {
  const { userId, identities } = params;
  const user = mockUsers.get(userId);

  if (!user) {
    return {
      success: false,
      userId,
      linkedIdentities: [],
      message: `User ${userId} not found`,
      source: 'local'
    };
  }

  const linkedIdentities: string[] = [];

  for (const identity of identities) {
    const key = `${identity.type}:${identity.value}`;
    const existingUserId = identityIndex.get(key);

    if (existingUserId && existingUserId !== userId) {
      // Identity belongs to another user
      return {
        success: false,
        userId,
        linkedIdentities: [],
        message: `Identity ${key} already linked to user ${existingUserId}`,
        source: 'local'
      };
    }

    // Add new identity
    const newIdentity: Identity = {
      id: `${crypto.randomUUID()}`,
      type: identity.type,
      value: identity.value,
      verified: false,
      createdAt: new Date().toISOString(),
    };

    user.identities.push(newIdentity);
    identityIndex.set(key, userId);
    linkedIdentities.push(key);
  }

  user.updatedAt = new Date().toISOString();

  return {
    success: true,
    userId,
    linkedIdentities,
    message: `Successfully linked ${linkedIdentities.length} identities`,
    source: 'local'
  };
}

function getIdentityGraph(userId: string): IdentityGraph | null {
  const user = mockUsers.get(userId);
  if (!user) {
    return null;
  }

  const nodes: IdentityGraph['nodes'] = [];
  const edges: IdentityGraph['edges'] = [];
  const visitedUserIds = new Set<string>();

  // Add central user node
  nodes.push({
    id: userId,
    type: 'user',
    label: `User ${userId}`,
    properties: {
      createdAt: user.createdAt,
      confidence: user.confidence,
      profileCount: user.profiles.length,
    },
  });

  // Add identity nodes
  for (const identity of user.identities) {
    const nodeId = identity.id;
    nodes.push({
      id: nodeId,
      type: 'identity',
      label: `${identity.type}: ${identity.value}`,
      properties: {
        verified: identity.verified,
        createdAt: identity.createdAt,
      },
    });

    edges.push({
      source: userId,
      target: nodeId,
      label: 'has_identity',
      properties: {},
    });

    // If device identity, add device node
    if (identity.type === 'device') {
      const device = mockDevices.get(identity.value);
      if (device) {
        const deviceNodeId = `device_${device.deviceId}`;
        nodes.push({
          id: deviceNodeId,
          type: 'device',
          label: `Device: ${device.type}`,
          properties: {
            lastActive: device.lastActive,
            sharedWith: device.userIds.length,
          },
        });

        edges.push({
          source: nodeId,
          target: deviceNodeId,
          label: 'is_device',
          properties: {},
        });

        // Add other users on same device
        for (const otherUserId of device.userIds) {
          if (otherUserId !== userId && !visitedUserIds.has(otherUserId)) {
            visitedUserIds.add(otherUserId);
            const otherUser = mockUsers.get(otherUserId);
            if (otherUser) {
              nodes.push({
                id: otherUserId,
                type: 'user',
                label: `User ${otherUserId}`,
                properties: {
                  createdAt: otherUser.createdAt,
                  confidence: otherUser.confidence,
                },
              });

              edges.push({
                source: deviceNodeId,
                target: otherUserId,
                label: 'shared_device',
                properties: { type: 'device' },
              });
            }
          }
        }
      }
    }
  }

  // Add related users
  for (const relatedUserId of user.relatedUserIds) {
    if (!visitedUserIds.has(relatedUserId)) {
      visitedUserIds.add(relatedUserId);
      const relatedUser = mockUsers.get(relatedUserId);
      if (relatedUser) {
        nodes.push({
          id: relatedUserId,
          type: 'user',
          label: `User ${relatedUserId}`,
          properties: {
            createdAt: relatedUser.createdAt,
            confidence: relatedUser.confidence,
          },
        });

        edges.push({
          source: userId,
          target: relatedUserId,
          label: 'related',
          properties: {},
        });
      }
    }
  }

  return { userId, nodes, edges };
}

function findRelatedUsers(params: {
  userId: string;
  relationshipType?: 'device' | 'family' | 'household' | 'all';
}): {
  userId: string;
  relatedUsers: Array<{
    userId: string;
    relationship: string;
    confidence: number;
    sharedDetails: string[];
  }>;
} {
  const { userId, relationshipType = 'all' } = params;
  const user = mockUsers.get(userId);

  if (!user) {
    return { userId, relatedUsers: [] };
  }

  const relatedUsers: Array<{
    userId: string;
    relationship: string;
    confidence: number;
    sharedDetails: string[];
  }> = [];
  const seenUserIds = new Set<string>();

  // Find device-related users
  if (relationshipType === 'device' || relationshipType === 'all') {
    for (const identity of user.identities) {
      if (identity.type === 'device') {
        const device = mockDevices.get(identity.value);
        if (device) {
          for (const otherUserId of device.userIds) {
            if (otherUserId !== userId && !seenUserIds.has(otherUserId)) {
              seenUserIds.add(otherUserId);
              relatedUsers.push({
                userId: otherUserId,
                relationship: 'device',
                confidence: 0.95,
                sharedDetails: [
                  `Device: ${device.type}`,
                  `Last active: ${device.lastActive}`,
                ],
              });
            }
          }
        }
      }
    }
  }

  // Find family-related users (from relatedUserIds with high confidence)
  if (relationshipType === 'family' || relationshipType === 'all') {
    for (const relatedUserId of user.relatedUserIds) {
      if (!seenUserIds.has(relatedUserId)) {
        seenUserIds.add(relatedUserId);
        const relatedUser = mockUsers.get(relatedUserId);
        if (relatedUser) {
          // Check if they share phone number prefix (potential family)
          const userPhones = user.identities
            .filter((i) => i.type === 'phone')
            .map((i) => i.value);
          const relatedPhones = relatedUser.identities
            .filter((i) => i.type === 'phone')
            .map((i) => i.value);

          const sharedPhones = userPhones.filter((p1) =>
            relatedPhones.some((p2) => p1.substring(0, 3) === p2.substring(0, 3))
          );

          if (sharedPhones.length > 0) {
            relatedUsers.push({
              userId: relatedUserId,
              relationship: 'family',
              confidence: relatedUser.confidence,
              sharedDetails: [`Shared phone prefix`, `Phone: ${sharedPhones[0]}`],
            });
          }
        }
      }
    }
  }

  // Find household-related users (from relatedUserIds)
  if (relationshipType === 'household' || relationshipType === 'all') {
    for (const relatedUserId of user.relatedUserIds) {
      if (!seenUserIds.has(relatedUserId)) {
        seenUserIds.add(relatedUserId);
        relatedUsers.push({
          userId: relatedUserId,
          relationship: 'household',
          confidence: 0.8,
          sharedDetails: ['Same household (inferred)'],
        });
      }
    }
  }

  return { userId, relatedUsers };
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'rez-identity-resolution',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'resolve_identity',
        description:
          'Resolve a user identity by email, phone, or device ID. Returns the unified user ID if found.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'The identifier to search for (email, phone, or device ID)',
            },
            type: {
              type: 'string',
              enum: ['email', 'phone', 'device'],
              description: 'The type of identifier (optional, will search all if not specified)',
            },
          },
          required: ['identifier'],
        },
      },
      {
        name: 'get_unified_profile',
        description:
          'Get the unified user profile across all REZ applications. Returns all identities, app profiles, and related users.',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The unified user ID',
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'link_identities',
        description:
          'Link multiple identities to a single user. Can link email, phone, or device identities.',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The target user ID to link identities to',
            },
            identities: {
              type: 'array',
              description: 'Array of identities to link',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['email', 'phone', 'device'],
                  },
                  value: {
                    type: 'string',
                  },
                },
                required: ['type', 'value'],
              },
            },
          },
          required: ['userId', 'identities'],
        },
      },
      {
        name: 'get_identity_graph',
        description:
          'Get the complete identity linkage graph for a user. Shows all connected identities, devices, and related users.',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The unified user ID',
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'find_related_users',
        description:
          'Find users related to the given user based on device sharing, family connections, or household.',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'The unified user ID',
            },
            relationshipType: {
              type: 'string',
              enum: ['device', 'family', 'household', 'all'],
              description: 'Type of relationship to search for (default: all)',
            },
          },
          required: ['userId'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'resolve_identity': {
        const result = await resolveIdentity(args as { identifier: string; type?: 'email' | 'phone' | 'device' });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_unified_profile': {
        const userId = (args as { userId: string }).userId;
        const profile = await getUnifiedProfile(userId);
        if (!profile) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: `User ${userId} not found`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  profile,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'link_identities': {
        const params = args as {
          userId: string;
          identities: Array<{ type: 'email' | 'phone' | 'device'; value: string }>;
        };
        const result = linkIdentities(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_identity_graph': {
        const userId = (args as { userId: string }).userId;
        const graph = getIdentityGraph(userId);
        if (!graph) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: `User ${userId} not found`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  graph,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'find_related_users': {
        const params = args as {
          userId: string;
          relationshipType?: 'device' | 'family' | 'household' | 'all';
        };
        const result = findRelatedUsers(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  ...result,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  logger.error('REZ Identity Resolution MCP Server running on stdio');
  logger.error(`Identity Service URL: ${IDENTITY_SERVICE_URL}`);
  logger.error(`Real API: ${USE_REAL_API ? 'ENABLED' : 'DISABLED (set USE_REAL_IDENTITY=true to enable)'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
