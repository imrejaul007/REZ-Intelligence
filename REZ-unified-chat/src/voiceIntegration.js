/**
 * Voice Integration for Agent OS
 *
 * Connects Agent OS to voice systems:
 * - Support Copilot voice agents
 * - STT (Speech-to-Text)
 * - TTS (Text-to-Speech)
 * - Twilio phone calls
 * - Daily.co video
 */

const axios = require('axios');

class VoiceIntegration {
  constructor(config = {}) {
    this.config = {
      // Voice service URLs
      SUPPORT_VOICE_URL: process.env.SUPPORT_VOICE_URL || 'http://localhost:4033',
      VOICE_AI_URL: process.env.VOICE_AI_URL || 'http://localhost:4033/voice',

      // STT providers
      OPENAI_WHISPER_URL: 'https://api.openai.com/v1/audio/transcriptions',
      DEEPGRAM_URL: 'https://api.deepgram.com/v1/listen',

      // TTS providers
      ELEVEN_LABS_URL: 'https://api.elevenlabs.io/v1',

      // Telephony
      TWILIO_WEBHOOK_URL: process.env.TWILIO_WEBHOOK_URL
    };
  }

  // =========================================================================
  // VOICE INPUT (STT - Speech to Text)
  // =========================================================================

  /**
   * Transcribe audio to text
   */
  async transcribe(audioBuffer, provider = 'openai') {
    try {
      if (provider === 'openai') {
        return await this.transcribeOpenAI(audioBuffer);
      }
      if (provider === 'deepgram') {
        return await this.transcribeDeepgram(audioBuffer);
      }
      throw new Error(`Unknown STT provider: ${provider}`);
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  async transcribeOpenAI(audioBuffer) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'audio.webm' });
    form.append('model', 'whisper-1');
    form.append('language', 'en');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    return response.data.text;
  }

  async transcribeDeepgram(audioBuffer) {
    const response = await axios.post(
      `${this.config.DEEPGRAM_URL}?language=en&smart_format=true&punctuate=true`,
      audioBuffer,
      {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/webm'
        }
      }
    );

    return response.data.results.channels[0].alternatives[0].transcript;
  }

  // =========================================================================
  // VOICE OUTPUT (TTS - Text to Speech)
  // =========================================================================

  /**
   * Convert text to speech
   */
  async synthesize(text, options = {}) {
    const provider = options.provider || 'elevenlabs';
    const voice = options.voice || 'default';
    const lang = options.language || 'en';

    if (provider === 'elevenlabs') {
      return await this.synthesizeElevenLabs(text, voice);
    }

    // Fallback to browser Web Speech API (for web clients)
    return null;
  }

  async synthesizeElevenLabs(text, voice) {
    const response = await axios.post(
      `${this.config.ELEVEN_LABS_URL}/text-to-speech/${voice}`,
      {
        text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVEN_LABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    return response.data; // Audio buffer
  }

  // =========================================================================
  // PHONE (TWILIO)
  // =========================================================================

  /**
   * Handle Twilio webhook for phone calls
   */
  async handleTwilioWebhook(req) {
    const { CallSid, From, To, RecordingUrl, TranscriptionText } = req.body;

    // Get recording if available
    let transcript = TranscriptionText;

    if (!transcript && RecordingUrl) {
      try {
        const recording = await axios.get(RecordingUrl, {
          responseType: 'arraybuffer',
          auth: {
            username: process.env.TWILIO_ACCOUNT_SID,
            password: process.env.TWILIO_AUTH_TOKEN
          }
        });
        transcript = await this.transcribe(recording.data);
      } catch (error) {
        console.error('Recording transcription failed:', error);
      }
    }

    return { transcript, CallSid, From, To };
  }

  /**
   * Generate TwiML response
   */
  generateTwiml(speech, options = {}) {
    const voice = options.voice || 'alice';
    const language = options.language || 'en-IN';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${speech}</Say>
  <Gather numDigits="1" action="/voice/handle-gather" method="POST">
    <Say voice="${voice}" language="${language}">
      Press 1 for more options, or wait to repeat this message.
    </Say>
  </Gather>
  <Redirect method="POST">/voice/start</Redirect>
</Response>`;
  }

  // =========================================================================
  // AGENT OS INTEGRATION
  // =========================================================================

  /**
   * Process voice command through Agent OS
   */
  async processVoiceCommand(transcript, userId, context = {}) {
    // Send to Agent OS for routing
    const response = await axios.post(`${process.env.AGENT_OS_URL || 'http://localhost:4100'}/api/message`, {
      userId,
      message: transcript,
      namespace: 'voice',
      context: {
        ...context,
        channel: 'voice',
        input: 'voice'
      }
    });

    return response.data;
  }

  // =========================================================================
  // VOICE AGENTS (From Support Copilot)
  // =========================================================================

  /**
   * Route voice command to appropriate agent
   */
  async routeVoiceCommand(transcript) {
    const lower = transcript.toLowerCase();

    // Order intents
    if (this.matches(lower, ['order', 'buy', 'want'])) {
      return 'orderAgent';
    }

    // Booking intents
    if (this.matches(lower, ['book', 'reserve', 'appointment'])) {
      return 'bookingAgent';
    }

    // Support intents
    if (this.matches(lower, ['refund', 'complaint', 'issue'])) {
      return 'supportAgent';
    }

    // Help intents
    if (this.matches(lower, ['help', 'information', 'tell me'])) {
      return 'nluAgent';
    }

    // Default to NLU agent
    return 'nluAgent';
  }

  matches(text, keywords) {
    return keywords.some(k => text.includes(k));
  }

  /**
   * Get response from voice agent
   */
  async getVoiceAgentResponse(agent, transcript, context) {
    try {
      const response = await axios.post(`${this.config.SUPPORT_VOICE_URL}/voice/${agent}`, {
        transcript,
        context
      }, { timeout: 30000 });

      return response.data;
    } catch (error) {
      console.error(`Voice agent ${agent} error:`, error.message);
      return {
        response: "I'm having trouble processing your request. Please try again.",
        agent
      };
    }
  }
}

module.exports = VoiceIntegration;
