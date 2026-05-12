# REZ Education Expert Agent

A specialized AI agent for course recommendations, learning paths, and education guidance within the REZ commerce platform.

## Features

- **Course Recommendations**: Personalized course suggestions based on interests, skill level, and career goals
- **Learning Paths**: Structured learning journeys from beginner to advanced
- **Progress Tracking**: Track course progress, time spent, and achievements
- **Skill Assessment**: Evaluate current skills and identify gaps
- **Certification Guidance**: Information about certifications and exam preparation
- **Study Tips**: Learning strategies and time management advice

## Architecture

```
rez-education-expert/
├── src/
│   ├── config/
│   │   ├── systemPrompt.ts    # AI agent system prompt
│   │   ├── tone.ts            # Communication tone configuration
│   │   └── knowledge.ts       # Education domain knowledge base
│   ├── services/
│   │   ├── expertise.ts       # Core expertise and recommendations
│   │   ├── courseService.ts   # Course search and browsing
│   │   ├── progressService.ts # Progress tracking and achievements
│   │   └── recommendations.ts # Personalized recommendations
│   ├── intents/
│   │   └── educationIntents.ts # Intent parsing (20 intents)
│   ├── routes/
│   │   └── education.routes.ts # API endpoints
│   ├── types/
│   │   └── tone.ts            # TypeScript type definitions
│   └── index.ts               # Express server entry point
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Intents Supported

| Intent | Description |
|--------|-------------|
| COURSE_RECOMMENDATION | Get personalized course recommendations |
| LEARNING_PATH | Create structured learning paths |
| COURSE_SEARCH | Search and filter courses |
| ENROLL | Enroll in a course |
| PROGRESS_CHECK | Check course progress |
| CERTIFICATION_INFO | Get certification information |
| STUDY_TIPS | Receive study strategies |
| SKILL_ASSESSMENT | Evaluate skill levels |
| COURSE_COMPARE | Compare multiple courses |
| COMPLETION_CELEBRATE | Celebrate milestones |
| DOMAIN_EXPLORE | Explore learning domains |
| TIME_ESTIMATE | Get learning duration estimates |
| CAREER_GUIDANCE | Career path advice |
| COURSE_DIFFICULTY | Understand difficulty levels |
| LEARNING_STYLE | Preferences for learning formats |
| MOTIVATION | Get encouragement |
| ACHIEVEMENT_VIEW | View earned achievements |
| SCHEDULE_PLANNING | Create study schedules |
| CERTIFICATION_TRACK | Track certification progress |

## API Endpoints

### Health & Info
- `GET /health` - Health check
- `GET /agent` - Agent information

### Courses
- `GET /api/v1/courses` - Search courses
- `GET /api/v1/courses/trending` - Get trending courses
- `GET /api/v1/courses/:courseId` - Get course details
- `POST /api/v1/courses/compare` - Compare courses

### Recommendations
- `POST /api/v1/recommendations` - Get personalized recommendations

### Learning Paths
- `POST /api/v1/learning-paths` - Create learning path

### Progress & Achievements
- `POST /api/v1/progress/start` - Start a course
- `PUT /api/v1/progress` - Update progress
- `GET /api/v1/progress/:userId` - Get user progress
- `GET /api/v1/progress/:userId/stats` - Get learning stats
- `GET /api/v1/achievements/:userId` - Get achievements

### Skills
- `POST /api/v1/skills/assess` - Assess skills
- `POST /api/v1/skills/gap-analysis` - Gap analysis

### Chat
- `POST /api/v1/chat` - Chat with education agent

### Discovery
- `GET /api/v1/domains` - List domains
- `GET /api/v1/intents` - List supported intents

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Build the project
npm run build

# Start the server
npm start

# Development mode
npm run dev
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3006 |
| NODE_ENV | Environment | development |
| LOG_LEVEL | Logging level | info |
| REDIS_URL | Redis connection URL | redis://localhost:6379 |
| MONGODB_URI | MongoDB connection URI | mongodb://localhost:27017/rez-education |
| INTERNAL_SERVICE_TOKENS_JSON | Service authentication tokens | {} |
| CORS_ORIGIN | CORS allowed origins | * |

## Usage Examples

### Get Course Recommendations

```bash
curl -X POST http://localhost:3006/api/v1/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "interests": ["Python", "Machine Learning"],
    "skillLevel": "intermediate",
    "goals": ["Data Scientist"]
  }'
```

### Search Courses

```bash
curl "http://localhost:3006/api/v1/courses?query=Python&level=beginner&limit=5"
```

### Start a Course

```bash
curl -X POST http://localhost:3006/api/v1/progress/start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "courseId": "data-science-python"
  }'
```

### Update Progress

```bash
curl -X PUT http://localhost:3006/api/v1/progress \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "courseId": "data-science-python",
    "progress": 45,
    "timeSpentMinutes": 30
  }'
```

### Chat with Agent

```bash
curl -X POST http://localhost:3006/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "message": "recommend courses for web development",
    "context": {
      "interests": ["JavaScript", "React"],
      "skillLevel": "beginner"
    }
  }'
```

## Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

## Integration with REZ Platform

This service integrates with other REZ services:

- **ReZ Mind**: Intent tracking and ML scoring
- **ReZ Auth**: User authentication
- **ReZ Wallet**: Payment for paid courses
- **ReZ Notification**: Progress updates and reminders

## Development

### TypeScript

The project uses TypeScript with strict mode for type safety.

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

Proprietary - REZ Commerce Platform
