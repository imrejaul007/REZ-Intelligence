# REZ-Intelligence Service Consolidation Plan

**Date:** May 19, 2026

---

## Duplicate Services Found

### 1. Attribution Services (4 → 1)

| Service | Port | Status |
|---------|------|--------|
| `REZ-attribution-system` | 4090 | KEEP |
| `REZ-unified-attribution` | 4061 | MERGE → KEEP PORT 4061 |
| `REZ-ltv-attribution` | - | MERGE |
| `REZ-dooh-attribution` | - | MERGE |

**Action:** Keep `REZ-unified-attribution` as canonical, merge others.

### 2. User Profile/Identity (4 → 1)

| Service | Port | Status |
|---------|------|--------|
| `REZ-identity-graph` | 4050 | KEEP |
| `REZ-consumer-graph` | 4051 | MERGE |
| `REZ-universal-user-graph` | 4055 | MERGE |
| `REZ-unified-identity` | 4060 | MERGE → KEEP PORT 4060 |

**Action:** Keep `REZ-unified-identity` as canonical.

### 3. Recommendations (3 → 1)

| Service | Port | Status |
|---------|------|--------|
| `REZ-recommendation-engine` | 4065 | MERGE |
| `REZ-unified-recommendations` | 4090 | MERGE |
| `REZ-personalization` | - | MERGE |

**Action:** Create new canonical `REZ-recommendations-service`.

### 4. Loyalty (4 → 1)

| Service | Port | Status |
|---------|------|--------|
| `REZ-loyalty-intelligence` | 4041 | MERGE |
| `REZ-merchant-loyalty` | - | MERGE |
| `REZ-karma-loyalty-bridge` | - | MERGE |
| `REZ-cross-company-loyalty` | 4151 | KEEP |

**Action:** Keep `REZ-cross-company-loyalty` as canonical.

### 5. Support (4 → 1)

| Service | Port | Status |
|---------|------|--------|
| `REZ-care-service` | 4055 | KEEP |
| `REZ-support-copilot` | 4033 | MERGE |
| `REZ-support-dashboard` | - | MERGE |
| `REZ-care-command-center` | - | MERGE |

**Action:** Keep `REZ-care-service` as canonical.

---

## Consolidation Steps

### For Each Duplicate Cluster:

```
1. Identify canonical service (best maintained, most features)
2. Create migration plan
3. Export data from duplicates
4. Import data to canonical
5. Update consumers to use canonical
6. Deprecate duplicates
7. Archive duplicates
```

---

## Port Reassignment Plan

| Old Port | Old Service | New Port | Status |
|----------|------------|----------|--------|
| 4050 | REZ-identity-graph | 4050 | Keep |
| 4051 | REZ-consumer-graph | DEPRECATE | Archive |
| 4055 | REZ-universal-user-graph | DEPRECATE | Archive |
| 4060 | REZ-unified-identity | 4060 | Keep |
| 4090 | REZ-attribution-system | DEPRECATE | Archive |
| 4061 | REZ-unified-attribution | 4061 | Keep |

---

## Timeline

### Week 1-2: Attribution
- [ ] Merge attribution services
- [ ] Test unified attribution
- [ ] Update consumers

### Week 3-4: Identity
- [ ] Merge identity services
- [ ] Test unified identity
- [ ] Update consumers

### Week 5-6: Recommendations
- [ ] Create unified recommendations
- [ ] Migrate existing data
- [ ] Test and deploy

### Week 7-8: Loyalty & Support
- [ ] Merge loyalty services
- [ ] Merge support services
- [ ] Full integration testing

---

## Migration Commands

```bash
# 1. Export data from source service
cd REZ-original-service
npm run export-data > data-export.json

# 2. Import to canonical service
cd REZ-canonical-service
npm run import-data --file=data-export.json

# 3. Update consumers
# Update all services that use the old service to use the new one

# 4. Deprecate old service
# Mark as deprecated in PORT-REGISTRY.md

# 5. Archive old service
mv REZ-original-service ../Archive/
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Services consolidated | 15 → 4 |
| Port conflicts | 12 → 0 |
| Test coverage | 0% → 50% |
| Event Bus connections | 3 → 50+ |

---

## Status

- [x] Identify duplicates
- [ ] Create consolidation plan
- [ ] Execute consolidation
- [ ] Verify no breaking changes
- [ ] Update documentation
