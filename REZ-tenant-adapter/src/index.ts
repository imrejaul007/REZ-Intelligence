/**
 * REZ Tenant Adapter
 * Multi-tenant isolation layer for REZ Intelligence
 * Supports 3 client types with strict data isolation
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { ClientType, TenantContext, IntelligenceLevel, TenantConfig } from './types';
import { tenantService } from './services/tenantService';
import { knowledgeBaseService } from './services/knowledgeBaseService';
import { privacyService } from './services/privacyService';
import { logger } from './utils/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4210', 10);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request ID
app.use((req, res, next) => {
  req.headers['x-request-id'] = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'REZ-Tenant-Adapter', timestamp: new Date().toISOString() });
});

// Tenant Context Middleware
function tenantContext(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const internalToken = req.headers['x-internal-token'] as string;

  // Internal token bypass
  if (internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
    (req as Request & { tenant: TenantContext }).tenant = {
      tenantId: 'rez_internal',
      clientType: ClientType.REZ_ECOSYSTEM,
      knowledgeBaseId: 'rez_internal',
      intelligenceLevel: IntelligenceLevel.FULL,
      permissions: ['admin'],
      dataIsolation: 'shared'
    };
    return next();
  }

  // Parse API key format: rez_{type}_{id}
  if (apiKey && apiKey.startsWith('rez_')) {
    const parts = apiKey.split('_');
    if (parts.length >= 3) {
      const typeMap: Record<string, ClientType> = {
        'rez': ClientType.REZ_ECOSYSTEM,
        'ext': ClientType.NON_REZ,
        'saas': ClientType.RABTUL_SAAS
      };
      const clientType = typeMap[parts[1]] || ClientType.NON_REZ;
      const tenantId = parts.slice(2).join('_');

      (req as Request & { tenant: TenantContext }).tenant = {
        tenantId,
        clientType,
        knowledgeBaseId: `kb_${tenantId.substring(0, 8)}`,
        intelligenceLevel: clientType === ClientType.REZ_ECOSYSTEM ? IntelligenceLevel.FULL : IntelligenceLevel.ISOLATED,
        permissions: clientType === ClientType.REZ_ECOSYSTEM ? ['admin'] : ['read', 'write'],
        dataIsolation: clientType === ClientType.REZ_ECOSYSTEM ? 'shared' : 'strict'
      };
      return next();
    }
  }

  res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Valid API key required' } });
}

// ─────────────────────────────────────────────────────────
// TENANT MANAGEMENT
// ─────────────────────────────────────────────────────────

// Create tenant
app.post('/api/tenants', (req, res) => {
  const { clientType, displayName, industry, merchantId } = req.body;

  if (!clientType || !displayName || !industry) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'clientType, displayName, and industry required' }
    });
  }

  const tenant = tenantService.createTenant({ clientType, displayName, industry, merchantId });
  const apiKey = tenantService.generateApiKey(tenant);

  res.status(201).json({
    success: true,
    data: { tenant, apiKey },
    message: 'Tenant created. Save the API key securely - it will not be shown again.'
  });
});

// List tenants
app.get('/api/tenants', (req, res) => {
  const { clientType } = req.query;
  const tenants = tenantService.listTenants(clientType as ClientType);
  res.json({ success: true, data: { tenants, count: tenants.length } });
});

// Get tenant
app.get('/api/tenants/:tenantId', (req, res) => {
  const tenant = tenantService.getTenant(req.params.tenantId);
  if (!tenant) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
  }
  res.json({ success: true, data: { tenant } });
});

// ─────────────────────────────────────────────────────────
// KNOWLEDGE BASE (Tenant-isolated)
// ─────────────────────────────────────────────────────────

app.use('/api/knowledge', tenantContext);

// Add knowledge entry
app.post('/api/knowledge/entries', (req, res) => {
  const { tenant } = req as Request & { tenant: TenantContext };
  const entry = knowledgeBaseService.addEntry(tenant.tenantId, {
    ...req.body,
    isActive: true
  });
  res.status(201).json({ success: true, data: { entry } });
});

// Search knowledge base
app.get('/api/knowledge/search', (req, res) => {
  const { tenant } = req as Request & { tenant: TenantContext };
  const { q, limit } = req.query;
  const results = knowledgeBaseService.search(tenant.tenantId, q as string, parseInt(limit as string) || 10);
  res.json({ success: true, data: { results, count: results.length } });
});

// Get all entries
app.get('/api/knowledge/entries', (req, res) => {
  const { tenant } = req as Request & { tenant: TenantContext };
  const entries = knowledgeBaseService.getAllEntries(tenant.tenantId);
  res.json({ success: true, data: { entries, count: entries.length } });
});

// Bulk import
app.post('/api/knowledge/import', (req, res) => {
  const { tenant } = req as Request & { tenant: TenantContext };
  const { entries } = req.body;
  const imported = knowledgeBaseService.bulkImport(tenant.tenantId, entries);
  res.status(201).json({ success: true, data: { imported: imported.length } });
});

// ─────────────────────────────────────────────────────────
// PRIVACY CHECKS
// ─────────────────────────────────────────────────────────

// Check data access
app.post('/api/privacy/can-access', tenantContext, (req, res) => {
  const { tenant } = req as Request & { tenant: TenantContext };
  const { targetTenantId } = req.body;
  const check = privacyService.canAccessCrossTenantData(tenant, targetTenantId);
  res.json({ success: true, data: check });
});

// Check intent sharing
app.post('/api/privacy/can-share-intent', tenantContext, (req, res) => {
  const { tenant } = req as Request & { tenant: TenantContext };
  const { userId, intent, confidence } = req.body;
  const check = privacyService.canShareIntent(tenant, { userId, intent, confidence });
  res.json({ success: true, data: check });
});

// Filter data based on privacy
app.post('/api/privacy/filter', tenantContext, (req, res) => {
  const { tenant } = req as Request & { tenant: TenantContext };
  const filtered = privacyService.filterData(tenant, req.body);
  res.json({ success: true, data: { filtered } });
});

// ─────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`REZ Tenant Adapter started on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    clientTypes: Object.values(ClientType)
  });
});

export default app;
