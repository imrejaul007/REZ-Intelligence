# REZ Supplier Marketplace - SPEC.md

**Version:** 1.0.0
**Port:** 4063
**Company:** REZ-Intelligence
**Category:** B2B Commerce

---

## Overview

B2B supplier directory and marketplace. Connects businesses with verified suppliers for procurement, featuring supplier profiles, product catalogs, and order management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REZ Supplier Marketplace                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core Features:                                                           │
│  ├── Supplier Directory  → Verified B2B suppliers                       │
│  ├── Product Catalog    → Supplier product listings                      │
│  ├── Order Management  → B2B purchase orders                            │
│  ├── Reviews & Ratings → Supplier reputation system                       │
│  └── Search & Filter  → Category, location, certification search        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Supplier Types

| Type | Description |
|------|-------------|
| Manufacturer | Direct manufacturer |
| Wholesaler | Bulk distributor |
| Distributor | Regional distributor |
| Importer | International goods |
| Local Vendor | Local suppliers |

---

## API Endpoints

### Suppliers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/suppliers` | List suppliers |
| POST | `/api/suppliers` | Register supplier |
| GET | `/api/suppliers/:id` | Supplier details |
| PATCH | `/api/suppliers/:id` | Update supplier |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products |
| POST | `/api/products` | Add product |
| GET | `/api/products/:id` | Product details |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order |
| GET | `/api/orders/:id` | Order details |
| PATCH | `/api/orders/:id` | Update order |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reviews` | Add review |
| GET | `/api/reviews/supplier/:id` | Supplier reviews |

---

## Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0",
  "uuid": "^9.0.1"
}
```

---

## Status

- [x] Service foundation
- [ ] Supplier directory
- [ ] Product catalog
- [ ] Order management
- [ ] Reviews system
- [ ] Search & filters
