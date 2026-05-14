# Staff Scheduling Service

**Port:** 4067
**Purpose:** Workforce management and staff scheduling

## Features

- Staff registration and management
- Schedule creation by week
- Shift management
- Time-off requests
- Clock in/out functionality
- Hours tracking and reports

## API Endpoints

### Staff Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/staff` | Add staff member |
| GET | `/api/staff` | List staff |
| GET | `/api/staff/:id` | Get staff |
| PATCH | `/api/staff/:id` | Update staff |
| PATCH | `/api/staff/:id/status` | Update status |
| GET | `/api/staff/:id/shifts` | Get shifts |
| POST | `/api/staff/:id/time-off` | Request time off |
| GET | `/api/staff/:id/availability` | Check availability |

### Schedule Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedules` | Create schedule |
| GET | `/api/schedules` | List schedules |
| GET | `/api/schedules/:id` | Get schedule |
| PATCH | `/api/schedules/:id/status` | Publish/archive |
| GET | `/api/schedules/:id/shifts` | Get shifts |

### Shift Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shifts` | Create shift |
| GET | `/api/shifts` | List shifts |
| GET | `/api/shifts/:id` | Get shift |
| PATCH | `/api/shifts/:id` | Update shift |
| PATCH | `/api/shifts/:id/status` | Update status |
| POST | `/api/shifts/:id/clock-in` | Clock in |
| POST | `/api/shifts/:id/clock-out` | Clock out |
| DELETE | `/api/shifts/:id` | Delete shift |
| GET | `/api/shifts/reports/hours` | Hours report |

## Quick Start

```bash
cd REZ-Intelligence/REZ-staff-scheduling-service
npm install && npm run dev
```
