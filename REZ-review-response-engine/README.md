# REZ Review Response Engine

AI-powered review response generator with sentiment analysis and escalation.

## Features

- **Review Ingestion** - Import from Google, Facebook, REZ, Zomato, Swiggy
- **Sentiment Analysis** - Detect positive, negative, neutral with aspect extraction
- **AI Response Generation** - Personalized responses using templates
- **Escalation Detection** - Auto-flag critical reviews for human attention
- **Multi-Platform** - Support for all major review platforms

## API Endpoints

### Ingest Reviews
```bash
POST /api/reviews/ingest
{
  "merchantId": "merchant_123",
  "platform": "google",
  "rating": 4,
  "text": "Great food and service!",
  "customerName": "John D."
}
```

### Generate Response
```bash
POST /api/reviews/:id/respond
```

### Approve & Post
```bash
POST /api/reviews/:id/approve
{
  "responseText": "Thank you for your kind words!",
  "approvedBy": "manager_123"
}
```

## Port

Port: **4296**
