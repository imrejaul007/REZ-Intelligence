import {
  OrchestrationRequestSchema,
  processOrchestrationRequest,
} from '../models/OrchestrationRequest';
import {
  OrchestrationResponseSchema,
  OrchestrationResponseBuilder,
} from '../models/OrchestrationResponse';
import {
  CollaborationDetailsSchema,
  CollaborationConfigSchema,
} from '../models/CollaborationDetails';

describe('OrchestrationRequest Schema', () => {
  it('should validate a valid request', () => {
    const validRequest = {
      message: 'Hello, world!',
      context: {
        userId: 'user123',
        sessionId: 'session456',
      },
      routingHints: {
        preferredAgents: ['agent-1'],
        priority: 'high' as const,
      },
    };

    const result = OrchestrationRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('should reject empty message', () => {
    const invalidRequest = {
      message: '',
    };

    const result = OrchestrationRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('should apply default options', () => {
    const request = {
      message: 'Test message',
    };

    const result = OrchestrationRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options?.maxRetries).toBe(3);
      expect(result.data.options?.fallbackEnabled).toBe(true);
      expect(result.data.options?.streamResponse).toBe(false);
    }
  });

  it('should process request with generated ID', () => {
    const request = {
      message: 'Test message',
    };

    const processed = processOrchestrationRequest(request);
    expect(processed.requestId).toBeDefined();
    expect(processed.timestamp).toBeInstanceOf(Date);
    expect(processed.priority).toBe('normal');
  });

  it('should preserve custom request ID', () => {
    const customId = '123e4567-e89b-12d3-a456-426614174000';
    const request = {
      requestId: customId,
      message: 'Test message',
    };

    const processed = processOrchestrationRequest(request);
    expect(processed.requestId).toBe(customId);
  });
});

describe('OrchestrationResponse Builder', () => {
  it('should build a complete response', () => {
    const builder = new OrchestrationResponseBuilder('test-request-id');

    const response = builder
      .setStatus('success')
      .setPrimaryResponse('Test response content', 'text')
      .addAttribution({
        agentId: 'agent-1',
        agentName: 'Test Agent',
        capabilities: ['natural_language'],
        confidence: 1.0,
        processingTimeMs: 100,
        isFallback: false,
      })
      .setCollaboration(1, 'single')
      .setTiming({
        totalProcessingTimeMs: 150,
        agentSelectionTimeMs: 20,
      })
      .setWarnings(['Warning 1'])
      .build();

    expect(response.requestId).toBe('test-request-id');
    expect(response.status).toBe('success');
    expect(response.primaryResponse.content).toBe('Test response content');
    expect(response.primaryResponse.format).toBe('text');
    expect(response.attribution).toHaveLength(1);
    expect(response.collaboration?.agentsInvolved).toBe(1);
    expect(response.collaboration?.strategy).toBe('single');
    expect(response.warnings).toContain('Warning 1');
  });

  it('should calculate total processing time', () => {
    const builder = new OrchestrationResponseBuilder('test-id');
    const startTime = Date.now();

    // Simulate some processing
    const response = builder.setStatus('success').build();

    expect(response.timing.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
    expect(response.timing.totalProcessingTimeMs).toBeLessThanOrEqual(Date.now() - startTime + 100);
  });
});

describe('CollaborationDetails Schema', () => {
  it('should validate collaboration config', () => {
    const config = {
      maxAgents: 3,
      strategy: 'sequential' as const,
      timeoutMs: 30000,
    };

    const result = CollaborationConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should apply default values', () => {
    const config = {};

    const result = CollaborationConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxAgents).toBe(5);
      expect(result.data.strategy).toBe('sequential');
      expect(result.data.timeoutMs).toBe(60000);
      expect(result.data.allowDynamicParticipantAddition).toBe(true);
    }
  });

  it('should reject invalid strategy', () => {
    const config = {
      strategy: 'invalid_strategy',
    };

    const result = CollaborationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('should reject maxAgents out of range', () => {
    const config = {
      maxAgents: 15, // Max is 10
    };

    const result = CollaborationConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});
