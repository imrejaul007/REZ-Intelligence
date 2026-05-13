/**
 * REZ Health Monitor Service
 * Production-ready health monitoring with circuit breaker support
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { getHealthMonitorConfig, DEFAULT_SERVICES, ServiceConfig } from './config/index.js';
import { getCircuitBreakerRegistry, CircuitState, CircuitBreakerStats } from './services/circuitBreaker.js';
import { getServiceChecker, HealthCheckResult } from './services/serviceChecker.js';
import {
  getRecentAlerts,
  getAlertSummary,
  formatAlertsForDashboard,
  sendRecoveryAlert,
  Alert
} from './services/alertService.js';

dotenv.config();

const config = getHealthMonitorConfig();
const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Services to monitor (can be overridden via environment)
const servicesToMonitor: ServiceConfig[] = process.env.SERVICES_CONFIG
  ? JSON.parse(process.env.SERVICES_CONFIG)
  : DEFAULT_SERVICES;

// Initialize checker
const serviceChecker = getServiceChecker();
const circuitRegistry = getCircuitBreakerRegistry();

// Background health check loop
let healthCheckInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

function startHealthCheckLoop(): void {
  const runHealthCheck = async (): Promise<void> => {
    if (isShuttingDown) return;

    try {
      const results = await serviceChecker.checkAllServices(servicesToMonitor);

      // Check for recoveries
      for (const result of results) {
        if (result.circuitState === CircuitState.HALF_OPEN && result.status === 'healthy') {
          await sendRecoveryAlert(result.name, result.circuitState);
        }
      }

      // Log summary
      const summary = serviceChecker.getSummary(servicesToMonitor);
      if (summary.down > 0) {
        console.log(`[Health Check] ${summary.healthy}/${summary.total} healthy, ${summary.down} down`);
      }
    } catch (error) {
      console.error('[Health Check] Error during health check:', error);
    }
  };

  // Initial check
  runHealthCheck().catch(console.error);

  // Schedule periodic checks
  healthCheckInterval = setInterval(runHealthCheck, config.healthCheck.intervalMs);
}

function stopHealthCheckLoop(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

// ============================================
// HEALTH ENDPOINTS
// ============================================

/**
 * Basic health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-health-monitor',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Get all services health
 */
