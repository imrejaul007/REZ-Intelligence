# REZ Feature Flags - SPEC.md

**Version:** 1.0.0
**Port:** 4030
**Company:** REZ-Intelligence
**Category:** Configuration Management

---

## Overview

Centralized feature flag management service with per-tenant override support. Enables gradual rollouts, A/B testing, and tenant-specific feature configurations without code deployments.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Feature Flags (4030)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                             │
│  ├── Centralized Flags   → Single source for all features                 │
│  ├── Tenant Overrides   → Per-tenant flag customization                  │
│  ├── Rollout Percentage → Gradual feature rollout                         │
│  ├── Environment Support → Production/staging/dev flags                 │
│  └── Default Fallback   → Flags with sensible defaults                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes: /flags/*, /flags/tenant/*                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Default Feature Flags

| Flag Key | Default | Description |
|----------|---------|-------------|
| `learning_enabled` | false | Enable machine learning features |
| `adaptive_enabled` | false | Enable adaptive decisions |
| `personalization_enabled` | true | Personalized content delivery |
| `recommendations_enabled` | true | Product recommendations |
| `intent_prediction_enabled` | true | Real-time intent prediction |
| `ads_enabled` | false | Show targeted advertisements |
| `push_enabled` | true | Push notifications |
| `email_enabled` | true | Email notifications |
| `auto_execute_safe` | true | Auto-execute SAFE decisions |
| `require_approval_risky` | true | Require approval for RISKY decisions |
| `rollback_enabled` | true | Auto-rollback on failure |

---

## API Endpoints

### Global Flags

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/flags` | GET | List all feature flags |
| `/flags/:key` | GET | Get specific flag |
| `/flags/:key` | POST | Create/update flag |
| `/flags/:key/enable` | POST | Enable flag |
| `/flags/:key/disable` | POST | Disable flag |
| `/initialize` | POST | Initialize default flags |

### Tenant Flags

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/flags/tenant/:tenantId` | GET | Get all flags for tenant (with overrides) |
| `/flags/tenant/:tenantId/:flagKey` | GET | Get specific flag for tenant |
| `/flags/tenant/:tenantId/:flagKey` | POST | Set tenant override |
| `/flags/tenant/:tenantId/:flagKey` | DELETE | Remove tenant override |
| `/flags/tenant/:tenantId/overrides` | GET | List all tenant overrides |
| `/flags/tenant/:tenantId/bulk` | POST | Bulk set tenant overrides |

---

## Flag Resolution Priority

```
1. Tenant Override (highest priority)
       ↓
2. Database Flag
       ↓
3. Default Flag (lowest priority)
```

---

## API Examples

### Get All Flags

**Response:**
```json
{
  "flags": {
    "learning_enabled": {
      "enabled": false,
      "description": "Enable machine learning",
      "rollout": 100
    },
    "personalization_enabled": {
      "enabled": true,
      "description": "Personalized content",
      "rollout": 100
    }
  }
}
```

### Get Flag for Tenant

**Response:**
```json
{
  "tenantId": "tenant_abc",
  "flagKey": "ads_enabled",
  "enabled": true,
  "hasOverride": true,
  "source": "tenant_override"
}
```

### Set Tenant Override

**Request:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "tenantId": "tenant_abc",
  "flagKey": "ads_enabled",
  "enabled": true
}
```

### Bulk Set Tenant Overrides

**Request:**
```json
{
  "overrides": {
    "ads_enabled": true,
    "push_enabled": false,
    "email_enabled": true
  }
}
```

---

## Data Models

### FeatureFlag

```typescript
interface FeatureFlag {
  flag_key: string;
  enabled: boolean;
  description?: string;
  rollout_percentage: number;
  environment: string;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
```

### TenantOverride

```typescript
interface TenantOverride {
  tenantId: string;
  flagKey: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}
```

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.0",
  "cors": "^2.8.5",
  "helmet": "^8.0.0",
  "compression": "^1.8.1",
  "dotenv": "^16.3.1"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4030 | Service port |
| `MONGODB_URI` | mongodb://localhost:27017/rez-feature-flags | MongoDB URI |

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| All REZ Services | Read | Feature flag checks |
| RABTUL Services | Read | Platform feature flags |

---

## Use Cases

### Gradual Rollout

```javascript
// 10% rollout
await FeatureFlag.findOneAndUpdate(
  { flag_key: 'new_checkout' },
  { rollout_percentage: 10 }
);
```

### Tenant-Specific Features

```javascript
// Enable beta features for premium tenant
await setTenantOverride('tenant_premium', 'new_ui', true);
```

### Emergency Disable

```javascript
// Disable feature immediately
await FeatureFlag.findOneAndUpdate(
  { flag_key: 'payment_processing' },
  { enabled: false }
);
```

---

## Status

- [x] Centralized flag storage
- [x] Tenant override support
- [x] Bulk operations
- [x] Default flag initialization
- [x] Rollout percentage
- [x] Environment support
- [ ] Real-time flag updates (WebSocket)
- [ ] Flag change audit log
- [ ] A/B testing integration
- [ ] Gradual rollout automation
