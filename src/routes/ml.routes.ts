/**
 * ML Routes - Embeddings + Personalization API
 */

import { Router } from 'express';
import { embed, cosine } from '../services/embeddings.service';
import { buildUserEmbedding, recommend } from '../services/personalization.service';
import { trackIntent, predictIntent } from '../services/intent.service';

const router = Router();

/** Generate embedding */
router.post('/embed', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const embedding = await embed(text);
  res.json({ embedding, dimensions: embedding.length });
});

/** Build user profile */
router.post('/user/:userId/profile', async (req, res) => {
  const embedding = await buildUserEmbedding(req.params.userId);
  res.json({ embedding, dimensions: embedding.length });
});

/** Get recommendations */
router.get('/user/:userId/recommend', async (req, res) => {
  const items = await recommend(req.params.userId, parseInt(req.query.count as string) || 10);
  res.json({ items });
});

/** Track behavior */
router.post('/intent', async (req, res) => {
  await trackIntent(req.body);
  res.json({ success: true });
});

/** Predict intent */
router.get('/user/:userId/intent', async (req, res) => {
  const prediction = await predictIntent(req.params.userId);
  res.json(prediction);
});

export default router;
