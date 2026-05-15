# REZ Intelligence Signal Audit

**Date:** May 15, 2026
**Purpose:** Gap Analysis for Signal Collection Infrastructure

---

## Executive Summary

| Category | Status | Maturity |
|----------|--------|----------|
| **Merchant Intelligence** | PARTIAL | 60% |
| **Location Intelligence** | MISSING | 0% |
| **Social Signals** | PARTIAL | 40% |
| **Behavioral Psychology** | MISSING | 0% |
| **Unified Event Bus** | PARTIAL | 50% |
| **Attribution Layer** | PARTIAL | 60% |
| **Identity Resolution** | YES | 70% |
| **Ad Network** | PARTIAL | 50% |

---

## 1. MERCHANT INTELLIGENCE

### What You HAVE

| Signal | Service | Data |
|--------|---------|------|
| **Customer Segments** | REZ-rfm-service | RFM analysis (Recency, Frequency, Monetary) |
| | REZ-rfm-plus | Advanced segmentation |
| | REZ-cdp-service | Unified customer profiles |
| | REZ-merchant-360 | Merchant dashboard |
| **Predictive Signals** | REZ-reorder-engine | Churn prediction, revisit likelihood |
| | rez-priority-engine | Priority scoring |
| **Dashboard** | REZ-merchant-360 | Customer view |

### What You NEED

| Signal | Gap | Priority |
|--------|-----|----------|
| High spenders | PARTIAL - RFM covers this | HIGH |
| Likely repeat users | YES - reorder-engine predicts | HIGH |
| Discount hunters | NO - no discount sensitivity | HIGH |
| VIP customers | PARTIAL - RFM tier | HIGH |
| Dormant customers | YES - LAPSED segment | HIGH |
| Competitor switchers | NO | MEDIUM |
| Family users | NO | MEDIUM |
| Weekend spenders | PARTIAL - date analysis exists | HIGH |
| Office crowd | NO | MEDIUM |
| Luxury seekers | NO | HIGH |

### Verdict: **60% Coverage**

---

## 2. LOCATION INTELLIGENCE

### What You HAVE

| Signal | Service | Data |
|--------|---------|------|
| **QR Scans** | REZ-flywheel-mvp | Location of scan |
| | QR Attribution | Track QR → conversion |
| | adbazaar | QR scan tracking |
| **Venue Visits** | rez-restaurant-crm-service | Visit timestamps |
| **Delivery Zones** | rez-delivery-service | Area coverage |

### What You NEED

| Signal | Gap | Priority |
|--------|-----|----------|
| Frequently visits premium malls | **MISSING** | HIGH |
| Office commuter | **MISSING** | HIGH |
| College student cluster | **MISSING** | HIGH |
| Airport traveler | **MISSING** | MEDIUM |
| High footfall zone visitor | **MISSING** | HIGH |
| Geofence data | **MISSING** | HIGH |
| Dwell time | **MISSING** | HIGH |
| Cross-location tracking | **MISSING** | HIGH |

### Verdict: **0% Coverage** ⚠️

---

## 3. SOCIAL SIGNALS

### What You HAVE

| Signal | Service | Data |
|--------|---------|------|
| **Referrals** | REZ-referral-graph | Referral tracking |
| **Offer Sharing** | PARTIAL | No explicit sharing data |
| **Engagement** | REZ-engagement-platform | Campaign engagement |

### What You NEED

| Signal | Gap | Priority |
|--------|-----|----------|
| Shares offers often | **MISSING** | HIGH |
| Referral likelihood | PARTIAL - referral exists | MEDIUM |
| Influencer potential | **MISSING** | HIGH |
| Community organizer | **MISSING** | MEDIUM |
| Social reach | **MISSING** | MEDIUM |

### Verdict: **40% Coverage**

---

## 4. BEHAVIORAL PSYCHOLOGY

### What You HAVE

| Signal | Service | Data |
|--------|---------|------|
| **Payment Method** | rez-payment-service | UPI/Card/Cash |
| **Order Value** | rez-order-service | Transaction amounts |
| **Timing** | taste-profile | Peak hours |

