/**
 * REZ Data Governance Service
 *
 * Features:
 * - PII detection
 * - Data anonymization
 * - Consent management
 * - Data retention
 * - GDPR compliance
 * - Audit logging
 */

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// ============================================
// TYPES
// ============================================

interface Consent {
  user_id: string;
  type: 'marketing' | 'analytics' | 'data_sharing' | 'notifications';
  granted: boolean;
  timestamp: string;
}

interface DataRequest {
  id: string;
  user_id: string;
  type: 'export' | 'deletion' | 'correction';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  created_at: string;
  completed_at?: string;
}

interface PIIPattern {
  type: string;
  pattern: RegExp;
  replacement: string;
}

// PII patterns
const PII_PATTERNS: PIIPattern[] = [
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  { type: 'phone', pattern: /\b\d{10,}\b/g, replacement: '[PHONE_REDACTED]' },
  { type: 'aadhaar', pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g, replacement: '[AADHAAR_REDACTED]' },
  { type: 'pan', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g, replacement: '[PAN_REDACTED]' },
  { type: 'upi', pattern: /[a-z]+@[a-z]+/g, replacement: '[UPI_REDACTED]' }
];

// Consent store
const consents = new Map<string, Consent[]>();

// Data requests store
const dataRequests = new Map<string, DataRequest>();

// Audit log
const auditLog: unknown[] = [];

// ============================================
// PII DETECTION & ANONYMIZATION
// ============================================

/**
 * POST /governance/anonymize
 * Anonymize PII in data
 */
router.post('/governance/anonymize', (req, res) => {
  const { data, types } = req.body;

  let anonymized = JSON.stringify(data);

  const patternsToApply = types
    ? PII_PATTERNS.filter(p => types.includes(p.type))
    : PII_PATTERNS;

  for (const pii of patternsToApply) {
    anonymized = anonymized.replace(pii.pattern, pii.replacement);
  }

  auditLog.push({
    action: 'anonymize',
    timestamp: new Date().toISOString(),
    types_applied: patternsToApply.map(p => p.type)
  });

  res.json({
    anonymized: JSON.parse(anonymized),
    patterns_applied: patternsToApply.map(p => p.type)
  });
});

/**
 * POST /governance/detect-pii
 * Detect PII in data
 */
router.post('/governance/detect-pii', (req, res) => {
  const { data } = req.body;

  const detections: { type: string; value: string; field: string }[] = [];
  const jsonStr = JSON.stringify(data);

  for (const pii of PII_PATTERNS) {
    const matches = jsonStr.match(new RegExp(pii.pattern, 'g'));
    if (matches) {
      detections.push(...matches.map(m => ({ type: pii.type, value: m, field: 'detected' })));
    }
  }

  res.json({
    pii_detected: detections.length > 0,
    detections
  });
});

// ============================================
// CONSENT MANAGEMENT
// ============================================

/**
 * POST /governance/consent
 * Grant/withdraw consent
 */
router.post('/governance/consent', (req, res) => {
  const { user_id, type, granted } = req.body;

  const consent: Consent = {
    user_id,
    type,
    granted,
    timestamp: new Date().toISOString()
  };

  const key = `${user_id}_${type}`;
  consents.set(key, consent);

  auditLog.push({
    action: 'consent_update',
    user_id,
    consent_type: type,
    granted,
    timestamp: consent.timestamp
  });

  res.json({ consent });
});

/**
 * GET /governance/consent/:userId
 * Get user consents
 */
router.get('/governance/consent/:userId', (req, res) => {
  const { userId } = req.params;

  const userConsents: Consent[] = [];
  for (const [key, consent] of consents) {
    if (key.startsWith(userId)) {
      userConsents.push(consent);
    }
  }

  res.json({ consents: userConsents });
});

/**
 * POST /governance/consent/check
 * Check if consent is granted
 */
router.post('/governance/consent/check', (req, res) => {
  const { user_id, type } = req.body;

  const key = `${user_id}_${type}`;
  const consent = consents.get(key);

  res.json({
    granted: consent?.granted ?? false,
    timestamp: consent?.timestamp
  });
});

// ============================================
// DATA SUBJECT REQUESTS (GDPR/CCPA)
// ============================================

/**
 * POST /governance/data-request
 * Submit data request
 */
router.post('/governance/data-request', (req, res) => {
  const { user_id, type } = req.body;

  const request: DataRequest = {
    id: `dr_${Date.now()}`,
    user_id,
    type,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  dataRequests.set(request.id, request);

  // Process async
  processDataRequest(request);

  res.status(202).json({
    request_id: request.id,
    status: 'pending',
    estimated_completion: '24 hours'
  });
});

/**
 * GET /governance/data-request/:id
 * Get request status
 */
router.get('/governance/data-request/:id', (req, res) => {
  const request = dataRequests.get(req.params.id);

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json({ request });
});

/**
 * GET /governance/data-export/:userId
 * Export user data
 */
router.get('/governance/data-export/:userId', async (req, res) => {
  const { userId } = req.params;

  // Collect all user data
  const exportData = {
    user_id: userId,
    exported_at: new Date().toISOString(),
    consents: Array.from(consents.entries())
      .filter(([key]) => key.startsWith(userId))
      .map(([, c]) => c),
    audit_logs: auditLog.filter(l => l.user_id === userId)
  };

  res.json(exportData);
});

/**
 * DELETE /governance/data-deletion/:userId
 * Delete user data (right to be forgotten)
 */
router.delete('/governance/data-deletion/:userId', (req, res) => {
  const { userId } = req.params;

  // Mark deletion request
  const request: DataRequest = {
    id: `dr_${Date.now()}`,
    user_id: userId,
    type: 'deletion',
    status: 'processing',
    created_at: new Date().toISOString()
  };

  dataRequests.set(request.id, request);

  auditLog.push({
    action: 'deletion_requested',
    user_id: userId,
    timestamp: new Date().toISOString()
  });

  res.json({
    request_id: request.id,
    status: 'processing'
  });
});

// ============================================
// RETENTION POLICIES
// ============================================

const retentionPolicies = [
  { name: 'transactions', duration_days: 2555, applies_to: 'order_data' },
  { name: 'sessions', duration_days: 90, applies_to: 'session_logs' },
  { name: 'marketing', duration_days: 730, applies_to: 'marketing_events' },
  { name: 'pii', duration_days: 365, applies_to: 'pii_data' }
];

/**
 * GET /governance/retention
 * List retention policies
 */
router.get('/governance/retention', (req, res) => {
  res.json({ policies: retentionPolicies });
});

// ============================================
// AUDIT LOG
// ============================================

/**
 * GET /governance/audit
 * Query audit log
 */
router.get('/governance/audit', (req, res) => {
  const { user_id, action, from, to } = req.query;

  let filtered = [...auditLog];

  if (user_id) {
    filtered = filtered.filter(l => l.user_id === user_id);
  }

  if (action) {
    filtered = filtered.filter(l => l.action === action);
  }

  res.json({ logs: filtered.slice(-100), total: filtered.length });
});

// ============================================
// HELPERS
// ============================================

async function processDataRequest(request: DataRequest): Promise<void> {
  // Simulate processing
  setTimeout(() => {
    request.status = 'completed';
    request.completed_at = new Date().toISOString();
    dataRequests.set(request.id, request);
  }, 5000);
}

function generateHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ============================================
// HEALTH
// ============================================

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    policies: retentionPolicies.length,
    pending_requests: Array.from(dataRequests.values()).filter(r => r.status === 'pending').length
  });
});

export default router;
