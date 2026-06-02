import http from 'http';
import client from 'prom-client';
import { logger } from './config/logger';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

let isHealthy = false; // NE-02 FIX: start unhealthy until worker confirms it's running
let isReady = false;

export function setHealthy(healthy: boolean): void {
  isHealthy = healthy;
  if (healthy) isReady = true;
}

export function setReady(ready: boolean): void {
  isReady = ready;
}

export function startHealthServer(port: number = 3001): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      if (isHealthy) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unhealthy' }));
      }
    } else if (req.url === '/ready') {
      // NE-02 FIX: /ready now reflects actual worker + DB + Redis readiness
      if (isReady) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ready' }));
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'not ready' }));
      }
    } else if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    logger.info(`[Health] Server listening on port ${port}`);
  });

  return server;
}