### What You NEED

| Signal | Gap | Priority |
|--------|-----|----------|
| Cashback motivated | **MISSING** | HIGH |
| Convenience motivated | **MISSING** | HIGH |
| Luxury motivated | **MISSING** | HIGH |
| Urgent buyer | **MISSING** | MEDIUM |
| Planner vs impulse | **MISSING** | HIGH |
| Price sensitive | **MISSING** | HIGH |
| Quality over price | **MISSING** | MEDIUM |

### Verdict: **0% Coverage** ⚠️

---

## 5. UNIFIED EVENT BUS

### What You HAVE

| Event | Tracked | Service |
|-------|---------|---------|
| `scan_qr` | YES | flywheel-mvp, QR attribution |
| `open_offer` | PARTIAL | engagement-platform |
| `booking_started` | YES | booking service |
| `payment_completed` | YES | payment-service |
| `cashback_redeemed` | YES | cashback-service |
| `repeat_visit` | YES | reorder-engine |
| `ad_clicked` | YES | targeting-engine |
| `merchant_viewed` | PARTIAL | analytics |
| `order_placed` | YES | order-service |
| `notification_sent` | YES | notification-router |

### What You NEED

| Event | Gap | Priority |
|-------|-----|----------|
| `offer_shared` | **MISSING** | HIGH |
| `profile_updated` | **MISSING** | MEDIUM |
| `location_visited` | **MISSING** | HIGH |
| `referral_clicked` | **MISSING** | HIGH |
| `search_performed` | **MISSING** | HIGH |
| `wishlist_added` | **MISSING** | MEDIUM |
| `price_alert_set` | **MISSING** | MEDIUM |

### Verdict: **50% Coverage**

---

## 6. ATTRIBUTION LAYER

### What You HAVE

| Attribution | Service | Coverage |
|-------------|---------|----------|
| **QR → Conversion** | QR Attribution | YES |
| **Ad → Visit** | REZ-dooh-attribution | YES (DOOH only) |
| **Offer → Conversion** | REZ-attribution-system | PARTIAL |
| **Campaign → Revenue** | REZ-attribution-system | PARTIAL |

### What You NEED

| Attribution | Gap | Priority |
|------------|-----|----------|
| Ad → Visit | PARTIAL - DOOH only | HIGH |
| Offer → Conversion | PARTIAL | HIGH |
| Influencer → Purchase | **MISSING** | HIGH |
| QR → Repeat Users | **MISSING** | HIGH |
| Location → Purchase | **MISSING** | HIGH |
| Notification → Action | **MISSING** | MEDIUM |
| Cross-channel attribution | **MISSING** | HIGH |

### Verdict: **60% Coverage**

---

## 7. IDENTITY RESOLUTION

### What You HAVE

| Identity Type | Service | Coverage |
|--------------|---------|----------|
| **Phone** | REZ-identity-graph | YES |
| **Email** | REZ-identity-graph | YES |
| **Device ID** | PARTIAL | Limited |
| **Wallet** | rez-wallet-service | YES |
| **QR Scans** | flywheel-mvp | YES |
| **Bookings** | booking service | YES |

### What You NEED

| Identity Type | Gap | Priority |
|--------------|-----|----------|
| Device fingerprint | **MISSING** | HIGH |
| Location fingerprints | **MISSING** | HIGH |
| WiFi/Bluetooth proximity | **MISSING** | MEDIUM |
| Cross-app user linking | PARTIAL | HIGH |
| Anonymous → Known bridging | **MISSING** | HIGH |

### Verdict: **70% Coverage**

---

## 8. AD NETWORK

### What You HAVE

| Component | Service | Status |
|-----------|---------|--------|
| **DOOH Screens** | REZ-dooh-service | YES - 4018 |
| **DOOH Attribution** | REZ-dooh-attribution | YES |
| **DOOH Intelligence** | REZ-dooh-intelligence | YES |
| **Targeting Engine** | REZ-targeting-engine | YES |
| **Campaign Builder** | REZ-ai-campaign-builder | YES |
| **WhatsApp Store** | rez-whatsapp-store | YES |

