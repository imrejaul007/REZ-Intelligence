/**
 * Speech-to-Text Service using OpenAI Whisper
 * Handles audio transcription for voice interactions
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getOpenAIClient, getOpenAIConfig } from '../config/ai.config';
import { logger, logAIService, logMetric } from '../utils/logger';
import { TranscriptionResult } from '../types';

export interface WhisperTranscriptionOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

export interface WhisperResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

export class SpeechToTextService {
  private client = getOpenAIClient();
  private config = getOpenAIConfig();
  private audioCache: Map<string, { buffer: Buffer; timestamp: number }> = new Map();
  private cacheMaxAge = 5 * 60 * 1000; // 5 minutes

  /**
   * Transcribe audio from a file path
   */
  async transcribeFromFile(
    filePath: string,
    options?: WhisperTranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      logAIService('Whisper', 'transcribe_from_file', { filePath });

      const fileStream = fs.createReadStream(filePath);
      const fileSize = fs.statSync(filePath).size;

      const response = await this.client.audio.transcriptions.create({
        file: fileStream,
        model: options?.language || this.config.whisperModel,
        language: options?.language || this.config.whisperLanguage,
        prompt: options?.prompt,
        temperature: options?.temperature ?? this.config.temperature,
        response_format: options?.responseFormat || 'verbose_json'
      });

      const result: WhisperResponse = response as unknown as WhisperResponse;

      const transcription: TranscriptionResult = {
        text: result.text.trim(),
        confidence: this.estimateConfidence(result),
        isFinal: true,
        timestamp: new Date()
      };

      const duration = Date.now() - startTime;
      logMetric('stt_transcription_duration_ms', duration, {
        fileSize,
        textLength: transcription.text.length
      });

      logAIService('Whisper', 'transcription_complete', {
        textLength: transcription.text.length,
        confidence: transcription.confidence,
        durationMs: duration
      });

      return transcription;
    } catch (error) {
      logger.error('Whisper transcription failed', { error, filePath, options });
      throw new Error(`Speech-to-text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio from a buffer (e.g., from Twilio recording)
   */
  async transcribeFromBuffer(
    buffer: Buffer,
    filename: string = 'audio.webm',
    options?: WhisperTranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      logAIService('Whisper', 'transcribe_from_buffer', {
        filename,
        size: buffer.length
      });

      const file = new File([buffer], filename, { type: 'audio/webm' });

      const response = await this.client.audio.transcriptions.create({
        file: file,
        model: options?.language || this.config.whisperModel,
        language: options?.language || this.config.whisperLanguage,
        prompt: options?.prompt,
        temperature: options?.temperature ?? this.config.temperature,
        response_format: 'verbose_json'
      });

      const result: WhisperResponse = response as unknown as WhisperResponse;

      const transcription: TranscriptionResult = {
        text: result.text.trim(),
        confidence: this.estimateConfidence(result),
        isFinal: true,
        timestamp: new Date()
      };

      const duration = Date.now() - startTime;
      logMetric('stt_transcription_duration_ms', duration, {
        bufferSize: buffer.length,
        textLength: transcription.text.length
      });

      return transcription;
    } catch (error) {
      logger.error('Whisper buffer transcription failed', { error, filename });
      throw new Error(`Speech-to-text failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe audio from a URL (e.g., Twilio recording URL)
   */
  async transcribeFromUrl(
    audioUrl: string,
    options?: WhisperTranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      logAIService('Whisper', 'transcribe_from_url', { audioUrl });

      // Download the audio file
      const response = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Basic ${Buffer.from(this.config.apiKey).toString('base64')}`
        },
        timeout: 30000
      });

      const buffer = Buffer.from(response.data);
      const filename = this.getFilenameFromUrl(audioUrl);

      return this.transcribeFromBuffer(buffer, filename, options);
    } catch (error) {
      logger.error('Whisper URL transcription failed', { error, audioUrl });
      throw new Error(`Speech-to-text from URL failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cache audio buffer for potential re-transcription
   */
  cacheAudio(sessionId: string, buffer: Buffer): void {
    this.audioCache.set(sessionId, {
      buffer,
      timestamp: Date.now()
    });

    // Clean old cache entries
    this.cleanupCache();
  }

  /**
   * Get cached audio buffer
   */
  getCachedAudio(sessionId: string): Buffer | null {
    const cached = this.audioCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.buffer;
    }
    this.audioCache.delete(sessionId);
    return null;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.audioCache.entries()) {
      if (now - value.timestamp > this.cacheMaxAge) {
        this.audioCache.delete(key);
      }
    }
  }

  /**
   * Estimate confidence based on response characteristics
   */
  private estimateConfidence(response: WhisperResponse): number {
    // Use segments to estimate confidence
    if (response.segments && response.segments.length > 0) {
      const avgSegmentLength = response.segments.reduce(
        (sum, seg) => sum + seg.text.length, 0
      ) / response.segments.length;

      // Higher confidence for well-formed segments
      if (avgSegmentLength > 10 && avgSegmentLength < 200) {
        return 0.9;
      }
    }

    // Default confidence based on text quality
    const text = response.text || '';
    if (text.length < 2) return 0.5;
    if (text.includes('...') || text.includes('???')) return 0.6;

    return 0.8;
  }

  /**
   * Extract filename from URL
   */
  private getFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      return path.basename(pathname) || 'audio.webm';
    } catch {
      return 'audio.webm';
    }
  }

  /**
   * Check service health
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple API test
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error('Whisper health check failed', { error });
      return false;
    }
  }
}

// Singleton instance
let sttServiceInstance: SpeechToTextService | null = null;

export function getSTTService(): SpeechToTextService {
  if (!sttServiceInstance) {
    sttServiceInstance = new SpeechToTextService();
  }
  return sttServiceInstance;
}

export default SpeechToTextService;
