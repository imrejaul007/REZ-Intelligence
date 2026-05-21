# REZ Education Expert - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** AI Expert

---

## Overview

Purpose-built AI agent for education domain. Specialized for courses, learning paths, certifications, and academic assistance. Provides personalized learning recommendations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REZ Education Expert                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                            │
│  ├── Course Discovery      → Find relevant courses                        │
│  ├── Learning Paths        → Skill progression plans                       │
│  ├── Certification Help    → Exam prep, certifications                    │
│  └── Academic Assistance   → Tutoring, homework help                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Education
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/education/search` | Search courses |
| POST | `/api/education/path` | Create learning path |
| POST | `/api/education/recommend` | Get recommendations |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "redis": "^4.6.12",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "compression": "^1.7.4"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| CorpPerks TalentAI | Read | Learning content |
| REZ Intent Graph | Read | Education intent |
| REZ User Agents | Write | Learning recommendations |

---

## Status

- [x] Service foundation
- [x] Course discovery
- [x] Learning paths
- [ ] Certification help
- [ ] Academic assistance
