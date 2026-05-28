import { logger } from './utils/logger.js';

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Environment configuration
const REAL_HEALTH_CHECK = process.env.REAL_HEALTH_CHECK === 'true';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// Service Registry - Complete REZ Ecosystem (90+ services)
const serviceRegistry: Record<string, Service> = {
  // =============================================================================
  // RABTUL SHARED SERVICES (Infrastructure Foundation)
  // =============================================================================
  'rez-auth-service': {
    name: 'rez-auth-service',
    displayName: 'Authentication Service',
    description: 'Centralized authentication and authorization service',
    category: 'infrastructure',
    port: 4002,
    url: process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['auth', 'security', 'identity', 'jwt', 'oauth'],
    status: 'unknown'
  },
  'rez-payment-service': {
    name: 'rez-payment-service',
    displayName: 'Payment Service',
    description: 'Payment processing via Razorpay with ledger and fraud shield',
    category: 'payments',
    port: 4001,
    url: process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['payments', 'razorpay', 'ledger', 'transactions'],
    status: 'unknown'
  },
  'rez-wallet-service': {
    name: 'rez-wallet-service',
    displayName: 'Wallet Service',
    description: 'Digital wallet management and balance tracking',
    category: 'payments',
    port: 4004,
    url: process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['wallet', 'balance', 'credits'],
    status: 'unknown'
  },
  'rez-order-service': {
    name: 'rez-order-service',
    displayName: 'Order Service',
    description: 'Order management and fulfillment orchestration',
    category: 'commerce',
    port: 4006,
    url: process.env.ORDER_SERVICE_URL || 'https://rez-order-service-hz18.onrender.com',
    healthEndpoint: '/health',
    tags: ['orders', 'fulfillment', 'commerce'],
    status: 'unknown'
  },
  'rez-catalog-service': {
    name: 'rez-catalog-service',
    displayName: 'Catalog Service',
    description: 'Product catalog management and indexing',
    category: 'commerce',
    port: 4007,
    url: process.env.CATALOG_SERVICE_URL || 'https://rez-catalog-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['products', 'catalog', 'inventory'],
    status: 'unknown'
  },
  'rez-search-service': {
    name: 'rez-search-service',
    displayName: 'Search Service',
    description: 'Full-text search and product discovery',
    category: 'commerce',
    port: 4008,
    url: process.env.SEARCH_SERVICE_URL || 'https://rez-search-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['search', 'discovery', 'elasticsearch'],
    status: 'unknown'
  },
  'rez-booking-service': {
    name: 'rez-booking-service',
    displayName: 'Booking Service',
    description: 'Reservation and appointment booking system',
    category: 'commerce',
    port: 4020,
    url: process.env.BOOKING_SERVICE_URL || 'https://rez-booking-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['booking', 'reservations', 'appointments'],
    status: 'unknown'
  },
  'rez-delivery-service': {
    name: 'rez-delivery-service',
    displayName: 'Delivery Service',
    description: 'Delivery tracking and logistics management',
    category: 'commerce',
    port: 4009,
    url: process.env.DELIVERY_SERVICE_URL || 'https://rez-delivery-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['delivery', 'logistics', 'tracking'],
    status: 'unknown'
  },
  'rez-notifications-service': {
    name: 'rez-notifications-service',
    displayName: 'Notifications Service',
    description: 'Multi-channel notifications (email, SMS, push)',
    category: 'communication',
    port: 4011,
    url: process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['notifications', 'email', 'sms', 'push'],
    status: 'unknown'
  },
  'rez-analytics-service': {
    name: 'rez-analytics-service',
    displayName: 'Analytics Service',
    description: 'Real-time analytics and event tracking',
    category: 'analytics',
    port: 4016,
    url: process.env.ANALYTICS_SERVICE_URL || 'https://rez-analytics-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['analytics', 'events', 'metrics'],
    status: 'unknown'
  },
  'rez-insights-service': {
    name: 'rez-insights-service',
    displayName: 'Insights Service',
    description: 'Business intelligence and insights generation',
    category: 'analytics',
    port: 4017,
    url: process.env.INSIGHTS_SERVICE_URL || 'https://rez-insights-service.onrender.com',
    healthEndpoint: '/health',
    tags: ['insights', 'bi', 'reporting'],
    status: 'unknown'
  },
  'REZ-rfm-plus': {
    name: 'REZ-rfm-plus',
    displayName: 'RFM Plus Service',
    description: 'Enhanced RFM (Recency, Frequency, Monetary) customer segmentation',
    category: 'analytics',
    port: 4055,
    url: 'http://localhost:4055',
    healthEndpoint: '/health',
    tags: ['rfm', 'segmentation', 'customers', 'marketing'],
    status: 'unknown'
  },
  'REZ-circuit-breaker': {
    name: 'REZ-circuit-breaker',
    displayName: 'Circuit Breaker Service',
    description: 'Resilience pattern implementation for fault tolerance',
    category: 'infrastructure',
    port: 4030,
    url: 'http://localhost:4030',
    healthEndpoint: '/health',
    tags: ['resilience', 'fault-tolerance', 'circuit-breaker'],
    status: 'unknown'
  },
  'REZ-dlq-service': {
    name: 'REZ-dlq-service',
    displayName: 'Dead Letter Queue Service',
    description: 'Failed message handling and retry orchestration',
    category: 'infrastructure',
    port: 4032,
    url: 'http://localhost:4032',
    healthEndpoint: '/health',
    tags: ['dlq', 'messaging', 'retry', 'errors'],
    status: 'unknown'
  },
  'REZ-idempotency-service': {
    name: 'REZ-idempotency-service',
    displayName: 'Idempotency Service',
    description: 'Request deduplication and idempotency key management',
    category: 'infrastructure',
    port: 4033,
    url: 'http://localhost:4033',
    healthEndpoint: '/health',
    tags: ['idempotency', 'deduplication', 'requests'],
    status: 'unknown'
  },
  'REZ-secrets-manager': {
    name: 'REZ-secrets-manager',
    displayName: 'Secrets Manager',
    description: 'Centralized secrets management and rotation',
    category: 'infrastructure',
    port: 4035,
    url: 'http://localhost:4035',
    healthEndpoint: '/health',
    tags: ['secrets', 'vault', 'credentials'],
    status: 'unknown'
  },

  // =============================================================================
  // REZ-INTELLIGENCE SERVICES (AI/ML Core)
  // =============================================================================
  'REZ-reorder-engine': {
    name: 'REZ-reorder-engine',
    displayName: 'Reorder Engine',
    description: 'AI-powered automatic reorder prediction and triggering',
    category: 'intelligence',
    port: 4040,
    url: process.env.REORDER_ENGINE_URL || 'http://localhost:4040',
    healthEndpoint: '/health',
    tags: ['ai', 'reorder', 'predictions', 'automation'],
    status: 'unknown'
  },
  'REZ-taste-profile': {
    name: 'REZ-taste-profile',
    displayName: 'Taste Profile Service',
    description: 'Personalized taste and preference profiling',
    category: 'intelligence',
    port: 4041,
    url: 'http://localhost:4041',
    healthEndpoint: '/health',
    tags: ['taste', 'preferences', 'personalization', 'recommendations'],
    status: 'unknown'
  },
  'REZ-demand-forecast': {
    name: 'REZ-demand-forecast',
    displayName: 'Demand Forecast Service',
    description: 'ML-based demand forecasting and trend analysis',
    category: 'intelligence',
    port: 4042,
    url: 'http://localhost:4042',
    healthEndpoint: '/health',
    tags: ['demand', 'forecasting', 'trends', 'ml'],
    status: 'unknown'
  },
  'REZ-price-predictor': {
    name: 'REZ-price-predictor',
    displayName: 'Price Predictor',
    description: 'Dynamic pricing optimization using ML',
    category: 'intelligence',
    port: 4043,
    url: 'http://localhost:4043',
    healthEndpoint: '/health',
    tags: ['pricing', 'dynamic-pricing', 'optimization'],
    status: 'unknown'
  },
  'REZ-identity-graph': {
    name: 'REZ-identity-graph',
    displayName: 'Identity Graph',
    description: 'Unified customer identity resolution across channels',
    category: 'intelligence',
    port: 4050,
    url: process.env.IDENTITY_SERVICE_URL || 'http://localhost:4050',
    healthEndpoint: '/health',
    tags: ['identity', 'resolution', 'customer', 'graph'],
    status: 'unknown'
  },
  'REZ-memory-engine': {
    name: 'REZ-memory-engine',
    displayName: 'Memory Engine',
    description: 'Long-term memory and context retention for AI',
    category: 'intelligence',
    port: 4051,
    url: 'http://localhost:4051',
    healthEndpoint: '/health',
    tags: ['memory', 'context', 'ai', 'retention'],
    status: 'unknown'
  },
  'REZ-ai-router': {
    name: 'REZ-ai-router',
    displayName: 'AI Router',
    description: 'Intelligent routing of AI requests to optimal models',
    category: 'intelligence',
    port: 4052,
    url: 'http://localhost:4052',
    healthEndpoint: '/health',
    tags: ['ai', 'routing', 'llm', 'models'],
    status: 'unknown'
  },
  'REZ-knowledge-graph': {
    name: 'REZ-knowledge-graph',
    displayName: 'Knowledge Graph',
    description: 'Enterprise knowledge graph and semantic search',
    category: 'intelligence',
    port: 4060,
    url: 'http://localhost:4060',
    healthEndpoint: '/health',
    tags: ['knowledge', 'graph', 'semantic', 'search'],
    status: 'unknown'
  },
  'REZ-merchant-brain': {
    name: 'REZ-merchant-brain',
    displayName: 'Merchant Brain',
    description: 'AI-powered merchant insights and recommendations',
    category: 'intelligence',
    port: 4061,
    url: 'http://localhost:4061',
    healthEndpoint: '/health',
    tags: ['merchant', 'insights', 'ai', 'recommendations'],
    status: 'unknown'
  },
  'REZ-autonomous-agents': {
    name: 'REZ-autonomous-agents',
    displayName: 'Autonomous Agents',
    description: 'AI agents for autonomous task execution',
    category: 'intelligence',
    port: 4062,
    url: process.env.AGENT_ORCHESTRATOR_URL || 'http://localhost:4062',
    healthEndpoint: '/health',
    tags: ['agents', 'autonomous', 'ai', 'automation'],
    status: 'unknown'
  },
  'REZ-payments-brain': {
    name: 'REZ-payments-brain',
    displayName: 'Payments Brain',
    description: 'AI-driven payment optimization and fraud prevention',
    category: 'intelligence',
    port: 4070,
    url: 'http://localhost:4070',
    healthEndpoint: '/health',
    tags: ['payments', 'ai', 'fraud', 'optimization'],
    status: 'unknown'
  },
  'REZ-inventory-sync': {
    name: 'REZ-inventory-sync',
    displayName: 'Inventory Sync',
    description: 'Real-time inventory synchronization across channels',
    category: 'intelligence',
    port: 4071,
    url: 'http://localhost:4071',
    healthEndpoint: '/health',
    tags: ['inventory', 'sync', 'real-time', 'channels'],
    status: 'unknown'
  },
  'REZ-creator-network': {
    name: 'REZ-creator-network',
    displayName: 'Creator Network',
    description: 'Creator collaboration and content monetization',
    category: 'intelligence',
    port: 4072,
    url: 'http://localhost:4072',
    healthEndpoint: '/health',
    tags: ['creators', 'influencers', 'collaboration'],
    status: 'unknown'
  },
  'REZ-merchant-os': {
    name: 'REZ-merchant-os',
    displayName: 'Merchant OS',
    description: 'Operating system for merchant operations',
    category: 'intelligence',
    port: 4073,
    url: 'http://localhost:4073',
    healthEndpoint: '/health',
    tags: ['merchant', 'os', 'operations', 'dashboard'],
    status: 'unknown'
  },
  'REZ-event-bus': {
    name: 'REZ-event-bus',
    displayName: 'Event Bus',
    description: 'Centralized event streaming and pub/sub',
    category: 'intelligence',
    port: 4031,
    url: process.env.EVENT_BUS_URL || 'http://localhost:4031',
    healthEndpoint: '/health',
    tags: ['events', 'streaming', 'pubsub', 'kafka'],
    status: 'unknown'
  },
  'REZ-integration-sdk': {
    name: 'REZ-integration-sdk',
    displayName: 'Integration SDK',
    description: 'Unified SDK for third-party integrations',
    category: 'intelligence',
    port: 4091,
    url: 'http://localhost:4091',
    healthEndpoint: '/health',
    tags: ['sdk', 'integration', 'third-party'],
    status: 'unknown'
  },
  'REZ-identity-bridge': {
    name: 'REZ-identity-bridge',
    displayName: 'Identity Bridge',
    description: 'Cross-platform identity linking and bridging',
    category: 'intelligence',
    port: 4092,
    url: 'http://localhost:4092',
    healthEndpoint: '/health',
    tags: ['identity', 'bridge', 'linking', 'platforms'],
    status: 'unknown'
  },
  'REZ-feedback-collector': {
    name: 'REZ-feedback-collector',
    displayName: 'Feedback Collector',
    description: 'Unified feedback collection and analysis',
    category: 'intelligence',
    port: 4085,
    url: 'http://localhost:4085',
    healthEndpoint: '/health',
    tags: ['feedback', 'collection', 'analysis', 'nps'],
    status: 'unknown'
  },
  'REZ-unified-recommendations': {
    name: 'REZ-unified-recommendations',
    displayName: 'Unified Recommendations',
    description: 'Cross-channel recommendation engine',
    category: 'intelligence',
    port: 4090,
    url: 'http://localhost:4090',
    healthEndpoint: '/health',
    tags: ['recommendations', 'personalization', 'ml'],
    status: 'unknown'
  },
  'REZ-notification-router': {
    name: 'REZ-notification-router',
    displayName: 'Notification Router',
    description: 'Intelligent notification routing and prioritization',
    category: 'intelligence',
    port: 4093,
    url: 'http://localhost:4093',
    healthEndpoint: '/health',
    tags: ['notifications', 'routing', 'ai', 'prioritization'],
    status: 'unknown'
  },
  'REZ-realtime-gateway': {
    name: 'REZ-realtime-gateway',
    displayName: 'Realtime Gateway',
    description: 'WebSocket and SSE gateway for real-time updates',
    category: 'intelligence',
    port: 4094,
    url: 'http://localhost:4094',
    healthEndpoint: '/health',
    tags: ['realtime', 'websocket', 'sse', 'gateway'],
    status: 'unknown'
  },
  'REZ-health-monitor': {
    name: 'REZ-health-monitor',
    displayName: 'Health Monitor',
    description: 'Service health monitoring and alerting',
    category: 'intelligence',
    port: 4095,
    url: 'http://localhost:4095',
    healthEndpoint: '/health',
    tags: ['health', 'monitoring', 'alerting', 'uptime'],
    status: 'unknown'
  },
  'REZ-flywheel-mvp': {
    name: 'REZ-flywheel-mvp',
    displayName: 'Flywheel MVP',
    description: 'Growth flywheel orchestration engine',
    category: 'intelligence',
    port: 4101,
    url: process.env.FLYWHEEL_SERVICE_URL || 'http://localhost:4101',
    healthEndpoint: '/health',
    tags: ['flywheel', 'growth', 'orchestration'],
    status: 'unknown'
  },
  'REZ-copilot-service': {
    name: 'REZ-copilot-service',
    displayName: 'AI Copilot Service',
    description: 'AI copilot for business operations assistance',
    category: 'intelligence',
    port: 4102,
    url: 'http://localhost:4102',
    healthEndpoint: '/health',
    tags: ['copilot', 'ai', 'assistant', 'llm'],
    status: 'unknown'
  },
  'REZ-decision-service': {
    name: 'REZ-decision-service',
    displayName: 'Decision Service',
    description: 'ML-powered decision making and recommendations',
    category: 'intelligence',
    port: 4103,
    url: 'http://localhost:4103',
    healthEndpoint: '/health',
    tags: ['decisions', 'ml', 'recommendations', 'business'],
    status: 'unknown'
  },

  // =============================================================================
  // REZ-COMMERCE SERVICES (Consumer & Merchant Operations)
  // =============================================================================
  'rez-food-delivery-service': {
    name: 'rez-food-delivery-service',
    displayName: 'Food Delivery Service',
    description: 'End-to-end food delivery orchestration',
    category: 'commerce',
    port: 4010,
    url: 'http://localhost:4010',
    healthEndpoint: '/health',
    tags: ['food', 'delivery', 'ordering', 'restaurant'],
    status: 'unknown'
  },
  'rez-kds-service': {
    name: 'rez-kds-service',
    displayName: 'Kitchen Display System',
    description: 'Kitchen order management and display',
    category: 'commerce',
    port: 4011,
    url: 'http://localhost:4011',
    healthEndpoint: '/health',
    tags: ['kds', 'kitchen', 'orders', 'restaurant'],
    status: 'unknown'
  },
  'rez-pos-service': {
    name: 'rez-pos-service',
    displayName: 'Point of Sale Service',
    description: 'POS system for in-store transactions',
    category: 'commerce',
    port: 4012,
    url: 'http://localhost:4012',
    healthEndpoint: '/health',
    tags: ['pos', 'checkout', 'payments', 'store'],
    status: 'unknown'
  },
  'rez-inventory-engine': {
    name: 'rez-inventory-engine',
    displayName: 'Inventory Engine',
    description: 'Advanced inventory management and optimization',
    category: 'commerce',
    port: 4013,
    url: 'http://localhost:4013',
    healthEndpoint: '/health',
    tags: ['inventory', 'stock', 'warehousing'],
    status: 'unknown'
  },
  'rez-fraud-service': {
    name: 'rez-fraud-service',
    displayName: 'Fraud Detection Service',
    description: 'Real-time fraud detection and prevention',
    category: 'commerce',
    port: 4022,
    url: 'http://localhost:4022',
    healthEndpoint: '/health',
    tags: ['fraud', 'detection', 'prevention', 'ml'],
    status: 'unknown'
  },
  'rez-api-gateway': {
    name: 'rez-api-gateway',
    displayName: 'API Gateway',
    description: 'Central API gateway with routing and rate limiting',
    category: 'infrastructure',
    port: 4000,
    url: 'http://localhost:4000',
    healthEndpoint: '/health',
    tags: ['api', 'gateway', 'routing', 'rate-limiting'],
    status: 'unknown'
  },
  'rez-profile-aggregator-service': {
    name: 'rez-profile-aggregator-service',
    displayName: 'Profile Aggregator',
    description: 'Unified user profile aggregation across platforms',
    category: 'commerce',
    port: 4014,
    url: 'http://localhost:4014',
    healthEndpoint: '/health',
    tags: ['profile', 'user', 'aggregation', 'identity'],
    status: 'unknown'
  },
  'REZ-economic-engine': {
    name: 'REZ-economic-engine',
    displayName: 'Economic Engine',
    description: 'Economic modeling and pricing optimization',
    category: 'commerce',
    port: 4016,
    url: 'http://localhost:4016',
    healthEndpoint: '/health',
    tags: ['economics', 'pricing', 'modeling', 'optimization'],
    status: 'unknown'
  },
  'REZ-rto-engine': {
    name: 'REZ-rto-engine',
    displayName: 'RTO Engine',
    description: 'Real-time operations optimization engine',
    category: 'commerce',
    port: 4018,
    url: 'http://localhost:4018',
    healthEndpoint: '/health',
    tags: ['rto', 'optimization', 'real-time', 'operations'],
    status: 'unknown'
  },

  // =============================================================================
  // REZ-MEDIA SERVICES (Advertising & Digital Marketing)
  // =============================================================================
  'REZ-ad-ai': {
    name: 'REZ-ad-ai',
    displayName: 'Ad AI Service',
    description: 'AI-powered ad targeting and optimization',
    category: 'media',
    port: 4021,
    url: 'http://localhost:4021',
    healthEndpoint: '/health',
    tags: ['ads', 'ai', 'targeting', 'advertising'],
    status: 'unknown'
  },
  'REZ-ad-exchange': {
    name: 'REZ-ad-exchange',
    displayName: 'Ad Exchange',
    description: 'Programmatic advertising exchange platform',
    category: 'media',
    port: 4022,
    url: 'http://localhost:4022',
    healthEndpoint: '/health',
    tags: ['ad-exchange', 'programmatic', 'rtb', 'advertising'],
    status: 'unknown'
  },
  'REZ-dooh-service': {
    name: 'REZ-dooh-service',
    displayName: 'DOOH Service',
    description: 'Digital Out-of-Home advertising network',
    category: 'media',
    port: 4018,
    url: 'http://localhost:4018',
    healthEndpoint: '/health',
    tags: ['dooh', 'digital-signage', 'screens', 'advertising'],
    status: 'unknown'
  },
  'REZ-journey-service': {
    name: 'REZ-journey-service',
    displayName: 'Journey Service',
    description: 'User journey tracking with AI-check nodes',
    category: 'media',
    port: 4019,
    url: 'http://localhost:4019',
    healthEndpoint: '/health',
    tags: ['journey', 'tracking', 'funnels', 'analytics'],
    status: 'unknown'
  },
  'REZ-automation-service': {
    name: 'REZ-automation-service',
    displayName: 'Automation Service',
    description: 'Workflow automation with AI exception handling',
    category: 'media',
    port: 4028,
    url: 'http://localhost:4028',
    healthEndpoint: '/health',
    tags: ['automation', 'workflow', 'ai', 'exceptions'],
    status: 'unknown'
  },
  'REZ-whatsapp-commerce': {
    name: 'REZ-whatsapp-commerce',
    displayName: 'WhatsApp Commerce',
    description: 'Commerce via WhatsApp messaging platform',
    category: 'media',
    port: 4030,
    url: 'http://localhost:4030',
    healthEndpoint: '/health',
    tags: ['whatsapp', 'commerce', 'messaging', 'chatbot'],
    status: 'unknown'
  },
  'rez-instagram-sales-agent': {
    name: 'rez-instagram-sales-agent',
    displayName: 'Instagram Sales Agent',
    description: 'AI sales agent for Instagram shopping',
    category: 'media',
    port: 4032,
    url: 'http://localhost:4032',
    healthEndpoint: '/health',
    tags: ['instagram', 'social', 'sales', 'shopping'],
    status: 'unknown'
  },
  'REZ-marketing-service': {
    name: 'REZ-marketing-service',
    displayName: 'Marketing Service',
    description: 'Marketing campaigns and automation',
    category: 'media',
    port: 4026,
    url: 'http://localhost:4026',
    healthEndpoint: '/health',
    tags: ['marketing', 'campaigns', 'automation', 'email'],
    status: 'unknown'
  },
  'REZ-pricing-engine': {
    name: 'REZ-pricing-engine',
    displayName: 'Pricing Engine',
    description: 'Dynamic pricing engine for products and services',
    category: 'media',
    port: 4015,
    url: 'http://localhost:4015',
    healthEndpoint: '/health',
    tags: ['pricing', 'dynamic', 'optimization', 'revenue'],
    status: 'unknown'
  },

  // =============================================================================
  // SUPPORT & ANALYTICS SERVICES
  // =============================================================================
  'rez-cohort-service': {
    name: 'rez-cohort-service',
    displayName: 'Cohort Analysis Service',
    description: 'Customer cohort analysis and tracking',
    category: 'analytics',
    port: 4027,
    url: 'http://localhost:4027',
    healthEndpoint: '/health',
    tags: ['cohort', 'analysis', 'customers', 'retention'],
    status: 'unknown'
  },
  'REZ-capital-service': {
    name: 'REZ-capital-service',
    displayName: 'Capital Service',
    description: 'Restaurant lending and merchant financing',
    category: 'commerce',
    port: 3005,
    url: 'http://localhost:3005',
    healthEndpoint: '/health',
    tags: ['capital', 'lending', 'financing', 'merchant'],
    status: 'unknown'
  },
  'rez-return-service': {
    name: 'rez-return-service',
    displayName: 'Return Service',
    description: 'Return and refund processing',
    category: 'commerce',
    port: 4031,
    url: 'http://localhost:4031',
    healthEndpoint: '/health',
    tags: ['returns', 'refunds', 'exchanges'],
    status: 'unknown'
  },
  'rez-support-dashboard': {
    name: 'rez-support-dashboard',
    displayName: 'Support Dashboard Backend',
    description: 'Unified support ticket management backend',
    category: 'infrastructure',
    port: 4052,
    url: 'http://localhost:4052',
    healthEndpoint: '/health',
    tags: ['support', 'tickets', 'helpdesk', 'customer-service'],
    status: 'unknown'
  },

  // =============================================================================
  // E-COMMERCE CONNECTORS
  // =============================================================================
  'rez-shopify-connector': {
    name: 'rez-shopify-connector',
    displayName: 'Shopify Connector',
    description: 'Shopify OAuth, webhooks, and product/order sync',
    category: 'commerce',
    port: 4050,
    url: 'http://localhost:4050',
    healthEndpoint: '/health',
    tags: ['shopify', 'connector', 'ecommerce', 'sync'],
    status: 'unknown'
  },
  'rez-woocommerce-connector': {
    name: 'rez-woocommerce-connector',
    displayName: 'WooCommerce Connector',
    description: 'WooCommerce REST API, webhooks, and sync',
    category: 'commerce',
    port: 4051,
    url: 'http://localhost:4051',
    healthEndpoint: '/health',
    tags: ['woocommerce', 'connector', 'ecommerce', 'sync'],
    status: 'unknown'
  },

  // =============================================================================
  // AI MARKETING SERVICES
  // =============================================================================
  'REZ-prompt-workflow-ai': {
    name: 'REZ-prompt-workflow-ai',
    displayName: 'Prompt Workflow AI',
    description: 'Natural language to workflow generation',
    category: 'intelligence',
    port: 4054,
    url: 'http://localhost:4054',
    healthEndpoint: '/health',
    tags: ['nlp', 'workflow', 'automation', 'prompt-engineering'],
    status: 'unknown'
  },
  'REZ-crm-hub': {
    name: 'REZ-crm-hub',
    displayName: 'CRM Hub',
    description: 'HubSpot and Zoho CRM integration',
    category: 'communication',
    port: 4056,
    url: 'http://localhost:4056',
    healthEndpoint: '/health',
    tags: ['crm', 'hubspot', 'zoho', 'integration'],
    status: 'unknown'
  },
  'REZ-support-tools-hub': {
    name: 'REZ-support-tools-hub',
    displayName: 'Support Tools Hub',
    description: 'Zendesk, Freshdesk, and Intercom integration',
    category: 'communication',
    port: 4057,
    url: 'http://localhost:4057',
    healthEndpoint: '/health',
    tags: ['support', 'zendesk', 'freshdesk', 'intercom'],
    status: 'unknown'
  },
  'REZ-research-opportunity-agent': {
    name: 'REZ-research-opportunity-agent',
    displayName: 'Research Opportunity Agent',
    description: 'Business analysis and opportunity detection',
    category: 'intelligence',
    port: 4058,
    url: 'http://localhost:4058',
    healthEndpoint: '/health',
    tags: ['research', 'opportunities', 'analysis', 'ai'],
    status: 'unknown'
  },
  'rez-voice-cart-recovery': {
    name: 'rez-voice-cart-recovery',
    displayName: 'Voice Cart Recovery',
    description: 'AI voice calls for cart recovery and COD confirmation',
    category: 'commerce',
    port: 4053,
    url: 'http://localhost:4053',
    healthEndpoint: '/health',
    tags: ['voice', 'ai', 'cart-recovery', 'twilio'],
    status: 'unknown'
  },
  'REZ-rfm-service': {
    name: 'REZ-rfm-service',
    displayName: 'RFM Service',
    description: 'RFM (Recency, Frequency, Monetary) customer segmentation',
    category: 'analytics',
    port: 4055,
    url: 'http://localhost:4055',
    healthEndpoint: '/health',
    tags: ['rfm', 'segmentation', 'customers', 'marketing'],
    status: 'unknown'
  },

  // =============================================================================
  // ADDITIONAL SERVICES FROM ECOSYSTEM
  // =============================================================================
  'REZ-discovery-platform': {
    name: 'REZ-discovery-platform',
    displayName: 'Discovery Platform',
    description: 'Product discovery and ranking platform',
    category: 'commerce',
    port: 3000,
    url: 'http://localhost:3000',
    healthEndpoint: '/health',
    tags: ['discovery', 'ranking', 'search', 'recommendations'],
    status: 'unknown'
  },
  'REZ-engagement-platform': {
    name: 'REZ-engagement-platform',
    displayName: 'Engagement Platform',
    description: 'Loyalty, offers, and referral management',
    category: 'media',
    port: 4017,
    url: 'http://localhost:4017',
    healthEndpoint: '/health',
    tags: ['engagement', 'loyalty', 'offers', 'referrals'],
    status: 'unknown'
  },
  'REZ-media-events': {
    name: 'REZ-media-events',
    displayName: 'Media Events',
    description: 'Media event tracking and attribution',
    category: 'media',
    port: 4029,
    url: 'http://localhost:4029',
    healthEndpoint: '/health',
    tags: ['media', 'events', 'tracking', 'attribution'],
    status: 'unknown'
  },
  'REZ-ai-campaign-builder': {
    name: 'REZ-ai-campaign-builder',
    displayName: 'AI Campaign Builder',
    description: 'AI-powered campaign generation and optimization',
    category: 'media',
    port: 4009,
    url: 'http://localhost:4009',
    healthEndpoint: '/health',
    tags: ['campaigns', 'ai', 'advertising', 'generation'],
    status: 'unknown'
  },
  'REZ-central-permissions': {
    name: 'REZ-central-permissions',
    displayName: 'Central Permissions',
    description: 'RBAC/ABAC permissions management',
    category: 'infrastructure',
    port: 3001,
    url: 'http://localhost:3001',
    healthEndpoint: '/health',
    tags: ['permissions', 'rbac', 'abac', 'authorization'],
    status: 'unknown'
  },
  'REZ-identity-service': {
    name: 'REZ-identity-service',
    displayName: 'Identity Service',
    description: 'Identity graph and resolution service',
    category: 'infrastructure',
    port: 4001,
    url: 'http://localhost:4001',
    healthEndpoint: '/health',
    tags: ['identity', 'graph', 'resolution'],
    status: 'unknown'
  },
  'REZ-feedback-service': {
    name: 'REZ-feedback-service',
    displayName: 'Feedback Service',
    description: 'User feedback collection service',
    category: 'analytics',
    port: 4010,
    url: 'http://localhost:4010',
    healthEndpoint: '/health',
    tags: ['feedback', 'collection', 'reviews'],
    status: 'unknown'
  },
  'REZ-attribution-platform': {
    name: 'REZ-attribution-platform',
    displayName: 'Attribution Platform',
    description: 'Offline attribution tracking platform',
    category: 'analytics',
    port: 3000,
    url: 'http://localhost:3000',
    healthEndpoint: '/health',
    tags: ['attribution', 'tracking', 'offline', 'marketing'],
    status: 'unknown'
  },
  'rez-payment-correctness': {
    name: 'rez-payment-correctness',
    displayName: 'Payment Correctness Service',
    description: 'Ledger reconciliation, fraud shield, and idempotency',
    category: 'payments',
    port: 4020,
    url: 'http://localhost:4020',
    healthEndpoint: '/health',
    tags: ['payments', 'ledger', 'fraud', 'reconciliation'],
    status: 'unknown'
  },
  'rez-webhook-service': {
    name: 'rez-webhook-service',
    displayName: 'Webhook Service',
    description: 'Webhook management and delivery',
    category: 'infrastructure',
    port: 4034,
    url: 'http://localhost:4034',
    healthEndpoint: '/health',
    tags: ['webhooks', 'delivery', 'management'],
    status: 'unknown'
  },
  'rez-referral-service': {
    name: 'rez-referral-service',
    displayName: 'Referral Service',
    description: 'Referral program management',
    category: 'commerce',
    port: 4007,
    url: 'http://localhost:4007',
    healthEndpoint: '/health',
    tags: ['referrals', 'loyalty', 'marketing'],
    status: 'unknown'
  },
  'rez-rewards-service': {
    name: 'rez-rewards-service',
    displayName: 'Rewards Service',
    description: 'Customer rewards and loyalty points',
    category: 'commerce',
    port: 4008,
    url: 'http://localhost:4008',
    healthEndpoint: '/health',
    tags: ['rewards', 'loyalty', 'points'],
    status: 'unknown'
  },
  'rez-coupon-service': {
    name: 'rez-coupon-service',
    displayName: 'Coupon Service',
    description: 'Coupon and discount management',
    category: 'commerce',
    port: 4009,
    url: 'http://localhost:4009',
    healthEndpoint: '/health',
    tags: ['coupons', 'discounts', 'promotions'],
    status: 'unknown'
  },
  'rez-inventory-service': {
    name: 'rez-inventory-service',
    displayName: 'Inventory Service',
    description: 'Inventory tracking and management',
    category: 'commerce',
    port: 4010,
    url: 'http://localhost:4010',
    healthEndpoint: '/health',
    tags: ['inventory', 'stock', 'warehousing'],
    status: 'unknown'
  },
  'rez-shipping-service': {
    name: 'rez-shipping-service',
    displayName: 'Shipping Service',
    description: 'Shipping rate calculation and label generation',
    category: 'commerce',
    port: 4011,
    url: 'http://localhost:4011',
    healthEndpoint: '/health',
    tags: ['shipping', 'labels', 'rates'],
    status: 'unknown'
  },
  'REZ-lead-intelligence': {
    name: 'REZ-lead-intelligence',
    displayName: 'Lead Intelligence',
    description: 'AI-powered lead scoring and qualification',
    category: 'intelligence',
    port: 4059,
    url: 'http://localhost:4059',
    healthEndpoint: '/health',
    tags: ['leads', 'scoring', 'qualification', 'crm'],
    status: 'unknown'
  },
  'REZ-ai-agent-framework': {
    name: 'REZ-ai-agent-framework',
    displayName: 'AI Agent Framework',
    description: 'Framework for building AI agents',
    category: 'intelligence',
    port: 4100,
    url: 'http://localhost:4100',
    healthEndpoint: '/health',
    tags: ['ai', 'agents', 'framework', 'agents-sdk'],
    status: 'unknown'
  },
  'REZ-conversation-engine': {
    name: 'REZ-conversation-engine',
    displayName: 'Conversation Engine',
    description: 'Conversational AI and chat interface',
    category: 'intelligence',
    port: 4104,
    url: 'http://localhost:4104',
    healthEndpoint: '/health',
    tags: ['conversation', 'chat', 'ai', 'nlp'],
    status: 'unknown'
  },
  'REZ-sentiment-analyzer': {
    name: 'REZ-sentiment-analyzer',
    displayName: 'Sentiment Analyzer',
    description: 'Real-time sentiment analysis service',
    category: 'intelligence',
    port: 4105,
    url: 'http://localhost:4105',
    healthEndpoint: '/health',
    tags: ['sentiment', 'analysis', 'nlp', 'ai'],
    status: 'unknown'
  },
  'REZ-content-moderator': {
    name: 'REZ-content-moderator',
    displayName: 'Content Moderator',
    description: 'AI-powered content moderation',
    category: 'intelligence',
    port: 4106,
    url: 'http://localhost:4106',
    healthEndpoint: '/health',
    tags: ['moderation', 'content', 'ai', 'safety'],
    status: 'unknown'
  },
  'REZ-translation-service': {
    name: 'REZ-translation-service',
    displayName: 'Translation Service',
    description: 'Multi-language translation service',
    category: 'communication',
    port: 4107,
    url: 'http://localhost:4107',
    healthEndpoint: '/health',
    tags: ['translation', 'i18n', 'localization', 'language'],
    status: 'unknown'
  },
  'REZ-audio-analytics': {
    name: 'REZ-audio-analytics',
    displayName: 'Audio Analytics',
    description: 'Audio content analysis and transcription',
    category: 'analytics',
    port: 4108,
    url: 'http://localhost:4108',
    healthEndpoint: '/health',
    tags: ['audio', 'analytics', 'transcription', 'speech'],
    status: 'unknown'
  },
  'REZ-image-recognition': {
    name: 'REZ-image-recognition',
    displayName: 'Image Recognition',
    description: 'Computer vision and image analysis',
    category: 'intelligence',
    port: 4109,
    url: 'http://localhost:4109',
    healthEndpoint: '/health',
    tags: ['vision', 'images', 'recognition', 'cv'],
    status: 'unknown'
  },
  'REZ-document-processor': {
    name: 'REZ-document-processor',
    displayName: 'Document Processor',
    description: 'Document parsing and extraction',
    category: 'intelligence',
    port: 4110,
    url: 'http://localhost:4110',
    healthEndpoint: '/health',
    tags: ['documents', 'parsing', 'extraction', 'ocr'],
    status: 'unknown'
  },
  'REZ-data-enrichment': {
    name: 'REZ-data-enrichment',
    displayName: 'Data Enrichment',
    description: 'Third-party data enrichment service',
    category: 'analytics',
    port: 4111,
    url: 'http://localhost:4111',
    healthEndpoint: '/health',
    tags: ['enrichment', 'data', 'third-party', 'apis'],
    status: 'unknown'
  },
  'REZ-ab-testing': {
    name: 'REZ-ab-testing',
    displayName: 'A/B Testing Service',
    description: 'Experiment and A/B testing platform',
    category: 'analytics',
    port: 4112,
    url: 'http://localhost:4112',
    healthEndpoint: '/health',
    tags: ['ab-testing', 'experiments', 'optimization'],
    status: 'unknown'
  },
  'REZ-feature-flags': {
    name: 'REZ-feature-flags',
    displayName: 'Feature Flags Service',
    description: 'Feature flag management and rollout',
    category: 'infrastructure',
    port: 4113,
    url: 'http://localhost:4113',
    healthEndpoint: '/health',
    tags: ['feature-flags', 'rollout', 'experiments'],
    status: 'unknown'
  },
  'REZ-suggestion-engine': {
    name: 'REZ-suggestion-engine',
    displayName: 'Suggestion Engine',
    description: 'Real-time suggestion and autocomplete',
    category: 'intelligence',
    port: 4114,
    url: 'http://localhost:4114',
    healthEndpoint: '/health',
    tags: ['suggestions', 'autocomplete', 'search', 'ai'],
    status: 'unknown'
  },
  'REZ-anomaly-detection': {
    name: 'REZ-anomaly-detection',
    displayName: 'Anomaly Detection',
    description: 'Real-time anomaly detection in data streams',
    category: 'analytics',
    port: 4115,
    url: 'http://localhost:4115',
    healthEndpoint: '/health',
    tags: ['anomaly', 'detection', 'ml', 'monitoring'],
    status: 'unknown'
  },
  'REZ-forecasting-service': {
    name: 'REZ-forecasting-service',
    displayName: 'Forecasting Service',
    description: 'Time-series forecasting service',
    category: 'analytics',
    port: 4116,
    url: 'http://localhost:4116',
    healthEndpoint: '/health',
    tags: ['forecasting', 'time-series', 'predictions'],
    status: 'unknown'
  },
  'REZ-churn-predictor': {
    name: 'REZ-churn-predictor',
    displayName: 'Churn Predictor',
    description: 'Customer churn prediction service',
    category: 'analytics',
    port: 4117,
    url: 'http://localhost:4117',
    healthEndpoint: '/health',
    tags: ['churn', 'retention', 'predictions', 'ml'],
    status: 'unknown'
  },
  'REZ-ltv-calculator': {
    name: 'REZ-ltv-calculator',
    displayName: 'LTV Calculator',
    description: 'Customer Lifetime Value calculation',
    category: 'analytics',
    port: 4118,
    url: 'http://localhost:4118',
    healthEndpoint: '/health',
    tags: ['ltv', 'lifetime-value', 'customers', 'metrics'],
    status: 'unknown'
  },
  'REZ-customer-health-score': {
    name: 'REZ-customer-health-score',
    displayName: 'Customer Health Score',
    description: 'Customer health scoring service',
    category: 'analytics',
    port: 4119,
    url: 'http://localhost:4119',
    healthEndpoint: '/health',
    tags: ['health-score', 'customers', 'metrics'],
    status: 'unknown'
  }
};

