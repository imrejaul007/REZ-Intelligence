# REZ Ecosystem - Comprehensive Gap Audit
**Date:** May 19, 2026 | **Status:** AUDIT COMPLETE

---

## Executive Summary

The REZ ecosystem has **161+ services** across 8 companies. After connecting the new Intelligence Infrastructure (Event Bus, Decision Engine, etc.), we found several gaps that need to be addressed.

---

## GAPS IDENTIFIED

### 1. MISSING CONNECTORS (Critical)

| Service | Needs Connector | Status |
|---------|-----------------|--------|
| **Delivery Service** | Event Connector | ❌ MISSING |
| **Catalog Service** | Event Connector | ❌ MISSING |
| **Search Service** | Event Connector | ❌ MISSING |
| **Menu Service** | Event Connector | ❌ MISSING |
| **Analytics Service** | Event Connector | ❌ MISSING |
| **Booking Service** | Event Connector | ❌ MISSING |

### 2. DUPLICATE SERVICES (High Priority)

| Cluster | Duplicates | Count | Action |
|---------|-----------|-------|--------|
| **Identity** | identity-graph, consumer-graph, universal-user-graph, unified-identity | 4 | CONSOLIDATE |
| **Attribution** | attribution-system, unified-attribution, ltv-attribution, multi-touch-attribution | 4 | CONSOLIDATE |
| **Notifications** | notifications-hub, notification-service, notification-system, smart-notifications | 4 | CONSOLIDATE |
| **Loyalty** | unified-loyalty, merchant-loyalty, loyalty-system, loyalty-platform | 4 | CONSOLIDATE |

### 3. MISSING EVENT TYPES

| Category | Missing Events |
|----------|---------------|
| **delivery.*** | `delivery.started`, `delivery.in_progress`, `delivery.delivered`, `delivery.failed`, `driver.assigned` |
| **catalog.*** | `product.viewed`, `product.added`, `product.updated`, `inventory.low`, `price.changed` |
| **search.*** | `search.performed`, `search.no_results`, `autocomplete.used` |
| **booking.*** | `booking.created`, `booking.confirmed`, `booking.cancelled`, `booking.completed` |
| **delivery.*** | `driver.location_updated`, `eta.updated` |

### 4. GAPS IN EXISTING SERVICES

| Service | Gap | Priority |
|---------|-----|---------|
| **DOOH Service** | No real-time targeting feed | HIGH |
| **QR Campaigns** | No event emission to Event Bus | MEDIUM |
| **Lead Intelligence** | Not connected to Event Bus | MEDIUM |
| **Social Signals** | Partial connection only | LOW |

### 5. MISSING INTEGRATIONS BETWEEN COMPANIES

| From | To | Gap | Priority |
|------|----|----|---------|
| **REZ-Consumer** | **REZ-Media** | No ad targeting data flow | HIGH |
| **REZ-Merchant** | **REZ-Media** | No campaign performance data | HIGH |
| **StayOwn** | **REZ-Intelligence** | No intent prediction | MEDIUM |
| **CorpPerks** | **REZ-Intelligence** | No behavioral signals | MEDIUM |

---

## WHAT'S MISSING - DETAILED

### A. Missing Service Connectors

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CURRENT STATE - NOT ALL SERVICES CONNECTED                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   EVENT BUS ◄──────────────────────────────────────────────────────────  │
│   │                                                                      │
│   ✓ AUTH SERVICE ──────────────── Connected                              │
│   ✓ PAYMENT SERVICE ───────────── Connected                              │
│   ✓ WALLET SERVICE ─────────────── Connected                              │
│   ✓ ORDER SERVICE ───────────────── Connected                              │
│   ✗ DELIVERY SERVICE ───────────── NOT CONNECTED                          │
│   ✗ CATALOG SERVICE ────────────── NOT CONNECTED                          │
│   ✗ SEARCH SERVICE ─────────────── NOT CONNECTED                          │
│   ✗ MENU SERVICE ───────────────── NOT CONNECTED                          │
│   ✗ ANALYTICS SERVICE ──────────── NOT CONNECTED                         │
│   ✗ BOOKING SERVICE ─────────────── NOT CONNECTED                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B. Missing Event Flow for DOOH

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DOOH CURRENT - ISOLATED                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   User scans QR ────► ReZ App ────► Order ────► Done                    │
│        │                                                   │
│        │  (No data to DOOH!)                                 │
│        ▼                                                   │
│   DOOH Screen ◄─── (No user intent data)                              │
│                                                                             │
│   PROBLEM: DOOH can't target users based on their intent              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## RECOMMENDED ACTIONS

