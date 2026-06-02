import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import logger from './utils/logger';
import sentimentRoutes from './routes/sentimentRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4903;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

app.get('/', (_req, res) => {
  res.json({
    service: 'REZ-sentiment-analyzer',
    version: '1.0.0',
    status: 'running',
  });
});

app.use('/api/v1/sentiment', sentimentRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

app.listen(PORT, () => {
  logger.info(`REZ-sentiment-analyzer service running on port ${PORT}`);
});

export default app;