interface Service {
  name: string;
  displayName: string;
  description?: string;
  category: 'infrastructure' | 'payments' | 'commerce' | 'communication' | 'analytics' | 'intelligence' | 'media';
  port?: number;
  url: string;
  healthEndpoint: string;
  tags?: string[];
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  uptime?: number;
  lastHealthCheck?: string;
  responseTime?: number;
}

// Real health check function
async function checkRealHealth(service: Service): Promise<{ status: Service['status']; responseTime?: number; error?: string }> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${service.url}${service.healthEndpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(INTERNAL_SERVICE_TOKEN ? { 'X-Internal-Token': INTERNAL_SERVICE_TOKEN } : {})
      },
      signal: controller.signal
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return { status: 'healthy', responseTime };
    } else if (response.status >= 500) {
      return { status: 'down', responseTime, error: `HTTP ${response.status}` };
    } else {
      return { status: 'degraded', responseTime, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { status: 'down', responseTime, error: 'Timeout (5s)' };
      }
      return { status: 'down', responseTime, error: error.message };
    }
    return { status: 'down', responseTime, error: 'Unknown error' };
  }
}

// Batch health check all services
async function refreshAllServiceHealth(): Promise<void> {
  if (!REAL_HEALTH_CHECK) return;

  const healthChecks = Object.values(serviceRegistry).map(async (service) => {
    const result = await checkRealHealth(service);
    service.status = result.status;
    service.responseTime = result.responseTime;
    service.lastHealthCheck = new Date().toISOString();
  });

  await Promise.all(healthChecks);
}

