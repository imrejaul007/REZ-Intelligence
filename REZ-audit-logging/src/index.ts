import express, { Application, Request, Response } from 'express';
import { logger } from './utils/logger.js';
import cors from 'cors';
import dotenv from 'dotenv';

import auditRoutes from './routes/audit.routes';
import complianceRoutes from './routes/compliance.routes';
import reportsRoutes from './routes/reports.routes';
import { correlationIdMiddleware } from './middleware/audit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

dotenv.config();

const app: Application = express();
const PORT = parseInt(process.env.PORT || '4106', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(correlationIdMiddleware);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'REZ-audit-logging',
    version: '1.0.0',
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'REZ Audit Logging Service',
    version: '1.0.0',
    routes: {
      audit: '/audit',
      compliance: '/compliance',
      reports: '/reports',
      health: '/health',
    },
  });
});

app.use('/audit', auditRoutes);
app.use('/compliance', complianceRoutes);
app.use('/reports', reportsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`REZ Audit Logging Service running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`API Endpoints:`);
  logger.info(`  - Audit: http://localhost:${PORT}/audit`);
  logger.info(`  - Compliance: http://localhost:${PORT}/compliance`);
  logger.info(`  - Reports: http://localhost:${PORT}/reports`);
});

export default app;
