# REZ Info Agent

A purpose-built information agent for the REZ commerce platform, providing FAQ, policies, and general information delivery through a comprehensive knowledge base.

## Features

- **Natural Language Search**: Intelligent query understanding and information retrieval
- **Comprehensive FAQ Database**: Extensive frequently asked questions across all categories
- **Policy Repository**: Complete terms, privacy policies, and legal documents
- **How-To Guides**: Step-by-step instructions for common tasks
- **Category Organization**: Organized information by topic (booking, payment, policies, etc.)
- **Popular Content**: Track and surface most-viewed content
- **Related Information**: Smart linking between related FAQs, articles, and policies
- **Feedback System**: Mark content as helpful to improve recommendations

## Architecture

```
rez-info-agent/
├── src/
│   ├── index.ts              # Express server entry point
│   ├── services/
│   │   ├── infoAgent.ts       # Core information logic
│   │   └── knowledgeBase.ts   # Knowledge base management
│   └── routes/
│       └── info.routes.ts   # API endpoints
├── package.json
└── tsconfig.json
```

## API Endpoints

### Query
```
POST /api/v1/info/query
```
Process natural language queries and return relevant information.

### Search
```
POST /api/v1/info/search
```
Search across FAQs, articles, and policies.

### FAQs
```
POST   /api/v1/info/faqs               # Search FAQs
GET    /api/v1/info/faqs/popular       # Get popular FAQs
GET    /api/v1/info/faqs/category/:cat # Get FAQs by category
GET    /api/v1/info/faqs/:faqId        # Get FAQ by ID
POST   /api/v1/info/faqs/:faqId/helpful  # Mark FAQ as helpful
```

### Policies
```
POST   /api/v1/info/policies              # Search policies
GET    /api/v1/info/policies/category/:cat  # Get policies by category
GET    /api/v1/info/policies/:policyId   # Get policy by ID
```

### Articles
```
POST   /api/v1/info/articles           # Search articles
GET    /api/v1/info/articles/popular   # Get popular articles
GET    /api/v1/info/articles/:articleId # Get article by ID
```

### Guides
```
POST   /api/v1/info/guides            # Search guides
GET    /api/v1/info/guides/:guideId   # Get guide by ID
```

### Categories
```
GET /api/v1/info/categories
```
Get all available information categories.

## Info Categories

| Category | Description |
|----------|-------------|
| `booking` | Booking-related questions |
| `payment` | Payment methods and pricing |
| `cancellation` | Cancellation procedures |
| `refund` | Refund eligibility and timelines |
| `shipping` | Delivery information |
| `account` | Account management |
| `loyalty` | Rewards program |
| `technical` | Technical support |
| `general` | General information |
| `policies` | Terms and policies |
| `contact` | Contact information |
| `faq` | Frequently asked questions |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3004 |
| NODE_ENV | Environment | development |
| LOG_LEVEL | Logging level | info |
| ALLOWED_ORIGINS | CORS origins | localhost:3000 |

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Development mode
npm run dev
```

## Example Usage

### Natural Language Query
```bash
curl -X POST http://localhost:3004/api/v1/info/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I cancel my booking and get a refund?"
  }'
```

### Search
```bash
curl -X POST http://localhost:3004/api/v1/info/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "refund policy",
    "category": "refund",
    "limit": 10
  }'
```

### Get FAQs by Category
```bash
curl http://localhost:3004/api/v1/info/faqs/category/booking
```

### Get Popular FAQs
```bash
curl http://localhost:3004/api/v1/info/faqs/popular?limit=5
```

### Get Policy
```bash
curl http://localhost:3004/api/v1/info/policies/pol_001
```

### Get Guide
```bash
curl http://localhost:3004/api/v1/info/guides/guide_002
```

### Get All Categories
```bash
curl http://localhost:3004/api/v1/info/categories
```

## Response Structure

### Query Response
```json
{
  "success": true,
  "data": {
    "response": "Human-readable response with information",
    "faqs": [...],
    "policies": [...],
    "articles": [...],
    "guides": [...]
  },
  "meta": {
    "sessionId": "uuid",
    "processingTimeMs": 45,
    "timestamp": "2026-05-12T10:30:00.000Z"
  }
}
```

### Search Response
```json
{
  "success": true,
  "data": {
    "faqs": [...],
    "articles": [...],
    "policies": [...],
    "counts": {
      "faqs": 5,
      "articles": 2,
      "policies": 1,
      "total": 8
    }
  }
}
```

## Knowledge Base Structure

### FAQ
```json
{
  "id": "faq_001",
  "question": "How do I book a trip on REZ?",
  "answer": "Booking on REZ is easy! Simply...",
  "category": "booking",
  "tags": ["booking", "how to", "tutorial"],
  "relatedFaqs": ["faq_002", "faq_003"],
  "viewCount": 15420,
  "helpfulCount": 14200,
  "lastUpdated": "2026-01-15"
}
```

### Policy
```json
{
  "id": "pol_001",
  "name": "Terms of Service",
  "description": "The complete terms governing your use of REZ services",
  "content": "Full policy content...",
  "category": "policies",
  "version": "2.5",
  "effectiveDate": "2026-01-01",
  "sections": [
    {
      "title": "Acceptance of Terms",
      "content": "By accessing or using REZ services..."
    }
  ]
}
```

### Guide
```json
{
  "id": "guide_001",
  "title": "Creating Your First REZ Account",
  "description": "Step-by-step guide to setting up your REZ account",
  "steps": [
    {
      "step": 1,
      "title": "Visit REZ",
      "description": "Go to rez.com and click Sign Up",
      "tips": ["Make sure you are on the official website"],
      "warnings": []
    }
  ],
  "category": "account",
  "difficulty": "beginner",
  "estimatedTime": "5 minutes",
  "tags": ["account", "signup", "getting started"]
}
```

## Content Management

The knowledge base includes:

- **15+ FAQs** covering booking, payments, cancellations, refunds, and more
- **4 Policies** including Terms of Service, Privacy Policy, Refund Policy, Cookie Policy
- **2 Articles** with travel tips and guides
- **3 How-To Guides** for common tasks

## License

Proprietary - REZ Commerce Platform