// MCP Tools
const tools = [
  {
    name: 'list_services',
    description: 'List all available services in the REZ ecosystem. Can filter by category, status, or tag. Returns comprehensive information about 90+ services across infrastructure, payments, commerce, intelligence, communication, analytics, and media categories.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['infrastructure', 'payments', 'commerce', 'communication', 'analytics', 'intelligence', 'media'],
          description: 'Filter by service category'
        },
        status: {
          type: 'string',
          enum: ['healthy', 'degraded', 'down', 'unknown'],
          description: 'Filter by current status'
        },
        tag: {
          type: 'string',
          description: 'Filter by tag (e.g., "ai", "payments", "ml")'
        }
      }
    }
  },
  {
    name: 'get_service',
    description: 'Get detailed information about a specific service including health status, description, tags, and connection details.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The service name (e.g., rez-auth-service, rez-order-service)'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'get_service_health',
    description: 'Check the health status of a service with detailed health checks.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The service name'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'get_service_logs',
    description: 'Get recent logs from a service (if available).',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The service name'
        },
        lines: {
          type: 'number',
          description: 'Number of log lines to retrieve (default: 100)',
          default: 100
        }
      },
      required: ['name']
    }
  },
  {
    name: 'find_services',
    description: 'Find services by keyword search in name, description, or tags.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'refresh_health_checks',
    description: 'Refresh health status for all services from real endpoints.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_service_count',
    description: 'Get count of services by category or overall.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['infrastructure', 'payments', 'commerce', 'communication', 'analytics', 'intelligence', 'media'],
          description: 'Filter by category'
        }
      }
    }
  }
];

