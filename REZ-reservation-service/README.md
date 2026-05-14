# Reservation Service

**Port:** 4065
**Purpose:** Table reservations for restaurants

## Features

- Restaurant management
- Table management
- Reservation creation and tracking
- Availability checking
- Status management

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reservations` | Create reservation |
| GET | `/api/reservations` | List reservations |
| GET | `/api/reservations/:id` | Get reservation |
| PATCH | `/api/reservations/:id/status` | Update status |
| GET | `/api/reservations/availability/:id` | Check availability |
| DELETE | `/api/reservations/:id` | Cancel |
| POST | `/api/tables` | Add table |
| GET | `/api/tables` | List tables |
| POST | `/api/restaurants` | Add restaurant |

## Quick Start

```bash
cd REZ-Intelligence/REZ-reservation-service
npm install && npm run dev
```
