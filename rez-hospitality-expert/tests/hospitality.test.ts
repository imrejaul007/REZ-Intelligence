/**
 * Hospitality Expert Agent Tests
 * Unit tests for core functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HospitalityExpertiseService } from '../src/services/expertise.js';
import { RecommendationsService } from '../src/services/recommendations.js';
import { HospitalityIntent } from '../src/types/index.js';

describe('HospitalityExpertiseService', () => {
  let service: HospitalityExpertiseService;

  beforeEach(() => {
    service = new HospitalityExpertiseService();
  });

  describe('detectIntent', () => {
    it('should detect CHECK_IN intent from check-in message', () => {
      const result = service.detectIntent('I would like to check in');
      expect(result.intent).toBe(HospitalityIntent.CHECK_IN);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect CHECK_OUT intent from checkout message', () => {
      const result = service.detectIntent('Need to check out');
      expect(result.intent).toBe(HospitalityIntent.CHECK_OUT);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect ROOM_SERVICE intent from room service message', () => {
      const result = service.detectIntent('Order breakfast to my room');
      expect(result.intent).toBe(HospitalityIntent.ROOM_SERVICE);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect HOUSEKEEPING intent from housekeeping message', () => {
      const result = service.detectIntent('Need extra towels please');
      expect(result.intent).toBe(HospitalityIntent.HOUSEKEEPING);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect CONCIERGE intent from concierge message', () => {
      const result = service.detectIntent('Can you recommend a restaurant?');
      expect(result.intent).toBe(HospitalityIntent.CONCIERGE);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect EMERGENCY intent from emergency message', () => {
      const result = service.detectIntent('This is an emergency!');
      expect(result.intent).toBe(HospitalityIntent.EMERGENCY);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect WIFI intent from WiFi message', () => {
      const result = service.detectIntent('What is the WiFi password?');
      expect(result.intent).toBe(HospitalityIntent.WiFi_TECHNICAL);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should return GENERAL_INQUIRY for unknown messages', () => {
      const result = service.detectIntent('Hello there');
      expect(result.intent).toBe(HospitalityIntent.GENERAL_INQUIRY);
    });
  });

  describe('getRoomInformation', () => {
    it('should return room information for specific room type', () => {
      const result = service.getRoomInformation(HospitalityIntent.ROOM_UPGRADE as any);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSuggestedActions', () => {
    it('should return suggested actions for CHECK_IN', () => {
      const actions = service.getSuggestedActions(HospitalityIntent.CHECK_IN);
      expect(actions).toBeDefined();
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].action).toBeDefined();
    });

    it('should return suggested actions for ROOM_SERVICE', () => {
      const actions = service.getSuggestedActions(HospitalityIntent.ROOM_SERVICE);
      expect(actions).toBeDefined();
      expect(actions.some(a => a.label.includes('Breakfast'))).toBe(true);
    });

    it('should return suggested actions for HOUSEKEEPING', () => {
      const actions = service.getSuggestedActions(HospitalityIntent.HOUSEKEEPING);
      expect(actions).toBeDefined();
      expect(actions.some(a => a.label.includes('Towels'))).toBe(true);
    });
  });

  describe('getQuickReplies', () => {
    it('should return quick replies for CHECK_IN', () => {
      const replies = service.getQuickReplies(HospitalityIntent.CHECK_IN);
      expect(replies).toBeDefined();
      expect(Array.isArray(replies)).toBe(true);
      expect(replies.length).toBeGreaterThan(0);
    });

    it('should return quick replies for CHECK_OUT', () => {
      const replies = service.getQuickReplies(HospitalityIntent.CHECK_OUT);
      expect(replies).toBeDefined();
      expect(replies.some(r => r.toLowerCase().includes('checkout'))).toBe(true);
    });
  });
});

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  beforeEach(() => {
    service = new RecommendationsService();
  });

  describe('generateRoomRecommendations', () => {
    it('should generate upgrade recommendations', () => {
      const result = service.generateRoomRecommendations({
        reservation: { id: '1', roomType: 'STANDARD' } as any,
        stayDuration: 3,
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should generate recommendations with price differences', () => {
      const result = service.generateRoomRecommendations({
        reservation: { id: '1', roomType: 'STANDARD' } as any,
        stayDuration: 1,
      });
      result.forEach(rec => {
        expect(rec.priceDifference).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('generateAmenityRecommendations', () => {
    it('should generate morning amenities for morning context', () => {
      const result = service.generateAmenityRecommendations({
        timeOfDay: 'morning',
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should generate evening amenities for evening context', () => {
      const result = service.generateAmenityRecommendations({
        timeOfDay: 'evening',
      });
      expect(result).toBeDefined();
    });
  });

  describe('generateDiningRecommendations', () => {
    it('should generate morning dining for morning context', () => {
      const result = service.generateDiningRecommendations({
        timeOfDay: 'morning',
      });
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('restaurant');
    });

    it('should generate evening dining for evening context', () => {
      const result = service.generateDiningRecommendations({
        timeOfDay: 'evening',
      });
      expect(result).toBeDefined();
    });
  });

  describe('generateLocalRecommendations', () => {
    it('should generate local recommendations', () => {
      const result = service.generateLocalRecommendations({
        timeOfDay: 'afternoon',
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by type when specified', () => {
      const result = service.generateLocalRecommendations({
        timeOfDay: 'afternoon',
      });
      const types = result.map(r => r.type);
      expect(types).toContain('attraction');
    });
  });

  describe('generateWelcomeMessage', () => {
    it('should include guest name when provided', () => {
      const message = service.generateWelcomeMessage({
        guest: { id: '1', name: 'John' } as any,
      });
      expect(message).toContain('John');
    });

    it('should include room type when provided', () => {
      const message = service.generateWelcomeMessage({
        reservation: { roomType: 'DELUXE' } as any,
      });
      expect(message).toContain('Deluxe');
    });

    it('should include occasion message for special occasions', () => {
      const message = service.generateWelcomeMessage({
        specialOccasion: 'honeymoon',
      });
      expect(message).toContain('honeymoon');
    });
  });

  describe('getQuickSuggestions', () => {
    it('should return quick suggestions', () => {
      const suggestions = service.getQuickSuggestions({
        timeOfDay: 'morning',
      });
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});

describe('Intent Detection', () => {
  const service = new HospitalityExpertiseService();

  const testCases = [
    { message: 'check me in', expected: HospitalityIntent.CHECK_IN },
    { message: 'I want to check out', expected: HospitalityIntent.CHECK_OUT },
    { message: 'room service menu', expected: HospitalityIntent.ROOM_SERVICE },
    { message: 'bring me towels', expected: HospitalityIntent.HOUSEKEEPING },
    { message: 'book a spa appointment', expected: HospitalityIntent.SPA_WELLNESS },
    { message: 'airport shuttle', expected: HospitalityIntent.TRANSPORTATION },
    { message: 'complaint about noise', expected: HospitalityIntent.COMPLAINT },
    { message: 'view my bill', expected: HospitalityIntent.BILLING },
    { message: 'restaurant reservations', expected: HospitalityIntent.DINING },
    { message: 'upgrade my room', expected: HospitalityIntent.ROOM_UPGRADE },
  ];

  testCases.forEach(({ message, expected }) => {
    it(`should detect ${expected} from "${message}"`, () => {
      const result = service.detectIntent(message);
      expect(result.intent).toBe(expected);
    });
  });
});
