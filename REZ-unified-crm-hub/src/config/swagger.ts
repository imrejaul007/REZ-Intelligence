/**
 * Swagger/OpenAPI Configuration
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'REZ Unified CRM Hub API',
      version: '1.0.0',
      description: `
⚠️ INTERNAL USE ONLY - For REZ Platform Team Only

This API provides two separate endpoints:

**Internal API (Port 4100)**
- Full customer intelligence data
- AI predictions, intent signals, engagement scores
- DO NOT expose to merchants or customers

**Merchant API (Port 4101)**
- Sanitized customer data safe for merchants
- Customer names, orders, basic segments
- NO AI predictions, engagement scores, or raw behavioral data

## Security

All internal endpoints require the \`X-Internal-Token\` header.
Merchant endpoints require Bearer JWT authentication.
      `,
      contact: {
        name: 'REZ Platform Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:4100',
        description: 'Internal API (Port 4100)',
      },
      {
        url: 'http://localhost:4101',
        description: 'Merchant API (Port 4101)',
      },
    ],
    components: {
      securitySchemes: {
        InternalToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Internal-Token',
          description: 'Internal service token for platform services',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Merchant JWT token',
        },
      },
      schemas: {
        // Internal Types
        InternalCustomer: {
          type: 'object',
          description: '🔒 INTERNAL: Full customer profile with AI intelligence',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            fullName: { type: 'string' },
            predictions: { $ref: '#/components/schemas/InternalPredictions' },
            engagement: { $ref: '#/components/schemas/InternalEngagement' },
            intentSignals: { $ref: '#/components/schemas/IntentSignals' },
          },
        },
        InternalPredictions: {
          type: 'object',
          description: '🔒 INTERNAL: AI-generated predictions',
          properties: {
            churnRisk: { type: 'string', enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            churnProbability: { type: 'number', minimum: 0, maximum: 1 },
            ltvPrediction: { $ref: '#/components/schemas/LTVPrediction' },
          },
        },
        InternalEngagement: {
          type: 'object',
          description: '🔒 INTERNAL: AI engagement scoring',
          properties: {
            score: { type: 'number', minimum: 0, maximum: 100 },
            tier: { type: 'string', enum: ['INACTIVE', 'COLD', 'WARM', 'HOT', 'CHAMPION'] },
          },
        },
        IntentSignals: {
          type: 'object',
          description: '🔒 INTERNAL: Customer intent tracking',
          properties: {
            intentScore: { type: 'number', minimum: 0, maximum: 100 },
            purchaseIntent: { $ref: '#/components/schemas/PurchaseIntent' },
          },
        },
        LTVPrediction: {
          type: 'object',
          properties: {
            predicted: { type: 'number' },
            actual: { type: 'number' },
            confidence: { type: 'number' },
            timeframe: { type: 'string', enum: ['30d', '90d', '365d'] },
          },
        },
        PurchaseIntent: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            timeframe: { type: 'string' },
            productsOfInterest: { type: 'array', items: { type: 'string' } },
          },
        },

        // Merchant Types
        MerchantCustomer: {
          type: 'object',
          description: '👁️ MERCHANT: Sanitized customer data',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            phone: { type: 'string' },
            segments: { type: 'array', items: { type: 'string' } },
            totalOrders: { type: 'number' },
            totalSpend: { type: 'number' },
            averageOrderValue: { type: 'number' },
            lastVisit: { type: 'string', format: 'date-time' },
          },
        },
        MerchantSegment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            customerCount: { type: 'number' },
            totalRevenue: { type: 'number' },
          },
        },

        // Common
        DashboardOverview: {
          type: 'object',
          properties: {
            totalCustomers: { type: 'number' },
            activeCustomers: { type: 'number' },
            newCustomersThisMonth: { type: 'number' },
            revenue: { $ref: '#/components/schemas/RevenueMetrics' },
            engagement: { $ref: '#/components/schemas/EngagementMetrics' },
          },
        },
        RevenueMetrics: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            averageOrderValue: { type: 'number' },
            totalOrders: { type: 'number' },
          },
        },
        EngagementMetrics: {
          type: 'object',
          properties: {
            averageEngagementScore: { type: 'number' },
            activeUsers: { type: 'number' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string' },
            meta: { type: 'object' },
          },
        },
      },
    },
    security: [
      { InternalToken: [] },
    ],
    tags: [
      {
        name: 'Internal Dashboard',
        description: '🔒 Internal API - Full intelligence data',
      },
      {
        name: 'Internal Customers',
        description: '🔒 Internal API - Customer 360 with AI predictions',
      },
      {
        name: 'Internal Smart Tags',
        description: '🔒 Internal API - AI-generated customer tags',
      },
      {
        name: 'Merchant Customers',
        description: '👁️ Merchant API - Sanitized customer data',
      },
      {
        name: 'Merchant Inbox',
        description: '👁️ Merchant API - Unified messaging',
      },
      {
        name: 'Health',
        description: 'Service health and status',
      },
    ],
    paths: {
      // Internal API
      '/api/v1/internal/dashboard/overview': {
        get: {
          tags: ['Internal Dashboard'],
          summary: 'Get dashboard overview',
          description: '🔒 INTERNAL: Returns full dashboard with AI-generated metrics',
          security: [{ InternalToken: [] }],
          responses: {
            '200': {
              description: 'Dashboard overview',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DashboardOverview' },
                },
              },
            },
          },
        },
      },
      '/api/v1/internal/customers': {
        get: {
          tags: ['Internal Customers'],
          summary: 'List all customers',
          description: '🔒 INTERNAL: Returns customers with full intelligence data',
          security: [{ InternalToken: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'number' } },
            { name: 'limit', in: 'query', schema: { type: 'number' } },
            { name: 'q', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Customer list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/InternalCustomer' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/internal/customers/{id}': {
        get: {
          tags: ['Internal Customers'],
          summary: 'Get customer by ID',
          description: '🔒 INTERNAL: Returns full Customer 360 with AI predictions',
          security: [{ InternalToken: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Customer detail',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/InternalCustomer' },
                },
              },
            },
          },
        },
      },
      '/api/v1/internal/customers/{id}/predictions': {
        get: {
          tags: ['Internal Customers'],
          summary: 'Get AI predictions',
          description: '🔒 INTERNAL: Returns churn, LTV, and conversion predictions',
          security: [{ InternalToken: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'AI predictions',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/InternalPredictions' },
                },
              },
            },
          },
        },
      },
      '/api/v1/internal/customers/{id}/intent': {
        get: {
          tags: ['Internal Customers'],
          summary: 'Get intent signals',
          description: '🔒 INTERNAL: Returns browsing, purchase intent, and brand affinity',
          security: [{ InternalToken: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Intent signals',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/IntentSignals' },
                },
              },
            },
          },
        },
      },
      '/api/v1/internal/tags': {
        get: {
          tags: ['Internal Smart Tags'],
          summary: 'List smart tags',
          description: '🔒 INTERNAL: Returns AI-generated customer tags',
          security: [{ InternalToken: [] }],
          responses: {
            '200': {
              description: 'Smart tags list',
            },
          },
        },
      },

      // Merchant API
      '/api/v1/merchant/customers': {
        get: {
          tags: ['Merchant Customers'],
          summary: 'List merchant customers',
          description: '👁️ MERCHANT: Returns sanitized customer data (no AI predictions)',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'number' } },
            { name: 'limit', in: 'query', schema: { type: 'number' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'segment', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Merchant-safe customer list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: { type: 'array', items: { $ref: '#/components/schemas/MerchantCustomer' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/merchant/customers/{id}': {
        get: {
          tags: ['Merchant Customers'],
          summary: 'Get customer detail',
          description: '👁️ MERCHANT: Returns sanitized customer with orders',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Customer detail (merchant-safe)',
            },
          },
        },
      },
      '/api/v1/merchant/segments': {
        get: {
          tags: ['Merchant Customers'],
          summary: 'List segments',
          description: '👁️ MERCHANT: Returns basic segment info',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Segments list',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/MerchantSegment' },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/merchant/inbox/messages': {
        get: {
          tags: ['Merchant Inbox'],
          summary: 'Get inbox messages',
          description: '👁️ MERCHANT: Returns unified messages',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Inbox messages',
            },
          },
        },
      },
      '/api/v1/merchant/inbox/channels': {
        get: {
          tags: ['Merchant Inbox'],
          summary: 'Get channel status',
          description: '👁️ MERCHANT: Returns connected channels',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Channel status',
            },
          },
        },
      },

      // Health
      '/api/v1/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          description: 'Returns service health status',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      service: { type: 'string' },
                      timestamp: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/ready': {
        get: {
          tags: ['Health'],
          summary: 'Readiness check',
          description: 'Checks if all dependent services are healthy',
          responses: {
            '200': {
              description: 'Service is ready',
            },
            '503': {
              description: 'Service is not ready',
            },
          },
        },
      },
      '/api/v1/services': {
        get: {
          tags: ['Health'],
          summary: 'Service status',
          description: 'Returns status of all connected services',
          responses: {
            '200': {
              description: 'Service health list',
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
