/**
 * Core Messaging Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { Message } from '../types';

const router = Router();
const messages: Map<string, Message> = new Map();

// Zod schema for message validation
const messageSchema = z.object({
  content: z.string().min(1, 'Content is required').max(4096, 'Content must be at most 4096 characters'),
  recipientId: z.string().regex(/^\d+$/, 'Recipient ID must be numeric'),
  type: z.enum(['text', 'image', 'document'], {
    errorMap: () => ({ message: 'Type must be text, image, or document' })
  }),
  metadata: z.record(z.unknown()).optional()
});

router.get('/', (req, res) => {
  res.json({ success: true, data: Array.from(messages.values()) });
});

router.post('/', async (req, res) => {
  const result = messageSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid input',
      details: errors
    });
  }

  const message: Message = {
    id: `msg_${Date.now()}`,
    content: result.data.content,
    recipientId: result.data.recipientId,
    type: result.data.type,
    metadata: result.data.metadata,
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  messages.set(message.id, message);
  res.json({ success: true, data: message });
});

router.get('/:id', (req, res) => {
  const message = messages.get(req.params.id);
  if (!message) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: message });
});

router.patch('/:id/status', (req, res) => {
  const message = messages.get(req.params.id);
  if (!message) return res.status(404).json({ success: false, error: 'Not found' });
  message.status = req.body.status;
  message.updatedAt = new Date();
  messages.set(message.id, message);
  res.json({ success: true, data: message });
});

export default router;
