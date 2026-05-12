# REZ Conversation Intelligence Service

A production-ready microservice for learning from every conversation in the REZ commerce platform. This service captures, analyzes, and exports conversation data to train and improve AI models.

## Features

- **Conversation Logging**: Store and index all conversations with metadata
- **Intent Extraction**: Automatically identify user intents using NLP
- **Sentiment Analysis**: Analyze emotional tone of conversations
- **Outcome Tracking**: Track conversation outcomes and success metrics
- **Feedback Loop**: Process user feedback for continuous improvement
- **Training Export**: Export curated datasets for model training
- **Model Versioning**: Track model versions with metadata

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Conversation Intelligence                      │
├─────────────────────────────────────────────────────────────────┤
│  Routes: logging, analytics, export                              │
├─────────────────────────────────────────────────────────────────┤
│  Services: Logger, IntentExtractor, SentimentAnalyzer,           │
│            OutcomeTracker, FeedbackLoop, TrainingExporter        │
├─────────────────────────────────────────────────────────────────┤
│  Pipelines: Extraction, Labeling, Export                         │
├─────────────────────────────────────────────────────────────────┤
│  Schedulers: DailyExport, ModelUpdate                            │
├─────────────────────────────────────────────────────────────────┤
│  Models: ConversationSample, Feedback, TrainingBatch,            │
│          ModelVersion                                            │
└─────────────────────────────────────────────────────────────────┘
           │                         │
           ▼                         ▼
      MongoDB                    Redis
   (Primary Store)          (Cache, Queues)
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start Redis and MongoDB (if not running)
docker run -d -p 27017:27017 -p 6379:6379 mongo:7 redis:7

# Run in development
npm run dev

# Build for production
npm run build

# Start production
npm start
```

## API Endpoints

### Conversation Logging
- `POST /api/v1/conversations` - Log a new conversation
- `GET /api/v1/conversations/:id` - Get conversation by ID
- `GET /api/v1/conversations` - List conversations with filters
- `POST /api/v1/conversations/:id/messages` - Add message to conversation

### Analytics
- `GET /api/v1/analytics/intents` - Get intent distribution
- `GET /api/v1/analytics/sentiment` - Get sentiment trends
- `GET /api/v1/analytics/outcomes` - Get outcome metrics
- `GET /api/v1/analytics/summary` - Get conversation summary

### Feedback
- `POST /api/v1/feedback` - Submit feedback
- `GET /api/v1/feedback/:id` - Get feedback by ID
- `GET /api/v1/feedback/conversation/:conversationId` - Get feedback for conversation

### Export
- `POST /api/v1/export/training-data` - Trigger training data export
- `GET /api/v1/export/status/:jobId` - Get export job status
- `GET /api/v1/export/download/:versionId` - Download exported data
- `GET /api/v1/models` - List model versions
- `GET /api/v1/models/:version` - Get model version details

## Data Models

### ConversationSample
Stores raw conversation data with metadata:
- Conversation ID, session ID, participants
- Messages array with sender, content, timestamp
- Extracted intents and sentiment scores
- Outcome and metadata

### Feedback
Stores user feedback on conversations:
- Feedback type (rating, correction, suggestion)
- Rating value (1-5)
- Corrections and suggestions
- Feedback metadata

### TrainingBatch
Stores exported training batches:
- Batch ID, version, status
- Sample count and file path
- Export statistics
- Created timestamp

### ModelVersion
Stores model version metadata:
- Version ID and number
- Training data statistics
- Performance metrics
- Created timestamp

## Configuration

All configuration is via environment variables. See `.env.example` for all options.

## Testing

```bash
npm test
npm run test:watch
```

## License

Proprietary - REZ Commerce Platform
