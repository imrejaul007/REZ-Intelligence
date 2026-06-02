/**
 * Merchant WhatsApp Routes
 */

import { Router } from 'express';
import { MerchantWhatsAppNumber, Conversation } from '../types';

const router = Router();
const whatsappNumbers: Map<string, MerchantWhatsAppNumber> = new Map();
const conversations: Map<string, Conversation> = new Map();

router.get('/numbers', (req, res) => {
  const { merchantId } = req.query;
  const numbers = Array.from(whatsappNumbers.values())
    .filter(n => !merchantId || n.merchantId === merchantId);
  res.json({ success: true, data: numbers });
});

router.post('/numbers', (req, res) => {
  const whatsapp: MerchantWhatsAppNumber = {
    id: `wab_${Date.now()}`,
    merchantId: req.body.merchantId,
    phoneNumber: req.body.phoneNumber,
    wabaId: req.body.wabaId || '',
    config: req.body.config || {
      businessName: '',
      autoReply: true,
      aiAssistant: true,
      aiPersona: 'helpful_assistant',
      workingHours: { enabled: false, timezone: 'Asia/Kolkata' }
    },
    integrations: { orders: true, campaigns: true, support: false, commerce: true },
    limits: { monthly: 10000, daily: 1000, templateCooldown: 5 },
    status: 'pending',
    stats: { totalMessages: 0, monthlyMessages: 0, avgResponseTime: 0 },
    createdAt: new Date()
  };
  whatsappNumbers.set(whatsapp.id, whatsapp);
  res.json({ success: true, data: whatsapp });
});

router.post('/webhook', async (req, res) => {
  const { From, To, Body, MessageSid } = req.body;
  console.log(`[WhatsApp] From: ${From}, Body: ${Body}`);
  res.sendStatus(200);
});

router.get('/conversations', (req, res) => {
  const convs = Array.from(conversations.values());
  res.json({ success: true, data: convs.slice(0, 50) });
});

router.get('/analytics', (req, res) => {
  res.json({
    success: true,
    data: {
      volume: { sent: 0, delivered: 0, read: 0, clicked: 0 },
      rates: { delivery: 0, read: 0, click: 0 }
    }
  });
});

export default router;
