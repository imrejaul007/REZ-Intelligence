/**
 * REZ Conversation Intelligence - Entity Extraction Service
 *
 * Extracts named entities from conversation text using NLP patterns
 */

import logger from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ExtractedEntity {
  text: string;
  type: 'person' | 'company' | 'product' | 'location' | 'date' | 'time' | 'money' | 'organization' | 'email' | 'phone' | 'url' | 'custom';
  confidence: number;
  startIndex: number;
  endIndex: number;
  metadata?: Record<string, any>;
}

export interface EntityExtractionResult {
  text: string;
  entities: ExtractedEntity[];
  stats: {
    totalEntities: number;
    byType: Record<string, number>;
  };
}

// ============================================================================
// Pattern Definitions
// ============================================================================

const PATTERNS = {
  // Email pattern
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,

  // Phone patterns (various formats)
  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g,

  // URL pattern
  url: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,

  // Money patterns
  money: /\$\s?\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s?(?:dollars?|USD|INR| rupees?|₹|€|£)/gi,

  // Percentage
  percentage: /\d+(?:\.\d+)?%/g,

  // Date patterns
  date: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/gi,

  // Time patterns
  time: /\b(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)|(?:at|by|before|after)\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b/gi,

  // Indian PIN code
  pincode: /\b\d{6}\b/g,

  // GST number (India)
  gstin: /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}\b/g,
};

// ============================================================================
// Dictionary-based Entity Recognition
// ============================================================================

const PERSON_TITLE_PREFIXES = [
  'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sir', 'Madam',
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof'
];

const PERSON_TITLE_SUFFIXES = [
  'Jr.', 'Sr.', 'III', 'IV', 'PhD', 'MD', 'CEO', 'CTO', 'CFO', 'COO',
  'President', 'Vice President', 'Director', 'Manager', 'Engineer'
];

const LOCATION_KEYWORDS = [
  'city', 'town', 'village', 'district', 'state', 'country', 'region',
  'area', 'zone', 'branch', 'office', 'store', 'shop', 'location',
  'in', 'at', 'near', 'around', 'from'
];

const COMPANY_SUFFIXES = [
  'Inc.', 'Inc', 'LLC', 'Ltd.', 'Ltd', 'Corp.', 'Corp', 'Corporation',
  'Pvt.', 'Pvt', 'Private', 'Limited', 'Company', 'Co.', 'Co',
  'Group', 'Holdings', 'Solutions', 'Services', 'Technologies',
  'Systems', 'Technologies', 'Labs', 'Ventures', 'Partners'
];

// ============================================================================
// Entity Extractor Class
// ============================================================================

export class EntityExtractor {
  private text: string;
  private entities: ExtractedEntity[] = [];

  constructor(text: string) {
    this.text = text;
  }

