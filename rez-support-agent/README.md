# REZ Support Agent

A purpose-built support agent for the REZ commerce platform, providing intelligent ticket management, refund handling, and customer assistance.

## Features

- **Intelligent Ticket Management**: Automated ticket creation, routing, and escalation
- **Refund Processing**: Complete refund workflow from request to completion
- **SLA Tracking**: Automatic SLA deadline calculation and monitoring
- **Conversational Support**: Natural language processing for customer support interactions
- **Multi-Channel Support**: Chat, email, phone, and mobile app ticket sources
- **Priority Handling**: Intelligent priority assignment based on customer tier and issue type

## Architecture

```
rez-support-agent/
├── src/
│   ├── index.ts              # Express server entry point
│   ├── services/
│   │   ├── supportAgent.ts     # Core support logic and conversation handling
│   │   ├── ticketService.ts     # Ticket management and tracking
│   │   └── refundService.ts     # Refund processing workflow
│   └── routes/
│       └── support.routes.ts   # API endpoints
├── package.json
└── tsconfig.json
```

## API Endpoints

### Chat
```
POST /api/v1/support/chat
```
Process customer support messages and return intelligent responses.

### Tickets
```
POST   /api/v1/support/tickets           # Create a new ticket
GET    /api/v1/support/tickets           # List tickets with filters
GET    /api/v1/support/tickets/stats     # Get ticket statistics
GET    /api/v1/support/tickets/overdue   # Get overdue tickets
GET    /api/v1/support/tickets/:id      # Get ticket by ID
PATCH  /api/v1/support/tickets/:id       # Update ticket
POST   /api/v1/support/tickets/:id/messages  # Add message to ticket
POST   /api/v1/support/tickets/:id/resolve  # Resolve ticket
POST   /api/v1/support/tickets/:id/close    # Close ticket
POST   /api/v1/support/tickets/:id/escalate # Escalate ticket
POST   /api/v1/support/tickets/:id/assign   # Assign ticket to agent
```

### Refunds
```
POST   /api/v1/support/refunds/eligibility  # Check refund eligibility
POST   /api/v1/support/refunds              # Create refund request
GET    /api/v1/support/refunds              # List all refunds
GET    /api/v1/support/refunds/stats        # Get refund statistics
GET    /api/v1/support/refunds/:id          # Get refund by ID
POST   /api/v1/support/refunds/:id/approve  # Approve refund
POST   /api/v1/support/refunds/:id/process # Process refund
POST   /api/v1/support/refunds/:id/complete # Complete refund
POST   /api/v1/support/refunds/:id/reject   # Reject refund
```

## Ticket Statuses

| Status | Description |
|--------|-------------|
| `open` | Ticket created, awaiting assignment |
| `in_progress` | Ticket assigned and being worked on |
| `pending_customer` | Waiting for customer response |
| `pending_internal` | Waiting on internal team |
| `resolved` | Issue resolved, pending customer confirmation |
| `closed` | Ticket closed |
| `escalated` | Ticket escalated to higher priority |

## Ticket Priorities

| Priority | SLA Response Time |
|----------|-------------------|
| `critical` | 15 minutes |
| `urgent` | 1 hour |
| `high` | 4 hours |
| `medium` | 24 hours |
| `low` | 48 hours |

## Ticket Categories

- `billing` - Payment and invoice issues
- `technical` - Technical problems and bugs
- `booking` - Reservation and booking issues
- `refund` - Refund requests
- `general` - General inquiries
- `complaint` - Customer complaints
- `feature_request` - Feature requests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3002 |
| NODE_ENV | Environment | development |
| LOG_LEVEL | Logging level | info |
| ALLOWED_ORIGINS | CORS origins | localhost:3000 |

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Development mode
npm run dev
```

## Example Usage

### Send a support message
```bash
curl -X POST http://localhost:3002/api/v1/support/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need help with my order ORD-123456",
    "context": {
      "customer": {
        "id": "cust_123",
        "email": "customer@example.com",
        "name": "John Doe",
        "tier": "premium",
        "accountAge": 365,
        "totalSpent": 5000,
        "totalTickets": 2,
        "satisfactionScore": 4.5
      }
    }
  }'
```

### Create a ticket
```bash
curl -X POST http://localhost:3002/api/v1/support/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Issue with my booking",
    "description": "I am unable to modify my reservation dates",
    "category": "booking",
    "priority": "medium",
    "customerId": "cust_123",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "orderId": "ORD-123456"
  }'
```

### Check refund eligibility
```bash
curl -X POST http://localhost:3002/api/v1/support/refunds/eligibility \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-123456",
    "customerId": "cust_123",
    "totalSpent": 5000,
    "totalTickets": 2
  }'
```

## Refund Policies

### Basic Tier
- Refund window: 30 days
- Cancellation fee: 15%
- Processing time: 7 business days

### Premium Tier
- Refund window: 60 days
- Cancellation fee: 10%
- Processing time: 5 business days
- Max bonus: 10%

### Enterprise Tier
- Refund window: 90 days
- Cancellation fee: 5%
- Processing time: 3 business days
- Max bonus: 15%

## License

Proprietary - REZ Commerce Platform
