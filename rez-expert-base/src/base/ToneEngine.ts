/**
 * ToneEngine - Handles communication tone adjustment
 * Adjusts response content and style based on configured tone
 */

import { ExpertTone, ExpertiseLevel } from '../types/expert.types';

export interface ToneConfig {
  tone: ExpertTone;
  expertiseLevel: ExpertiseLevel;
  customModifications?: ToneModification[];
}

export interface ToneModification {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: string[]) => string);
  description: string;
}

export interface ToneAdjustment {
  content: string;
  greeting?: string;
  closing?: string;
  emphasis?: string[];
  caveats?: string[];
}

export class ToneEngine {
  private tone: ExpertTone;
  private expertiseLevel: ExpertiseLevel;
  private modifications: ToneModification[];

  private readonly tonePatterns: Record<ExpertTone, TonePatterns> = {
    professional: {
      greeting: ['Good day', 'Hello', 'Greetings'],
      closing: ['Best regards', 'Regards', 'Thank you for your inquiry'],
      formalPhrases: ['I would like to', 'Please be advised', 'In accordance with'],
      casualPhrases: []
    },
    friendly: {
      greeting: ['Hey there', 'Hi there', 'Hello', 'Great to connect with you'],
      closing: ['Cheers', 'Talk soon', 'Happy to help'],
      formalPhrases: [],
      casualPhrases: ['No problem', 'Of course', 'Sure thing', 'Got it']
    },
    casual: {
      greeting: ['Hey', 'Hi', 'What\'s up', 'Yo'],
      closing: ['Later', 'Catch you later', 'All the best'],
      formalPhrases: [],
      casualPhrases: ['Basically', 'Kind of', 'Pretty much', 'You know']
    },
    formal: {
      greeting: ['Dear Sir/Madam', 'To whom it may concern', 'Good morning/afternoon'],
      closing: ['Yours sincerely', 'Respectfully', 'With kind regards'],
      formalPhrases: ['I am pleased to', 'We hereby', 'Pursuant to', 'Hereby'],
      casualPhrases: []
    },
    empathetic: {
      greeting: ['I understand', 'Thank you for sharing', 'I hear you'],
      closing: ['Take care', 'I\'m here if you need more help', 'Wishing you well'],
      formalPhrases: [],
      casualPhrases: [],
      empathyPhrases: [
        'I can see this is important to you',
        'That sounds challenging',
        'I appreciate you sharing this with me',
        'Let me help you find a solution'
      ]
    }
  };

  constructor(tone: ExpertTone, expertiseLevel: ExpertiseLevel, modifications?: ToneModification[]) {
    this.tone = tone;
    this.expertiseLevel = expertiseLevel;
    this.modifications = modifications || [];
  }

  /**
   * Adjust content based on configured tone
   */
  adjustContent(content: string, action?: string): string {
    let adjusted = content;

    // Apply expertise level adjustments
    adjusted = this.adjustForExpertiseLevel(adjusted);

    // Apply tone-specific patterns
    adjusted = this.applyTonePatterns(adjusted);

    // Apply custom modifications
    adjusted = this.applyCustomModifications(adjusted);

    // Apply action-specific adjustments
    if (action) {
      adjusted = this.adjustForAction(adjusted, action);
    }

    return adjusted;
  }

  /**
   * Get greeting based on tone
   */
  getGreeting(): string {
    const patterns = this.tonePatterns[this.tone];
    return this.pickRandom(patterns.greeting);
  }

  /**
   * Get closing based on tone
   */
  getClosing(): string {
    const patterns = this.tonePatterns[this.tone];
    return this.pickRandom(patterns.closing);
  }

  /**
   * Generate full tone-adjusted response wrapper
   */
  generateToneWrapper(content: string, action?: string): ToneAdjustment {
    return {
      content: this.adjustContent(content, action),
      greeting: this.getGreeting(),
      closing: this.getClosing(),
      emphasis: this.getEmphasisPhrases(),
      caveats: this.getCaveats()
    };
  }

  /**
   * Update the tone configuration
   */
  updateTone(tone: ExpertTone): void {
    this.tone = tone;
  }

  /**
   * Update the expertise level
   */
  updateExpertiseLevel(level: ExpertiseLevel): void {
    this.expertiseLevel = level;
  }

  private adjustForExpertiseLevel(content: string): string {
    switch (this.expertiseLevel) {
      case 'beginner':
        return this.simplifyForBeginner(content);
      case 'intermediate':
        return content;
      case 'advanced':
        return this.enrichForAdvanced(content);
      case 'expert':
        return this.enrichForExpert(content);
      default:
        return content;
    }
  }

