# REZ Memory Engine - SPEC.md

**Version:** 1.0.0
**Port:** 4051
**Company:** REZ-Intelligence
**Category:** AI Memory

---

## Overview

Persistent AI memory service for intelligent copilots and AI assistants. Provides multi-tier memory storage with Redis caching and MongoDB persistence, supporting short-term, long-term, episodic, semantic, procedural, working, and identity memory types.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Memory Engine (4051)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Memory Tiers:                                                              │
│  ├── SHORT_TERM   → Session memory, 1 hour TTL                            │
│  ├── LONG_TERM    → Persistent, 90 day TTL                                │
│  ├── EPISODIC     → Events/experiences, 30 day TTL                       │
│  ├── SEMANTIC     → Facts/preferences, 30 day TTL                        │
│  ├── PROCEDURAL   → Workflows/how-tos, 30 day TTL                        │
│  ├── WORKING      → Active context, 30 min TTL                            │
│  └── IDENTITY     → User profile, 90 day TTL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Storage: Redis (cache) + MongoDB (persistence)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /api/memory/*                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Memory Types

| Type | TTL | Description |
|------|-----|-------------|
| `SHORT_TERM` | 1 hour | Current session data |
| `LONG_TERM` | 90 days | Persistent across sessions |
| `EPISODIC` | 30 days | Specific events/experiences |
| `SEMANTIC` | 30 days | Facts, preferences, knowledge |
| `PROCEDURAL` | 30 days | How-to, workflows |
| `WORKING` | 30 min | Active task context |
| `IDENTITY` | 90 days | User profile, preferences |

---

## API Endpoints

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |

### Memory Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/memory` | POST | Store new memory |
| `/api/memory/:memoryId` | GET | Retrieve memory |
| `/api/memory/:memoryId` | DELETE | Delete memory |
| `/api/memory/:memoryId/importance` | PATCH | Update importance |
| `/api/memory/user/:userId/search` | GET | Search memories |
| `/api/memory/user/:userId/context` | GET | Get AI context |
| `/api/memory/user/:userId/consolidate` | POST | Consolidate memories |

### Conversation Memory

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/memory/conversation` | POST | Store conversation turn |
| `/api/memory/conversation/:sessionId` | GET | Get conversation history |

### Entity Extraction

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/memory/extract` | POST | Extract and store entities |

### Statistics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/memory/stats` | GET | Memory statistics |

---

## Data Models

### Memory

```typescript
interface Memory {
  memoryId: string;
  userId: string;
  entityType: 'user' | 'merchant' | 'session' | 'conversation';
  entityId?: string;
  type: MemoryType;
  content: any;
  metadata: {
    source: 'ai' | 'user' | 'system' | 'action';
    action?: string;
    category?: string;
    tags?: string[];
    language?: string;
  };
  importance: {
    score: number;      // 0-1
    accessCount: number;
    lastAccessed?: Date;
    lastUpdated?: Date;
  };
  recall: {
    keywords?: string[];
    embeddings?: number[];
    entities?: Entity[];
  };
  privacy: {
    isPublic: boolean;
    isShared: boolean;
    consentGiven: boolean;
  };
  expiresAt?: Date;
  persistent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Entity {
  type: 'merchant' | 'item' | 'category' | 'location';
  id: string;
  name: string;
}
```

---

## API Examples

### Store Memory

**Request:**
```json
{
  "userId": "user_123",
  "type": "semantic",
  "content": {
    "preference": "spicy food",
    "cuisine": "Indian"
  },
  "metadata": {
    "source": "ai",
    "action": "preference_extraction"
  },
  "importance": 0.8,
  "keywords": ["food", "spicy", "indian"]
}
```

**Response:**
```json
{
  "success": true,
  "memoryId": "mem_abc123",
  "type": "semantic"
}
```

### Get AI Context

**Response:**
```json
{
  "success": true,
  "context": {
    "userId": "user_123",
    "timestamp": "2026-05-20T10:30:00Z",
    "memories": [
      {
        "type": "identity",
        "content": "User profile: { name: 'John' }",
        "importance": 0.9
      },
      {
        "type": "semantic",
        "content": "{ preference: 'spicy food' }",
        "importance": 0.8
      }
    ]
  }
}
```

### Store Conversation

**Request:**
```json
{
  "userId": "user_123",
  "sessionId": "sess_abc",
  "role": "user",
  "message": "I want to order biryani"
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "redis": "^4.6.0",
  "zod": "^3.22.4",
  "uuid": "^9.0.0",
  "winston": "^3.11.0"
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Service port (default: 4051) |
| `MONGODB_URI` | Yes | MongoDB connection |
| `REDIS_URL` | No | Redis connection |
| `INTERNAL_SERVICE_TOKEN` | Yes | Service authentication |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| AI Copilots | Read/Write | Memory storage |
| REZ-autonomous-agents | Read | Agent context |
| REZ-creative-engine | Read | Personalization context |

---

## Memory Consolidation

Automatic consolidation moves important short-term memories to long-term storage:

```javascript
// Memories with importance >= 0.7 are promoted
await memoryEngine.consolidate(userId);
```

---

## Status

- [x] Multi-tier memory storage
- [x] Redis caching
- [x] MongoDB persistence
- [x] Importance scoring
- [x] Semantic search (keywords)
- [x] Conversation memory
- [x] Entity extraction
- [x] Memory consolidation
- [x] Privacy controls
- [ ] Vector embeddings (future)
- [ ] Semantic search (embeddings)
- [ ] Cross-user shared memory
