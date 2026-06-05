# ReZ Mind Education Service

AI-powered intelligence service for education industry, helping institutions optimize student outcomes, predict performance, and reduce dropout rates.

## Features

- **Student Performance Prediction**: AI-powered predictions of student academic outcomes
- **Attendance Anomaly Detection**: Real-time detection of attendance patterns and anomalies
- **Course Recommendation**: Personalized course suggestions based on student profiles
- **Batch Optimization**: Optimal batch timing and size recommendations
- **Fee Payment Prediction**: Predict likelihood of on-time fee payments
- **Dropout Risk Identification**: Early warning system for at-risk students
- **Teacher Assignment Optimization**: AI-driven teacher-student matching

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

```env
PORT=4058
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/rez_mind_education
INTERNAL_SERVICE_TOKEN=your-32-char-minimum-secret-token
AUTH_SERVICE_URL=https://auth.rez.com
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_AI=30
RATE_LIMIT_MAX_READ=100
```

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check with dependencies
- `GET /health/detailed` - Detailed health status

### AI Consultation
- `POST /api/consult` - Process education AI consultation
- `GET /api/consult/:sessionId` - Retrieve consultation session

### Performance Management
- `GET /api/performance/:institutionId` - Get student performance predictions
- `GET /api/performance/:institutionId/student/:studentId` - Get specific student predictions
- `POST /api/performance/:institutionId/predict` - Create new performance prediction

### Attendance Management
- `GET /api/attendance/:institutionId` - Get attendance anomalies
- `GET /api/attendance/:institutionId/student/:studentId` - Get student attendance history
- `POST /api/attendance/:institutionId/analyze` - Analyze attendance patterns

### Enrollment Management
- `GET /api/enrollment/:institutionId/courses` - Get course recommendations
- `POST /api/enrollment/:institutionId/recommend` - Get personalized course recommendations
- `GET /api/enrollment/:institutionId/dropout-risk` - Get dropout risk assessment

## Architecture

```
src/
├── index.ts                 # Application entry point
├── config/
│   ├── index.ts            # Environment configuration
│   ├── knowledge.ts         # Education industry knowledge base
│   └── systemPrompt.ts      # AI training prompts
├── types/
│   └── index.ts            # TypeScript interfaces
├── models/
│   ├── index.ts             # Model exports
│   ├── EducationMindSession.ts
│   ├── PerformancePrediction.ts
│   ├── AttendanceAnomaly.ts
│   └── DropoutRisk.ts
├── routes/
│   ├── consult.routes.ts
│   ├── performance.routes.ts
│   ├── attendance.routes.ts
│   └── enrollment.routes.ts
├── services/
│   ├── studentIntelligence.ts
│   ├── performancePredictor.ts
│   ├── dropoutDetector.ts
│   └── batchOptimizer.ts
├── middleware/
│   ├── auth.ts
│   ├── errorHandler.ts
│   ├── rateLimit.ts
│   └── validation.ts
├── integrations/
│   └── rabtul.ts
└── utils/
    └── logger.ts
```

## Port Configuration

| Service | Port |
|---------|------|
| Education | 4058 |

## License

Proprietary - ReZ Technologies