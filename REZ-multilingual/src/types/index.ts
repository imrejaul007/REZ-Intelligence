import { z } from 'zod';

export const SupportedLanguageSchema = z.enum([
  'en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur'
]);
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const TranslationRequestSchema = z.object({
  text: z.string().min(1),
  sourceLang: SupportedLanguageSchema,
  targetLang: SupportedLanguageSchema,
  context: z.string().optional(),
  formality: z.enum(['formal', 'informal', 'auto']).default('auto'),
});

export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;

export const BatchTranslationRequestSchema = z.object({
  items: z.array(z.object({
    text: z.string().min(1),
    targetLang: SupportedLanguageSchema,
  })).min(1).max(100),
  sourceLang: SupportedLanguageSchema.default('en'),
});

export type BatchTranslationRequest = z.infer<typeof BatchTranslationRequestSchema>;

export const DetectLanguageSchema = z.object({
  text: z.string().min(1).max(5000),
});

export type DetectLanguage = z.infer<typeof DetectLanguageSchema>;
