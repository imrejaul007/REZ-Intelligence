/**
 * Twilio Voice Webhook Handler
 * Handles incoming call events and routing for the voice agent
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  generateTwiMLResponse,
  generateGatherTwiML,
  generateDialTwiML,
  generateRejectTwiML,
  validateTwilioSignature
} from '../config/twilio.config';
import { getIvrService } from '../services/ivrService';
import { getConversationService } from '../services/conversationService';
import { getSTTService } from '../services/sttService';
import { getTTSService } from '../services/ttsService';
import { getVoiceSalesAgent } from '../agents/voiceSalesAgent';
import { getVoiceSupportAgent } from '../agents/voiceSupportAgent';
import { getVoiceInfoAgent } from '../agents/voiceInfoAgent';
import { logger, logCallEvent } from '../utils/logger.js';
import {
  TwilioVoiceWebhookRequest,
  VoiceAgentType,
  ConversationState
} from '../types';

// Store active call sessions
const activeSessions: Map<string, {
  callSid: string;
  conversationId?: string;
  ivrSessionId?: string;
  agentType?: VoiceAgentType;
  state: 'ivr' | 'agent' | 'transfer' | 'voicemail';
  startTime: Date;
}> = new Map();

/**
 * Main webhook handler for Twilio voice
 */
export async function handleVoiceWebhook(req: Request, res: Response): Promise<void> {
  const twilioRequest = req.body as TwilioVoiceWebhookRequest;
  const callSid = twilioRequest.CallSid;

  // Validate Twilio signature in production
  if (process.env.NODE_ENV === 'production') {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `${process.env.TWILIO_WEBHOOK_BASE_URL}/webhook/voice`;

    if (!validateTwilioSignature(signature, url, req.body as Record<string, string>)) {
      logger.warn('Invalid Twilio signature', { callSid });
      res.status(403).send('Forbidden');
      return;
    }
  }

  logCallEvent(callSid, 'Webhook received', {
    callStatus: twilioRequest.CallStatus,
    from: twilioRequest.From,
    to: twilioRequest.To
  });

  try {
    // Route based on call status
    switch (twilioRequest.CallStatus) {
      case 'initiated':
        await handleCallInitiated(callSid, twilioRequest, res);
        break;
      case 'ringing':
        await handleCallRinging(callSid, twilioRequest, res);
        break;
      case 'in-progress':
        await handleCallInProgress(callSid, twilioRequest, res);
        break;
      case 'completed':
        await handleCallCompleted(callSid, twilioRequest, res);
        break;
      case 'busy':
      case 'no-answer':
        await handleCallFailed(callSid, twilioRequest, res);
        break;
      default:
        await handleCallDefault(callSid, twilioRequest, res);
    }
  } catch (error) {
    logger.error('Webhook handler error', { callSid, error });
    res.status(500).type('text/xml').send(generateErrorTwiML('An error occurred. Please try again.'));
  }
}

/**
 * Handle new incoming call
 */
async function handleCallInitiated(callSid: string, request: TwilioVoiceWebhookRequest, res: Response): Promise<void> {
  logCallEvent(callSid, 'Call initiated');

  // Initialize session
  const session = {
    callSid,
    state: 'ivr' as const,
    startTime: new Date()
  };
  activeSessions.set(callSid, session);

  // Create IVR session
  const ivrService = getIvrService();
  const ivrSessionId = ivrService.createSession();
  session.ivrSessionId = ivrSessionId;

  const webhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL || 'https://your-domain.com';
  const gatherUrl = `${webhookBaseUrl}/webhook/voice`;

  const twiml = generateGatherTwiML({
    prompt: 'Welcome to ReZ. For sales, press 1. For customer support, press 2. For information, press 3. To speak with an operator, press 0.',
    numDigits: 1,
    timeout: 5,
    action: gatherUrl
  });

  logCallEvent(callSid, 'Sending welcome IVR');
  res.type('text/xml').send(twiml);
}

/**
 * Handle call ringing
 */
