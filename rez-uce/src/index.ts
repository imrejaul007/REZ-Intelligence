import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as adPlatform from './services/adPlatform';

const app = express();
const PORT = process.env.PORT || 4028;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Campaign routes
app.post('/api/campaigns', async (req, res) => {
  try {
    const campaign = await adPlatform.createCampaign(req.body);
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create campaign' });
  }
});

app.get('/api/campaigns', async (req, res) => {
  try {
    const { status } = req.query;
    const campaigns = await adPlatform.listCampaigns(status as any);
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to list campaigns' });
  }
});

app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await adPlatform.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get campaign' });
  }
});

app.patch('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await adPlatform.updateCampaign(req.params.id, req.body);
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update campaign' });
  }
});

// QR routes
app.post('/api/qr/generate', async (req, res) => {
  try {
    const { campaignId, label } = req.body;
    const qr = await adPlatform.generateQRCode(campaignId, label);
    res.json({ success: true, data: qr });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate QR' });
  }
});

app.post('/api/qr/:id/scan', async (req, res) => {
  try {
    const { userId } = req.body;
    await adPlatform.recordScan(req.params.id, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record scan' });
  }
});

// Reward routes
app.post('/api/rewards/distribute', async (req, res) => {
  try {
    const { campaignId, userId, event, amount } = req.body;
    const result = await adPlatform.distributeReward(campaignId, userId, event, amount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to distribute reward' });
  }
});

// Attribution routes
app.post('/api/attribution/track', async (req, res) => {
  try {
    const { campaignId, userId, stage } = req.body;
    await adPlatform.trackAttribution(campaignId, userId, stage);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to track attribution' });
  }
});

app.get('/api/attribution/:campaignId/:userId', async (req, res) => {
  try {
    const attribution = await adPlatform.getAttribution(req.params.campaignId, req.params.userId);
    res.json({ success: true, data: attribution });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get attribution' });
  }
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ad-platform' });
});

app.listen(PORT, () => {
  console.log(`Ad platform running on port ${PORT}`);
});

export default app;
