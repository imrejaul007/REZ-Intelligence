# REZ ML Models - SPEC.md

**Version:** 1.0.0
**Type:** Library
**Company:** REZ-Intelligence
**Category:** ML Infrastructure

---

## Overview

Unified ML services library for the REZ platform. Provides common ML model interfaces, utilities, and event handling for machine learning workflows.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ ML Models Library                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Model Types:                                                             │
│  ├── Classification    → Category prediction                              │
│  ├── Regression       → Value prediction                                 │
│  ├── Ranking         → Relevance scoring                                │
│  └── NLP             → Text understanding                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Exports

| Export | Description |
|--------|-------------|
| `ClassificationModel` | Base classification interface |
| `RegressionModel` | Base regression interface |
| `RankingModel` | Base ranking interface |
| `NLPModel` | Base NLP interface |
| `ModelFactory` | Dynamic model instantiation |
| `ModelEvents` | Event emitter for model lifecycle |

---

## Usage

```typescript
import { ClassificationModel, ModelFactory } from 'rez-ml-models';

// Load model
const model = await ModelFactory.load('churn-predictor');

// Predict
const result = await model.predict({ userId, features });

// Events
model.on('predict', (input, output) => { ... });
```

---

## Dependencies

```json
{
  "events": "^3.3.0"
}
```

---

## Status

- [x] Model interfaces
- [x] Model factory
- [x] Event handling
- [ ] Model implementations
- [ ] Model registry