  /**
   * Extract all entities from text
   */
  extract(): EntityExtractionResult {
    this.entities = [];

    // Extract pattern-based entities first
    this.extractEmails();
    this.extractPhones();
    this.extractUrls();
    this.extractMoney();
    this.extractDates();
    this.extractTimes();

    // Extract dictionary-based entities
    this.extractPersons();
    this.extractCompanies();
    this.extractLocations();

    // Remove duplicates and overlapping entities
    this.deduplicateEntities();

    // Calculate stats
    const stats = {
      totalEntities: this.entities.length,
      byType: this.entities.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    logger.info('Entity extraction completed', {
      entityCount: this.entities.length,
      types: Object.keys(stats.byType),
    });

    return {
      text: this.text,
      entities: this.entities,
      stats,
    };
  }

  /**
   * Extract email addresses
   */
  private extractEmails(): void {
    const matches = this.text.matchAll(PATTERNS.email);
    for (const match of matches) {
      this.entities.push({
        text: match[0],
        type: 'email',
        confidence: 0.95,
        startIndex: match.index!,
        endIndex: match.index! + match[0].length,
        metadata: { domain: match[0].split('@')[1] },
      });
    }
  }

  /**
   * Extract phone numbers
   */
  private extractPhones(): void {
    const matches = this.text.matchAll(PATTERNS.phone);
    for (const match of matches) {
      const phone = match[0].replace(/\s+/g, '').trim();
      // Skip if too short or contains common false positives
      if (phone.replace(/\D/g, '').length >= 10) {
        this.entities.push({
          text: match[0],
          type: 'phone',
          confidence: 0.85,
          startIndex: match.index!,
          endIndex: match.index! + match[0].length,
          metadata: { digits: phone.replace(/\D/g, '') },
        });
      }
    }
  }

  /**
   * Extract URLs
   */
  private extractUrls(): void {
    const matches = this.text.matchAll(PATTERNS.url);
    for (const match of matches) {
      this.entities.push({
        text: match[0],
        type: 'url',
        confidence: 0.95,
        startIndex: match.index!,
        endIndex: match.index! + match[0].length,
        metadata: {
          domain: this.extractDomain(match[0]),
          protocol: match[0].startsWith('https') ? 'https' : 'http',
        },
      });
    }
  }

  /**
   * Extract money/currency
   */
  private extractMoney(): void {
    const matches = this.text.matchAll(PATTERNS.money);
    for (const match of matches) {
      const text = match[0];
      const currency = this.detectCurrency(text);
      this.entities.push({
        text: text,
        type: 'money',
        confidence: 0.9,
        startIndex: match.index!,
        endIndex: match.index! + text.length,
        metadata: {
          amount: this.parseAmount(text),
          currency,
        },
      });
    }
  }

  /**
   * Extract dates
   */
  private extractDates(): void {
    const matches = this.text.matchAll(PATTERNS.date);
    for (const match of matches) {
      this.entities.push({
        text: match[0],
        type: 'date',
        confidence: 0.8,
        startIndex: match.index!,
        endIndex: match.index! + match[0].length,
        metadata: {
          parsed: this.parseDate(match[0]),
        },
      });
    }
  }

  /**
   * Extract times
   */
  private extractTimes(): void {
    const matches = this.text.matchAll(PATTERNS.time);
    for (const match of matches) {
      this.entities.push({
        text: match[0],
        type: 'time',
        confidence: 0.85,
        startIndex: match.index!,
        endIndex: match.index! + match[0].length,
        metadata: {
          parsed: this.parseTime(match[0]),
        },
      });
    }
  }

  /**
   * Extract person names using heuristics
   */
  private extractPersons(): void {
    const words = this.text.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      // Check for title prefix
      if (PERSON_TITLE_PREFIXES.some(t => words[i].startsWith(t))) {
        let nameParts = [words[i]];
        let j = i + 1;

        // Collect subsequent capitalized words
        while (j < words.length && /^[A-Z][a-z]+$/.test(words[j])) {
          nameParts.push(words[j]);
          j++;
        }

        if (nameParts.length >= 2) {
          const fullName = nameParts.join(' ');
          const startIndex = this.text.indexOf(fullName);

          // Check for duplicates
          if (!this.hasOverlappingEntity(startIndex, startIndex + fullName.length)) {
            this.entities.push({
              text: fullName,
              type: 'person',
              confidence: 0.75,
              startIndex,
              endIndex: startIndex + fullName.length,
              metadata: {
                title: nameParts[0],
                firstName: nameParts[1],
                lastName: nameParts.slice(2).join(' ') || undefined,
              },
            });
          }
        }
      }
    }
  }

  /**
   * Extract company names using suffixes
   */
  private extractCompanies(): void {
    for (const suffix of COMPANY_SUFFIXES) {
      const regex = new RegExp(`\\b[A-Z][A-Za-z\\s]+${suffix}\\b`, 'gi');
      const matches = this.text.matchAll(regex);

      for (const match of matches) {
        if (!this.hasOverlappingEntity(match.index!, match.index! + match[0].length)) {
          this.entities.push({
            text: match[0],
            type: 'company',
            confidence: 0.8,
            startIndex: match.index!,
            endIndex: match.index! + match[0].length,
            metadata: {
              suffix: suffix.replace('.', ''),
            },
          });
        }
      }
    }
  }

