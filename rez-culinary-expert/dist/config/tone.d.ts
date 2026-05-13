/**
 * Culinary Expert Tone Configuration
 * Defines the communication style and voice for the culinary agent
 */
export interface ToneConfig {
    enthusiasm: 'high' | 'medium' | 'low';
    formality: 'formal' | 'semi-formal' | 'casual';
    verbosity: 'detailed' | 'moderate' | 'concise';
}
export declare const TONE_PRESETS: {
    readonly default: {
        readonly enthusiasm: "high";
        readonly formality: "semi-formal";
        readonly verbosity: "moderate";
    };
    readonly quick: {
        readonly enthusiasm: "medium";
        readonly formality: "casual";
        readonly verbosity: "concise";
    };
    readonly detailed: {
        readonly enthusiasm: "high";
        readonly formality: "semi-formal";
        readonly verbosity: "detailed";
    };
    readonly fineDining: {
        readonly enthusiasm: "medium";
        readonly formality: "formal";
        readonly verbosity: "detailed";
    };
};
/**
 * Generates tone-specific language modifiers
 */
export declare function getToneModifiers(preset: keyof typeof TONE_PRESETS): {
    modifiers: {
        adjectives: string[];
        exclamations: string[];
        opener: string;
    } | {
        adjectives: string[];
        exclamations: string[];
        opener: string;
    };
    formality: {
        prefix: string;
        suffix: string;
        structure: "structured";
    } | {
        prefix: string;
        suffix: string;
        structure: "balanced";
    } | {
        prefix: string;
        suffix: string;
        structure: "relaxed";
    };
    verbosityLevel: number;
    enthusiasm: "high";
    verbosity: "moderate";
} | {
    modifiers: {
        adjectives: string[];
        exclamations: string[];
        opener: string;
    } | {
        adjectives: string[];
        exclamations: string[];
        opener: string;
    };
    formality: {
        prefix: string;
        suffix: string;
        structure: "structured";
    } | {
        prefix: string;
        suffix: string;
        structure: "balanced";
    } | {
        prefix: string;
        suffix: string;
        structure: "relaxed";
    };
    verbosityLevel: number;
    enthusiasm: "medium";
    verbosity: "concise";
} | {
    modifiers: {
        adjectives: string[];
        exclamations: string[];
        opener: string;
    } | {
        adjectives: string[];
        exclamations: string[];
        opener: string;
    };
    formality: {
        prefix: string;
        suffix: string;
        structure: "structured";
    } | {
        prefix: string;
        suffix: string;
        structure: "balanced";
    } | {
        prefix: string;
        suffix: string;
        structure: "relaxed";
    };
    verbosityLevel: number;
    enthusiasm: "high";
    verbosity: "detailed";
} | {
    modifiers: {
        adjectives: string[];
        exclamations: string[];
        opener: string;
    } | {
        adjectives: string[];
        exclamations: string[];
        opener: string;
    };
    formality: {
        prefix: string;
        suffix: string;
        structure: "structured";
    } | {
        prefix: string;
        suffix: string;
        structure: "balanced";
    } | {
        prefix: string;
        suffix: string;
        structure: "relaxed";
    };
    verbosityLevel: number;
    enthusiasm: "medium";
    verbosity: "detailed";
};
/**
 * Applies tone to a culinary response
 */
export declare function applyTone(text: string, preset?: keyof typeof TONE_PRESETS): string;
/**
 * Generates a recommendation opener based on tone
 */
export declare function generateOpener(context: 'recommendation' | 'explanation' | 'warning' | 'greeting', preset?: keyof typeof TONE_PRESETS): string;
/**
 * Adjective rotation to avoid repetition
 */
export declare function getRotatingAdjective(usedAdjectives: string[]): string;
export type TonePreset = keyof typeof TONE_PRESETS;
//# sourceMappingURL=tone.d.ts.map