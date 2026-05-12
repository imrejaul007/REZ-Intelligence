/**
 * SystemPromptGenerator - Generates system prompts for AI models
 * Creates contextual, tone-appropriate system prompts for expert agents
 */

import { ExpertAgent } from './ExpertAgent';
import { ExpertiseLevel, ExpertCapability } from '../types/expert.types';

export interface SystemPromptOptions {
  includeCapabilities?: boolean;
  includeExamples?: boolean;
  includeGuidelines?: boolean;
  includeConstraints?: boolean;
  customInstructions?: string[];
}

export class SystemPromptGenerator {
  private expert: ExpertAgent;
  private defaultOptions: SystemPromptOptions = {
    includeCapabilities: true,
    includeExamples: true,
    includeGuidelines: true,
    includeConstraints: true
  };

  constructor(expert: ExpertAgent) {
    this.expert = expert;
  }

  /**
   * Generate a complete system prompt
   */
  generate(options?: SystemPromptOptions): string {
    const opts = { ...this.defaultOptions, ...options };
    const sections: string[] = [];

    // Header
    sections.push(this.generateHeader());

    // Role definition
    sections.push(this.generateRoleDefinition());

    // Capabilities
    if (opts.includeCapabilities) {
      sections.push(this.generateCapabilities());
    }

    // Tone and communication style
    sections.push(this.generateCommunicationStyle());

    // Guidelines
    if (opts.includeGuidelines) {
      sections.push(this.generateGuidelines());
    }

    // Constraints
    if (opts.includeConstraints) {
      sections.push(this.generateConstraints());
    }

    // Custom instructions
    if (opts.customInstructions && opts.customInstructions.length > 0) {
      sections.push(this.generateCustomInstructions(opts.customInstructions));
    }

    // Closing
    sections.push(this.generateClosing());

    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * Generate a short system prompt for quick operations
   */
  generateShort(): string {
    return [
      this.generateHeader(),
      this.generateRoleDefinition(),
      this.generateCommunicationStyle(),
      'You are a helpful expert. Provide clear, accurate, and concise responses.'
    ].join('\n\n');
  }

  private generateHeader(): string {
    return `# ${this.expert.name} - Expert Agent System Prompt
Version: ${this.expert.version}
Industry: ${this.expert.industry}
Generated: ${new Date().toISOString()}`;
  }

  private generateRoleDefinition(): string {
    return `## Role Definition

You are ${this.expert.name}, an AI expert agent specializing in the ${this.expert.industry} industry.
Your role is to assist users with questions, provide recommendations, and solve problems
related to your domain of expertise.

**Core Identity:**
- Expert ID: ${this.expert.expertId}
- Industry: ${this.expert.industry}
- Version: ${this.expert.version}`;
  }

  private generateCapabilities(): string {
    const capabilities = this.expert.getCapabilities();
    const sections: string[] = ['## Capabilities & Expertise'];

    for (const capability of capabilities) {
      sections.push(`### ${capability.domain}
${capability.description}

**Actions you can perform:**
${capability.actions.map(a => `- ${a}`).join('\n')}

**Confidence range:** ${capability.confidenceRange.min * 100}% - ${capability.confidenceRange.max * 100}%`);

      if (capability.examples && capability.examples.length > 0) {
        sections.push(`\n**Example interactions:**
${capability.examples.map(e => `- ${e}`).join('\n')}`);
      }
    }

    return sections.join('\n\n');
  }

  private generateCommunicationStyle(): string {
    return `## Communication Style

- Be ${this.getToneAdjective()} in your responses
- Use clear, professional language appropriate for ${this.expert.industry}
- Provide context and explanation when helpful
- Ask clarifying questions when needed
- Admit uncertainty when you don't know something
- Suggest follow-up actions when appropriate`;
  }

  private getToneAdjective(): string {
    const toneMap: Record<string, string> = {
      professional: 'professional and business-focused',
      friendly: 'warm and approachable',
      casual: 'relaxed and conversational',
      formal: 'formal and precise',
      empathetic: 'compassionate and understanding'
    };
    return toneMap[this.expert['config'].tone] || 'professional';
  }

  private generateGuidelines(): string {
    return `## Operating Guidelines

1. **Understand Before Acting:** Always ensure you understand the user's intent before responding
2. **Be Accurate:** Provide correct information; don't guess or hallucinate
3. **Be Transparent:** If you're uncertain, say so
4. **Prioritize Safety:** Don't provide harmful, illegal, or unethical advice
5. **Respect Privacy:** Never ask for or store sensitive personal information unnecessarily
6. **Be Helpful:** Aim to provide actionable, useful responses
7. **Escalate When Needed:** If a request is outside your expertise, suggest escalation`;
  }

  private generateConstraints(): string {
    return `## Constraints & Boundaries

- **Do not:**
  - Make up information or statistics
  - Provide medical, legal, or financial advice that requires professional certification
  - Share sensitive data or private information
  - Perform actions that could cause harm

- **Do:**
  - Provide general information and guidance
  - Suggest professional consultation when appropriate
  - Offer alternatives and options when possible
  - Explain your reasoning and logic`;
  }

  private generateCustomInstructions(instructions: string[]): string {
    return `## Custom Instructions\n\n${instructions.map(i => `- ${i}`).join('\n')}`;
  }

  private generateClosing(): string {
    return `---

Remember: You are an AI assistant. Your goal is to be helpful, accurate, and respectful
while operating within your defined capabilities and constraints.`;
  }

  /**
   * Generate a prompt for a specific action
   */
  generateForAction(action: string, context?: Record<string, unknown>): string {
    const basePrompt = this.generateShort();
    const actionInstructions = this.getActionInstructions(action);

    return `${basePrompt}

## Current Task: ${action}
${actionInstructions}

${context ? `## Context\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`` : ''}

Provide your response below.`;
  }

  private getActionInstructions(action: string): string {
    const instructions: Record<string, string> = {
      query: 'Answer the user\'s question based on your expertise. Be thorough but concise.',
      recommend: 'Based on the user\'s needs, provide relevant recommendations with explanations.',
      explain: 'Explain the concept clearly with examples where helpful.',
      troubleshoot: 'Help diagnose issues by asking relevant questions and providing solutions.',
      compare: 'Present a balanced comparison of options with pros and cons.',
      summarize: 'Provide a concise summary of the key points.',
      guide: 'Provide step-by-step guidance through the process.',
      advise: 'Give considered advice based on best practices and your expertise.'
    };

    return instructions[action] || 'Provide a helpful and accurate response.';
  }
}
