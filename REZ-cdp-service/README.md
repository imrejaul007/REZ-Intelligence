# REZ CDP Service

Customer Data Platform (CDP) for unified customer profiles, identity resolution, segmentation, and activity tracking.

## Overview

REZ CDP Service provides a comprehensive customer data platform with the following capabilities:

- **Profile Management**: Create, update, and manage customer profiles with rich attribute schemas
- **Identity Resolution**: Cross-device identity matching and linking
- **Segmentation**: Create dynamic customer segments based on rules
- **Activity Tracking**: Track and analyze customer interactions
- **Profile Unification**: Merge duplicate profiles with rollback capability

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development
npm run dev

# Run in production
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Profile Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/profiles` | Create new profile |
| GET | `/profiles/:id` | Get profile by ID |
| PUT | `/profiles/:id` | Update profile |
| DELETE | `/profiles/:id` | Delete profile |
| POST | `/profiles/:id/attributes` | Update profile attributes |
| GET | `/profiles/search` | Search profiles |

### Identity Resolution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/identity/resolve` | Resolve identity |
| POST | `/identity/link` | Link identities |
| POST | `/identity/unmerge` | Unmerge identities |
| GET | `/identity/:id/graph` | Get identity graph |

### Activity Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/activities` | Track activity |
| POST | `/activities/batch` | Track batch activities |
| GET | `/activities/:profileId` | Get profile activities |
| GET | `/activities/:profileId/timeline` | Get activity timeline |

### Segmentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/segments` | Create segment |
| GET | `/segments` | List segments |
| GET | `/segments/:id` | Get segment |
| POST | `/segments/:id/evaluate` | Evaluate segment |
| GET | `/segments/:id/members` | Get segment members |
| DELETE | `/segments/:id` | Delete segment |

### Profile Unification

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/unify` | Merge profiles |
| POST | `/unify/preview` | Preview merge |
| POST | `/unify/revert/:mergeId` | Revert merge |
| GET | `/unify/history/:profileId` | Get merge history |

## Data Models

### Profile

```typescript
interface Profile {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  identityId: string;
  attributes: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
    location?: {
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
    company?: {
      name?: string;
      title?: string;
      industry?: string;
    };
    preferences?: {
      language?: string;
      timezone?: string;
      interests?: string[];
    };
  };
  consent: {
    marketing: boolean;
    analytics: boolean;
    thirdParty: boolean;
  };
  status: 'active' | 'inactive' | 'deleted' | 'merged';
  score?: number;
  lifetimeValue?: number;
  tags: string[];
  source: string;
}
```

### Segment Rule

```typescript
interface SegmentRule {
  id: string;
  field: string;  // Supports dot notation: 'attributes.location.country'
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'exists';
  value: unknown;
  fieldType: 'string' | 'number' | 'date' | 'boolean' | 'array';
}
```

### Activity

```typescript
interface Activity {
  id: string;
  profileId: string;
  type: 'page_view' | 'click' | 'purchase' | 'search' | 'login' | 'custom';
  channel: 'web' | 'mobile' | 'email' | 'api';
  timestamp: string;
  properties: Record<string, unknown>;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    location?: { country?: string; city?: string; };
  };
  revenue?: { amount: number; currency: string; };
}
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3005 | Server port |
| NODE_ENV | development | Environment |
| LOG_LEVEL | info | Logging level |

## Architecture

```
REZ CDP Service
├── Profile Manager      - Customer profile CRUD operations
├── Identity Resolver    - Cross-device identity linking
├── Segmentation Engine  - Dynamic segment evaluation
├── Activity Tracker     - Event tracking and timeline
└── Profile Unification - Merge and deduplication
```

## Deployment

Deploy to Render:

```bash
# Using Render CLI
render deploy

# Or connect GitHub repo in Render Dashboard
```

## License

Proprietary - REZ Intelligence
