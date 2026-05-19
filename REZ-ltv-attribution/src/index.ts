/**
 * REZ LTV Attribution Service
 *
 * Port: 4090
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger.js';
import ltvRouter from './routes/ltv.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4090', 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  logger.debug('Incoming request', { path: req.path });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rez-ltv-attribution' });
});

app.use(ltvRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal error' });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`REZ LTV Attribution Service started on port ${PORT}`);
});

export default app;
