/**
 * Webhook Signature Verification Middleware
 *
 * Provides HMAC-SHA256 signature verification for webhook endpoints.
 * Supports multiple signature header names for compatibility with
 * different webhook providers (Razorpay, Stripe, custom webhooks).
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger.js';

// Supported signature header names
const SIGNATURE_HEADERS = [
  'x-razorpay-signature',
  'x-webhook-signature',
  'x-hub-signature-256', // GitHub-style
  'stripe-signature', // Stripe-style
];

/**
 * Raw body capture for signature verification
 * Express needs the raw body for HMAC comparison
 */
export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Verifies HMAC-SHA256 signature using timing-safe comparison
 */
function verifyHmacSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    // Handle both hex and sha256= prefixed signatures
    const normalizedSignature = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;

    return crypto.timingSafeEqual(
      Buffer.from(normalizedSignature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    // Buffers have different lengths - signature is invalid
    return false;
  }
}

/**
 * Extracts signature from request headers
 */
function extractSignature(headers: Record<string, string | string[] | undefined>): string | null {
  for (const headerName of SIGNATURE_HEADERS) {
    const value = headers[headerName.toLowerCase()];
    if (value && typeof value === 'string') {
      return value;
    }
  }
  return null;
}

/**
 * Middleware to capture raw body for signature verification
 * Must be used BEFORE express.json() middleware
 */
export function captureRawBody(
  req: RawBodyRequest,
  res: Response,
  buf: Buffer
): void {
  req.rawBody = buf;
}

/**
 * Webhook signature verification middleware
 *
 * Verifies that incoming webhook requests have a valid HMAC-SHA256 signature.
 * If WEBHOOK_SECRET is not configured, webhooks are rejected in production.
 *
 * Returns 401 Unauthorized if signature is missing or invalid.
 */
export function verifyWebhookSignature(
  req: RawBodyRequest,
  res: Response,
  next: NextFunction
): void {
  const secret = config.webhooks.secret;

  // Reject webhooks in production if no secret is configured
  if (!secret) {
    if (config.service.env === 'production') {
      logger.error('Webhook verification failed: WEBHOOK_SECRET not configured');
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Webhook secret not configured',
      });
      return;
    }
    // Allow unsigned webhooks in development for testing
    logger.warn('Webhook signature not verified: WEBHOOK_SECRET not set (dev mode only)');
    next();
    return;
  }

  // Extract signature from headers
  const signature = extractSignature(req.headers as Record<string, string | string[] | undefined>);

  if (!signature) {
    logger.warn('Webhook signature missing', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing webhook signature',
    });
    return;
  }

  // Get payload for verification
  // Use rawBody if available (captured by middleware), otherwise serialize the body
  const payload = req.rawBody
    ? req.rawBody.toString('utf8')
    : JSON.stringify(req.body);

  // Verify signature
  const isValid = verifyHmacSignature(payload, signature, secret);

  if (!isValid) {
    logger.warn('Webhook signature verification failed', {
      path: req.path,
      ip: req.ip,
      signaturePrefix: signature.substring(0, 8) + '...',
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature',
    });
    return;
  }

  logger.debug('Webhook signature verified successfully', {
    path: req.path,
  });

  next();
}

/**
 * Creates a webhook signature for testing/client use
 */
export function createWebhookSignature(
  payload: string,
  secret: string = config.webhooks.secret
): string {
  if (!secret) {
    throw new Error('WEBHOOK_SECRET not configured');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Utility to create signed webhook headers for testing
 */
export function createWebhookHeaders(
  payload: string,
  secret: string = config.webhooks.secret
): Record<string, string> {
  const signature = createWebhookSignature(payload, secret);
  return {
    'Content-Type': 'application/json',
    'x-webhook-signature': signature,
  };
}
