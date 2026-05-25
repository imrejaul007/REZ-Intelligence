import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import ontologyRoutes from './routes/ontologyRoutes.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 4200;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'rez-ontology-engine', timestamp: new Date().toISOString() });
});

app.use('/api', ontologyRoutes);

app.listen(PORT, () => {
  logger.info(`REZ Ontology Engine running on port ${PORT}`);
});

export default app;