// Tool handlers
async function handleListServices(args: Record<string, unknown>): Promise<string> {
  let services = Object.values(serviceRegistry);

  if (args.category && typeof args.category === 'string') {
    services = services.filter(s => s.category === args.category);
  }

  if (args.status && typeof args.status === 'string') {
    services = services.filter(s => s.status === args.status);
  }

  if (args.tag && typeof args.tag === 'string') {
    const tag = args.tag.toLowerCase();
    services = services.filter(s => s.tags?.some(t => t.toLowerCase().includes(tag)));
  }

  return JSON.stringify({
    count: services.length,
    totalServices: Object.keys(serviceRegistry).length,
    services: services.map(s => ({
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      category: s.category,
      port: s.port,
      url: s.url,
      tags: s.tags,
      status: s.status
    })),
    realHealthCheck: REAL_HEALTH_CHECK,
    note: REAL_HEALTH_CHECK ? 'Health checks are live' : 'Set REAL_HEALTH_CHECK=true to enable live health checks'
  }, null, 2);
}

async function handleGetService(args: Record<string, unknown>): Promise<string> {
  const name = typeof args.name === 'string' ? args.name : String(args.name);
  const service = serviceRegistry[name];

  if (!service) {
    return JSON.stringify({
      error: 'Service not found',
      available: Object.keys(serviceRegistry),
      suggestion: 'Try using find_services with a keyword to discover services'
    });
  }

  // Perform real health check if enabled
  if (REAL_HEALTH_CHECK) {
    const healthResult = await checkRealHealth(service);
    service.status = healthResult.status;
    service.responseTime = healthResult.responseTime;
    service.lastHealthCheck = new Date().toISOString();
  }

  return JSON.stringify(service, null, 2);
}

