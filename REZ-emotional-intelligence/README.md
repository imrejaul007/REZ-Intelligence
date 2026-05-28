# REZ Emotional Intelligence Service

**Port:** 4160

Mood tracking, sentiment analysis, wellness scoring, and cosmic interpretation for the Human Context Graph.

## Overview

This service provides emotional intelligence capabilities that power Cosmic OS:
- **Mood Tracking**: Record and analyze user mood states over time
- **Sentiment Analysis**: Detect sentiment from text, behavior, and signals
- **Wellness Scoring**: Calculate wellness across mental, emotional, social dimensions
- **Cosmic Interpretation**: Generate symbolic, abstracted insights (not surveillance)

## Features

### Mood Intelligence
- Real-time mood check-ins with context
- Mood patterns by time, location, activity, weather
- Trend analysis and predictions
- Emotional volatility detection

### Sentiment Analysis
- Text-based sentiment detection
- Behavioral sentiment inference
- Multi-source sentiment aggregation

### Wellness Scoring
- 5-dimension wellness model (mental, emotional, social, purpose, growth)
- Risk factor identification
- Protective factor tracking
- Trend trajectory analysis

### Cosmic Interpretation (Key Differentiator)
Abstracts raw data into symbolic, helpful guidance:
- NOT: "You traveled to Mumbai 4 times this month"
- BUT: "Fresh environments may inspire new perspectives"

This is the TRUST LAYER that makes the ecosystem feel helpful, not creepy.

## API Endpoints

### Mood
- `POST /api/mood/checkin` - Record mood check-in
- `GET /api/mood/:userId/current` - Get current mood
- `GET /api/mood/:userId/history` - Get mood history
- `GET /api/mood/:userId/patterns` - Analyze mood patterns
- `GET /api/mood/:userId/trend` - Get mood trends

### Sentiment
- `POST /api/sentiment/analyze` - Analyze text sentiment
- `GET /api/sentiment/:userId/aggregate` - Get aggregated sentiment

### Wellness
- `GET /api/wellness/:userId` - Get wellness score
- `POST /api/wellness/:userId/assess` - Self-assess wellness
- `PUT /api/wellness/:userId` - Update wellness dimensions

### Signals
- `POST /api/signals/update` - Update emotional signals
- `GET /api/signals/:userId` - Get current signals

### Context
- `POST /api/context` - Get full emotional context
- `POST /api/context/cosmic` - Get cosmic interpretation

## Integration

### Input Sources
- User check-ins (explicit)
- RisaCare wellness data
- REZ Consumer behavior signals
- REZ Care service feedback
- Third-party wellness apps

### Output Consumers
- Cosmic OS (mood state, cosmic interpretation)
- REZ Intent Graph (emotional intent signals)
- REZ Signal Aggregator (emotional signals)
- REZ Human Context Graph (context layer)
- Hojai AI (wellness intelligence)

## Quick Start

```bash
cd REZ-Intelligence/REZ-emotional-intelligence
npm install
npm run dev
```

## Environment Variables

```
PORT=4160
MONGODB_URI=mongodb://localhost:27017/rez_emotional
LOG_LEVEL=info
```

## Data Privacy

All emotional data is:
- Pseudonymized (userId, not PII)
- User-consented (opt-in check-ins)
- Abstracted in outputs (never raw surveillance data)
- Stored with encryption at rest

## License

Proprietary - RTNM Group