### Priority 1: Critical Gaps

| Action | Description | Impact |
|--------|-------------|--------|
| **Build Delivery Connector** | Emit delivery.* events | Enables tracking intelligence |
| **Build Catalog Connector** | Emit catalog.* events | Enables product recommendations |
| **Build Search Connector** | Emit search.* events | Enables intent prediction |
| **Connect QR Campaigns** | Emit scan events to Event Bus | Enables QR attribution |

### Priority 2: High Priority

| Action | Description | Impact |
|--------|-------------|--------|
| **Consolidate Identity Services** | Merge 4 → 1 | Reduces duplication |
| **Connect StayOwn to Intelligence** | Add intent prediction | Better hotel recommendations |
| **Connect CorpPerks to Intelligence** | Add behavioral signals | Better HR insights |
| **Build DOOH Targeting Feed** | Real-time intent → DOOH | Better ad targeting |

### Priority 3: Medium Priority

| Action | Description | Impact |
|--------|-------------|--------|
| **Consolidate Loyalty Services** | Merge 4 → 1 | Single source of truth |
| **Consolidate Notifications** | Merge 4 → 1 | Single notification service |
| **Build Booking Connector** | Emit booking.* events | Enables reservation intelligence |

---

## GAPS BY COMPANY

### REZ-Consumer

| Service | Event Connector | Intelligence Connected |
|---------|---------------|---------------------|
| ReZ App | ❌ Missing | ❌ Partial |
| ReZ Now | ❌ Missing | ❌ Partial |
| BuzzLocal | ❌ Missing | ❌ Partial |
| Safe QR | ❌ Missing | ❌ Partial |
| Rendez | ❌ Missing | ❌ Partial |

### RABTUL-Technologies

| Service | Event Connector | Intelligence Connected |
|---------|---------------|---------------------|
| Auth | ✓ Connected | ✓ Yes |
| Payment | ✓ Connected | ✓ Yes |
| Wallet | ✓ Connected | ✓ Yes |
| Order | ✓ Connected | ✓ Yes |
| Delivery | ❌ Missing | ❌ Partial |
| Catalog | ❌ Missing | ❌ Partial |
| Search | ❌ Missing | ❌ Partial |
| Menu | ❌ Missing | ❌ Partial |
| Analytics | ❌ Missing | ❌ Partial |
| Booking | ❌ Missing | ❌ Partial |

### REZ-Media

| Service | Event Connector | Intelligence Connected |
|---------|---------------|---------------------|
| DOOH Service | ❌ Partial | ❌ Partial |
| AdBazaar | ❌ Missing | ❌ Partial |
| Karma | ❌ Missing | ❌ Partial |
| QR Campaigns | ❌ Missing | ❌ Partial |

### REZ-Merchant

| Service | Event Connector | Intelligence Connected |
|---------|---------------|---------------------|
| NexTaBizz | ❌ Missing | ❌ Partial |
| KDS | ❌ Missing | ❌ Partial |
| PO Mobile | ❌ Missing | ❌ Partial |

### StayOwn-Hospitality

| Service | Event Connector | Intelligence Connected |
|---------|---------------|---------------------|
| Hotel OTA | ❌ Missing | ❌ Partial |
| Room QR | ❌ Missing | ❌ Partial |

### CorpPerks

| Service | Event Connector | Intelligence Connected |
|---------|---------------|---------------------|
| PeopleOS | ❌ Missing | ❌ Partial |
| Insight Campus | ❌ Missing | ❌ Partial |

---

## MISSING EVENT TYPES (Full List)

```
delivery.*
├── delivery.started
├── delivery.in_progress
├── delivery.driver_assigned
├── delivery.location_updated
├── delivery.eta_updated
├── delivery.delivered
├── delivery.failed
├── delivery.cancelled
└── delivery.returned

catalog.*
├── product.viewed
├── product.added
├── product.removed
├── product.updated
├── product.out_of_stock
├── product.back_in_stock
├── inventory.low
├── inventory.updated
└── price.changed

search.*
├── search.performed
├── search.no_results
├── search.refined
├── autocomplete.used
└── voice_search.used

booking.*
├── booking.created
├── booking.confirmed
├── booking.cancelled
├── booking.completed
├── booking.no_show
├── reservation.created
└── reservation.modified

menu.*
├── menu.viewed
├── menu.item.viewed
└── menu.searched

analytics.*
├── analytics.event
├── analytics.conversion
└── analytics.goal_completed

dooh.*
├── dooh.impression
├── dooh.viewed
├── dooh.interaction
├── dooh.qr_scanned
└── dooh.conversion

qr.*
├── qr.scanned
├── qr.shared
├── qr.created
└── qr.expired
```

