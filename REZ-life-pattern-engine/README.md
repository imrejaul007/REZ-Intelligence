# REZ Life Pattern Engine

**Port:** 4161

Daily/weekly/seasonal patterns, routine detection, life events for Human Context Graph.

## Overview

Tracks and analyzes life patterns to understand user routines, rhythms, and life events:
- **Routine Detection**: Identify recurring activities and habits
- **Time Patterns**: Peak hours, weekly/monthly/seasonal rhythms
- **Lifestyle Profiling**: Chronotype, activity level, social patterns
- **Life Events**: Detect significant life changes
- **Predictions**: Next 24h routine predictions

## Features

### Routine Intelligence
- Automatic routine detection from activity data
- Pattern consistency scoring
- Routine streak tracking
- Variation detection (weekday/weekend/holiday)

### Temporal Analysis
- Weekly/monthly/quarterly/yearly rhythms
- Peak and trough identification
- Amplitude and stability metrics

### Life Stage Detection
- Career stage inference
- Relationship status signals
- Lifestyle indicators

### Integration Sources
- ReZ Ride (commute patterns)
- RisaCare (fitness/wellness)
- REZ Consumer (shopping/dining)
- BuzzLocal (social activities)
- Z-Events (social events)

## API Endpoints

### Activity
- `POST /api/activity` - Record activity
- `GET /api/activity/:userId` - Get activities

### Routines
- `POST /api/routines/detect` - Detect routines
- `GET /api/routines/:userId` - Get routines
- `GET /api/routines/:userId/variations` - Weekday/weekend patterns

### Patterns
- `POST /api/patterns/time` - Analyze time patterns
- `POST /api/patterns/lifestyle` - Analyze lifestyle
- `POST /api/patterns/rhythms` - Analyze rhythms

### Life Events
- `POST /api/life-events/detect` - Detect events
- `GET /api/life-events/:userId` - Get events
- `POST /api/life-events/:userId` - Record event

### Context
- `POST /api/context` - Full life pattern context
- `GET /api/predictions/:userId/24h` - 24h predictions

## Quick Start

```bash
cd REZ-Intelligence/REZ-life-pattern-engine
npm install
npm run dev
```

## License

Proprietary - RTNM Group
