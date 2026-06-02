import sanitizeHtmlLib from 'sanitize-html';
import validator from 'validator';

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION)\b)/i,
  /(--|;|\/\*|\*\/|@@|@)/,
  /('|(\\'))+(\s)*(OR|AND)(\s)*('|(\\'))*(\s)*(=|<|>)/i,
  /(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i,
  /(\bUNION\b(\s)+(ALL\s+)?SELECT\b)/i,
  /(INTO\s+(OUTFILE|DUMPFILE))/i,
  /LOAD_FILE\s*\(/i,
  /(BENCHMARK|SLEEP)\s*\(\s*\d+\s*\)/i,
  /(CASE|WHEN|THEN|ELSE|END)\s+.*\s+=\s+/i,
  /[\x00-\x1f]/,  // Control characters
  /[\x27\x22\x5c]/,  // Single quote, double quote, backslash
];

// Dangerous SQL characters that should be escaped
const SQL_DANGEROUS_CHARS = /['"\\;\-\-\/\*]/g;

// Potential command injection patterns
const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$]/,
  /\$\(.*\)/,
  /\$\{.*\}/,
  /`.*`/,
  /\|\|/,
  /&&/,
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/gi,
  /%2e%2e\//gi,
  /%2e%2e%5c/gi,
  /\.\.%2f/gi,
];

// Regular expression for detecting potential XSS vectors
const XSS_PATTERNS = [
  /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
  /<script\b[^>]*\/>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["']?[^"']*["']?/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /expression\s*\(/gi,
  /url\s*\(\s*["']?\s*javascript:/gi,
  /data\s*:\s*text\/html/gi,
  /vbscript\s*:/gi,
  /<!--[\s\S]*?-->/g,
];

// HTML entity encoding patterns
const HTML_ENTITY_PATTERN = /&#[x]?[0-9]+;|&[a-z]+;/gi;

// HTML sanitization options
const SANITIZE_HTML_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'strong', 'em', 'b', 'i', 'u', 's',
    'a', 'img',
    'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span'
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'div': ['class'],
    'span': ['class'],
    'td': ['colspan', 'rowspan'],
    'th': ['colspan', 'rowspan']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    'a': (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: '_blank'
      }
    })
  }
};

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  // First pass: decode any double-encoded entities
  let decoded = decodeHtmlEntities(input);

  // Remove null bytes and other control characters
  decoded = decoded.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Sanitize HTML tags
  let sanitized = sanitizeHtmlLib(decoded, SANITIZE_HTML_OPTIONS);

  // Remove any potential XSS vectors that slipped through
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove HTML entities that could be used for encoding attacks
  sanitized = removeDangerousHtmlEntities(sanitized);

  return sanitized;
}

// Decode HTML entities (including double-encoded)
function decodeHtmlEntities(input: string): string {
  let decoded = input;

  // Try to decode common entities
  decoded = decoded
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");

  // Try decoding numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => {
    return String.fromCharCode(parseInt(num, 10));
  });

  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}

// Remove potentially dangerous HTML entities
function removeDangerousHtmlEntities(input: string): string {
  return input.replace(HTML_ENTITY_PATTERN, (match) => {
    // Keep common safe entities
    const safeEntities = ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;', '&nbsp;'];
    if (safeEntities.includes(match.toLowerCase())) {
      return match;
    }
    return '';
  });
}

/**
 * Escape SQL special characters to prevent SQL injection
 */
export function escapeSql(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  let escaped = input;

  // Escape backslashes first (must be first!)
  escaped = escaped.replace(/\\/g, '\\\\');

  // Escape single quotes (for SQL string contexts)
  escaped = escaped.replace(/'/g, "''");

  // Escape double quotes (for SQL identifiers)
  escaped = escaped.replace(/"/g, '""');

  // Escape percent signs (for LIKE patterns)
  escaped = escaped.replace(/%/g, '\\%');

  // Escape underscores (for LIKE patterns)
  escaped = escaped.replace(/_/g, '\\_');

  // Remove null bytes
  escaped = escaped.replace(/\x00/g, '');

  return escaped;
}

/**
 * Escape for MySQL specifically
 */
export function escapeMysql(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
}

/**
 * Escape for PostgreSQL specifically
 */
export function escapePostgres(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  return input
    .replace(/'/g, "''")
    .replace(/\x00/g, '');
}

/**
 * Check if input matches SQL injection patterns
 */
export function isSqlInjectionPattern(input: unknown): boolean {
  if (typeof input !== 'string') return false;

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Check for command injection patterns
 */
export function isCommandInjectionPattern(input: unknown): boolean {
  if (typeof input !== 'string') return false;

  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Check for path traversal attempts
 */
export function isPathTraversalPattern(input: unknown): boolean {
  if (typeof input !== 'string') return false;

  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string | false {
  return validator.isEmail(email) ? validator.normalizeEmail(email) as string | false : false;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string, requireProtocol = true): string | false {
  if (requireProtocol) {
    return validator.isURL(url, { require_protocol: true }) ? validator.escape(url) : false;
  }
  return validator.isURL(url) ? validator.escape(url) : false;
}

/**
 * Sanitize and escape HTML entities
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Strip all HTML tags
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  // Remove HTML comments
  let stripped = input.replace(/<!--[\s\S]*?-->/g, '');

  // Remove script and style tags with content
  stripped = stripped.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Remove all HTML tags
  stripped = stripped.replace(/<[^>]+>/g, '');

  // Decode remaining entities
  stripped = decodeHtmlEntities(stripped);

  return stripped.trim();
}

/**
 * Sanitize filename to prevent path traversal and invalid characters
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return '';
  }

  // Remove path components
  let sanitized = filename.replace(/^.*[\\\/]/, '');

  // Replace dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');

  // Prevent path traversal
  sanitized = sanitized.replace(/\.\.+/g, '.');

  // Limit length
  sanitized = sanitized.slice(0, 255);

  // Default name if empty
  if (!sanitized) {
    sanitized = 'unnamed';
  }

  return sanitized;
}

/**
 * Complete validation and sanitization pipeline
 */
export function validateAndSanitize(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Check for security threats
  if (isSqlInjectionPattern(input)) {
    throw new Error('Potential SQL injection detected');
  }

  if (isCommandInjectionPattern(input)) {
    throw new Error('Potential command injection detected');
  }

  if (isPathTraversalPattern(input)) {
    throw new Error('Potential path traversal detected');
  }

  // Apply sanitization
  let sanitized = sanitizeHtml(input);
  sanitized = escapeSql(sanitized);

  return sanitized;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = validateAndSanitize(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : typeof item === 'string'
          ? validateAndSanitize(item)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Trim and normalize whitespace
 */
export function normalizeWhitespace(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  // Trim
  let normalized = input.trim();

  // Normalize whitespace (replace multiple spaces with single space)
  normalized = normalized.replace(/\s+/g, ' ');

  // Normalize line breaks
  normalized = normalized.replace(/\r\n|\r|\n/g, '\n');

  return normalized;
}

/**
 * Remove invisible Unicode characters
 */
export function removeInvisibleChars(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  // Remove zero-width characters
  return input.replace(/[​-‍﻿­]/g, '');
}

/**
 * Sanitize for JSON output
 */
export function sanitizeForJson(input: string): string {
  if (typeof input !== 'string') {
    return input as unknown as string;
  }

  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