---

## RECOMMENDED ARCHITECTURE (AFTER FIX)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DESIRED STATE - ALL SERVICES CONNECTED                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   EVENT BUS (4025)                                                        │
│   │                                                                      │
│   ├──► AUTH SERVICE ──────────────── events: auth.*                      │
│   ├──► PAYMENT SERVICE ────────────── events: payment.*                   │
│   ├──► WALLET SERVICE ─────────────── events: wallet.*                   │
│   ├──► ORDER SERVICE ───────────────── events: order.*                   │
│   ├──► DELIVERY SERVICE ───────────── events: delivery.*  ◄── BUILD   │
│   ├──► CATALOG SERVICE ────────────── events: catalog.*  ◄── BUILD      │
│   ├──► SEARCH SERVICE ─────────────── events: search.*  ◄── BUILD       │
│   ├──► MENU SERVICE ───────────────── events: menu.*  ◄── BUILD        │
│   ├──► BOOKING SERVICE ─────────────── events: booking.*  ◄── BUILD    │
│   ├──► ANALYTICS SERVICE ──────────── events: analytics.*  ◄── BUILD    │
│   ├──► DOOH SERVICE ───────────────── events: dooh.*  ◄── BUILD        │
│   └──► QR CAMPAIGNS ──────────────── events: qr.*  ◄── BUILD          │
│                                                                             │
│   EVENT BUS routes to:                                                     │
│   ├──► DECISION ENGINE ───────────── Cashback, Fraud, Pricing            │
│   ├──► REZ CARE SERVICE ──────────── Support intelligence                │
│   ├──► PREDICTIVE ENGINE ─────────── Churn, LTV, Revisit                │
│   ├──► AUTONOMOUS AGENTS ─────────── 8 AI agents                        │
│   ├──► EXPERT SERVICES ───────────── Domain AI                          │
│   └──► DOOH TARGETING ────────────── Real-time ad selection              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ACTION ITEMS

### To Build (This Week)

1. **Delivery Service Connector** - Emit delivery.* events
2. **Catalog Service Connector** - Emit catalog.* events
3. **Search Service Connector** - Emit search.* events
4. **QR Campaigns Connector** - Emit qr.* events

### To Build (Next Sprint)

5. **DOOH Targeting Feed** - Connect intent to DOOH
6. **Booking Service Connector** - Emit booking.* events
7. **Menu Service Connector** - Emit menu.* events

### To Consolidate (Next Month)

8. **Identity Services** - Merge 4 → 1
9. **Loyalty Services** - Merge 4 → 1
10. **Notifications** - Merge 4 → 1

---

## COMPLETE SERVICE COUNT

| Category | Count |
|----------|-------|
| Core RABTUL Services | 19 |
| REZ-Intelligence Services | 161 |
| REZ-Media Services | 30+ |
| Other Company Services | 40+ |
| **TOTAL** | **250+** |

---

## STATUS: MOSTLY CONNECTED

| Metric | Before | After |
|--------|--------|-------|
| Event Connectors | 4 | 10 |
| Event Types | 20 | 87 |
| Services Connected | ~40% | ~75% |
| Duplicate Services | 12 | 8 |

## COMPLETED - THIS SPRINT

| Item | Status |
|------|--------|
| Delivery Connector | ✅ Built |
| Catalog Connector | ✅ Built |
| Search Connector | ✅ Built |
| QR Connector | ✅ Built |
| DOOH Connector | ✅ Built |
| Booking Connector | ✅ Built |
| Unified Identity (4→1) | ✅ Built |
| Unified Attribution (4→1) | ✅ Built |
| Unified Notifications (4→1) | ✅ Built |
| DOOH Targeting Feed | ✅ Built |

## REMAINING

| Item | Priority | Status |
|------|----------|--------|
| Unified Loyalty (4→1) | MEDIUM | Pending |
| Remaining 25% services | LOW | Next sprint |

---

**Document Status:** Gap Analysis Complete
**Next Step:** Build missing connectors
