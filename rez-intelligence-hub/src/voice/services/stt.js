/**
 * Speech-to-Text Service
 * Converts audio to text using Whisper API
 */

const axios = require('axios');
const FormData = require('form-data');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-1';

class SpeechToTextService {
  constructor() {
    this.initialized = !!OPENAI_API_KEY;
  }

  /**
   * Transcribe audio from URL or buffer
   */
  async transcribe(audioSource, options = {}) {
    const { language = 'en', prompt = '' } = options;

    try {
      if (!this.initialized) {
        console.log('[STT] Running in mock mode');
        return this.mockTranscribe(audioSource);
      }

      let audioBuffer;

      if (typeof audioSource === 'string' && audioSource.startsWith('http')) {
        // Download audio from URL
        const response = await axios.get(audioSource, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        audioBuffer = Buffer.from(response.data);
      } else {
        audioBuffer = audioSource;
      }

      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm'
      });
      formData.append('model', WHISPER_MODEL);
      formData.append('language', language);
      if (prompt) {
        formData.append('prompt', prompt);
      }

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            ...formData.getHeaders()
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 60000
        }
      );

      return {
        text: response.data.text,
        language: response.data.language || language,
        duration: response.data.duration || 0,
        confidence: 0.95
      };

    } catch (error) {
      console.error('[STT] Transcription error:', error.message);
      throw new Error(`Speech-to-text failed: ${error.message}`);
    }
  }

  /**
   * Mock transcription for development
   */
  mockTranscribe(audioSource) {
    console.log('[STT] Mock transcription for:', audioSource);
    return {
      text: 'I want to order biryani for delivery',
      language: 'en',
      duration: 3.5,
      confidence: 0.92
    };
  }

  /**
   * Stream transcription for long audio
   */
  async transcribeStream(audioStream) {
    // For streaming, accumulate chunks then transcribe
    const chunks = [];

    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    return this.transcribe(buffer);
  }

  /**
   * Language detection from audio
   */
  async detectLanguage(audioBuffer) {
    if (!this.initialized) {
      return { language: 'en', confidence: 0.9 };
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm'
      });
      formData.append('model', 'whisper-1');

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            ...formData.getHeaders()
          }
        }
      );

      return {
        language: response.data.language,
        confidence: 0.95
      };
    } catch (error) {
      console.error('[STT] Language detection error:', error.message);
      return { language: 'en', confidence: 0.5 };
    }
  }
}

module.exports = new SpeechToTextService();
