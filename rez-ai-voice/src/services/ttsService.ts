/**
 * Text-to-Speech Service using ElevenLabs
 * Handles audio synthesis for voice responses
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getElevenLabsConfig } from '../config/ai.config';
import { logger, logAIService, logMetric } from '../utils/logger';
import { SynthesisResult } from '../types';

export interface ElevenLabsSynthesisOptions {
  voiceId?: string;
  model?: string;
  latencyOptimization?: 'low' | 'medium' | 'high';
  outputFormat?: 'mp3' | 'opus' | 'pcm_16khz' | 'pcm_8khz' | 'ulaw_8khz';
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

export class TextToSpeechService {
  private config = getElevenLabsConfig();
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private audioCache: Map<string, { audioUrl: string; timestamp: number }> = new Map();
  private cacheMaxAge = 10 * 60 * 1000; // 10 minutes
  private outputDir: string;

  constructor() {
    this.outputDir = process.env.TTS_OUTPUT_DIR || './audio_output';
    this.ensureOutputDirectory();
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Synthesize speech from text
   */
  async synthesize(
    text: string,
    options?: ElevenLabsSynthesisOptions
  ): Promise<SynthesisResult> {
    const startTime = Date.now();

    const voiceId = options?.voiceId || this.config.defaultVoiceId;
    const model = options?.model || this.config.modelId;
    const latency = options?.latencyOptimization || this.config.latencyOptimization;
    const outputFormat = options?.outputFormat || 'mp3';

    try {
      logAIService('ElevenLabs', 'synthesize', {
        textLength: text.length,
        voiceId,
        model
      });

      // Check cache
      const cacheKey = this.getCacheKey(text, voiceId, model);
      const cached = this.audioCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
        logAIService('ElevenLabs', 'cache_hit', { cacheKey });
        return {
          audioUrl: cached.audioUrl,
          durationMs: Date.now() - startTime,
          voiceId
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text: this.prepareTextForTTS(text),
          model_id: model,
          voice_settings: {
            stability: options?.stability ?? 0.5,
            similarity_boost: options?.similarityBoost ?? 0.75,
            style: options?.style ?? 0.0,
            use_speaker_boost: options?.useSpeakerBoost ?? true
          }
        },
        {
          headers: {
            'Accept': this.getAcceptHeader(outputFormat),
            'Content-Type': 'application/json',
            'xi-api-key': this.config.apiKey
          },
          params: {
            optimize_for_latency: this.getLatencyParam(latency)
          },
          responseType: 'arraybuffer'
        }
      );

      // Save audio to file
      const filename = `${Date.now()}_${this.generateShortId()}.${this.getExtension(outputFormat)}`;
      const filepath = path.join(this.outputDir, filename);

      fs.writeFileSync(filepath, response.data);

      const audioUrl = this.getAudioUrl(filepath);

      // Cache the result
      this.audioCache.set(cacheKey, {
        audioUrl,
        timestamp: Date.now()
      });

      const duration = Date.now() - startTime;
      logMetric('tts_synthesis_duration_ms', duration, {
        textLength: text.length,
        voiceId,
        audioSize: response.data.length
      });

      // Cleanup old files
      this.cleanupOldFiles();

      return {
        audioUrl,
        durationMs: duration,
        voiceId
      };
    } catch (error) {
      logger.error('ElevenLabs synthesis failed', { error, text: text.substring(0, 100) });
      throw new Error(`Text-to-speech failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available voices from ElevenLabs
   */
  async getAvailableVoices(): Promise<Voice[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.config.apiKey
        }
      });

      return response.data.voices || [];
    } catch (error) {
      logger.error('Failed to fetch voices', { error });
      throw new Error(`Failed to fetch voices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get voice by ID with settings
   */
  async getVoice(voiceId: string): Promise<Voice | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/voices/${voiceId}`, {
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.config.apiKey
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch voice', { error, voiceId });
      return null;
    }
  }

  /**
   * Stream audio synthesis for real-time applications
   */
  async *synthesizeStream(
    text: string,
    options?: ElevenLabsSynthesisOptions
  ): AsyncGenerator<Buffer, void, unknown> {
    const voiceId = options?.voiceId || this.config.defaultVoiceId;
    const model = options?.model || this.config.modelId;
    const latency = options?.latencyOptimization || this.config.latencyOptimization;

    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          text: this.prepareTextForTTS(text),
          model_id: model,
          voice_settings: {
            stability: options?.stability ?? 0.5,
            similarity_boost: options?.similarityBoost ?? 0.75,
            style: options?.style ?? 0.0,
            use_speaker_boost: options?.useSpeakerBoost ?? true
          }
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.config.apiKey
          },
          params: {
            optimize_for_latency: this.getLatencyParam(latency)
          },
          responseType: 'stream'
        }
      );

      for await (const chunk of response.data) {
        yield Buffer.from(chunk);
      }
    } catch (error) {
      logger.error('ElevenLabs stream synthesis failed', { error });
      throw new Error(`Text-to-speech stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get history of generated audio (for debugging)
   */
  async getAudioHistory(limit: number = 100): Promise<Array<{ filename: string; created: Date; size: number }>> {
    try {
      const files = fs.readdirSync(this.outputDir);
      const audioFiles = files
        .filter(f => f.endsWith('.mp3') || f.endsWith('.opus'))
        .map(f => {
          const stats = fs.statSync(path.join(this.outputDir, f));
          return {
            filename: f,
            created: stats.birthtime,
            size: stats.size
          };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime())
        .slice(0, limit);

      return audioFiles;
    } catch (error) {
      logger.error('Failed to get audio history', { error });
      return [];
    }
  }

  /**
   * Prepare text for TTS (handle SSML-like tags and formatting)
   */
  private prepareTextForTTS(text: string): string {
    // Remove any XML-like tags that aren't for TTS
    let prepared = text.replace(/<[^>]*>/g, '');

    // Clean up multiple spaces and newlines
    prepared = prepared.replace(/\s+/g, ' ').trim();

    // Ensure text isn't too long (ElevenLabs limit)
    if (prepared.length > 5000) {
      prepared = prepared.substring(0, 5000);
      logger.warn('Text truncated for TTS', { originalLength: text.length });
    }

    return prepared;
  }

  /**
   * Generate short ID for filename
   */
  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  /**
   * Get cache key for text and voice combination
   */
  private getCacheKey(text: string, voiceId: string, model: string): string {
    return `${voiceId}_${model}_${text.substring(0, 50).replace(/\s/g, '_')}`;
  }

  /**
   * Get audio URL from file path
   */
  private getAudioUrl(filepath: string): string {
    const baseUrl = process.env.TTS_AUDIO_BASE_URL || 'https://your-domain.com/audio';
    const filename = path.basename(filepath);
    return `${baseUrl}/${filename}`;
  }

  /**
   * Get file extension from output format
   */
  private getExtension(format: string): string {
    const extensions: Record<string, string> = {
      mp3: 'mp3',
      opus: 'opus',
      pcm_16khz: 'pcm',
      pcm_8khz: 'pcm',
      ulaw_8khz: 'ulaw'
    };
    return extensions[format] || 'mp3';
  }

  /**
   * Get Accept header for format
   */
  private getAcceptHeader(format: string): string {
    const headers: Record<string, string> = {
      mp3: 'audio/mpeg',
      opus: 'audio/opus',
      pcm_16khz: 'audio/pcm',
      pcm_8khz: 'audio/pcm',
      ulaw_8khz: 'audio/basic'
    };
    return headers[format] || 'audio/mpeg';
  }

  /**
   * Get latency optimization parameter
   */
  private getLatencyParam(latency: 'low' | 'medium' | 'high'): number {
    const params: Record<string, number> = {
      low: 4,
      medium: 3,
      high: 1
    };
    return params[latency] || 3;
  }

  /**
   * Clean up old audio files
   */
  private cleanupOldFiles(): void {
    try {
      const maxAge = parseInt(process.env.TTS_MAX_FILE_AGE || '3600', 10) * 1000; // 1 hour default
      const now = Date.now();

      const files = fs.readdirSync(this.outputDir);
      for (const file of files) {
        const filepath = path.join(this.outputDir, file);
        const stats = fs.statSync(filepath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filepath);
          logger.info('Cleaned up old audio file', { file });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old files', { error });
    }
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const voices = await this.getAvailableVoices();
      return voices.length > 0;
    } catch (error) {
      logger.error('ElevenLabs health check failed', { error });
      return false;
    }
  }
}

// Singleton instance
let ttsServiceInstance: TextToSpeechService | null = null;

export function getTTSService(): TextToSpeechService {
  if (!ttsServiceInstance) {
    ttsServiceInstance = new TextToSpeechService();
  }
  return ttsServiceInstance;
}

export default TextToSpeechService;