  private simplifyForBeginner(content: string): string {
    let simplified = content;

    // Add explanations for technical terms
    simplified = simplified.replace(
      /\b(API|database|server|frontend|backend|algorithm|protocol)\b/gi,
      '$& (a technical term - basically means)'
    );

    // Ensure simpler sentence structures
    simplified = simplified.replace(/, which/gi, ' (this means)');

    // Add encouraging phrases
    if (!simplified.includes('No worries') && !simplified.includes('Don\'t worry')) {
      simplified = simplified.replace(
        /^(.{10,})/,
        'No worries if this seems complex! Let me break it down:\n$1'
      );
    }

    return simplified;
  }

  private enrichForAdvanced(content: string): string {
    // Add technical depth for advanced users
    return content;
  }

  private enrichForExpert(content: string): string {
    // Add detailed technical insights
    return content;
  }

  private applyTonePatterns(content: string): string {
    const patterns = this.tonePatterns[this.tone];

    if (patterns.formalPhrases.length > 0) {
      // Replace casual phrases with formal ones if needed
      for (const phrase of patterns.casualPhrases) {
        const formalEquivalent = this.getFormalEquivalent(phrase);
        if (formalEquivalent) {
          content = content.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), formalEquivalent);
        }
      }
    }

    if (patterns.casualPhrases.length > 0) {
      // Add casual flair
      for (const phrase of patterns.formalPhrases) {
        const casualEquivalent = this.getCasualEquivalent(phrase);
        if (casualEquivalent) {
          content = content.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), casualEquivalent);
        }
      }
    }

    // Add empathy phrases for empathetic tone
    if (this.tone === 'empathetic' && patterns.empathyPhrases) {
      const empathyPhrase = this.pickRandom(patterns.empathyPhrases);
      if (!content.includes(empathyPhrase)) {
        content = `${empathyPhrase}. ${content}`;
      }
    }

    return content;
  }

  private getFormalEquivalent(casual: string): string | undefined {
    const map: Record<string, string> = {
      'no problem': 'You\'re welcome',
      'sure thing': 'Certainly',
      'ok': 'Understood',
      'got it': 'I understand',
      'basically': 'fundamentally',
      'pretty much': 'essentially'
    };
    return map[casual.toLowerCase()];
  }

  private getCasualEquivalent(formal: string): string | undefined {
    const map: Record<string, string> = {
      'I would like to': 'I\'d like to',
      'Please be advised': 'Just so you know',
      'hereby': 'now',
      'pursuant to': 'based on'
    };
    return map[formal.toLowerCase()];
  }

  private applyCustomModifications(content: string): string {
    for (const mod of this.modifications) {
      content = content.replace(mod.pattern, mod.replacement);
    }
    return content;
  }

  private adjustForAction(content: string, action: string): string {
    const actionAdapters: Record<string, (c: string) => string> = {
      query: (c) => c,
      recommend: (c) => c.includes('recommend') ? c : `Based on your needs, I recommend: ${c}`,
      explain: (c) => c.includes('explain') ? c : `Here's an explanation: ${c}`,
      troubleshoot: (c) => c.includes('troubleshoot') ? c : `Let's work through this: ${c}`,
      compare: (c) => c.includes('compare') ? c : `Comparing your options: ${c}`,
      summarize: (c) => `In summary: ${c}`,
      guide: (c) => `Here's how to proceed: ${c}`,
      advise: (c) => `My advice: ${c}`
    };

    const adapter = actionAdapters[action];
    return adapter ? adapter(content) : content;
  }

  private getEmphasisPhrases(): string[] {
    const emphasisPhrases: Record<ExpertTone, string[]> = {
      professional: ['Importantly', 'Additionally', 'Furthermore'],
      friendly: ['Also', 'Plus', 'One more thing'],
      casual: ['Key point', 'Big deal', 'Here\'s the thing'],
      formal: ['It should be noted', 'Significantly', 'Particularly'],
      empathetic: ['I want to emphasize', 'This is really important', 'Please know']
    };
    return emphasisPhrases[this.tone];
  }

  private getCaveats(): string[] {
    const caveats: Record<ExpertTone, string[]> = {
      professional: ['Please note', 'It should be noted', 'With this in mind'],
      friendly: ['Just keep in mind', 'One thing to be aware of', 'A little heads up'],
      casual: ['Fair warning', 'Just so you know', 'Word of caution'],
      formal: ['It is important to note', 'Caution is advised', 'Due consideration should be given'],
      empathetic: ['I want to be careful to mention', 'Please remember', 'I say this with care']
    };
    return caveats[this.tone];
  }

  private pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }
}

interface TonePatterns {
  greeting: string[];
  closing: string[];
  formalPhrases: string[];
  casualPhrases: string[];
  empathyPhrases?: string[];
}
