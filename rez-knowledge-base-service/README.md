# REZ Knowledge Base Service

Merchant knowledge base service for REZ Mind - stores menu data, FAQs, policies, and training documents.

## Features

- **Merchant Management** - CRUD for merchant knowledge bases
- **Menu Data** - Categories, items, modifiers, dietary info
- **FAQs** - Question/answer pairs with categories and tags
- **Policies** - Cancellation, delivery, payment, reservation rules
- **Search** - Full-text search across all knowledge
- **Import/Export** - CSV and JSON support

## API Endpoints

### Health
- `GET /health` - Service health check

### Merchants
- `GET /api/merchants` - List all merchants
- `POST /api/merchants` - Create merchant
- `GET /api/merchants/:merchantId` - Get merchant
- `PUT /api/merchants/:merchantId` - Update merchant
- `DELETE /api/merchants/:merchantId` - Delete merchant

### Menu
- `POST /api/merchants/:merchantId/menu` - Add menu item
- `PUT /api/merchants/:merchantId/menu/:itemId` - Update menu item
- `DELETE /api/merchants/:merchantId/menu/:itemId` - Delete menu item

### FAQs
- `GET /api/merchants/:merchantId/faq` - List FAQs
- `POST /api/merchants/:merchantId/faq` - Add FAQ
- `PUT /api/merchants/:merchantId/faq/:faqId` - Update FAQ
- `DELETE /api/merchants/:merchantId/faq/:faqId` - Delete FAQ

### Search & Import
- `GET /api/merchants/:merchantId/search?q=query` - Search knowledge
- `POST /api/merchants/:merchantId/import` - Import data
- `GET /api/merchants/:merchantId/export` - Export data

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB URI
npm run dev
```

## Environment Variables

- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (default: 4005)
- `REDIS_HOST` - Redis host (optional)
- `REDIS_PORT` - Redis port (optional)
- `REDIS_PASSWORD` - Redis password (optional)
