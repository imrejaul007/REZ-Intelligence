/**
 * AI Configuration - OpenAI Whisper (STT) and ElevenLabs (TTS)
 * Handles all AI service configuration and initialization
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  whisperModel: string;
  whisperLanguage?: string;
  maxTokens: number;
  temperature: number;
}

export interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId: string;
  voices: Record<string, string>;
  modelId: string;
  latencyOptimization: 'low' | 'medium' | 'high';
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface AIConfig {
  openai: OpenAIConfig;
  elevenlabs: ElevenLabsConfig;
  anthropic: AnthropicConfig;
  defaultLanguage: string;
  fallbacksEnabled: boolean;
}

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

export function getOpenAIConfig(): OpenAIConfig {
  const apiKey = process.env.OPENAI_API_KEY;
  const organization = process.env.OPENAI_ORG_ID;

  if (!apiKey) {
    throw new Error('Missing required OpenAI configuration: OPENAI_API_KEY');
  }

  return {
    apiKey,
    organization,
    whisperModel: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
    whisperLanguage: process.env.OPENAI_WHISPER_LANGUAGE || 'en',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1024', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
  };
}

export function getElevenLabsConfig(): ElevenLabsConfig {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('Missing required ElevenLabs configuration: ELEVENLABS_API_KEY');
  }

  return {
    apiKey,
    defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
    voices: {
      default: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
      sales: process.env.ELEVENLABS_VOICE_SALES || 'EXAVITQu4vr4xnSDxMaL',
      support: process.env.ELEVENLABS_VOICE_SUPPORT || 'VR6AewLTigWG4xSOukaG',
      info: process.env.ELEVENLABS_VOICE_INFO || 'pFZP5JQG7iRYjFPEnMMb',
      male: process.env.ELEVENLABS_VOICE_MALE || 'ErXwobaYiN019PkyB4C9',
      female: process.env.ELEVENLABS_VOICE_FEMALE || 'EXAVITQu4vr4xnSDxMaL'
    },
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1',
    latencyOptimization: (process.env.ELEVENLABS_LATENCY as 'low' | 'medium' | 'high') || 'medium'
  };
}

export function getAnthropicConfig(): AnthropicConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Missing required Anthropic configuration: ANTHROPIC_API_KEY');
  }

  return {
    apiKey,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
    systemPrompt: process.env.ANTHROPIC_SYSTEM_PROMPT
  };
}

export function getAIConfig(): AIConfig {
  return {
    openai: getOpenAIConfig(),
    elevenlabs: getElevenLabsConfig(),
    anthropic: getAnthropicConfig(),
    defaultLanguage: process.env.AI_DEFAULT_LANGUAGE || 'en-US',
    fallbacksEnabled: process.env.AI_FALLBACKS_ENABLED !== 'false'
  };
}

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const config = getOpenAIConfig();
    openaiClient = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization
    });
    logger.info('OpenAI client initialized', {
      whisperModel: config.whisperModel,
      maxTokens: config.maxTokens
    });
  }
  return openaiClient;
}

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const config = getAnthropicConfig();
    anthropicClient = new Anthropic({
      apiKey: config.apiKey
    });
    logger.info('Anthropic client initialized', {
      model: config.model,
      maxTokens: config.maxTokens
    });
  }
  return anthropicClient;
}

// Voice-specific configuration
export interface VoiceSettings {
  stt: {
    model: string;
    language: string;
    prompt?: string;
    temperature: number;
  };
  tts: {
    voiceId: string;
    model: string;
    latencyOptimization: 'low' | 'medium' | 'high';
    outputFormat: 'mp3' | 'opus' | 'pcm_16khz' | 'pcm_8khz' | 'ulaw_8khz';
    sampleRate?: number;
  };
  llm: {
    model: string;
    maxTokens: number;
    temperature: number;
    systemPrompt: string;
  };
}

export function getVoiceSettings(agentType?: string): VoiceSettings {
  const aiConfig = getAIConfig();

  const baseSettings: VoiceSettings = {
    stt: {
      model: aiConfig.openai.whisperModel,
      language: aiConfig.openai.whisperLanguage || 'en',
      temperature: aiConfig.openai.temperature
    },
    tts: {
      voiceId: aiConfig.elevenlabs.voices[agentType || 'default'] || aiConfig.elevenlabs.defaultVoiceId,
      model: aiConfig.elevenlabs.modelId,
      latencyOptimization: aiConfig.elevenlabs.latencyOptimization,
      outputFormat: 'mp3'
    },
    llm: {
      model: aiConfig.anthropic.model,
      maxTokens: aiConfig.anthropic.maxTokens,
      temperature: aiConfig.anthropic.temperature,
      systemPrompt: aiConfig.anthropic.systemPrompt || getDefaultSystemPrompt(agentType)
    }
  };

  return baseSettings;
}

function getDefaultSystemPrompt(agentType?: string): string {
  const prompts: Record<string, string> = {
    sales: `You are a professional voice sales agent for ReZ platform. Your role is to:
- Engage potential customers with a friendly and professional demeanor
- Understand their needs and recommend appropriate products/services
- Handle objections gracefully and provide compelling responses
- Guide customers through the purchasing process
- Collect necessary information for orders while keeping conversation natural
- Always be helpful, never pushy, and respect when a customer wants to think about it

Keep responses concise (1-3 sentences max) for voice interaction. Use natural, conversational language.`,
    support: `You are a helpful voice support agent for ReZ platform. Your role is to:
- Assist customers with their questions and concerns
- Provide clear, accurate information about products and services
- Help troubleshoot common issues
- Guide customers through self-service solutions when possible
- Escalate complex issues to human agents when needed
- Maintain a calm, patient, and empathetic tone

Keep responses concise (1-3 sentences max) for voice interaction. Focus on solutions.`,
    info: `You are an informational voice assistant for ReZ platform. Your role is to:
- Provide accurate information about the company, products, and services
- Answer frequently asked questions
- Share business hours, locations, and contact information
- Describe products and services in a helpful way
- Direct callers to appropriate resources or departments

Keep responses concise (1-3 sentences max) for voice interaction. Be informative and helpful.`,
    default: `You are a professional voice assistant for ReZ platform. Your role is to:
- Greet callers warmly and identify how you can help
- Provide accurate and helpful information
- Guide callers to appropriate resources
- Handle requests efficiently and professionally

Keep responses concise (1-3 sentences max) for voice interaction. Be friendly and helpful.`
  };

  return prompts[agentType || 'default'] || prompts.default;
}

// Rate limiting configuration
export interface RateLimitConfig {
  maxTranscriptionsPerMinute: number;
  maxSynthesesPerMinute: number;
  maxCallsPerDay: number;
  maxConcurrentCalls: number;
}

export function getRateLimitConfig(): RateLimitConfig {
  return {
    maxTranscriptionsPerMinute: parseInt(process.env.MAX_TRANSCRIPTIONS_PER_MINUTE || '60', 10),
    maxSynthesesPerMinute: parseInt(process.env.MAX_SYNTHESES_PER_MINUTE || '60', 10),
    maxCallsPerDay: parseInt(process.env.MAX_CALLS_PER_DAY || '10000', 10),
    maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_CALLS || '100', 10)
  };
}
