# Waitlist Service

**Port:** 4066
**Purpose:** Queue management and waitlist service

## Features

- Queue creation and management
- Join waitlist with party size
- Real-time position tracking
- Call and seat functionality
- Estimated wait times
- Cancellation and no-show tracking

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/waitlist/join` | Join queue |
| GET | `/api/waitlist` | List entries |
| GET | `/api/waitlist/:id` | Get entry |
| GET | `/api/waitlist/customer/:id` | Customer's entries |
| PATCH | `/api/waitlist/:id/call` | Call customer |
| PATCH | `/api/waitlist/:id/seat` | Seat customer |
| PATCH | `/api/waitlist/:id/cancel` | Cancel |
| PATCH | `/api/waitlist/:id/no-show` | Mark no-show |
| GET | `/api/waitlist/:queueId/position/:id` | Get position |
| POST | `/api/queues` | Create queue |
| GET | `/api/queues` | List queues |
| GET | `/api/queues/:id` | Get queue |
| PATCH | `/api/queues/:id` | Update queue |
| PATCH | `/api/queues/:id/status` | Update status |
| GET | `/api/queues/:id/stats` | Get stats |

## Quick Start

```bash
cd REZ-Intelligence/REZ-waitlist-service
npm install && npm run dev
```
