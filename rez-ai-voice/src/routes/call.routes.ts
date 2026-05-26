/**
 * Call Routes
 * REST API endpoints for call management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { initiateOutboundCall, getTwilioConfig } from '../config/twilio.config';
import { getConversationService } from '../services/conversationService';
import { getVoiceSalesAgent } from '../agents/voiceSalesAgent';
import { getVoiceSupportAgent } from '../agents/voiceSupportAgent';
import { getVoiceInfoAgent } from '../agents/voiceInfoAgent';
import { logger } from '../utils/logger';
import { VoiceAgentType, OutboundCallRequest, OutboundCallResponse } from '../types';

const router = Router();

// Validation schemas
const outboundCallSchema = z.object({
  to: z.string().min(10),
  from: z.string().optional(),
  agentType: z.enum(['sales', 'support', 'info']).optional(),
  greetingMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

const callQuerySchema = z.object({
  callSid: z.string().optional(),
  conversationId: z.string().optional()
});

/**
 * POST /api/calls/outbound
 * Initiate an outbound call
 */
router.post('/outbound', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = outboundCallSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: validation.error.issues
      });
      return;
    }

    const params = validation.data as OutboundCallRequest;
    const config = getTwilioConfig();
    const webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;

    // Determine agent type and greeting
    const agentType = params.agentType || VoiceAgentType.INFO;
    const greetings: Record<VoiceAgentType, string> = {
      [VoiceAgentType.SALES]: 'Thank you for calling ReZ sales. How can I assist you today?',
      [VoiceAgentType.SUPPORT]: 'Thank you for calling ReZ support. How can I help you?',
      [VoiceAgentType.INFO]: 'Thank you for calling ReZ. How can I help you today?'
    };

    const greeting = params.greetingMessage || greetings[agentType];

    // Create TwiML URL for the call
    const twimlUrl = `${webhookBaseUrl}/webhook/voice`;

    // Initiate the call
    const result = await initiateOutboundCall({
      to: params.to,
      from: params.from || config.phoneNumber,
      url: twimlUrl,
      statusCallback: `${webhookBaseUrl}/api/calls/status`,
      timeout: 30
    });

    logger.info('Outbound call initiated via API', {
      callSid: result.callSid,
      to: params.to,
      agentType
    });

    const response: OutboundCallResponse = {
      callSid: result.callSid,
      status: result.status,
      direction: 'outbound'
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/calls/:callSid
 * Get call details
 */
router.get('/:callSid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callSid } = req.params;

    const conversationService = getConversationService();
    const conversation = conversationService.getConversationByCallSid(callSid);

    if (!conversation) {
      res.status(404).json({
        error: 'Call not found'
      });
      return;
    }

    res.status(200).json({
      callSid: conversation.callSid,
      callerNumber: conversation.callerNumber,
      agentType: conversation.agentType,
      state: conversation.state,
      startTime: conversation.startTime,
      lastActivity: conversation.lastActivity,
      turnCount: conversation.turns.length,
      isActive: conversation.isActive,
      metadata: conversation.metadata
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/calls/:callSid/transcript
 * Get call transcript
 */
router.get('/:callSid/transcript', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callSid } = req.params;

    const conversationService = getConversationService();
    const conversation = conversationService.getConversationByCallSid(callSid);

    if (!conversation) {
      res.status(404).json({
        error: 'Call not found'
      });
      return;
    }

    const transcript = conversationService.getTranscript(conversation.id);

    res.status(200).json({
      callSid,
      transcript,
      turnCount: conversation.turns.length,
      duration: conversation.lastActivity.getTime() - conversation.startTime.getTime()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/calls/:callSid/message
 * Send a message to an active call
 */
router.post('/:callSid/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callSid } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Message is required'
      });
      return;
    }

    const conversationService = getConversationService();
    const conversation = conversationService.getConversationByCallSid(callSid);

    if (!conversation) {
      res.status(404).json({
        error: 'Call not found'
      });
      return;
    }

    if (!conversation.isActive) {
      res.status(400).json({
        error: 'Call is no longer active'
      });
      return;
    }

    // Process message with appropriate agent
    let response;
    switch (conversation.agentType) {
      case VoiceAgentType.SALES:
        response = await getVoiceSalesAgent().processInput(conversation.id, message);
        break;
      case VoiceAgentType.SUPPORT:
        response = await getVoiceSupportAgent().processInput(conversation.id, message);
        break;
      default:
        response = await getVoiceInfoAgent().processInput(conversation.id, message);
    }

    logger.info('API message sent to call', {
      callSid,
      conversationId: conversation.id,
      messageLength: message.length,
      responseLength: response.text.length
    });

    res.status(200).json({
      success: true,
      response: {
        text: response.text,
        audioUrl: response.audioUrl,
        action: response.action
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/calls/:callSid/end
 * End an active call
 */
router.post('/:callSid/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callSid } = req.params;

    const conversationService = getConversationService();
    const conversation = conversationService.getConversationByCallSid(callSid);

    if (!conversation) {
      res.status(404).json({
        error: 'Call not found'
      });
      return;
    }

    conversationService.endConversation(conversation.id, 'API request');

    logger.info('Call ended via API', { callSid });

    res.status(200).json({
      success: true,
      callSid,
      duration: conversation.lastActivity.getTime() - conversation.startTime.getTime()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/calls
 * List active and recent calls
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversationService = getConversationService();
    const stats = conversationService.getStats();

    res.status(200).json({
      activeCalls: stats.active,
      totalCalls: stats.total,
      byAgentType: stats.byAgentType,
      averageTurns: stats.averageTurns
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/calls/status
 * Twilio status callback endpoint
 */
router.post('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    logger.info('Twilio status callback', {
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration
    });

    // Handle different statuses
    if (CallStatus === 'completed') {
      const conversationService = getConversationService();
      const conversation = conversationService.getConversationByCallSid(CallSid);

      if (conversation) {
        conversationService.endConversation(conversation.id, `Call completed: ${CallDuration}s`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/calls/active
 * Get count of active calls
 */
router.get('/stats/active', async (req: Request, res: Response) => {
  const conversationService = getConversationService();
  const stats = conversationService.getStats();

  res.status(200).json({
    activeConversations: stats.active,
    totalConversations: stats.total,
    byAgentType: stats.byAgentType
  });
});

export default router;
