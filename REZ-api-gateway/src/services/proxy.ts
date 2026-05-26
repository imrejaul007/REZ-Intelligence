/**
 * Service Proxy
 * Routes requests to internal REZ Intelligence services
 */

import { Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger.js';
import { ClientType } from '../middleware/tenantIsolation';

const SERVICES = {
  memory: process.env.REZ_MEMORY_URL || 'http://localhost:4201',
  flow: process.env.REZ_FLOW_URL || 'http://localhost:4200',
  intent: process.env.REZ_INTENT_URL || 'http://localhost:4018',
  care: process.env.REZ_CARE_URL || 'http://localhost:4058',
  predictive: process.env.REZ_PREDICTIVE_URL || 'http://localhost:4141',
  whatsapp: process.env.REZ_WHATSAPP_URL || 'http://localhost:4202'
};

const TIMEOUT = 30000;

class ProxyService {
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const path = req.path;
    const tenant = req.tenant;

    // Route based on path
    let targetUrl: string | null = null;

    if (path.startsWith('/memory')) {
      targetUrl = `${SERVICES.memory}/api${path.replace('/internal/memory', '')}`;
    } else if (path.startsWith('/flow')) {
      targetUrl = `${SERVICES.flow}/api${path.replace('/internal/flow', '')}`;
    } else if (path.startsWith('/intent')) {
      targetUrl = `${SERVICES.intent}/api${path.replace('/internal/intent', '')}`;
    } else if (path.startsWith('/care')) {
      targetUrl = `${SERVICES.care}/api${path.replace('/internal/care', '')}`;
    } else if (path.startsWith('/predict')) {
      targetUrl = `${SERVICES.predictive}/api${path.replace('/internal/predict', '')}`;
    } else if (path.startsWith('/whatsapp')) {
      targetUrl = `${SERVICES.whatsapp}/api${path.replace('/internal/whatsapp', '')}`;
    }

    if (!targetUrl) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Service not found' }
      });
      return;
    }

    try {
      // Build headers with tenant context
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token',
        'X-Request-ID': (req.headers['x-request-id'] as string) || ''
      };

      // Add tenant headers for isolation
      if (tenant) {
        headers['X-Tenant-ID'] = tenant.tenantId;
        headers['X-Client-Type'] = tenant.clientType;
        headers['X-Data-Isolation'] = tenant.dataIsolation;
      }

      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        params: req.query,
        headers,
        timeout: TIMEOUT
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      const axiosError = error as AxiosError;

      logger.error('Proxy error', {
        targetUrl,
        method: req.method,
        path,
        error: axiosError.message,
        tenantId: tenant?.tenantId
      });

      if (axiosError.response) {
        res.status(axiosError.response.status).json(axiosError.response.data);
      } else {
        res.status(502).json({
          success: false,
          error: {
            code: 'BAD_GATEWAY',
            message: 'Service unavailable'
          }
        });
      }
    }
  }
}

export const proxyService = new ProxyService();
