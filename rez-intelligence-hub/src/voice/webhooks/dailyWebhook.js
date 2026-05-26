/**
 * Daily.co Webhook Handler
 * Handles voice/video calls via Daily.co
 */

const express = require('express');
const router = express.Router();
const { randomInt } = require('crypto');

const sttService = require('../services/stt');
const ttsService = require('../services/tts');
const swarmOrchestrator = require('../agents/swarmOrchestrator');

const DAILY_API_KEY = process.env.DAILY_API_KEY;

/**
 * POST /webhook/daily
 * Handle Daily.co meeting events
 */
router.post('/', async (req, res) => {
  console.log('[DailyWebhook] Event:', req.body.event);

  const { event, payload } = req.body;

  try {
    switch (event) {
      case 'meeting.started':
        await handleMeetingStarted(payload);
        break;
      case 'meeting.ended':
        await handleMeetingEnded(payload);
        break;
      case 'participant.joined':
        await handleParticipantJoined(payload);
        break;
      case 'participant.left':
        await handleParticipantLeft(payload);
        break;
      case 'transcription':
        await handleTranscription(payload);
        break;
      default:
        console.log('[DailyWebhook] Unhandled event:', event);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('[DailyWebhook] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a voice room
 */
router.post('/room', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.daily.co/v1/rooms',
      {
        name: `voice-${Date.now()}`,
        properties: {
          enable_chat: false,
          enable_screenshare: false,
          enable_recording: 'cloud',
          enable_knocking: true,
          start_video_off: true,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`
        }
      }
    );

    res.json({
      success: true,
      room: response.data
    });
  } catch (error) {
    console.error('[DailyWebhook] Room creation failed:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * Handle meeting started
 */
async function handleMeetingStarted(payload) {
  console.log('[DailyWebhook] Meeting started:', payload.room?.name);

  // Initialize voice session
  const session = {
    roomName: payload.room?.name,
    startedAt: new Date()
  };

  return session;
}

/**
 * Handle meeting ended
 */
async function handleMeetingEnded(payload) {
  console.log('[DailyWebhook] Meeting ended:', payload.room?.name);

  // Clean up session
  // Could log to analytics
}

/**
 * Handle participant joined
 */
async function handleParticipantJoined(payload) {
  console.log('[DailyWebhook] Participant joined:', payload.participant?.user_id);

  // Greet participant
  const greeting = await generateGreeting();
  // Would send to the participant
}

/**
 * Handle participant left
 */
async function handleParticipantLeft(payload) {
  console.log('[DailyWebhook] Participant left:', payload.participant?.user_id);
}

/**
 * Handle transcription
 */
async function handleTranscription(payload) {
  const { text, participantId, roomName } = payload;

  if (!text || text.trim().length === 0) return;

  console.log('[DailyWebhook] Transcription:', { participantId, text: text.substring(0, 50) });

  // Process through AI
  const result = await swarmOrchestrator.route(
    { text },
    { participantId, roomName, channel: 'voice' }
  );

  // Generate and play response
  if (result.message) {
    await playAudioResponse(participantId, result.message);
  }
}

/**
 * Generate greeting
 */
async function generateGreeting() {
  const greetings = [
    "Hello! Welcome to ReZ support. How can I help you today?",
    "Hi there! I'm here to help. What can I assist you with?",
    "Welcome! What would you like help with today?"
  ];

  return greetings[randomInt(0, greetings.length)];
}

/**
 * Play audio response via Daily
 */
async function playAudioResponse(participantId, message) {
  try {
    // Generate TTS
    const audio = await ttsService.synthesize(message);

    // Send to participant (Daily.co has audio playback via meeting tokens)
    console.log('[DailyWebhook] Playing response to:', participantId);

    // In production, this would use Daily.co's sendAppMessage or audio playback
    return true;
  } catch (error) {
    console.error('[DailyWebhook] Audio playback error:', error);
    return false;
  }
}

module.exports = router;
