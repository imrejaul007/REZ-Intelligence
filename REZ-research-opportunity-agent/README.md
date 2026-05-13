# ReZ Research & Opportunity Agent

An autonomous AI agent that analyzes customer business data, monitors market and competitors, identifies growth opportunities, and recommends actionable campaigns.

## Features

- **Business Analysis**: Customer behavior patterns, purchase trends, product performance, channel effectiveness
- **Market Intelligence**: Competitor monitoring, industry trends, price positioning, product gaps
- **Opportunity Identification**: AI-powered opportunity detection across multiple categories
- **Natural Language Queries**: Ask business questions in plain English
- **Scheduled Reports**: Daily briefings and weekly opportunity reports
- **Real-time Alerts**: Anomaly detection and threshold monitoring

## Tech Stack

- Node.js 18+
- Express.js
- MongoDB (Mongoose)
- Redis
- OpenAI SDK (GPT-4o)
- Node-cron for scheduling
- TypeScript

## Installation

```bash
# Clone the repository
cd REZ-Intelligence/REZ-research-opportunity-agent

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Required: OPENAI_API_KEY

# Build
npm run build

# Start
npm start
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test
```

## API Endpoints

### Research
- `POST /api/research/analyze` - Full business analysis
- `POST /api/research/competitors` - Competitor analysis
- `POST /api/research/segments` - Segment deep-dive
- `GET /api/research/reports` - List insight reports

### Opportunities
- `GET /api/opportunities` - List opportunities
- `GET /api/opportunities/:id` - Opportunity details
- `POST /api/opportunities/generate` - Generate new opportunities
- `PATCH /api/opportunities/:id/status` - Update status
- `POST /api/opportunities/:id/approve` - Approve for action
- `POST /api/opportunities/:id/execute` - Create campaign from opportunity

### Insights
- `GET /api/insights/daily` - Daily insight summary
- `GET /api/insights/alerts` - Active alerts
- `POST /api/insights/query` - Natural language query

### Campaigns
- `POST /api/campaigns/from-insight` - Create campaign from insight

### Workers
- `POST /api/workers/daily/run` - Run daily briefing on-demand
- `POST /api/workers/weekly/run` - Run weekly report on-demand
- `GET /api/workers/status` - Get worker status

### Health
- `GET /api/health` - Health check

## Authentication

Internal services should include the `X-Internal-Token` header:

```bash
curl -X GET http://localhost:4058/api/health \
  -H "X-Internal-Token: your-token"
```

## Scheduled Jobs

| Schedule | Task |
|----------|------|
| Every 5 minutes | Real-time anomaly detection |
| Daily 6 AM | Daily briefing generation |
| Weekly Monday 7 AM | Weekly opportunity report |
| On-demand | Manual report generation |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | 4058 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/rez-research-agent |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `LOG_LEVEL` | Logging level | info |

## Project Structure

```
src/
├── index.ts              # Main entry point
├── config/               # Configuration
├── agents/               # AI agents
│   ├── researchAgent.ts
│   ├── opportunityAgent.ts
│   └── insightAgent.ts
├── services/             # Business logic
│   ├── businessAnalysisService.ts
│   ├── competitorAnalysisService.ts
│   ├── opportunityService.ts
│   ├── alertService.ts
│   └── campaignRecommendationService.ts
├── routes/               # API routes
├── models/               # MongoDB models
├── workers/              # Scheduled workers
├── prompts/              # AI prompts
├── types/                # TypeScript types
├── constants/            # Constants and thresholds
├── middleware/           # Express middleware
└── utils/                # Utilities
```

## License

Proprietary - RABTUL Technologies
