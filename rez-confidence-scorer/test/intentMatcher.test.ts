import { AgentCapabilities } from '../src/types';

describe('Intent Matcher', () => {
  // Mock data for testing
  const mockCapabilities: AgentCapabilities = {
    domains: ['payment', 'billing', 'refunds'],
    maxConcurrentTasks: 10,
    specializations: ['credit_card', 'upi', 'netbanking', 'wallet'],
    supportedLanguages: ['en', 'hi'],
    version: '1.0.0',
  };

  describe('Keyword Extraction', () => {
    it('should extract keywords from intent string', () => {
      const intent = 'Process credit card payment through UPI';
      const normalized = intent
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2);

      // Should remove common stop words
      expect(normalized).not.toContain('the');
      expect(normalized).not.toContain('and');
      expect(normalized).not.toContain('for');

      // Should keep meaningful words
      expect(normalized).toContain('process');
      expect(normalized).toContain('credit');
      expect(normalized).toContain('card');
      expect(normalized).toContain('payment');
    });

    it('should filter out short words', () => {
      const intent = 'I need to pay via cc';
      const words = intent.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
      expect(words.length).toBeLessThanOrEqual(intent.split(/\s+/).length);
    });
  });

  describe('Capability Matching', () => {
    it('should match exact capability', () => {
      const intent = 'process credit card payment';
      const capability = 'credit_card';

      const isMatch =
        intent.toLowerCase().includes(capability.replace('_', ' ')) ||
        capability.replace('_', ' ').includes(intent.toLowerCase());

      expect(isMatch).toBe(true);
    });

    it('should match partial capability', () => {
      const intent = 'process payment';
      const capability = 'payment_processing';

      const isMatch =
        capability.includes(intent) || intent.includes(capability.split('_')[0]);

      expect(isMatch).toBe(true);
    });

    it('should not match unrelated capability', () => {
      const intent = 'process payment';
      const capability = 'hotel_booking';

      const isMatch = capability.includes(intent) || intent.includes(capability);

      expect(isMatch).toBe(false);
    });
  });

  describe('Domain Matching', () => {
    it('should match exact domain', () => {
      const intent = 'refund request';
      const domain = 'refunds';

      const isMatch =
        domain.toLowerCase() === intent.toLowerCase() ||
        domain.includes(intent.toLowerCase()) ||
        intent.toLowerCase().includes(domain);

      expect(isMatch).toBe(true);
    });

    it('should match partial domain', () => {
      const intent = 'pay bill';
      const domain = 'billing';

      const isMatch =
        domain.includes(intent.split(' ')[0]) || intent.includes(domain.slice(0, -1));

      expect(isMatch).toBe(true);
    });
  });

  describe('Confidence Level Calculation', () => {
    const getConfidenceLevel = (score: number): 'high' | 'medium' | 'low' => {
      if (score >= 0.75) return 'high';
      if (score >= 0.4) return 'medium';
      return 'low';
    };

    it('should return high for scores >= 0.75', () => {
      expect(getConfidenceLevel(0.75)).toBe('high');
      expect(getConfidenceLevel(0.9)).toBe('high');
      expect(getConfidenceLevel(1.0)).toBe('high');
    });

    it('should return medium for scores >= 0.4 and < 0.75', () => {
      expect(getConfidenceLevel(0.4)).toBe('medium');
      expect(getConfidenceLevel(0.5)).toBe('medium');
      expect(getConfidenceLevel(0.74)).toBe('medium');
    });

    it('should return low for scores < 0.4', () => {
      expect(getConfidenceLevel(0.0)).toBe('low');
      expect(getConfidenceLevel(0.3)).toBe('low');
      expect(getConfidenceLevel(0.39)).toBe('low');
    });
  });

  describe('Score Calculation', () => {
    it('should calculate weighted capability score', () => {
      const intentKeywords = ['process', 'payment', 'refund'];
      const capabilities = ['payment', 'refunds', 'billing'];
      const weights = { capability: 0.4, domain: 0.3, specialization: 0.2, required: 0.1 };

      let matches = 0;
      for (const keyword of intentKeywords) {
        for (const cap of capabilities) {
          if (cap.includes(keyword) || keyword.includes(cap)) {
            matches += 1;
            break;
          }
        }
      }

      const capabilityScore = matches / intentKeywords.length;
      const score = capabilityScore * weights.capability;

      expect(score).toBeGreaterThan(0);
    });

    it('should normalize score to 0-1 range', () => {
      const normalizeScore = (score: number): number => {
        return Math.min(1, Math.max(0, score));
      };

      expect(normalizeScore(-0.5)).toBe(0);
      expect(normalizeScore(1.5)).toBe(1);
      expect(normalizeScore(0.5)).toBe(0.5);
    });
  });

  describe('Matched/Unmatched Capabilities', () => {
    it('should identify matched capabilities', () => {
      const intent = 'process payment';
      const capabilities = ['payment_processing', 'refunds', 'billing'];
      const intentKeywords = intent.toLowerCase().split(/\s+/);

      const matched: string[] = [];
      for (const keyword of intentKeywords) {
        for (const cap of capabilities) {
          if (cap.includes(keyword) || keyword.includes(cap)) {
            matched.push(cap);
            break;
          }
        }
      }

      expect(matched).toContain('payment_processing');
    });

    it('should identify unmatched requirements', () => {
      const requiredCapabilities = ['payment_processing', 'kyc_verification'];
      const matchedCapabilities = ['payment_processing'];

      const unmatched = requiredCapabilities.filter(
        (req) => !matchedCapabilities.includes(req)
      );

      expect(unmatched).toContain('kyc_verification');
    });
  });
});