async function handleGetServiceHealth(args: Record<string, unknown>): Promise<string> {
  const name = typeof args.name === 'string' ? args.name : String(args.name);
  const service = serviceRegistry[name];

  if (!service) {
    return JSON.stringify({ error: 'Service not found' });
  }

  let healthResult;
  let checks;

  if (REAL_HEALTH_CHECK) {
    // Perform real health check
    const result = await checkRealHealth(service);
    healthResult = result;
    service.status = result.status;
    service.responseTime = result.responseTime;
    service.lastHealthCheck = new Date().toISOString();

    checks = [
      { name: 'http', status: result.status === 'healthy' ? 'pass' : result.status === 'degraded' ? 'warn' : 'fail', latency: result.responseTime },
      { name: 'service', status: result.status === 'healthy' ? 'pass' : 'fail' }
    ];
  } else {
    // Return mock health checks
    checks = [
      { name: 'http', status: service.status === 'healthy' ? 'pass' : 'fail' },
      { name: 'database', status: 'pass' },
      { name: 'cache', status: 'pass' }
    ];
  }

  return JSON.stringify({
    service: service.name,
    displayName: service.displayName,
    status: service.status,
    timestamp: new Date().toISOString(),
    responseTime: healthResult?.responseTime,
    error: healthResult?.error,
    checks,
    realHealthCheck: REAL_HEALTH_CHECK
  }, null, 2);
}