async function handleCallRinging(callSid: string, request: TwilioVoiceWebhookRequest, res: Response): Promise<void> {
  logCallEvent(callSid, 'Call ringing');
  res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

/**
 * Handle call in progress
 */
async function handleCallInProgress(callSid: string, request: TwilioVoiceWebhookRequest, res: Response): Promise<void> {
  logCallEvent(callSid, 'Call in progress');

  const session = activeSessions.get(callSid);
  if (!session) {
    res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    return;
  }

  // Handle based on current state
  switch (session.state) {
    case 'ivr':
      await handleIVRState(callSid, request, res, session);
      break;
    case 'agent':
      await handleAgentState(callSid, request, res, session);
      break;
    case 'transfer':
      await handleTransferState(callSid, request, res, session);
      break;
    case 'voicemail':
      await handleVoicemailState(callSid, request, res, session);
      break;
    default:
      res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
}

/**
 * Handle IVR state
 */
async function handleIVRState(callSid: string, request: TwilioVoiceWebhookRequest, res: Response, session: typeof activeSessions extends Map<string, infer V> ? V : never): Promise<void> {
  const ivrService = getIvrService();

  if (!request.Digits) {
    // No digits - might be timeout, show menu again
    if (session.ivrSessionId) {
      const twiml = ivrService.generateTwiML(session.ivrSessionId, `${process.env.TWILIO_WEBHOOK_BASE_URL}/webhook/voice`);
      res.type('text/xml').send(twiml);
      return;
    }
    res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    return;
  }

  // Process digit input
  if (session.ivrSessionId) {
    const updatedContext = ivrService.processInput(session.ivrSessionId, request.Digits);
    const context = ivrService.buildConversationContext(session.ivrSessionId);

    logCallEvent(callSid, 'IVR digit received', { digits: request.Digits, newState: context.state });

    // Check if should transfer to agent
    if (context.state === ConversationState.TRANSFER) {
      session.state = 'agent';
      session.agentType = context.agentType;

      // Start agent conversation
      await startAgentConversation(callSid, session, context.agentType!);

      const twiml = generateGatherTwiML({
        prompt: 'Connecting you now. Please hold.',
        numDigits: 1,
        timeout: 1,
        action: `${process.env.TWILIO_WEBHOOK_BASE_URL}/webhook/voice`
      });
      res.type('text/xml').send(twiml);
      return;
    }

    // Check if should transfer to operator
    if (request.Digits === '0') {
      session.state = 'transfer';
      logCallEvent(callSid, 'Transferring to operator');
      const twiml = generateDialTwiML(process.env.OPERATOR_PHONE_NUMBER || '');
      res.type('text/xml').send(twiml);
      return;
    }

    // Continue in IVR
    const twiml = ivrService.generateTwiML(session.ivrSessionId, `${process.env.TWILIO_WEBHOOK_BASE_URL}/webhook/voice`);
    res.type('text/xml').send(twiml);
  } else {
    res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
}

/**
 * Handle agent conversation state
 */
async function handleAgentState(callSid: string, request: TwilioVoiceWebhookRequest, res: Response, session: typeof activeSessions extends Map<string, infer V> ? V : never): Promise<void> {
  if (!session.conversationId || !session.agentType) {
    // Start new agent conversation
    await startAgentConversation(callSid, session, VoiceAgentType.INFO);
  }

  const conversationService = getConversationService();
  const conversation = conversationService.getConversation(session.conversationId!);

  if (!conversation) {
    res.status(200).type('text/xml').send(generateErrorTwiML('Conversation not found.'));
    return;
  }

  // Check for speech input
  let userMessage = '';
  let transcriptionConfidence = 0;

  if (request.SpeechResult) {
    userMessage = request.SpeechResult;
    transcriptionConfidence = parseFloat(request.Confidence || '0.5');
  } else if (request.TranscriptionText) {
    userMessage = request.TranscriptionText;
    transcriptionConfidence = 0.8;
  }

  if (userMessage) {
    logCallEvent(callSid, 'User speech received', { text: userMessage, confidence: transcriptionConfidence });

    // Process with appropriate agent
    let response;
    switch (session.agentType) {
      case VoiceAgentType.SALES:
        const salesAgent = getVoiceSalesAgent();
        response = await salesAgent.processInput(session.conversationId!, userMessage, {
          transcription: { text: userMessage, confidence: transcriptionConfidence }
        });
        break;
      case VoiceAgentType.SUPPORT:
        const supportAgent = getVoiceSupportAgent();
        response = await supportAgent.processInput(session.conversationId!, userMessage, {
          transcription: { text: userMessage, confidence: transcriptionConfidence }
        });
        break;
      default:
        const infoAgent = getVoiceInfoAgent();
        response = await infoAgent.processInput(session.conversationId!, userMessage, {
          transcription: { text: userMessage, confidence: transcriptionConfidence }
        });
    }

    logCallEvent(callSid, 'Agent response', { text: response.text, action: response.action });

    // Handle agent action
    switch (response.action) {
      case 'hangup':
        session.state = 'completed';
        const goodbye = generateTwiMLResponse(response.text);
        res.type('text/xml').send(goodbye);
        return;

      case 'transfer':
        session.state = 'transfer';
        const transferTwiml = response.transferNumber
          ? generateDialTwiML(response.transferNumber)
          : generateTwiMLResponse('Transferring you now. Please hold.');
        res.type('text/xml').send(transferTwiml);
        return;

      case 'voicemail':
        session.state = 'voicemail';
        const voicemailTwiml = generateVoicemailTwiML();
        res.type('text/xml').send(voicemailTwiml);
        return;

      default:
        // Continue conversation with audio response
        if (response.audioUrl) {
          const twiml = generateWithAudio(response.text, response.audioUrl);
          res.type('text/xml').send(twiml);
        } else {
          const twiml = generateTwiMLResponse(response.text);
          res.type('text/xml').send(twiml);
        }
    }
  } else {
    // No input - play greeting or wait
    if (conversation.turns.length === 0) {
      // Generate greeting
      let greeting: VoiceAgentResponse;
      switch (session.agentType) {
        case VoiceAgentType.SALES:
          greeting = await getVoiceSalesAgent().startConversation(callSid, request.From);
          break;
        case VoiceAgentType.SUPPORT:
          greeting = await getVoiceSupportAgent().startConversation(callSid, request.From);
          break;
        default:
          greeting = await getVoiceInfoAgent().startConversation(callSid, request.From);
      }

      if (greeting.audioUrl) {
        const twiml = generateWithAudio(greeting.text, greeting.audioUrl);
        res.type('text/xml').send(twiml);
      } else {
        const twiml = generateTwiMLResponse(greeting.text);
        res.type('text/xml').send(twiml);
      }
    } else {
      // Continue waiting for input
      const twiml = generateSilenceWait();
      res.type('text/xml').send(twiml);
    }
  }
}

/**
 * Handle transfer state
 */
async function handleTransferState(callSid: string, request: TwilioVoiceWebhookRequest, res: Response, session: typeof activeSessions extends Map<string, infer V> ? V : never): Promise<void> {
  logCallEvent(callSid, 'Transfer complete or failed');
  res.status(200).type('text/xml').send(generateTwiMLResponse('Call ended.'));
}

/**
 * Handle voicemail state
 */
async function handleVoicemailState(callSid: string, request: TwilioVoiceWebhookRequest, res: Response, session: typeof activeSessions extends Map<string, infer V> ? V : never): Promise<void> {
  logCallEvent(callSid, 'Voicemail recorded');

  if (request.RecordingUrl) {
    logger.info('Voicemail saved', { callSid, recordingUrl: request.RecordingUrl });
    // Could process transcription here
    if (request.TranscriptionText) {
      logger.info('Voicemail transcription', { callSid, transcription: request.TranscriptionText });
    }
  }

  res.status(200).type('text/xml').send(generateTwiMLResponse('Thank you for your message. We will get back to you shortly.'));
}

/**
 * Handle call completed
 */
async function handleCallCompleted(callSid: string, request: TwilioVoiceWebhookRequest, res: Response): Promise<void> {
  logCallEvent(callSid, 'Call completed', {
    duration: request.CallDuration
  });

  // Cleanup session
  const session = activeSessions.get(callSid);
  if (session) {
    if (session.conversationId) {
      getConversationService().endConversation(session.conversationId, 'call completed');
    }
    if (session.ivrSessionId) {
      getIvrService().endSession(session.ivrSessionId);
    }
    activeSessions.delete(callSid);
  }

  res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

/**
 * Handle call failed
 */
async function handleCallFailed(callSid: string, request: TwilioVoiceWebhookRequest, res: Response): Promise<void> {
  logCallEvent(callSid, 'Call failed or not answered', { status: request.CallStatus });

  const session = activeSessions.get(callSid);
  if (session) {
    if (session.conversationId) {
      getConversationService().endConversation(session.conversationId, 'call failed');
    }
    activeSessions.delete(callSid);
  }

  res.status(200).type('text/xml').send(generateRejectTwiML());
}

/**
 * Handle default/unknown status
 */
async function handleCallDefault(callSid: string, request: TwilioVoiceWebhookRequest, res: Response): Promise<void> {
  logCallEvent(callSid, 'Unknown call status', { status: request.CallStatus });
  res.status(200).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}

/**
 * Start agent conversation
 */
async function startAgentConversation(callSid: string, session: typeof activeSessions extends Map<string, infer V> ? V : never, agentType: VoiceAgentType): Promise<void> {
  const conversationService = getConversationService();

  const conversation = conversationService.createConversation({
    callSid,
    callerNumber: '', // Will be set from request
    agentType,
    metadata: { ivrSessionId: session.ivrSessionId }
  });

  session.conversationId = conversation.id;
  session.state = 'agent';
  session.agentType = agentType;

  logCallEvent(callSid, 'Agent conversation started', { agentType, conversationId: conversation.id });
}

/**
 * Generate TwiML with audio playback
 */
function generateWithAudio(text: string, audioUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">${escapeXml(text)}</Say>
  <Play>${audioUrl}</Play>
</Response>`;
}

/**
 * Generate voicemail TwiML
 */
function generateVoicemailTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Please leave a message after the tone.</Say>
  <Record
    maxLength="120"
    timeout="5"
    transcribe="true"
    playBeep="true"
    action="${process.env.TWILIO_WEBHOOK_BASE_URL}/webhook/voice"
    method="POST"
    recordingStatusCallback="${process.env.TWILIO_WEBHOOK_BASE_URL}/webhook/voice"
  />
</Response>`;
}

/**
 * Generate silence wait TwiML
 */
function generateSilenceWait(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="alice" language="en-US">I'm still here. How can I help you?</Say>
</Response>`;
}

/**
 * Generate error TwiML
 */
function generateErrorTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">${escapeXml(message)}</Say>
  <Say voice="alice" language="en-US">Please call again or visit our website for assistance.</Say>
</Response>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get active session count
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}

/**
 * Get session info
 */
export function getSessionInfo(callSid: string): typeof activeSessions extends Map<string, infer V> ? V : never | null {
  return activeSessions.get(callSid) || null;
}
