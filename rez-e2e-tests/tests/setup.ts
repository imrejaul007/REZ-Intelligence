import logger from './utils/logger';

import { beforeAll, afterAll, afterEach } from '@jest/globals';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

// Load environment variables
dotenv.config();

// ============================================================================
// Type Definitions
// ============================================================================

export interface TestUser {
  userId: string;
  name: string;
  email: string;
  phone: string;
  walletBalance: number;
}

export interface TestOrder {
  orderId: string;
  userId: string;
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: string;
}

export interface OrchestratorResponse {
  success: boolean;
  intent: string;
  expert: string;
  message: string;
  sessionId: string;
  data?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  status: string;
  amount?: number;
  error?: string;
}

export interface TestContext {
  testUser: TestUser;
  testOrder: TestOrder;
  sessionId: string;
}

// ============================================================================
// Configuration
// ============================================================================

interface Config {
  ORCHESTRATOR_URL: string;
  PAYMENT_SERVICE_URL: string;
  WALLET_SERVICE_URL: string;
  ORDER_SERVICE_URL: string;
  AUTH_SERVICE_URL: string;
  NOTIFICATION_SERVICE_URL: string;
  WHATSAPP_BRIDGE_URL: string;
  INSTAGRAM_BRIDGE_URL: string;
  MONGODB_URI: string;
  TEST_DATABASE_NAME: string;
  REDIS_URL: string;
  INTERNAL_SERVICE_TOKENS: {
    orchestrator: string;
    payment: string;
    wallet: string;
    order: string;
  };
  SERVICE_STARTUP_TIMEOUT: number;
  HTTP_REQUEST_TIMEOUT: number;
  DB_OPERATION_TIMEOUT: number;
}

const CONFIG: Config = {
  ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL || 'http://localhost:3000',
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001',
  WALLET_SERVICE_URL: process.env.WALLET_SERVICE_URL || 'http://localhost:4002',
  ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL || 'http://localhost:4003',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:4004',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4005',
  WHATSAPP_BRIDGE_URL: process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:5000',
  INSTAGRAM_BRIDGE_URL: process.env.INSTAGRAM_BRIDGE_URL || 'http://localhost:5001',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  TEST_DATABASE_NAME: process.env.TEST_DATABASE_NAME || 'rez_e2e_tests',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  INTERNAL_SERVICE_TOKENS: {
    orchestrator: process.env.ORCHESTRATOR_TOKEN || 'test-orchestrator-token',
    payment: process.env.PAYMENT_TOKEN || 'test-payment-token',
    wallet: process.env.WALLET_TOKEN || 'test-wallet-token',
    order: process.env.ORDER_TOKEN || 'test-order-token',
  },
  SERVICE_STARTUP_TIMEOUT: 60000,
  HTTP_REQUEST_TIMEOUT: 10000,
  DB_OPERATION_TIMEOUT: 5000,
};

// ============================================================================
// Global State
// ============================================================================

let mongoClient: MongoClient | null = null;
let db: Db | null = null;
let redis: Redis | null = null;
const serviceProcesses: Map<string, ChildProcess> = new Map();
let isSetupComplete = false;

const axiosInstances: Map<string, AxiosInstance> = new Map();

// ============================================================================
// Wait Port Function
// ============================================================================

async function waitForPort(options: { port: number; host?: string; timeout?: number; output?: string }): Promise<boolean> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;

  return new Promise((resolve) => {
    const checkPort = () => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - startTime < timeout) {
          setTimeout(checkPort, 100);
        } else {
          resolve(false);
        }
      });

      socket.connect(options.port, options.host || 'localhost');
    };

    checkPort();
  });
}

// ============================================================================
// Test Environment Setup
// ============================================================================

