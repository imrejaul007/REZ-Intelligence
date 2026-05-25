/**
 * REZ Care - ID Generation Utility
 * Uses uuid v4 for cryptographically secure ID generation
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix?: string): string {
  const id = uuidv4();
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Generate a short unique ID (first 8 characters of uuid)
 */
export function generateShortId(prefix?: string): string {
  const id = uuidv4().split('-')[0];
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Generate a DLQ (Dead Letter Queue) ID
 */
export function generateDLQId(): string {
  return `dlq_${uuidv4()}`;
}

/**
 * Generate a ticket ID
 */
export function generateTicketId(): string {
  return `TKT-${Date.now()}-${uuidv4().split('-')[0].toUpperCase()}`;
}

/**
 * Generate an auto-ticket ID
 */
export function generateAutoTicketId(): string {
  return `AUTO-${uuidv4().split('-')[0].toUpperCase()}`;
}

/**
 * Generate an agent ID
 */
export function generateAgentId(): string {
  return `AGENT-${uuidv4().split('-')[0].toUpperCase()}`;
}

/**
 * Generate an issue ID
 */
export function generateIssueId(): string {
  return `ISSUE-${uuidv4().split('-')[0].toUpperCase()}`;
}

/**
 * Generate a communication ID
 */
export function generateCommunicationId(): string {
  return `COMM-${uuidv4().split('-')[0].toUpperCase()}`;
}

/**
 * Generate an escalation rule ID
 */
export function generateRuleId(): string {
  return `RULE-${uuidv4().split('-')[0].toUpperCase()}`;
}

/**
 * Generate an escalation log ID
 */
export function generateEscalationLogId(): string {
  return `ESC-${uuidv4().split('-')[0].toUpperCase()}`;
}

export default {
  generateId,
  generateShortId,
  generateDLQId,
  generateTicketId,
  generateAutoTicketId,
  generateAgentId,
  generateIssueId,
  generateCommunicationId,
  generateRuleId,
  generateEscalationLogId,
};
