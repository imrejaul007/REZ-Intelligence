import logger from './utils/logger';

/**
 * Text-to-Speech Service
 * Converts text to audio using ElevenLabs or fallback
 */

const axios = require('axios');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'amy';

const VOICE_CONFIGS = {
  'amy': {
    name: 'Amy',
    language: 'en-IN',
    gender: 'female',
    provider: 'elevenlabs'
  },
  'aru': {
    name: 'Aarav',
    language: 'en-IN',
    gender: 'male',
    provider: 'elevenlabs'
  },
  'priya': {
    name: 'Priya',
    language: 'en-IN',
    gender: 'female',
    provider: 'elevenlabs'
  },
  'ravi': {
    name: 'Ravi',
    language: 'hi',
    gender: 'male',
    provider: 'elevenlabs'
  }
};

class TextToSpeechService {
  constructor() {
    this.initialized = !!ELEVENLABS_API_KEY;
    this.fallbackEndpoint = process.env.TTS_FALLBACK_URL;
  }

  /**
   * Synthesize speech from text
   */
  async synthesize(text, options = {}) {
    const {
      voice = 'amy',
      language = 'en-IN',
      speed = 1.0,
      pitch = 1.0
    } = options;

    try {
      if (!this.initialized && !this.fallbackEndpoint) {
        logger.info('[TTS] Running in mock mode');
        return this.mockSynthesize(text);
      }

      const voiceConfig = VOICE_CONFIGS[voice] || VOICE_CONFIGS['amy'];
      const actualVoice = ELEVENLABS_VOICE_ID || voice;

      // Use ElevenLabs
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${actualVoice}`,
        {
          text: this.prepareText(text),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
            speed: speed,
            pitch: (pitch - 1) * 10 // ElevenLabs uses -10 to 10
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      return {
        audio: Buffer.from(response.data),
        format: 'mp3',
        duration: this.estimateDuration(text),
        voice: actualVoice
      };

    } catch (error) {
      console.error('[TTS] Synthesis error:', error.message);
      // Fallback to mock
      return this.mockSynthesize(text);
    }
  }

  /**
   * Prepare text for TTS (add pauses, handle special chars)
   */
  prepareText(text) {
    // Add pauses for punctuation
    return text
      .replace(/\./g, '.<break time="300ms"/>')
      .replace(/,/g, ',<break time="150ms"/>')
      .replace(/\?/g, '?<break time="300ms"/>')
      .replace(/!/g, '!<break time="300ms"/>');
  }

  /**
   * Estimate audio duration
   */
  estimateDuration(text) {
    // ~150 words per minute at normal speed
    const words = text.split(/\s+/).length;
    return (words / 150) * 60;
  }

  /**
   * Mock synthesis for development
   */
  mockSynthesize(text) {
    console.log('[TTS] Mock synthesis for:', text.substring(0, 50) + '...');
    return {
      audio: Buffer.from('mock-audio-data'),
      format: 'mp3',
      duration: this.estimateDuration(text),
      voice: 'amy'
    };
  }

  /**
   * Get available voices
   */
  getVoices() {
    return Object.entries(VOICE_CONFIGS).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  /**
   * Stream synthesis for long texts
   */
  async synthesizeStream(text, options = {}) {
    // For now, synthesize full then chunk
    const result = await this.synthesize(text, options);
    return result;
  }

  /**
   * Generate speech with SSML
   */
  async synthesizeSSML(ssml, options = {}) {
    try {
      const voice = options.voice || 'amy';
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`,
        {
          text: ssml,
          model_id: 'eleven_multilingual_v2'
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY
          },
          timeout: 30000
        }
      );

      return {
        audio: Buffer.from(response.data.audio_base64, 'base64'),
        wordTimings: response.data.words,
        format: 'mp3'
      };
    } catch (error) {
      console.error('[TTS] SSML synthesis error:', error.message);
      throw error;
    }
  }
}

module.exports = new TextToSpeechService();