### What You NEED

| Component | Gap | Priority |
|-----------|-----|----------|
| Hyperlocal targeting | **MISSING** | HIGH |
| In-app placements | PARTIAL | HIGH |
| WhatsApp ads | PARTIAL - store exists | HIGH |
| QR-triggered campaigns | PARTIAL | HIGH |
| Receipt ads | **MISSING** | MEDIUM |
| Booking ads | PARTIAL | MEDIUM |
| Merchant discovery boosts | **MISSING** | HIGH |

### Verdict: **50% Coverage**

---

## Gap Summary: What to Build

### CRITICAL (Build Now)

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 1 | **Location Intelligence Layer** | HIGH | HIGH |
| 2 | **Behavioral Psychology Scoring** | HIGH | MEDIUM |
| 3 | **Cross-channel Attribution** | HIGH | HIGH |
| 4 | **Offer Sharing Events** | HIGH | LOW |
| 5 | **Competitor Switcher Detection** | HIGH | MEDIUM |

### IMPORTANT (Build Soon)

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 6 | Influencer Detection | MEDIUM | MEDIUM |
| 7 | Geofence Infrastructure | HIGH | HIGH |
| 8 | Anonymous → Known Bridging | HIGH | HIGH |
| 9 | Hyperlocal Ad Targeting | HIGH | HIGH |
| 10 | Price Sensitivity Scoring | HIGH | LOW |

### NICE-TO-HAVE (Later)

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 11 | Community Detection | MEDIUM | HIGH |
| 12 | Social Reach Scoring | MEDIUM | MEDIUM |
| 13 | Dwell Time Tracking | MEDIUM | HIGH |
| 14 | Cross-location Identity | MEDIUM | HIGH |

---

## Your Moat: "1000+ Real World Commerce Signals"

### What Makes REZ Different

| Signal Type | GoKwik | REZ Opportunity |
|-------------|--------|------------------|
| Online purchase intent | YES | YES |
| **Offline lifestyle behavior** | NO | **YES** |
| **QR interaction patterns** | NO | **YES** |
| **Real-world visit frequency** | NO | **YES** |
| **Multi-category behavior** | NO | **YES** |
| **Booking pattern intelligence** | NO | **YES** |

### Your 200+ Signal Categories

1. **Visit Signals** (30+)
   - Frequency, timing, duration, recency, geography

2. **Spend Signals** (25+)
   - Average, peak, category, method, sensitivity

3. **Loyalty Signals** (20+)
   - Tenure, engagement, referral, feedback

4. **Behavioral Signals** (50+)
   - Planner/impulse, urgency, convenience, luxury

5. **Location Signals** (30+)
   - Commuter, mall-goer, traveler, explorer

6. **Social Signals** (25+)
   - Sharer, influencer, connector, advocate

7. **Predictive Signals** (20+)
   - Churn, LTV, revisit, conversion

---

## Recommended Actions

### Phase 1: Quick Wins (2 weeks)

1. Add `offer_shared` event to event bus
2. Add `price_sensitivity` score to user profile
3. Add `weekend_spender` segment to RFM
4. Add `discount_responsive` tracking

### Phase 2: Core Infrastructure (4 weeks)

1. Build Location Intelligence Layer
2. Build Behavioral Psychology Engine
3. Build Cross-channel Attribution
4. Build Competitor Detection

### Phase 3: Advanced Intelligence (8 weeks)

1. Geofence Infrastructure
2. Anonymous → Known Bridging
3. Hyperlocal Ad Targeting
4. Influencer Detection

---

## Conclusion

**Your current coverage: ~50%**

**Biggest gaps:**
1. Location Intelligence (0%)
2. Behavioral Psychology (0%)
3. Cross-channel Attribution (40%)

**Biggest opportunity:**
Building the "1000+ Real World Commerce Signals" moat that competitors can't replicate.

---

**Next Step:** Want me to build Phase 1 (Quick Wins)?
