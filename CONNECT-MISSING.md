# REZ Intelligence - Services Needing Integrations

**Date:** May 19, 2026
**Total Services:** 188
**Connected:** 9 (5%)
**Not Connected:** 179 (95%)

---

## PRIORITY SERVICES TO CONNECT

### P0 - Critical (Connect This Week)

| Service | Purpose | Integration Needed |
|---------|---------|------------------|
| `REZ-autonomous-agents` | 8 AI agents | Intent, Profile, Analytics |
| `REZ-predictive-engine` | Churn, LTV | Profile, Wallet, Notifications |
| `REZ-identity-graph` | Identity resolution | Profile, Auth |
| `REZ-signal-aggregator` | Signal collection | All services |
| `REZ-realtime-segments` | User segmentation | All consumer services |

### P1 - High Priority (Connect This Month)

| Service | Purpose | Integration Needed |
|---------|---------|------------------|
| `REZ-creative-engine` | Ad creative generation | Attribution, Segments |
| `REZ-targeting-engine` | Ad targeting | Segments, Identity |
| `REZ-ab-testing` | A/B testing | Analytics |
| `REZ-care-service` | Customer support | Profile, Notifications |

### P2 - Medium Priority (Connect This Quarter)

| Service | Integration Needed |
|---------|------------------|
| All 179 services | RABTUL Analytics |

---

## QUICK CONNECT

### Priority 1: Add to these services NOW

```bash
# Create integrations for critical services
mkdir -p REZ-Intelligence/REZ-autonomous-agents/src/integrations
mkdir -p REZ-Intelligence/REZ-predictive-engine/src/integrations
mkdir -p REZ-Intelligence/REZ-identity-graph/src/integrations
mkdir -p REZ-Intelligence/REZ-signal-aggregator/src/integrations
mkdir -p REZ-Intelligence/REZ-realtime-segments/src/integrations
```

### Priority 2: Add to all remaining services

```bash
# Automated script to add integrations to all services
for dir in REZ-Intelligence/*/src; do
  if [ ! -d "$dir/integrations" ]; then
    mkdir -p "$dir/integrations"
  fi
done
```

---

## INTEGRATION TEMPLATE

```typescript
// REZ-Intelligence/[service]/src/integrations/rabtulPlatform.ts
export const [service]Integrations = {
  intent: () => {/* Use intent predictor */},
  profile: () => {/* Use unified profile */},
  analytics: () => {/* Track events */},
};
```

---

## RECOMMENDED PRIORITY

1. REZ-autonomous-agents
2. REZ-predictive-engine
3. REZ-identity-graph
4. REZ-signal-aggregator
5. REZ-realtime-segments
6. REZ-creative-engine
7. REZ-targeting-engine
8. REZ-ab-testing
9. REZ-care-service
10. All remaining 170 services