app.get('/health/all', async (req: Request, res: Response) => {
  try {
    const results = await serviceChecker.checkAllServices(servicesToMonitor);
    const summary = serviceChecker.getSummary(servicesToMonitor);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      services: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get health for specific service
 */
app.get('/health/:serviceName', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const service = servicesToMonitor.find(s => s.name === serviceName);

  if (!service) {
    return res.status(404).json({
      success: false,
      error: 'Service not found',
      availableServices: servicesToMonitor.map(s => s.name),
    });
  }

  try {
    const result = await serviceChecker.checkService(service);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get detailed health for specific service
 */
app.get('/health/:serviceName/detailed', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const service = servicesToMonitor.find(s => s.name === serviceName);

  if (!service) {
    return res.status(404).json({
      success: false,
      error: 'Service not found',
    });
  }

  try {
    const result = await serviceChecker.getDetailedHealth(service);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// CIRCUIT BREAKER ENDPOINTS
// ============================================

/**
 * Get all circuit breaker states
 */
app.get('/circuits', (req: Request, res: Response) => {
  const stats = circuitRegistry.getAllStats();

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...stats,
  });
});

/**
 * Get circuit breaker state for specific service
 */
app.get('/circuits/:serviceName', (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const circuit = circuitRegistry.getCircuit(serviceName);

  res.json({
    success: true,
    ...circuit.getStats(),
  });
});

/**
 * Force reset a circuit breaker
 */
app.post('/circuits/:serviceName/reset', (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const circuit = circuitRegistry.getCircuit(serviceName);

  circuit.reset();

  res.json({
    success: true,
    message: `Circuit breaker for ${serviceName} has been reset`,
    ...circuit.getStats(),
  });
});

/**
 * Force a specific circuit state
 */
app.post('/circuits/:serviceName/state', (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const { state } = req.body;

  if (!Object.values(CircuitState).includes(state)) {
    return res.status(400).json({
      success: false,
      error: `Invalid state. Must be one of: ${Object.values(CircuitState).join(', ')}`,
    });
  }

  const circuit = circuitRegistry.getCircuit(serviceName);
  circuit.forceState(state);

  res.json({
    success: true,
    message: `Circuit breaker for ${serviceName} forced to ${state}`,
    ...circuit.getStats(),
  });
});

// ============================================
// ALERT ENDPOINTS
// ============================================

/**
 * Get recent alerts
 */
app.get('/alerts', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = getRecentAlerts(limit);
  const summary = getAlertSummary();

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    alerts,
    summary,
  });
});

/**
 * Get alerts for specific service
 */
app.get('/alerts/:serviceName', (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const alerts = getRecentAlerts(20).filter(a => a.serviceName === serviceName);

  res.json({
    success: true,
    serviceName,
    alerts,
  });
});

// ============================================
// SERVICES CONFIG ENDPOINTS
// ============================================

/**
 * Get monitored services list
 */
app.get('/services', (req: Request, res: Response) => {
  res.json({
    success: true,
    count: servicesToMonitor.length,
    services: servicesToMonitor,
  });
});

/**
 * Add a service to monitor
 */
app.post('/services', (req: Request, res: Response) => {
  const { name, url, category } = req.body;

  if (!name || !url) {
    return res.status(400).json({
      success: false,
      error: 'Name and URL are required',
    });
  }

  if (servicesToMonitor.some(s => s.name === name)) {
    return res.status(409).json({
      success: false,
      error: `Service ${name} is already being monitored`,
    });
  }

  servicesToMonitor.push({ name, url, category });
  serviceChecker.clearCache();

  res.json({
    success: true,
    message: `Service ${name} added to monitoring`,
    services: servicesToMonitor,
  });
});

/**
 * Remove a service from monitoring
 */
app.delete('/services/:serviceName', (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const index = servicesToMonitor.findIndex(s => s.name === serviceName);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Service not found',
    });
  }

  servicesToMonitor.splice(index, 1);
  circuitRegistry.remove(serviceName);
  serviceChecker.clearCache();

  res.json({
    success: true,
    message: `Service ${serviceName} removed from monitoring`,
    services: servicesToMonitor,
  });
});

// ============================================
// DASHBOARD
// ============================================

/**
 * Dashboard HTML page
 */
app.get('/dashboard', (req: Request, res: Response) => {
  res.send(getDashboardHTML());
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: config.nodeEnv === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Health Monitor] Received ${signal}. Shutting down gracefully...`);
  isShuttingDown = true;

  stopHealthCheckLoop();

  // Allow in-flight requests to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('[Health Monitor] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================
// STARTUP
// ============================================

async function startServer(): Promise<void> {
  try {
    // Start health check loop
    startHealthCheckLoop();

    app.listen(config.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                  REZ HEALTH MONITOR v2.0.0                     ║
╠══════════════════════════════════════════════════════════════════╣
║  Status:     Running                                           ║
║  Port:       ${String(config.port).padEnd(48)}║
║  Environment: ${config.nodeEnv.padEnd(46)}║
╠══════════════════════════════════════════════════════════════════╣
║  Health Check Interval: ${String(config.healthCheck.intervalMs / 1000 + 's').padEnd(39)}║
║  Circuit Breaker Threshold: ${String(config.circuitBreaker.failureThreshold).padEnd(32)}║
║  Circuit Reset Timeout: ${String(config.circuitBreaker.resetTimeoutMs / 1000 + 's').padEnd(35)}║
╠══════════════════════════════════════════════════════════════════╣
║  Monitored Services: ${String(servicesToMonitor.length).padEnd(43)}║
╚══════════════════════════════════════════════════════════════════╝

  Endpoints:
  • GET  /health           - Basic health check
  • GET  /health/all       - All services health
  • GET  /health/:name     - Specific service health
  • GET  /circuits         - Circuit breaker states
  • GET  /alerts           - Recent alerts
  • GET  /dashboard        - Web dashboard

  Dashboard: http://localhost:${config.port}/dashboard
      `);
    });
  } catch (error) {
    console.error('Failed to start Health Monitor:', error);
    process.exit(1);
  }
}

