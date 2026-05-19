# REZ-Intelligence Port Conflicts - FIX REQUIRED

**Date:** May 19, 2026

---

## Port Conflicts Found

| Port | Services | Conflict |
|------|----------|----------|
| **3005** | rez-ml-feature-store, rez-salon-expert | CONFLICT |
| **3007** | rez-fraud-agent, rez-fraud-detection-service | CONFLICT |
| **4100** | Multiple services | NEEDS REVIEW |
| **4110** | Multiple services | NEEDS REVIEW |

---

## Fix Required

### Port 3005 Conflict

| Service | Current Port | Suggested Port |
|---------|-------------|---------------|
| rez-ml-feature-store | 3005 | 4180 |
| rez-salon-expert | 3005 | 3005 is correct for salon |

**Action:** Change rez-ml-feature-store to port **4180**

### Port 3007 Conflict

| Service | Current Port | Suggested Port |
|---------|-------------|---------------|
| rez-fraud-agent | 3007 | 4181 |
| rez-fraud-detection-service | 3007 | 4182 |

**Action:** Change rez-fraud-agent to port **4181**
**Action:** Change rez-fraud-detection-service to port **4182**

---

## Services to Update

### rez-ml-feature-store

```json
// package.json
{
  "scripts": {
    "start": "PORT=4180 node src/index.js"
  }
}
```

### rez-fraud-agent

```json
// package.json
{
  "scripts": {
    "start": "PORT=4181 node src/index.js"
  }
}
```

### rez-fraud-detection-service

```json
// package.json
{
  "scripts": {
    "start": "PORT=4182 node src/index.js"
  }
}
```

---

## Verify After Fix

```bash
# Check for remaining conflicts
grep -E "^\|.*\| [0-9]{4}" PORT-REGISTRY.md | \
  awk -F'|' '{print $2}' | \
  sort | uniq -c | sort -rn | grep -v "^ *1"
```

Expected result: **No output** (no conflicts)

---

## Status

- [ ] Fix rez-ml-feature-store → 4180
- [ ] Fix rez-fraud-agent → 4181
- [ ] Fix rez-fraud-detection-service → 4182
- [ ] Update PORT-REGISTRY.md
- [ ] Verify no remaining conflicts
