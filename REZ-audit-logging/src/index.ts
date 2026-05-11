import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import auditRoutes from './routes/audit.routes';
import complianceRoutes from './routes/compliance.routes';
import reportsRoutes from './routes/reports.routes';
import { correlationIdMiddleware } from './middleware/audit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

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
  console.log(`REZ Audit Logging Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Endpoints:`);
  console.log(`  - Audit: http://localhost:${PORT}/audit`);
  console.log(`  - Compliance: http://localhost:${PORT}/compliance`);
  console.log(`  - Reports: http://localhost:${PORT}/reports`);
});

export default app;
