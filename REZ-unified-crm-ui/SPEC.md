# REZ Unified CRM UI - SPEC.md

**Version:** 1.0.0
**Port:** 3000 (Next.js)
**Company:** REZ-Intelligence
**Category:** Dashboard

---

## Overview

Next.js-based CRM dashboard providing unified customer relationship management. Features advanced customer 360 views, engagement tracking, and actionable insights.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      REZ Unified CRM UI                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend:                                                                 │
│  ├── Next.js 14 (App Router)                                              │
│  ├── React 18 with Server Components                                      │
│  ├── Tailwind CSS + Radix UI                                              │
│  └── Recharts for data visualization                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Features:                                                                 │
│  ├── Customer 360 View                                                     │
│  ├── Engagement Analytics                                                  │
│  ├── Segment Management                                                    │
│  └── Campaign Tracking                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## UI Components

### Navigation
- Sidebar navigation
- Tab-based views
- Tooltip overlays

### Data Visualization
| Chart | Library | Purpose |
|-------|---------|---------|
| Line charts | Recharts | Trends over time |
| Bar charts | Recharts | Comparative analysis |
| Pie charts | Recharts | Distribution views |

### Interactive Elements
| Component | Library | Purpose |
|-----------|---------|---------|
| Dialogs | Radix UI | Modals |
| Dropdowns | Radix UI | Select menus |
| Tabs | Radix UI | View switching |
| Select | Radix UI | Filter options |

---

## Dependencies

### Production
```json
{
  "next": "14.2.0",
  "react": "18.2.0",
  "@radix-ui/react-dialog": "^1.0.5",
  "@radix-ui/react-dropdown-menu": "^2.0.6",
  "@radix-ui/react-select": "^2.0.0",
  "@radix-ui/react-tabs": "^1.0.4",
  "@radix-ui/react-tooltip": "^1.0.7",
  "recharts": "^2.12.0",
  "lucide-react": "^0.344.0",
  "date-fns": "^3.3.0",
  "axios": "^1.6.0"
}
```

### Development
```json
{
  "typescript": "^5.3.0",
  "tailwindcss": "^3.4.0",
  "postcss": "^8.4.35"
}
```

---

## API Integration

The CRM UI connects to backend services:

| Service | Endpoint Pattern |
|---------|------------------|
| REZ Unified Profile | `/api/profiles/*` |
| REZ Signal Aggregator | `/api/signals/*` |
| REZ Predictive Engine | `/api/predictions/*` |
| REZ Care Service | `/api/support/*` |

---

## Status

- [x] Next.js foundation
- [x] CRM dashboard layout
- [x] Data visualization
- [x] API integration layer
- [ ] Full feature completion
