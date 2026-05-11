/**
 * Twilio Webhook Handler
 * Handles incoming phone calls via Twilio
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

const sttService = require('../services/stt');
const ttsService = require('../services/tts');
const voiceClassifier = require('../services/voiceRouter');
const swarmOrchestrator = require('../agents/swarmOrchestrator');

// Twilio credentials
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

/**
 * POST /webhook/twilio
 * Main webhook for incoming calls
 */
router.post('/', async (req, res) => {
  console.log('[TwilioWebhook] Incoming call');

  const {
    CallSid,
    From,
    To,
    CallStatus,
    RecordingUrl,
    Digits
  } = req.body;

  try {
    // Handle recording
    if (RecordingUrl) {
      return handleRecording(req, res, { CallSid, From, To });
    }

    // Handle DTMF digits
    if (Digits) {
      return handleDigits(req, res, { CallSid, Digits });
    }

    // Initial greeting
    const twiml = generateTwiml({
      message: "Hello! Welcome to ReZ. How can I help you today? You can say 'I want to order food', 'Track my order', or 'Speak to an agent'.",
      gather: true,
      gatherAction: '/webhook/voice/twilio/process'
    });

    res.type('text/xml').send(twiml);

  } catch (error) {
    console.error('[TwilioWebhook] Error:', error);
    res.status(500).send('<Response><Say>An error occurred. Please try again.</Say></Response>');
  }
});

/**
 * POST /webhook/twilio/process
 * Process voice input
 */
router.post('/process', async (req, res) => {
  console.log('[TwilioWebhook] Processing voice');

  const {
    CallSid,
    From,
    RecordingUrl,
    Digits,
    SpeechResult
  } = req.body;

  try {
    let transcript;
    let response;

    // Handle speech input
    if (SpeechResult) {
      transcript = SpeechResult;
      console.log('[TwilioWebhook] Speech result:', transcript);
    }
    // Handle recording
    else if (RecordingUrl) {
      transcript = await processRecording(RecordingUrl);
    }
    // Handle DTMF
    else if (Digits) {
      response = handleDigitResponse(Digits);
      return sendResponse(res, response);
    }
    // No input
    else {
      return sendResponse(res, {
        message: "I didn't hear anything. Could you please repeat?",
        gather: true
      });
    }

    // Route through AI
    const aiResult = await swarmOrchestrator.route(
      { text: transcript },
      { userId: From, phone: From, channel: 'voice' }
    );

    // Generate response
    response = {
      message: aiResult.message || "I've processed your request.",
      gather: !aiResult.success
    };

    sendResponse(res, response);

  } catch (error) {
    console.error('[TwilioWebhook] Processing error:', error);
    sendResponse(res, {
      message: "I'm sorry, I had trouble understanding. Could you please repeat?"
    });
  }
});

/**
 * POST /webhook/twilio/status
 * Call status callbacks
 */
router.post('/status', async (req, res) => {
  console.log('[TwilioWebhook] Status callback:', req.body.CallStatus);

  const { CallSid, CallStatus } = req.body;

  // Log call status
  if (CallStatus === 'completed') {
    console.log(`[TwilioWebhook] Call ${CallSid} completed`);
  } else if (CallStatus === 'failed') {
    console.log(`[TwilioWebhook] Call ${CallSid} failed`);
  }

  res.sendStatus(200);
});

/**
 * POST /webhook/twilio/hangup
 * Handle hangup
 */
router.post('/hangup', async (req, res) => {
  console.log('[TwilioWebhook] Call hangup');

  const twiml = `<Response><Say>Thank you for calling. Goodbye!</Say></Response>`;
  res.type('text/xml').send(twiml);
});

/**
 * Process recording
 */
async function processRecording(recordingUrl) {
  try {
    const result = await sttService.transcribe(recordingUrl);
    return result.text;
  } catch (error) {
    console.error('[TwilioWebhook] STT error:', error);
    throw error;
  }
}

/**
 * Handle DTMF digits
 */
function handleDigitResponse(digits) {
  const digitMap = {
    '1': 'repeat',
    '0': 'agent',
    '9': 'cancel'
  };

  const action = digitMap[digits] || 'unknown';

  switch (action) {
    case 'repeat':
      return { message: 'Let me repeat that.', repeat: true };
    case 'agent':
      return { message: "I'll connect you to an agent.", transfer: true };
    case 'cancel':
      return { message: 'Cancelling. Goodbye!', end: true };
    default:
      return { message: "I didn't understand. Could you try again?" };
  }
}

/**
 * Generate TwiML response
 */
function generateTwiml({ message, gather = false, gatherAction, loop = 1 }) {
  let twiml = '<Response>';

  if (message) {
    twiml += `<Say voice="Polly.Amy">${escapeXml(message)}</Say>`;
  }

  if (gather) {
    twiml += `
      <Gather numDigits="1" action="${gatherAction || '/webhook/voice/twilio/process'}" method="POST" timeout="10">
        <Say voice="Polly.Amy">Press 1 to repeat, 0 for an agent.</Say>
      </Gather>`;
  }

  twiml += '</Response>';
  return twiml;
}

/**
 * Send response
 */
async function sendResponse(res, { message, gather, transfer, end }) {
  if (transfer) {
    // Transfer to agent - in production, this would queue the call
    const twiml = `
      <Response>
        <Say voice="Polly.Amy">Connecting you to our support team. Please hold.</Say>
        <Dial record="true">
          <Client support_queue</Client>
        </Dial>
      </Response>`;
    return res.type('text/xml').send(twiml);
  }

  if (end) {
    return res.type('text/xml').send('<Response><Say voice="Polly.Amy">Goodbye!</Say></Response>');
  }

  const twiml = generateTwiml({
    message,
    gather,
    gatherAction: '/webhook/voice/twilio/process'
  });

  res.type('text/xml').send(twiml);
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
