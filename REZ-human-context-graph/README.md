# REZ Human Context Graph

**Port:** 4162

Unified 15-layer context aggregation for Human Life Intelligence.

## Overview

This service aggregates context from all 15 life layers into a unified Human Context Graph:
- **15 Life Layers**: Health, Commerce, Relationship, Karma, Career, Business, Mobility, Spiritual, Financial, Real Estate, Hospitality, Daily Living, Hyperlocal, Events, Student
- **Cross-Layer Insights**: Correlation and causation patterns across layers
- **Life Stage Assessment**: Career stage, relationship status, financial phase
- **Risk Factors**: Identified risks across all layers
- **Opportunities**: Growth opportunities based on context

## Features

### Context Aggregation
- Fetches context from upstream services
- Aggregates signals from all 15 layers
- Cross-layer correlation analysis
- Data completeness tracking

### Cosmic Context
- Generates abstracted, symbolic interpretations
- Privacy-safe insights (not surveillance)
- Timing advice based on patterns
- Suggested actions based on context

### Integration
- REZ Emotional Intelligence (spiritual layer)
- REZ Life Pattern Engine (daily layer)
- RisaCare (health layer)
- REZ Consumer (commerce layer)
- All other life layer services

## API Endpoints

### Signals
- `POST /api/signals` - Record layer signal
- `GET /api/signals/:userId/:layer` - Get layer signals

### Context
- `POST /api/context` - Get unified human context
- `POST /api/context/cosmic` - Get cosmic context

### Insights
- `GET /api/insights/:userId/cross-layer` - Cross-layer insights
- `GET /api/insights/:userId/risks` - Risk factors
- `GET /api/insights/:userId/opportunities` - Opportunities

## Quick Start

```bash
cd REZ-Intelligence/REZ-human-context-graph
npm install
npm run dev
```

## License

Proprietary - RTNM Group
