# ReZ Mind Education Service - Technical Specification

## Overview

The ReZ Mind Education Service is an AI-powered intelligence service designed for educational institutions to optimize student outcomes, predict academic performance, detect attendance anomalies, and identify dropout risks.

## Service Architecture

### Core Components

1. **StudentIntelligence Service**
   - Analyzes student data and behavior patterns
   - Predicts academic outcomes based on historical data
   - Generates personalized recommendations

2. **PerformancePredictor Service**
   - Predicts student exam scores and grades
   - Identifies factors affecting performance
   - Provides intervention recommendations

3. **DropoutDetector Service**
   - Identifies at-risk students early
   - Analyzes contributing risk factors
   - Generates retention recommendations

4. **BatchOptimizer Service**
   - Recommends optimal batch sizes
   - Suggests best timing for batches
   - Predicts batch success rates

## Data Models

### EducationMindSession
- **Purpose**: Stores AI consultation sessions
- **Retention**: 60 days TTL
- **Indexes**: sessionId (unique), institutionId

### PerformancePrediction
- **Purpose**: Stores student performance predictions
- **Indexes**: institutionId + studentId + date

### AttendanceAnomaly
- **Purpose**: Tracks attendance anomalies
- **Indexes**: institutionId + studentId + date

### DropoutRisk
- **Purpose**: Tracks dropout risk assessments
- **Indexes**: institutionId + studentId + riskLevel

## API Specification

### POST /api/consult

**Request:**
```json
{
  "institutionId": "string (required)",
  "studentId": "string (optional)",
  "context": {
    "courseId": "string",
    "semester": "string",
    "grades": ["array of grade objects"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "recommendations": [...],
    "riskAssessments": [...],
    "performancePredictions": [...],
    "confidence": "number"
  }
}
```

### GET /api/performance/:institutionId

**Response:**
```json
{
  "success": true,
  "data": {
    "predictions": [
      {
        "studentId": "string",
        "predictedGrade": "A|B|C|D|F",
        "confidence": "number (0-1)",
        "riskFactors": ["string"]
      }
    ]
  }
}
```

### GET /api/enrollment/:institutionId/dropout-risk

**Response:**
```json
{
  "success": true,
  "data": {
    "atRiskStudents": [
      {
        "studentId": "string",
        "riskScore": "number (0-100)",
        "riskLevel": "high|medium|low",
        "contributingFactors": ["string"],
        "recommendations": ["string"]
      }
    ]
  }
}
```

## Industry Knowledge Base

### Performance Indicators

| Indicator | Good | Average | Poor |
|-----------|------|---------|------|
| Attendance Rate | >90% | 75-90% | <75% |
| Assignment Completion | >85% | 70-85% | <70% |
| Quiz Performance | >80% | 60-80% | <60% |
| Participation Score | >75% | 50-75% | <50% |

### Risk Factors for Dropout

1. **Academic Factors**
   - Declining grades
   - Low assignment completion
   - Poor exam performance
   - Course failures

2. **Engagement Factors**
   - Low attendance
   - Limited participation
   - Rare course access
   - Low interaction

3. **External Factors**
   - Financial difficulties
   - Family issues
   - Health problems
   - Distance from institution

### Course Recommendation Criteria

1. Student interest alignment
2. Skill gap analysis
3. Career path matching
4. Prerequisite completion
5. Workload balance

## Rate Limiting

- **AI Consultation**: 30 requests per minute
- **Read Operations**: 100 requests per minute
- **Prediction Operations**: 50 requests per minute

## Authentication

- Internal service authentication via `X-Internal-Token` header
- JWT Bearer token support for external services
- Rate limiting per service token

## Dependencies

- MongoDB: Primary data store
- RABTUL Platform: Intent routing and notifications
- ReZ Intelligence Hub: AI model orchestration

## Performance Targets

- Response time: < 500ms for AI consultations
- Throughput: 100 concurrent requests
- Availability: 99.9% uptime

## Monitoring

- Health endpoints for load balancer integration
- Detailed metrics in `/health/detailed`
- Request tracing via correlation IDs

## Security

- Helmet.js for HTTP headers
- CORS configuration for allowed origins
- Rate limiting to prevent abuse
- Input validation with Zod schemas