startServer();

// ============================================
// DASHBOARD HTML
// ============================================

function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REZ Health Monitor Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e0e0e0;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    h1 {
      color: #fff;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .header-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .stat-value { font-size: 2.5rem; font-weight: bold; }
    .stat-label { font-size: 0.9rem; color: #aaa; margin-top: 5px; }
    .stat-card.healthy .stat-value { color: #4caf50; }
    .stat-card.degraded .stat-value { color: #ff9800; }
    .stat-card.down .stat-value { color: #f44336; }
    .stat-card.info .stat-value { color: #2196f3; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 15px;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
      border-left: 4px solid #666;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .card.healthy { border-left-color: #4caf50; }
    .card.degraded { border-left-color: #ff9800; }
    .card.down { border-left-color: #f44336; }
    .card.half_open { border-left-color: #2196f3; }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .card h3 { color: #fff; font-size: 1rem; }
    .status-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.healthy { background: #4caf50; color: #fff; }
    .status-badge.degraded { background: #ff9800; color: #fff; }
    .status-badge.down { background: #f44336; color: #fff; }
    .status-badge.half_open { background: #2196f3; color: #fff; }
    .card-meta {
      font-size: 0.85rem;
      color: #888;
      margin-top: 8px;
    }
    .card-meta div { margin: 4px 0; }
    .error-msg {
      color: #f44336;
      font-size: 0.85rem;
      margin-top: 8px;
      word-break: break-word;
    }
    .section-title {
      color: #fff;
      margin: 30px 0 15px 0;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .alert-list {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 20px;
    }
    .alert-item {
      padding: 12px;
      margin: 8px 0;
      border-radius: 8px;
      border-left: 3px solid;
    }
    .alert-item.critical { border-left-color: #f44336; background: rgba(244,67,54,0.1); }
    .alert-item.warning { border-left-color: #ff9800; background: rgba(255,152,0,0.1); }
    .alert-item.info { border-left-color: #2196f3; background: rgba(33,150,243,0.1); }
    .refresh-btn {
      background: #2196f3;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.2s;
    }
    .refresh-btn:hover { background: #1976d2; }
    .refresh-btn:disabled { background: #666; cursor: not-allowed; }
    .last-updated { color: #888; margin-left: 15px; font-size: 0.9rem; }
    .loading { text-align: center; padding: 40px; color: #888; }
    .error-state { text-align: center; padding: 40px; color: #f44336; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .refreshing { animation: pulse 1s infinite; }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      <span>REZ Health Monitor</span>
      <button class="refresh-btn" onclick="refreshData()" id="refreshBtn">Refresh</button>
      <span class="last-updated" id="lastUpdated"></span>
    </h1>

    <div class="header-stats" id="headerStats">
      <div class="stat-card info">
        <div class="stat-value" id="totalServices">-</div>
        <div class="stat-label">Total Services</div>
      </div>
      <div class="stat-card healthy">
        <div class="stat-value" id="healthyCount">-</div>
        <div class="stat-label">Healthy</div>
      </div>
      <div class="stat-card degraded">
        <div class="stat-value" id="degradedCount">-</div>
        <div class="stat-label">Degraded</div>
      </div>
      <div class="stat-card down">
        <div class="stat-value" id="downCount">-</div>
        <div class="stat-label">Down</div>
      </div>
      <div class="stat-card info">
        <div class="stat-value" id="openCircuits">-</div>
        <div class="stat-label">Open Circuits</div>
      </div>
      <div class="stat-card info">
        <div class="stat-value" id="totalAlerts">-</div>
        <div class="stat-label">Alerts (24h)</div>
      </div>
    </div>

    <h2 class="section-title">Services</h2>
    <div class="grid" id="servicesGrid">
      <div class="loading">Loading services...</div>
    </div>

    <h2 class="section-title">Recent Alerts</h2>
    <div class="alert-list" id="alertsList">
      <div class="loading">Loading alerts...</div>
    </div>
  </div>

  <script>
    let refreshInterval = null;

    async function refreshData() {
      const btn = document.getElementById('refreshBtn');
      btn.disabled = true;
      btn.classList.add('refreshing');
      btn.textContent = 'Refreshing...';

      try {
        const [healthRes, circuitsRes, alertsRes] = await Promise.all([
          fetch('/health/all'),
          fetch('/circuits'),
          fetch('/alerts?limit=10')
        ]);

        const health = await healthRes.json();
        const circuits = await circuitsRes.json();
        const alerts = await alertsRes.json();

        // Update header stats
        document.getElementById('totalServices').textContent = health.summary.total;
        document.getElementById('healthyCount').textContent = health.summary.healthy;
        document.getElementById('degradedCount').textContent = health.summary.degraded;
        document.getElementById('downCount').textContent = health.summary.down;
        document.getElementById('openCircuits').textContent = circuits.summary.open;
        document.getElementById('totalAlerts').textContent = alerts.summary.last24Hours;

        // Create circuit state map
        const circuitMap = {};
        circuits.circuits.forEach(c => { circuitMap[c.name] = c; });

        // Update services grid
        const grid = document.getElementById('servicesGrid');
        grid.innerHTML = health.services.map(s => {
          const circuit = circuitMap[s.name];
          const statusClass = circuit && circuit.state === 'half_open' ? 'half_open' : s.status;
          return \`
            <div class="card \${statusClass}">
              <div class="card-header">
                <h3>\${s.name}</h3>
                <span class="status-badge \${statusClass}">\${circuit ? circuit.state : s.status}</span>
              </div>
              <div class="card-meta">
                <div>Latency: \${s.latency !== null ? s.latency + 'ms' : 'N/A'}</div>
                <div>Circuit: \${circuit ? circuit.state : 'unknown'}</div>
                <div>Failures: \${circuit ? circuit.consecutiveFailures : 0}</div>
                <div>Updated: \${new Date(s.timestamp).toLocaleTimeString()}</div>
              </div>
              \${s.error ? \`<div class="error-msg">\${s.error}</div>\` : ''}
            </div>
          \`;
        }).join('');

        // Update alerts list
        const alertsList = document.getElementById('alertsList');
        if (alerts.alerts.length === 0) {
          alertsList.innerHTML = '<div class="loading">No recent alerts</div>';
        } else {
          alertsList.innerHTML = alerts.alerts.map(a => \`
            <div class="alert-item \${a.severity}">
              <strong>\${a.serviceName}</strong>
              <div>\${a.message}</div>
              <div style="color: #888; font-size: 0.8rem; margin-top: 4px;">
                \${new Date(a.timestamp).toLocaleString()}
              </div>
            </div>
          \`).join('');
        }

        document.getElementById('lastUpdated').textContent =
          'Last updated: ' + new Date().toLocaleTimeString();

      } catch (error) {
        console.error('Error refreshing data:', error);
        document.getElementById('servicesGrid').innerHTML =
          \`<div class="error-state">Error loading data: \${error.message}</div>\`;
      } finally {
        btn.disabled = false;
        btn.classList.remove('refreshing');
        btn.textContent = 'Refresh';
      }
    }

    // Initial load
    refreshData();

    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(refreshData, 30000);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (refreshInterval) clearInterval(refreshInterval);
    });
  </script>
</body>
</html>`;
}

// Export for testing
export { app, servicesToMonitor };
