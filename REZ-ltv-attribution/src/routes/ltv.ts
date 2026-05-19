/**
 * LTV Attribution Routes
 */

import { Router, Request, Response } from 'express';
import { ltvAttribution } from '../services/ltvAttribution.js';
import type { Customer, AttributionResult } from '../services/ltvAttribution.js';

const router = Router();

// In-memory store (use MongoDB in production)
const customers: Map<string, Customer> = new Map();

/**
 * POST /api/customers
 * Register a customer
 */
router.post('/api/customers', (req, res) => {
  const customer: Customer = {
    id: req.body.id || `cust_${Date.now()}`,
    merchantId: req.body.merchantId,
    totalOrders: req.body.totalOrders || 0,
    totalSpend: req.body.totalSpend || 0,
    averageOrderValue: req.body.averageOrderValue || 0,
    sourceChannel: req.body.sourceChannel,
    sourceCampaign: req.body.sourceCampaign,
    touchpoints: [],
  };

  customers.set(customer.id, customer);

  res.json({ success: true, data: customer });
});

/**
 * GET /api/customers/:id/ltv
 * Get LTV attribution for customer
 */
router.get('/api/customers/:id/ltv', (req, res) => {
  const customer = customers.get(req.params.id);

  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  const model = (req.query.model as 'first_touch' | 'last_touch' | 'linear') || 'linear';
  const result = ltvAttribution.calculateCustomerLTV(customer, model);

  res.json({ success: true, data: result });
});

/**
 * POST /api/customers/:id/touchpoints
 * Add touchpoint to customer
 */
router.post('/api/customers/:id/touchpoints', (req, res) => {
  const customer = customers.get(req.params.id);

  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  const touchpoint = {
    id: `tp_${Date.now()}`,
    customerId: customer.id,
    channel: req.body.channel,
    campaignId: req.body.campaignId,
    adId: req.body.adId,
    orderId: req.body.orderId,
    value: req.body.value,
    timestamp: new Date(req.body.timestamp || Date.now()),
  };

  customer.touchpoints.push(touchpoint);

  res.json({ success: true, data: touchpoint });
});

/**
 * GET /api/reports/channels
 * Get channel LTV report
 */
router.get('/api/reports/channels', (req, res) => {
  const merchantId = req.query.merchantId as string;

  let customerList = Array.from(customers.values());
  if (merchantId) {
    customerList = customerList.filter(c => c.merchantId === merchantId);
  }

  const report = ltvAttribution.generateChannelReport(customerList);

  res.json({ success: true, data: report });
});

/**
 * GET /api/reports/campaigns
 * Get campaign LTV report
 */
router.get('/api/reports/campaigns', (req, res) => {
  const merchantId = req.query.merchantId as string;

  let customerList = Array.from(customers.values());
  if (merchantId) {
    customerList = customerList.filter(c => c.merchantId === merchantId);
  }

  const report = ltvAttribution.generateCampaignReport(customerList);

  res.json({ success: true, data: report });
});

/**
 * GET /api/reports/efficiency
 * Get channel efficiency report
 */
router.get('/api/reports/efficiency', (req, res) => {
  const merchantId = req.query.merchantId as string;

  let customerList = Array.from(customers.values());
  if (merchantId) {
    customerList = customerList.filter(c => c.merchantId === merchantId);
  }

  const efficiency = ltvAttribution.calculateChannelEfficiency(customerList);

  res.json({ success: true, data: efficiency });
});

export default router;
