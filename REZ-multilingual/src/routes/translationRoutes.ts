import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { translationService } from '../services/translationService.js';
import { TranslationRequestSchema, BatchTranslationRequestSchema, DetectLanguageSchema } from '../types/index.js';

const router = Router();

router.post('/translate', async (req: Request, res: Response) => {
  const validation = TranslationRequestSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ success: false, errors: validation.error.issues });
    return;
  }
  const result = await translationService.translate(validation.data);
  res.json({ success: true, data: result });
});

router.post('/translate/batch', async (req: Request, res: Response) => {
  const validation = BatchTranslationRequestSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ success: false, errors: validation.error.issues });
    return;
  }
  const results = await translationService.batchTranslate(validation.data);
  res.json({ success: true, data: results });
});

router.post('/detect', async (req: Request, res: Response) => {
  const validation = DetectLanguageSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ success: false, errors: validation.error.issues });
    return;
  }
  const result = await translationService.detectLanguage(validation.data);
  res.json({ success: true, data: result });
});

router.get('/languages', (_req, res) => {
  res.json({ success: true, data: translationService.getSupportedLanguages() });
});

export default router;
