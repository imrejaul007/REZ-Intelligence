# REZ Expert Base

Base template class for all REZ industry expert agents. Provides common functionality for intent processing, knowledge management, tone adjustment, and workflow orchestration.

## Architecture

```
rez-expert-base/
├── src/
│   ├── base/           # Base classes
│   │   ├── ExpertAgent.ts       # Abstract base for all experts
│   │   ├── SystemPrompt.ts      # System prompt generator
│   │   ├── ToneEngine.ts       # Communication tone handler
│   │   └── KnowledgeBase.ts   # Knowledge/caching interface
│   ├── interfaces/     # TypeScript interfaces
│   │   ├── IExpert.ts          # Expert contract
│   │   ├── IIntent.ts          # Intent structure
│   │   └── IResponse.ts        # Response structure
│   ├── services/       # Business logic
│   │   ├── expertiseService.ts      # Expertise matching
│   │   ├── workflowService.ts        # Multi-step workflows
│   │   └── recommendationService.ts # Follow-up suggestions
│   ├── routes/         # Express routes
│   │   └── expert.routes.ts  # REST API endpoints
│   ├── types/          # Type definitions
│   └── utils/          # Utilities (logging)
└── index.ts            # Entry point
```

## Quick Start

```typescript
import { ExpertAgent } from './base/ExpertAgent';
import { ExpertConfig, ExpertCapability } from './types/expert.types';
import { Logger } from './utils/logger';

// Define your expert configuration
const config: ExpertConfig = {
  expertId: 'healthcare-expert',
  name: 'Healthcare Expert',
  industry: 'healthcare',
  version: '1.0.0',
  description: 'Expert for healthcare domain queries',
  tone: 'professional',
  expertiseLevel: 'advanced',
  capabilities: [
    {
      domain: 'healthcare',
      actions: ['query', 'explain', 'recommend'],
      description: 'Healthcare industry expertise',
      confidenceRange: { min: 0.7, max: 0.95 }
    }
  ]
};

// Extend the base class
class HealthcareExpert extends ExpertAgent {
  protected async processIntentCore(intent: IIntent, context: ResponseContext) {
    // Your expertise logic here
    return {
      content: `Based on my healthcare expertise...`,
      confidence: 'high',
      actions: [],
      metadata: {}
    };
  }

  protected canHandleCore(intent: IIntent): boolean {
    return intent.classification.domain === 'healthcare';
  }
}

// Initialize and use
const logger = new Logger('healthcare-expert');
const expert = new HealthcareExpert(config, logger);
await expert.initialize();

const response = await expert.processIntent(intent);
```

## Creating a New Expert

1. Create a new directory for your expert (e.g., `rez-healthcare-expert`)
2. Copy the base structure or extend `ExpertAgent`
3. Implement `processIntentCore()` and `canHandleCore()`
4. Register with the registry

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |
| GET | `/experts` | List all experts |
| GET | `/experts/:id` | Get expert details |
| POST | `/intents` | Process an intent |
| GET | `/experts/:id/health` | Expert health check |
| GET | `/capabilities` | List all capabilities |

## Intent Processing Flow

```
User Input → Intent Parser → Expert Registry → Best Expert
    ↓
Expert.processIntent()
    ↓
├── Check Cache
├── Match Expertise
├── Generate Response (AI Model)
├── Apply Tone
├── Generate Follow-ups
└── Cache Response
```

## Configuration

See `.env.example` for all available configuration options.

## Extending Base Classes

### ExpertAgent

Override these methods:

- `processIntentCore()` - Main processing logic
- `canHandleCore()` - Intent filtering logic

### SystemPromptGenerator

Customize prompts:

```typescript
const prompt = systemPromptGenerator.generate({
  includeCapabilities: true,
  includeExamples: true,
  customInstructions: ['Always cite sources']
});
```

### ToneEngine

Adjust tone:

```typescript
toneEngine.updateTone('friendly');
const adjusted = toneEngine.adjustContent(content, 'query');
```

## Workflow Orchestration

Define multi-step workflows in config:

```typescript
const workflowConfig = {
  enabled: true,
  timeoutMs: 30000,
  maxRetries: 3,
  steps: [
    { name: 'validate', handler: 'validateIntent', timeoutMs: 5000, required: true },
    { name: 'process', handler: 'processIntent', timeoutMs: 20000, required: true },
    { name: 'enrich', handler: 'enrichResponse', timeoutMs: 5000, required: false }
  ]
};
```

## Testing

```bash
npm run test        # Run all tests
npm run typecheck  # TypeScript validation
npm run lint       # Linting
```

## License

MIT
