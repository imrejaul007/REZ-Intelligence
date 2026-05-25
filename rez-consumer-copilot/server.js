import logger from './utils/logger';

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4021;

// CORS - restrict to known origins
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://rez.money,https://admin.rez.money,https://merchant.rez.money').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS blocked'));
  },
  credentials: true,
}));
app.use(express.json());

// Serve static files from root directory
app.use(express.static(__dirname));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rez-consumer-copilot' });
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  logger.info(`REZ Consumer Copilot running on port ${PORT}`);
});
