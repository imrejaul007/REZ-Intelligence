/**
 * REZ Intelligence - Monitoring Service
 *
 * Health check aggregator and monitoring dashboard
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import logger from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '4250', 10);

// ============================================
// SERVICE REGISTRY
// ============================================

interface ServiceEndpoint {
  name: string;
  url: string;
  port: number;
  critical: boolean;
}

const SERVICES: ServiceEndpoint[] = [
  // Infrastructure
  { name: 'mongodb', url: 'mongodb://localhost:27017', port: 27017, critical: true },
  { name: 'redis', url: 'redis://localhost:6379', port: 6379, critical: true },

  // Gateway Services
  { name: 'rez-api-gateway', url: 'http://localhost:4300', port: 4300, critical: true },
  { name: 'rez-tenant-adapter', url: 'http://localhost:4210', port: 4210, critical: true },
  { name: 'rez-saas-runtime', url: 'http://localhost:4220', port: 4220, critical: false },

  // Core AI Services
  { name: 'rez-intent-predictor', url: 'http://localhost:4018', port: 4018, critical: true },
  { name: 'rez-predictive-engine', url: 'http://localhost:4141', port: 4141, critical: true },
  { name: 'rez-knowledge-graph', url: 'http://localhost:4060', port: 4060, critical: false },

  // Memory & Workflow
  { name: 'rez-whatsapp', url: 'http://localhost:4202', port: 4202, critical: false },
  { name: 'rez-memory-layer', url: 'http://localhost:4201', port: 4201, critical: true },
  { name: 'rez-flow-runtime', url: 'http://localhost:4200', port: 4200, critical: true },
  { name: 'rez-care-service', url: 'http://localhost:4058', port: 4058, critical: false },

  // Orchestration
  { name: 'rez-orchestrator-v2', url: 'http://localhost:4015', port: 4015, critical: true },
  { name: 'rez-agent-registry', url: 'http://localhost:4011', port: 4011, critical: true },

  // Expert Agents
  { name: 'rez-travel-expert', url: 'http://localhost:3003', port: 3003, critical: false },
  { name: 'rez-hospitality-expert', url: 'http://localhost:3004', port: 3004, critical: false },
  { name: 'rez-retail-expert', url: 'http://localhost:3005', port: 3005, critical: false },
  { name: 'rez-health-expert', url: 'http://localhost:3006', port: 3006, critical: false },
  { name: 'rez-fitness-expert', url: 'http://localhost:3007', port: 3007, critical: false },
  { name: 'rez-salon-expert', url: 'http://localhost:3008', port: 3008, critical: false },
  { name: 'rez-culinary-expert', url: 'http://localhost:3009', port: 3009, critical: false },
  { name: 'rez-education-expert', url: 'http://localhost:3010', port: 3010, critical: false },
];

// ============================================
// TYPES
// ============================================

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency: number;
  uptime: number;
  lastChecked: string;
  port: number;
  critical: boolean;
  error?: string;
}

interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    criticalDown: number;
  };
  services: ServiceHealth[];
}

// ============================================
// HEALTH CHECK
// ============================================

async function checkServiceHealth(service: ServiceEndpoint): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    const response = await axios.get(`${service.url}/health`, {
      timeout: 5000,
      validateStatus: () => true,
    });

    const latency = Date.now() - start;
    const status = response.status === 200 ? 'healthy' : 'degraded';

    return {
      name: service.name,
      status,
      latency,
      uptime: 100,
      lastChecked: new Date().toISOString(),
      port: service.port,
      critical: service.critical,
    };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';

    return {
      name: service.name,
      status: 'unhealthy',
      latency,
      uptime: 0,
      lastChecked: new Date().toISOString(),
      port: service.port,
      critical: service.critical,
      error: errorMessage,
    };
  }
}

// ============================================
// ROUTES
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'rez-monitoring', timestamp: new Date().toISOString() });
});

app.get('/api/health', async (_req: Request, res: Response) => {
  const healthChecks = await Promise.all(SERVICES.map(checkServiceHealth));

  const report: HealthReport = {
    overall: 'healthy',
    timestamp: new Date().toISOString(),
    summary: {
      total: healthChecks.length,
      healthy: healthChecks.filter(s => s.status === 'healthy').length,
      degraded: healthChecks.filter(s => s.status === 'degraded').length,
      unhealthy: healthChecks.filter(s => s.status === 'unhealthy').length,
      unknown: healthChecks.filter(s => s.status === 'unknown').length,
      criticalDown: healthChecks.filter(s => s.critical && s.status === 'unhealthy').length,
    },
    services: healthChecks,
  };

  if (report.summary.criticalDown > 0) {
    report.overall = 'unhealthy';
  } else if (report.summary.unhealthy > 0 || report.summary.degraded > 0) {
    report.overall = 'degraded';
  }

  const statusCode = report.overall === 'healthy' ? 200 : report.overall === 'degraded' ? 200 : 503;
  res.status(statusCode).json(report);
});

app.get('/api/health/:serviceName', async (req: Request, res: Response) => {
  const service = SERVICES.find(s => s.name === req.params.serviceName);
  if (!service) {
    res.status(404).json({ success: false, error: 'Service not found' });
    return;
  }
  const health = await checkServiceHealth(service);
  res.json({ success: true, data: health });
});

app.get('/api/health/summary', async (_req: Request, res: Response) => {
  const healthChecks = await Promise.all(SERVICES.map(checkServiceHealth));
  res.json({
    success: true,
    data: {
      overall: healthChecks.some(s => s.critical && s.status === 'unhealthy')
        ? 'unhealthy'
        : healthChecks.some(s => s.status !== 'healthy')
        ? 'degraded'
        : 'healthy',
      timestamp: new Date().toISOString(),
      summary: {
        total: healthChecks.length,
        healthy: healthChecks.filter(s => s.status === 'healthy').length,
        criticalDown: healthChecks.filter(s => s.critical && s.status === 'unhealthy').length,
      },
    },
  });
});

app.get('/dashboard', (_req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>REZ Intelligence - Service Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
    h1 { font-size: 24px; color: #f8fafc; }
    .Summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .Summary-card { background: #1e293b; padding: 20px; border-radius: 12px; text-align: center; }
    .Summary-card .value { font-size: 32px; font-weight: bold; }
    .Summary-card .label { color: #94a3b8; margin-top: 5px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }
    .service-card { background: #1e293b; padding: 20px; border-radius: 12px; }
    .service-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .service-name { font-weight: bold; font-size: 16px; }
    .service-status { padding: 4px 10px; border-radius: 12px; font-size: 12px; }
    .service-status.healthy { background: #166534; color: #bbf7d0; }
    .service-status.degraded { background: #854d0e; color: #fef08a; }
    .service-status.unhealthy { background: #991b1b; color: #fecaca; }
    .service-details { font-size: 13px; color: #94a3b8; }
    .service-details div { margin: 4px 0; }
    .critical { border: 1px solid #ef4444; }
    .refresh { background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .refresh:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>REZ Intelligence - Service Monitor</h1>
      <button class="refresh" onclick="location.reload()">Refresh</button>
    </header>
    <div class="Summary">
      <div class="Summary-card">
        <div class="value" id="total">-</div>
        <div class="label">Total Services</div>
      </div>
      <div class="Summary-card">
        <div class="value" id="healthy" style="color: #bbf7d0">-</div>
        <div class="label">Healthy</div>
      </div>
      <div class="Summary-card">
        <div class="value" id="degraded" style="color: #fef08a">-</div>
        <div class="label">Degraded</div>
      </div>
      <div class="Summary-card">
        <div class="value" id="unhealthy" style="color: #fecaca">-</div>
        <div class="label">Unhealthy</div>
      </div>
    </div>
    <div class="grid" id="services">Loading...</div>
  </div>
  <script>
    async function loadHealth() {
      const res = await fetch('/api/health');
      const data = await res.json();
      document.getElementById('total').textContent = data.summary.total;
      document.getElementById('healthy').textContent = data.summary.healthy;
      document.getElementById('degraded').textContent = data.summary.degraded;
      document.getElementById('unhealthy').textContent = data.summary.unhealthy;
      const container = document.getElementById('services');
      container.innerHTML = data.services.map(s => \`
        <div class="service-card \${s.critical ? 'critical' : ''}">
          <div class="service-header">
            <span class="service-name">\${s.name}</span>
            <span class="service-status \${s.status}">\${s.status.toUpperCase()}</span>
          </div>
          <div class="service-details">
            <div>Port: \${s.port}</div>
            <div>Latency: \${s.latency}ms</div>
            <div>Last checked: \${new Date(s.lastChecked).toLocaleTimeString()}</div>
            \${s.error ? '<div style="color:#fecaca">Error: ' + s.error + '</div>' : ''}
          </div>
        </div>
      \`).join('');
    }
    loadHealth();
    setInterval(loadHealth, 30000);
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  logger.info(`REZ Monitoring started on port ${PORT}`);
  logger.info(`Monitoring ${SERVICES.length} services`);
});

export default app;
