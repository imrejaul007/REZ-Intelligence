# REZ Unified CRM Hub - Architecture Summary

## ⚠️ INTERNAL USE ONLY ⚠️

**This system contains INTERNAL INTELLIGENCE DATA for REZ Platform Team only.**

---

## Data Classification

### 🔒 INTERNAL Only (Do Not Expose)

| Data | Why Internal | Use Case |
|------|--------------|----------|
| AI Predictions | Sensitive algorithms | Internal analytics, automation |
| Intent Signals | Competitive advantage | AI training, product decisions |
| Engagement Scores | Internal scoring | Internal metrics, health |
| Behavioral Patterns | Raw data | ML training, analytics |
| Smart Tags (AI) | Confidence scores | Internal segmentation |
| Churn Probability | Internal metric | Retention team |

### 👁️ Merchant-Facing (Safe to Show)

| Data | Why Public | Use Case |
|------|------------|----------|
| Customer Name | Basic identity | Personalization |
| Order History | Transparency | Customer service |
| Basic Segment | Helps service | Targeted offers |
| Total Spend | Shows value | Relationship building |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTERNAL CRM (REZ Platform)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Data Sources → Intelligence Layer → Internal CRM Hub → Analytics          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      DATA SOURCES                                   │   │
│  │  • REZ NOW (Orders, Customers)                                      │   │
│  │  • REZ Media (Ads, Engagement)                                      │   │
│  │  • REZ Intelligence (AI, ML)                                        │   │
│  │  • CorpPerks (Enterprise Sales)                                    │   │
│  │  • External CRM (HubSpot, Zoho)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    INTELLIGENCE LAYER                               │   │
│  │  • Identity Graph (4050) - User resolution                        │   │
│  │  • Predictive Engine (4059) - Churn, LTV predictions             │   │
│  │  • RFM Service (4055) - Segmentation                             │   │
│  │  • Intent Graph (4070) - Browsing, purchase intent               │   │
│  │  • Engagement Scorer (4065) - Channel scoring                     │   │
│  │  • Unified Profile (4060) - Customer profile                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  UNIFIED CRM HUB (4100)                            │   │
│  │  🔒 INTERNAL API - Do Not Expose to Merchants                    │   │
│  │                                                                     │   │
│  │  Returns:                                                          │   │
│  │  • Full Customer 360                                               │   │
│  │  • AI Predictions (churn, LTV)                                   │   │
│  │  • Intent Signals                                                 │   │
│  │  • Engagement Scores                                              │   │
│  │  • Smart Tags (with confidence)                                  │   │
│  │  • Behavioral Analysis                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │ REZ NOW CRM  │  │ REZ Media   │  │ CorpPerks   │
         │ Merchant     │  │ Dashboard   │  │ Dashboard   │
         │ Dashboard    │  │             │  │             │
         └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                │                  │                  │
                ▼                  ▼                  ▼
         ┌─────────────────────────────────────────────────────┐
         │              MERCHANT-FACING DATA                     │
         ├─────────────────────────────────────────────────────┤
         │                                                       │
         │  Only sanitized, public-safe data:                    │
         │  • Customer name                                   │
         │  • Order history                                   │
         │  • Basic segment (VIP, New, Regular)               │
         │  • Last visit date                                 │
         │  • Total spend                                     │
         │                                                       │
         │  NEVER exposed:                                    │
         │  ✗ AI predictions                                  │
         │  ✗ Engagement scores                               │
         │  ✗ Intent signals                                  │
         │  ✗ Raw behavioral data                            │
         │  ✗ Smart Tag confidence scores                     │
         │                                                       │
         └─────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Internal API (Port 4100) - REZ Platform Team Only

```
GET  /api/v1/internal/dashboard/overview
GET  /api/v1/internal/customers
GET  /api/v1/internal/customers/:id
GET  /api/v1/internal/customers/:id/predictions
GET  /api/v1/internal/customers/:id/intent
GET  /api/v1/internal/customers/:id/engagement
GET  /api/v1/internal/tags
GET  /api/v1/internal/segments
```

### Merchant API (Port 4101) - For Merchants

```
GET  /api/v1/merchant/customers
GET  /api/v1/merchant/customers/:id
GET  /api/v1/merchant/customers/:id/orders
GET  /api/v1/merchant/inbox/messages
POST /api/v1/merchant/inbox/messages/:id/reply
```

---

## Key Differences

| Aspect | Internal CRM | Merchant CRM |
|--------|-------------|--------------|
| Audience | REZ Platform Team | Merchants |
| Data | Full intelligence | Sanitized only |
| Predictions | ✓ Included | ✗ Never |
| Intent Signals | ✓ Included | ✗ Never |
| Engagement Scores | ✓ Included | ✗ Never |
| Smart Tags | ✓ With confidence | ✓ Names only |
| Order History | ✓ Full | ✓ Full |
| Customer Name | ✓ | ✓ |

---

## Security Rules

1. **No Intelligence in Merchant API**
   - Merchant API returns only `MerchantCustomer` type
   - No `InternalCustomer` data ever exposed
   - Separate endpoints, separate ports

2. **Data Sanitization**
   - `InternalCustomer` → `MerchantCustomer` transformation
   - Remove: predictions, intent, engagement, raw data
   - Keep: name, orders, basic segments

3. **Authentication**
   - Internal API: Service token
   - Merchant API: Merchant JWT

4. **Logging**
   - Log all internal API access
   - Alert on unusual patterns
   - Audit trail for compliance

---

## File Locations

```
REZ-Intelligence/
├── REZ-unified-crm-hub/     # Backend (Port 4100)
│   ├── src/
│   │   ├── types/index.ts    # Type definitions (with classification)
│   │   ├── routes/           # API routes
│   │   └── services/        # Business logic
│   └── README.md             # Full documentation
│
└── REZ-unified-crm-ui/      # Frontend
    └── src/
        └── app/page.tsx      # Internal dashboard UI
```

---

## Next Steps

1. **Deploy Internal CRM Hub** (Port 4100)
   - Connect to REZ Intelligence services
   - Test internal API endpoints
   - Verify data aggregation

2. **Create Merchant CRM API** (Port 4101)
   - Sanitize data transformations
   - Create merchant-safe endpoints
   - Add merchant authentication

3. **Update REZ NOW CRM**
   - Point to merchant API
   - Remove internal data exposure
   - Add proper data filtering

4. **Documentation**
   - API docs for internal team
   - Merchant API docs
   - Data classification guidelines

---

## Contact

For questions about internal data access or architecture, contact the REZ Intelligence team.