async function handleGetServiceLogs(args: Record<string, unknown>): Promise<string> {
  const name = typeof args.name === 'string' ? args.name : String(args.name);
  const service = serviceRegistry[name];

  if (!service) {
    return JSON.stringify({ error: 'Service not found' });
  }

  // Try to fetch real logs if the service has a logs endpoint
  if (REAL_HEALTH_CHECK) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${service.url}/logs?lines=${args.lines || 100}`, {
        headers: {
          'X-Internal-Token': INTERNAL_SERVICE_TOKEN
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const logs = await response.json();
        return JSON.stringify({
          service: service.name,
          source: 'remote',
          logs: logs.logs || logs
        }, null, 2);
      }
    } catch {
      // Fall back to mock logs
    }
  }

  // Mock logs for demo
  return JSON.stringify({
    service: service.name,
    source: 'mock',
    lines: args.lines || 100,
    logs: [
      `[${new Date().toISOString()}] INFO: Service started`,
      `[${new Date().toISOString()}] INFO: Connected to database`,
      `[${new Date().toISOString()}] INFO: Health check passed`
    ],
    note: 'Set REAL_HEALTH_CHECK=true to fetch real logs'
  }, null, 2);
}

async function handleFindServices(args: Record<string, unknown>): Promise<string> {
  const query = typeof args.query === 'string' ? args.query.toLowerCase() : String(args.query || '');

  const matches = Object.values(serviceRegistry).filter(s =>
    s.name.toLowerCase().includes(query) ||
    s.displayName.toLowerCase().includes(query) ||
    s.description?.toLowerCase().includes(query) ||
    s.category.toLowerCase().includes(query) ||
    s.tags?.some(t => t.toLowerCase().includes(query))
  );

  return JSON.stringify({
    query,
    count: matches.length,
    services: matches.map(s => ({
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      category: s.category,
      port: s.port,
      tags: s.tags
    }))
  }, null, 2);
}

async function handleRefreshHealthChecks(): Promise<string> {
  await refreshAllServiceHealth();

  return JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    services: Object.values(serviceRegistry).map(s => ({
      name: s.name,
      status: s.status,
      responseTime: s.responseTime,
      lastHealthCheck: s.lastHealthCheck
    }))
  }, null, 2);
}

async function handleGetServiceCount(args: Record<string, unknown>): Promise<string> {
  const byCategory = Object.values(serviceRegistry).reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let filtered = Object.values(serviceRegistry);
  if (args.category) {
    filtered = filtered.filter(s => s.category === args.category);
  }

  return JSON.stringify({
    total: Object.keys(serviceRegistry).length,
    filtered: filtered.length,
    byCategory,
    category: args.category || 'all'
  }, null, 2);
}

// Create MCP Server
const server = new Server(
  {
    name: 'rez-service-discovery',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'list_services':
        result = await handleListServices(args as Record<string, unknown>);
        break;
      case 'get_service':
        result = await handleGetService(args as Record<string, unknown>);
        break;
      case 'get_service_health':
        result = await handleGetServiceHealth(args as Record<string, unknown>);
        break;
      case 'get_service_logs':
        result = await handleGetServiceLogs(args as Record<string, unknown>);
        break;
      case 'find_services':
        result = await handleFindServices(args as Record<string, unknown>);
        break;
      case 'refresh_health_checks':
        result = await handleRefreshHealthChecks();
        break;
      case 'get_service_count':
        result = await handleGetServiceCount(args as Record<string, unknown>);
        break;
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (error) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }], isError: true };
  }
});

// Start server
async function main() {
  logger.error(`REZ Service Discovery MCP running on stdio with ${Object.keys(serviceRegistry).length} services`);
  logger.error(`Real health checks: ${REAL_HEALTH_CHECK ? 'ENABLED' : 'DISABLED (set REAL_HEALTH_CHECK=true to enable)'}`);

  // Initial health check if enabled
  if (REAL_HEALTH_CHECK) {
    await refreshAllServiceHealth();
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