  /**
   * Extract location mentions
   */
  private extractLocations(): void {
    // Look for location keywords followed by place names
    const locationRegex = /\b(?:in|at|near|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const matches = this.text.matchAll(locationRegex);

    for (const match of matches) {
      const place = match[1];
      if (!this.hasOverlappingEntity(match.index! + match[0].indexOf(place), match.index! + match[0].indexOf(place) + place.length)) {
        this.entities.push({
          text: place,
          type: 'location',
          confidence: 0.7,
          startIndex: match.index! + match[0].indexOf(place),
          endIndex: match.index! + match[0].indexOf(place) + place.length,
        });
      }
    }

    // Also look for common Indian city/state names
    const indianLocations = this.findIndianLocations();
    for (const loc of indianLocations) {
      if (!this.hasOverlappingEntity(loc.startIndex, loc.endIndex)) {
        this.entities.push({
          text: loc.text,
          type: 'location',
          confidence: 0.85,
          startIndex: loc.startIndex,
          endIndex: loc.endIndex,
          metadata: { country: 'India' },
        });
      }
    }
  }

  /**
   * Find Indian locations
   */
  private findIndianLocations(): Array<{text: string; startIndex: number; endIndex: number}> {
    const indianCities = [
      'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune',
      'Ahmedabad', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
      'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik',
      'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Aurangabad', 'Dhanbad', 'Amritsar',
      'Aligarh', 'Gwalior', 'Coimbatore', 'Kochi', 'Mysore', 'Chandigarh', 'Guwahati'
    ];

    const indianStates = [
      'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Gujarat',
      'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Kerala', 'Punjab', 'Haryana',
      'Madhya Pradesh', 'Bihar', 'Odisha', 'Assam', 'Chhattisgarh', 'Jharkhand'
    ];

    const locations: Array<{text: string; startIndex: number; endIndex: number}> = [];

    for (const city of indianCities) {
      const regex = new RegExp(`\\b${city}\\b`, 'gi');
      const matches = this.text.matchAll(regex);
      for (const match of matches) {
        locations.push({
          text: match[0],
          startIndex: match.index!,
          endIndex: match.index! + match[0].length,
        });
      }
    }

    return locations;
  }

  /**
   * Remove duplicate and overlapping entities
   */
  private deduplicateEntities(): void {
    // Sort by start index
    this.entities.sort((a, b) => a.startIndex - b.startIndex);

    // Remove overlapping (keep first/longer)
    const filtered: ExtractedEntity[] = [];
    for (const entity of this.entities) {
      const hasOverlap = filtered.some(
        e => !(entity.endIndex <= e.startIndex || entity.startIndex >= e.endIndex)
      );
      if (!hasOverlap) {
        filtered.push(entity);
      }
    }

    this.entities = filtered;
  }

  /**
   * Check if position overlaps with existing entity
   */
  private hasOverlappingEntity(start: number, end: number): boolean {
    return this.entities.some(
      e => !(end <= e.startIndex || start >= e.endIndex)
    );
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  /**
   * Detect currency from text
   */
  private detectCurrency(text: string): string {
    if (text.includes('₹') || text.toLowerCase().includes('rupee') || text.includes('INR')) return 'INR';
    if (text.includes('€')) return 'EUR';
    if (text.includes('£')) return 'GBP';
    if (text.includes('USD') || text.includes('$')) return 'USD';
    return 'UNKNOWN';
  }

  /**
   * Parse amount from money text
   */
  private parseAmount(text: string): number {
    const cleaned = text.replace(/[₹$€£,]/g, '').trim();
    const match = cleaned.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  /**
   * Parse date string to object
   */
  private parseDate(text: string): Record<string, any> {
    const date = new Date(text);
    if (!isNaN(date.getTime())) {
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        iso: date.toISOString(),
      };
    }
    return { raw: text };
  }

  /**
   * Parse time string
   */
  private parseTime(text: string): Record<string, any> {
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (timeMatch) {
      return {
        hour: parseInt(timeMatch[1]),
        minute: timeMatch[2] ? parseInt(timeMatch[2]) : 0,
        period: timeMatch[3]?.toUpperCase(),
      };
    }
    return { raw: text };
  }
}

/**
 * Convenience function for entity extraction
 */
export function extractEntities(text: string): EntityExtractionResult {
  const extractor = new EntityExtractor(text);
  return extractor.extract();
}

/**
 * Extract entities from conversation messages
 */
export function extractFromConversation(messages: Array<{role: string; content: string}>): EntityExtractionResult {
  const fullText = messages.map(m => m.content).join(' ');
  return extractEntities(fullText);
}

export default EntityExtractor;
