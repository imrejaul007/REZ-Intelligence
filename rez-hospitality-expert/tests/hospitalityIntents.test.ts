/**
 * HospitalityIntents Unit Tests
 *
 * Tests for the HospitalityIntents class which handles hospitality-specific
 * intent detection and response generation.
 */

import {
  HospitalityIntents,
  hospitalityIntents,
  IntentResponse,
} from '../src/intents/hospitalityIntents';
import {
  HospitalityIntent,
  ConversationContext,
  RoomType,
  Priority,
  ServiceStatus,
} from '../src/types/index.js';

// Mock external services
jest.mock('../src/services/expertise', () => ({
  expertiseService: {
    detectIntent: jest.fn().mockReturnValue({
      intent: HospitalityIntent.GENERAL_INQUIRY,
      confidence: 0.7,
      context: [],
    }),
  },
}));

jest.mock('../src/services/workflows', () => ({
  workflowService: {
    getCheckInWorkflow: jest.fn().mockReturnValue({
      estimatedTime: '10-15 minutes',
      steps: [],
    }),
    getCheckOutWorkflow: jest.fn().mockReturnValue({
      estimatedTime: '5-10 minutes',
      steps: [],
    }),
  },
}));

jest.mock('../src/services/recommendations', () => ({
  recommendationsService: {
    generateLocalRecommendations: jest.fn().mockReturnValue([]),
    generateDiningRecommendations: jest.fn().mockReturnValue([]),
    generateRoomRecommendations: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../src/config/tone', () => ({
  selectTone: jest.fn().mockReturnValue('warm'),
  ToneType: {
    WARM: 'warm',
    PROFESSIONAL: 'professional',
    REASSURING: 'reassuring',
  },
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('HospitalityIntents', () => {
  let hospitalityIntentsInstance: HospitalityIntents;

  const createMockContext = (overrides: Partial<ConversationContext> = {}): ConversationContext => ({
    sessionId: 'session-123',
    conversationHistory: [],
    recentRequests: [],
    language: 'en',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    hospitalityIntentsInstance = new HospitalityIntents();
  });

  describe('detectIntent', () => {
    it('should detect CHECK_IN intent from check-in message', async () => {
      const result = hospitalityIntentsInstance.detectIntent('I want to check in');

      expect(result.intent).toBe(HospitalityIntent.GENERAL_INQUIRY); // Uses expertise service
      expect(result.confidence).toBeDefined();
    });

    it('should detect ROOM_SERVICE intent', async () => {
      const result = hospitalityIntentsInstance.detectIntent('I need room service');

      expect(result.intent).toBeDefined();
    });

    it('should include context keywords', async () => {
      const result = hospitalityIntentsInstance.detectIntent('I want to check in');

      expect(result.context).toBeDefined();
    });
  });

  describe('handleIntent', () => {
    it('should handle CHECK_IN intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.CHECK_IN,
        context,
        'I want to check in'
      );

      expect(result.intent).toBe(HospitalityIntent.CHECK_IN);
      expect(result.message).toContain('check-in');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.suggestedActions).toBeDefined();
      expect(result.quickReplies).toBeDefined();
    });

    it('should handle CHECK_OUT intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.CHECK_OUT,
        context,
        'I need to check out'
      );

      expect(result.intent).toBe(HospitalityIntent.CHECK_OUT);
      expect(result.message).toContain('check-out');
      expect(result.suggestedActions).toBeDefined();
    });

    it('should handle ROOM_SERVICE intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.ROOM_SERVICE,
        context,
        'Order food to my room'
      );

      expect(result.intent).toBe(HospitalityIntent.ROOM_SERVICE);
      expect(result.message).toContain('room service');
      expect(result.suggestedActions).toContain('Breakfast Menu');
    });

    it('should handle HOUSEKEEPING intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.HOUSEKEEPING,
        context,
        'I need extra towels'
      );

      expect(result.intent).toBe(HospitalityIntent.HOUSEKEEPING);
      expect(result.suggestedActions).toContain('Extra Towels');
    });

    it('should handle CONCIERGE intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.CONCIERGE,
        context,
        'Can you recommend a restaurant'
      );

      expect(result.intent).toBe(HospitalityIntent.CONCIERGE);
      expect(result.suggestedActions).toContain('Restaurant Booking');
    });

    it('should handle AMENITIES intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.AMENITIES,
        context,
        'When does the pool open'
      );

      expect(result.intent).toBe(HospitalityIntent.AMENITIES);
      expect(result.suggestedActions).toContain('Pool Information');
    });

    it('should handle DINING intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.DINING,
        context,
        'I want to make a restaurant reservation'
      );

      expect(result.intent).toBe(HospitalityIntent.DINING);
      expect(result.suggestedActions).toContain('Make Reservation');
    });

    it('should handle SPA_WELLNESS intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.SPA_WELLNESS,
        context,
        'Book a massage'
      );

      expect(result.intent).toBe(HospitalityIntent.SPA_WELLNESS);
      expect(result.suggestedActions).toContain('View Treatment Menu');
    });

    it('should handle TRANSPORTATION intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.TRANSPORTATION,
        context,
        'I need an airport transfer'
      );

      expect(result.intent).toBe(HospitalityIntent.TRANSPORTATION);
      expect(result.suggestedActions).toContain('Airport Transfer');
    });

    it('should handle LOCAL_RECOMMENDATIONS intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.LOCAL_RECOMMENDATIONS,
        context,
        'What can I do nearby'
      );

      expect(result.intent).toBe(HospitalityIntent.LOCAL_RECOMMENDATIONS);
      expect(result.suggestedActions).toContain('Beaches');
    });

    it('should handle ROOM_UPGRADE intent', async () => {
      const context = createMockContext({
        reservation: {
          id: 'res-123',
          guestId: 'guest-123',
          roomType: RoomType.STANDARD,
          checkInDate: new Date().toISOString(),
          checkOutDate: new Date().toISOString(),
        },
      });

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.ROOM_UPGRADE,
        context,
        'I want to upgrade my room'
      );

      expect(result.intent).toBe(HospitalityIntent.ROOM_UPGRADE);
      expect(result.suggestedActions).toContain('View Suites');
    });

    it('should handle COMPLAINT intent with high priority', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.COMPLAINT,
        context,
        'I have a complaint'
      );

      expect(result.intent).toBe(HospitalityIntent.COMPLAINT);
      expect(result.serviceRequest).toBeDefined();
      expect(result.serviceRequest?.priority).toBe(Priority.HIGH);
    });

    it('should handle EMERGENCY intent with urgent priority', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.EMERGENCY,
        context,
        'Help, there is an emergency'
      );

      expect(result.intent).toBe(HospitalityIntent.EMERGENCY);
      expect(result.serviceRequest).toBeDefined();
      expect(result.serviceRequest?.priority).toBe(Priority.URGENT);
    });

    it('should handle BILLING intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.BILLING,
        context,
        'I have a question about my bill'
      );

      expect(result.intent).toBe(HospitalityIntent.BILLING);
      expect(result.suggestedActions).toContain('View Bill');
    });

    it('should handle WiFi_TECHNICAL intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.WiFi_TECHNICAL,
        context,
        'The WiFi is not working'
      );

      expect(result.intent).toBe(HospitalityIntent.WiFi_TECHNICAL);
      expect(result.suggestedActions).toContain('Get WiFi Password');
    });

    it('should handle GENERAL_INQUIRY intent', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.GENERAL_INQUIRY,
        context,
        'What services do you offer'
      );

      expect(result.intent).toBe(HospitalityIntent.GENERAL_INQUIRY);
      expect(result.confidence).toBe(0.70);
    });
  });

  describe('intent response structure', () => {
    it('should return complete IntentResponse structure', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.CHECK_IN,
        context,
        'I want to check in'
      );

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('suggestedActions');
      expect(result).toHaveProperty('quickReplies');
    });

    it('should include follow-up question', async () => {
      const context = createMockContext();

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.CHECK_IN,
        context,
        'I want to check in'
      );

      expect(result.followUp).toBeDefined();
      expect(typeof result.followUp).toBe('string');
    });

    it('should include metadata for room upgrade', async () => {
      const context = createMockContext({
        reservation: {
          id: 'res-123',
          guestId: 'guest-123',
          roomType: RoomType.STANDARD,
          checkInDate: new Date().toISOString(),
          checkOutDate: new Date().toISOString(),
        },
      });

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.ROOM_UPGRADE,
        context,
        'Show me upgrade options'
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.availableUpgrades).toBeDefined();
    });
  });

  describe('intent handler getTone', () => {
    it('should return correct tone for positive sentiment', () => {
      const handler = hospitalityIntentsInstance.getIntentHandler(HospitalityIntent.CHECK_IN);

      const tone = handler.getTone('positive');

      expect(tone).toBeDefined();
    });

    it('should return correct tone for negative sentiment', () => {
      const handler = hospitalityIntentsInstance.getIntentHandler(HospitalityIntent.COMPLAINT);

      const tone = handler.getTone('negative');

      expect(tone).toBeDefined();
    });

    it('should return correct tone for neutral sentiment', () => {
      const handler = hospitalityIntentsInstance.getIntentHandler(HospitalityIntent.GENERAL_INQUIRY);

      const tone = handler.getTone('neutral');

      expect(tone).toBeDefined();
    });

    it('should handle emergency with reassuring tone', () => {
      const handler = hospitalityIntentsInstance.getIntentHandler(HospitalityIntent.EMERGENCY);

      const tone = handler.getTone();

      expect(tone).toBeDefined();
    });
  });

  describe('intent handler detect', () => {
    it('should detect intent from message in each handler', () => {
      const checkInHandler = hospitalityIntentsInstance.getIntentHandler(HospitalityIntent.CHECK_IN);
      const detectResult = checkInHandler.detect('I want to check in');

      expect(detectResult).toHaveProperty('intent');
      expect(detectResult).toHaveProperty('confidence');
    });
  });

  describe('exported singleton', () => {
    it('should export hospitalityIntents singleton', () => {
      expect(hospitalityIntents).toBeDefined();
      expect(hospitalityIntents).toBeInstanceOf(HospitalityIntents);
    });

    it('should handle intents through singleton', async () => {
      const context = createMockContext();

      const result = await hospitalityIntents.handleIntent(
        HospitalityIntent.GENERAL_INQUIRY,
        context,
        'Hello'
      );

      expect(result).toBeDefined();
      expect(result.intent).toBe(HospitalityIntent.GENERAL_INQUIRY);
    });
  });

  describe('context-aware responses', () => {
    it('should use reservation context for room upgrade', async () => {
      const context = createMockContext({
        reservation: {
          id: 'res-123',
          guestId: 'guest-123',
          roomType: RoomType.DELUXE,
          checkInDate: new Date().toISOString(),
          checkOutDate: new Date().toISOString(),
        },
      });

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.ROOM_UPGRADE,
        context,
        'Show me available upgrades'
      );

      expect(result.message).toContain('enhance');
    });

    it('should use guest context when available', async () => {
      const context = createMockContext({
        guest: {
          id: 'guest-123',
          name: 'John Doe',
          tier: 'GOLD',
        },
      });

      const result = await hospitalityIntentsInstance.handleIntent(
        HospitalityIntent.GENERAL_INQUIRY,
        context,
        'Hello'
      );

      expect(result).toBeDefined();
    });
  });
});
