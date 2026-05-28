import { SupportedLanguage, TranslationRequest, BatchTranslationRequest, DetectLanguage } from '../types/index.js';
import { logger } from '../utils/logger.js';

interface TranslationResult {
  original: string;
  translated: string;
  sourceLang: SupportedLanguage;
  targetLang: SupportedLanguage;
  confidence: number;
}

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English', hi: 'Hindi', bn: 'Bengali', ta: 'Tamil',
  te: 'Telugu', mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada',
  ml: 'Malayalam', pa: 'Punjabi', ur: 'Urdu'
};

export class TranslationService {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    logger.info('Translating text', { source: request.sourceLang, target: request.targetLang });

    const translated = this.mockTranslate(request.text, request.targetLang);

    return {
      original: request.text,
      translated,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      confidence: 0.92,
    };
  }

  async batchTranslate(request: BatchTranslationRequest): Promise<TranslationResult[]> {
    logger.info('Batch translating', { count: request.items.length });

    return Promise.all(
      request.items.map(item =>
        this.translate({
          text: item.text,
          sourceLang: request.sourceLang,
          targetLang: item.targetLang,
          formality: 'auto',
        })
      )
    );
  }

  async detectLanguage(request: DetectLanguage): Promise<{
    language: SupportedLanguage;
    confidence: number;
    alternatives: Array<{ language: SupportedLanguage; confidence: number }>;
  }> {
    const text = request.text.toLowerCase();

    let detectedLang: SupportedLanguage = 'en';
    let confidence = 0.8;

    if (/[ऀ-ॿ]/.test(text)) {
      if (/[ఀ-౿]/.test(text)) { detectedLang = 'te'; }
      else if (/[ಀ-೿]/.test(text)) { detectedLang = 'kn'; }
      else if (/[ഀ-ൿ]/.test(text)) { detectedLang = 'ml'; }
      else if (/[઀-૿]/.test(text)) { detectedLang = 'gu'; }
      else if (/[ऀ-ॿ]/.test(text)) { detectedLang = 'hi'; }
      confidence = 0.95;
    } else if (/[؀-ۿ]/.test(text)) {
      detectedLang = 'ur';
      confidence = 0.9;
    } else if (/[஀-௿]/.test(text)) {
      detectedLang = 'ta';
      confidence = 0.9;
    }

    return {
      language: detectedLang,
      confidence,
      alternatives: [],
    };
  }

  getSupportedLanguages(): Array<{ code: SupportedLanguage; name: string }> {
    return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
      code: code as SupportedLanguage,
      name,
    }));
  }

  private mockTranslate(text: string, targetLang: SupportedLanguage): string {
    const prefix = `[${LANGUAGE_NAMES[targetLang]}]`;
    return `${prefix} ${text}`;
  }
}

export const translationService = new TranslationService();