beforeAll(async () => {
  logger.info('\n--- Starting REZ E2E Test Setup ---\n');

  try {
    // 1. Connect to MongoDB
    await connectToMongoDB();
    logger.info('MongoDB connected');

    // 2. Connect to Redis
    await connectToRedis();
    logger.info('Redis connected');

    // 3. Start required services (if in local mode)
    if (process.env.LOCAL_SERVICES === 'true') {
      await startLocalServices();
      logger.info('Local services started');
    }

    // 4. Initialize HTTP clients
    initializeAxiosClients();
    logger.info('HTTP clients initialized');

    // 5. Setup test database schema
    await setupTestDatabase();
    logger.info('Test database schema created');

    // 6. Wait for services to be healthy
    await waitForServicesHealthy();
    logger.info('All services healthy');

    isSetupComplete = true;
    logger.info('\n--- E2E Test Setup Complete ---\n');
  } catch (error) {
    console.error('\nSetup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  logger.info('\n--- Cleaning up E2E Test Environment ---\n');

  try {
    // 1. Stop all service processes
    await stopLocalServices();

    // 2. Close database connections
    if (mongoClient) {
      await mongoClient.close();
      logger.info('MongoDB connection closed');
    }

    if (redis) {
      await redis.quit();
      logger.info('Redis connection closed');
    }

    logger.info('\n--- Cleanup Complete ---\n');
  } catch (error) {
    console.error('\nCleanup failed:', error);
    throw error;
  }
});

afterEach(async () => {
  // Clean up test data after each test
  try {
    await cleanupTestData();
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }
});

// ============================================================================
// Database Connection
// ============================================================================

async function connectToMongoDB(): Promise<void> {
  mongoClient = new MongoClient(CONFIG.MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  await mongoClient.connect();
  db = mongoClient.db(CONFIG.TEST_DATABASE_NAME);
}

async function connectToRedis(): Promise<void> {
  redis = new Redis(CONFIG.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect();
}

async function setupTestDatabase(): Promise<void> {
  if (!db) throw new Error('Database not initialized');

  // Create collections with indexes
  const collections = [
    'users',
    'orders',
    'payments',
    'wallets',
    'sessions',
    'intents',
    'experts',
    'messages',
    'audit_logs',
    'whatsapp_contacts',
    'wallet_transactions',
  ];

  for (const collectionName of collections) {
    try {
      await db.createCollection(collectionName);
    } catch {
      // Collection may already exist
    }
  }

  // Create indexes
  await db.collection('users').createIndex({ userId: 1 }, { unique: true });
  await db.collection('orders').createIndex({ orderId: 1 }, { unique: true });
  await db.collection('payments').createIndex({ paymentId: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ sessionId: 1 }, { unique: true });
  await db.collection('messages').createIndex({ timestamp: -1 });
}

async function cleanupTestData(): Promise<void> {
  if (!mongoClient || !db) return;

  const collections = [
    'users',
    'orders',
    'payments',
    'wallets',
    'sessions',
    'intents',
    'messages',
    'audit_logs',
    'whatsapp_contacts',
    'wallet_transactions',
  ];

  try {
    const adminDb = mongoClient.db('admin');
    await adminDb.command({
      dropDatabase: 1,
      databaseName: CONFIG.TEST_DATABASE_NAME,
    });
  } catch {
    // Database may not exist
  }

  // Recreate collections after drop
  await setupTestDatabase();
}

// ============================================================================
// Service Management
// ============================================================================

async function startLocalServices(): Promise<void> {
  const services = [
    { name: 'orchestrator', port: 3000 },
    { name: 'payment-service', port: 3001 },
    { name: 'wallet-service', port: 4002 },
    { name: 'order-service', port: 4003 },
    { name: 'auth-service', port: 4004 },
    { name: 'notification-service', port: 4005 },
    { name: 'whatsapp-bridge', port: 5000 },
    { name: 'instagram-bridge', port: 5001 },
  ];

  for (const service of services) {
    try {
      const spawnedProcess = spawn('npm', ['run', 'dev'], {
        cwd: `../${service.name}`,
        stdio: 'pipe',
        shell: true,
        env: { ...process.env, NODE_ENV: 'test', PORT: String(service.port) },
      });

      serviceProcesses.set(service.name, spawnedProcess);
      logger.info(`Starting ${service.name} on port ${service.port}...`);
    } catch (error) {
      console.warn(`Could not start ${service.name}:`, error);
    }
  }

  // Wait for all services to be ready
  await Promise.all(
    services.map(async (service) => {
      try {
        const isReady = await waitForPort({
          port: service.port,
          host: 'localhost',
          timeout: CONFIG.SERVICE_STARTUP_TIMEOUT,
          output: 'silent',
        });
        if (isReady) {
          logger.info(`${service.name} is ready`);
        } else {
          logger.warn(`${service.name} did not start in time`);
        }
      } catch (error) {
        console.warn(`${service.name} did not start:`, error);
      }
    })
  );
}

async function stopLocalServices(): Promise<void> {
  for (const [name, proc] of serviceProcesses) {
    try {
      proc.kill('SIGTERM');
      logger.info(`Stopped ${name}`);
    } catch (error) {
      console.warn(`Failed to stop ${name}:`, error);
    }
  }
  serviceProcesses.clear();
}

async function waitForServicesHealthy(): Promise<void> {
  const services = [
    { name: 'Orchestrator', url: `${CONFIG.ORCHESTRATOR_URL}/health` },
    { name: 'Payment Service', url: `${CONFIG.PAYMENT_SERVICE_URL}/health` },
    { name: 'Wallet Service', url: `${CONFIG.WALLET_SERVICE_URL}/health` },
    { name: 'Order Service', url: `${CONFIG.ORDER_SERVICE_URL}/health` },
  ];

  await Promise.all(
    services.map(async (service) => {
      try {
        const client = axiosInstances.get(service.name.toLowerCase().replace(' ', '-'));
        if (client) {
          await client.get(service.url, { timeout: 5000 });
          logger.info(`${service.name} is healthy`);
        }
      } catch {
        logger.warn(`${service.name} health check failed (may not be running)`);
      }
    })
  );
}

// ============================================================================
// HTTP Client Initialization
// ============================================================================

function initializeAxiosClients(): void {
  const clients = [
    { name: 'orchestrator', baseURL: CONFIG.ORCHESTRATOR_URL },
    { name: 'payment', baseURL: CONFIG.PAYMENT_SERVICE_URL },
    { name: 'wallet', baseURL: CONFIG.WALLET_SERVICE_URL },
    { name: 'order', baseURL: CONFIG.ORDER_SERVICE_URL },
    { name: 'auth', baseURL: CONFIG.AUTH_SERVICE_URL },
    { name: 'notification', baseURL: CONFIG.NOTIFICATION_SERVICE_URL },
    { name: 'whatsapp', baseURL: CONFIG.WHATSAPP_BRIDGE_URL },
    { name: 'instagram', baseURL: CONFIG.INSTAGRAM_BRIDGE_URL },
  ];

  for (const clientConfig of clients) {
    const client = axios.create({
      baseURL: clientConfig.baseURL,
      timeout: CONFIG.HTTP_REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth
    client.interceptors.request.use((config) => {
      const serviceName = clientConfig.name;
      const token = CONFIG.INTERNAL_SERVICE_TOKENS[serviceName as keyof typeof CONFIG.INTERNAL_SERVICE_TOKENS];
      if (token) {
        config.headers['X-Internal-Token'] = token;
      }
      return config;
    });

    axiosInstances.set(clientConfig.name, client);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export const helpers = {
  /**
   * Create a test user
   */
  async createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    if (!db) throw new Error('Database not initialized');

    const userId = overrides.userId || `test_user_${uuidv4().slice(0, 8)}`;
    const user: TestUser = {
      userId,
      name: overrides.name || 'Test User',
      email: overrides.email || `${userId}@test.com`,
      phone: overrides.phone || `+1555${uuidv4().slice(0, 7)}`,
      walletBalance: overrides.walletBalance ?? 1000,
    };

    await db.collection('users').insertOne({
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create wallet for user
    await db.collection('wallets').insertOne({
      userId: user.userId,
      balance: user.walletBalance,
      currency: 'INR',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return user;
  },

  /**
   * Create a test order
   */
  async createTestOrder(userId: string, items?: TestOrder['items']): Promise<TestOrder> {
    if (!db) throw new Error('Database not initialized');

    const orderId = `order_${uuidv4().slice(0, 12)}`;
    const orderItems = items || [
      { itemId: `item_${uuidv4().slice(0, 8)}`, name: 'Biryani', quantity: 2, price: 250 },
      { itemId: `item_${uuidv4().slice(0, 8)}`, name: 'Raita', quantity: 1, price: 50 },
    ];

    const order: TestOrder = {
      orderId,
      userId,
      items: orderItems,
      total: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'PENDING',
    };

    await db.collection('orders').insertOne({
      ...order,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return order;
  },

  /**
   * Send chat message to orchestrator
   */
  async sendChatMessage(
    message: string,
    userId: string,
    channel: 'WHATSAPP' | 'INSTAGRAM' | 'WEB' | 'API' = 'API'
  ): Promise<OrchestratorResponse> {
    const client = axiosInstances.get('orchestrator');
    if (!client) {
      throw new Error('Orchestrator client not initialized');
    }

    try {
      const response = await client.post('/api/chat', {
        message,
        userId,
        channel,
        sessionId: uuidv4(),
      });
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      console.error('Chat message failed:', axiosError.response?.data || axiosError.message);
      throw error;
    }
  },

  /**
   * Create payment via payment service
   */
  async createPayment(
    orderId: string,
    amount: number,
    userId: string,
    method: 'WALLET' | 'RAZORPAY' | 'CARD' = 'WALLET'
  ): Promise<PaymentResult> {
    const client = axiosInstances.get('payment');
    if (!client) {
      return { success: false, status: 'FAILED', error: 'Payment client not initialized' };
    }

    try {
      const response = await client.post('/api/payments/initiate', {
        orderId,
        amount,
        userId,
        method,
        currency: 'INR',
        idempotencyKey: uuidv4(),
      });
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      return axiosError.response?.data as PaymentResult || {
        success: false,
        status: 'FAILED',
        error: axiosError.message
      };
    }
  },

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId: string): Promise<PaymentResult> {
    const client = axiosInstances.get('payment');
    if (!client) {
      return { success: false, status: 'UNKNOWN', error: 'Payment client not initialized' };
    }

    try {
      const response = await client.get(`/api/payments/${paymentId}`);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      return axiosError.response?.data as PaymentResult || {
        success: false,
        status: 'UNKNOWN',
        error: axiosError.message
      };
    }
  },

  /**
   * Get wallet balance
   */
  async getWalletBalance(userId: string): Promise<number> {
    if (!db) throw new Error('Database not initialized');

    const wallet = await db.collection('wallets').findOne({ userId });
    return wallet?.balance ?? 0;
  },

  /**
   * Deduct from wallet
   */
  async deductWallet(userId: string, amount: number): Promise<boolean> {
    if (!db) throw new Error('Database not initialized');

    const result = await db.collection('wallets').updateOne(
      { userId, balance: { $gte: amount } },
      {
        $inc: { balance: -amount },
        $set: { updatedAt: new Date() },
      }
    );
    return result.modifiedCount > 0;
  },

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string): Promise<boolean> {
    if (!db) throw new Error('Database not initialized');

    const result = await db.collection('orders').updateOne(
      { orderId },
      {
        $set: { status, updatedAt: new Date() },
      }
    );
    return result.modifiedCount > 0;
  },

  /**
   * Send WhatsApp message via bridge
   */
  async sendWhatsAppMessage(
    from: string,
    message: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    const client = axiosInstances.get('whatsapp');
    if (!client) {
      return { success: false, error: 'WhatsApp client not initialized' };
    }

    try {
      const response = await client.post('/webhook', {
        from,
        message,
        timestamp: new Date().toISOString(),
      });
      return { success: true, response: response.data?.response };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      return {
        success: false,
        error: (axiosError.response?.data as { error?: string })?.error || axiosError.message
      };
    }
  },

  /**
   * Send Instagram DM via bridge
   */
  async sendInstagramDM(
    from: string,
    message: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    const client = axiosInstances.get('instagram');
    if (!client) {
      return { success: false, error: 'Instagram client not initialized' };
    }

    try {
      const response = await client.post('/webhook', {
        sender: from,
        text: message,
        timestamp: new Date().toISOString(),
      });
      return { success: true, response: response.data?.response };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      return {
        success: false,
        error: (axiosError.response?.data as { error?: string })?.error || axiosError.message
      };
    }
  },

  /**
   * Call payment connector directly
   */
  async callPaymentConnector(
    action: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const client = axiosInstances.get('orchestrator');
    if (!client) {
      return { success: false, error: 'Orchestrator client not initialized' };
    }

    try {
      const response = await client.post(`/api/connectors/payment/${action}`, payload);
      return { success: true, data: response.data };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      return {
        success: false,
        error: (axiosError.response?.data as { error?: string })?.error || axiosError.message
      };
    }
  },

  /**
   * Call wallet connector directly
   */
  async callWalletConnector(
    action: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const client = axiosInstances.get('orchestrator');
    if (!client) {
      return { success: false, error: 'Orchestrator client not initialized' };
    }

    try {
      const response = await client.post(`/api/connectors/wallet/${action}`, payload);
      return { success: true, data: response.data };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      return {
        success: false,
        error: (axiosError.response?.data as { error?: string })?.error || axiosError.message
      };
    }
  },

  /**
   * Call order connector directly
   */
  async callOrderConnector(
    action: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const client = axiosInstances.get('orchestrator');
    if (!client) {
      return { success: false, error: 'Orchestrator client not initialized' };
    }

    try {
      const response = await client.post(`/api/connectors/order/${action}`, payload);
      return { success: true, data: response.data };
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      return {
        success: false,
        error: (axiosError.response?.data as { error?: string })?.error || axiosError.message
      };
    }
  },

  /**
   * Get test context
   */
  async getTestContext(): Promise<TestContext> {
    const testUser = await helpers.createTestUser();
    const testOrder = await helpers.createTestOrder(testUser.userId);
    return {
      testUser,
      testOrder,
      sessionId: uuidv4(),
    };
  },

  /**
   * Generate unique ID
   */
  generateId: (): string => uuidv4(),

  /**
   * Wait for specified duration
   */
  wait: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Retry operation with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          logger.info(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await helpers.wait(delay);
        }
      }
    }

    throw lastError;
  },
};

// ============================================================================
// Export Configuration and State
// ============================================================================

export {
  CONFIG,
  db,
  redis,
  axiosInstances,
  mongoClient,
};

export default {
  CONFIG,
  db,
  redis,
  axiosInstances,
  mongoClient,
  helpers,
};
