'use strict';

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Services to monitor
const SERVICES = [
  { name: 'REZ-event-platform', url: 'http://localhost:4008/health' },
  { name: 'REZ-identity-graph', url: 'http://localhost:4050/health' },
  { name: 'REZ-reorder-engine', url: 'http://localhost:4040/health' },
  { name: 'REZ-taste-profile', url: 'http://localhost:4041/health' },
  { name: 'REZ-demand-forecast', url: 'http://localhost:4042/health' },
  { name: 'REZ-price-predictor', url: 'http://localhost:4043/health' },
  { name: 'REZ-memory-engine', url: 'http://localhost:4051/health' },
  { name: 'REZ-ai-router', url: 'http://localhost:4052/health' },
  { name: 'REZ-knowledge-graph', url: 'http://localhost:4060/health' },
  { name: 'REZ-merchant-brain', url: 'http://localhost:4061/health' },
  { name: 'REZ-autonomous-agents', url: 'http://localhost:4062/health' },
  { name: 'REZ-payments-brain', url: 'http://localhost:4070/health' },
  { name: 'REZ-inventory-sync', url: 'http://localhost:4071/health' },
  { name: 'REZ-creator-network', url: 'http://localhost:4072/health' },
  { name: 'REZ-merchant-os', url: 'http://localhost:4073/health' },
  { name: 'REZ-feedback-collector', url: 'http://localhost:4085/health' },
  { name: 'REZ-unified-recommendations', url: 'http://localhost:4090/health' },
  { name: 'REZ-integration-sdk', url: 'http://localhost:4091/health' },
  { name: 'REZ-identity-bridge', url: 'http://localhost:4092/health' },
  { name: 'REZ-notification-router', url: 'http://localhost:4093/health' },
  { name: 'REZ-realtime-gateway', url: 'http://localhost:4094/health' },
  { name: 'REZ-validation-dashboard', url: 'http://localhost:4100/health' },
  { name: 'REZ-flywheel-mvp', url: 'http://localhost:4101/health' }
];

const healthCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

async function checkService(service) {
  const cacheKey = service.name;
  const cached = healthCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const startTime = Date.now();

  try {
    const response = await axios.get(service.url, { timeout: 5000 });
    const latency = Date.now() - startTime;

    const data = {
      name: service.name,
      status: 'healthy',
      latency,
      uptime: response.data?.uptime || null,
      timestamp: new Date().toISOString()
    };

    healthCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    const latency = Date.now() - startTime;
    const data = {
      name: service.name,
      status: err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' ? 'down' : 'degraded',
      latency,
      error: err.message,
      timestamp: new Date().toISOString()
    };

    healthCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }
}

async function checkAllServices() {
  const results = await Promise.allSettled(
    SERVICES.map(service => checkService(service))
  );

  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

// HTTP endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'health-monitor',
    timestamp: new Date().toISOString()
  });
});

app.get('/health/all', async (req, res) => {
  const services = await checkAllServices();

  const healthy = services.filter(s => s.status === 'healthy').length;
  const degraded = services.filter(s => s.status === 'degraded').length;
  const down = services.filter(s => s.status === 'down').length;

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      total: services.length,
      healthy,
      degraded,
      down,
      overallStatus: down > 0 ? 'degraded' : degraded > 0 ? 'degraded' : 'healthy'
    },
    services
  });
});

app.get('/health/:serviceName', async (req, res) => {
  const { serviceName } = req.params;
  const service = SERVICES.find(s => s.name === serviceName);

  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const result = await checkService(service);
  res.json({ success: true, ...result });
});

app.get('/dashboard', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>REZ Intelligence Health Dashboard</title>
  <style>
    body { font-family: system-ui; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; margin-top: 20px; }
    .card { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card.healthy { border-left: 4px solid #4caf50; }
    .card.degraded { border-left: 4px solid #ff9800; }
    .card.down { border-left: 4px solid #f44336; }
    .card h3 { margin: 0 0 10px 0; }
    .status { font-weight: bold; text-transform: uppercase; }
    .status.healthy { color: #4caf50; }
    .status.degraded { color: #ff9800; }
    .status.down { color: #f44336; }
    .meta { font-size: 12px; color: #666; margin-top: 5px; }
    .summary { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary-item { display: inline-block; margin-right: 30px; }
    .summary-item span { font-size: 24px; font-weight: bold; }
    .refresh { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>REZ Intelligence Health Dashboard</h1>
  <div class="summary" id="summary">Loading...</div>
  <div class="grid" id="services">Loading...</div>
  <script>
    async function refresh() {
      try {
        const res = await fetch('/health/all');
        const data = await res.json();

        document.getElementById('summary').innerHTML = \`
          <div class="summary-item"><span style="color: #4caf50">\${data.summary.healthy}</span><br>Healthy</div>
          <div class="summary-item"><span style="color: #ff9800">\${data.summary.degraded}</span><br>Degraded</div>
          <div class="summary-item"><span style="color: #f44336">\${data.summary.down}</span><br>Down</div>
          <div class="summary-item"><span>\${data.summary.total}</span><br>Total</div>
        \`;

        document.getElementById('services').innerHTML = data.services.map(s => \`
          <div class="card \${s.status}">
            <h3>\${s.name}</h3>
            <div class="status \${s.status}">\${s.status}</div>
            <div class="meta">
              Latency: \${s.latency || 'N/A'}ms
              \${s.error ? '<br>Error: ' + s.error : ''}
            </div>
          </div>
        \`).join('');
      } catch (err) {
        console.error(err);
      }
    }
    refresh();
    setInterval(refresh, 30000);
  </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 4095;

app.listen(PORT, () => {
  console.log(`Health Monitor running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
});
