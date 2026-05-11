# REZ Audit Logging Service

A comprehensive audit logging and compliance service for tracking system events, user actions, and regulatory compliance.

## Features

- **Audit Event Logging**: Track authentication, authorization, data access, and modification events
- **Compliance Monitoring**: GDPR, HIPAA, SOC2 framework compliance tracking
- **Reporting**: Generate executive summaries and security reports
- **Correlation Tracking**: Unique correlation IDs for tracing related events

## API Endpoints

### Audit Routes (`/audit`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /audit | Log a new audit event |
| GET | /audit | List audit events with filtering |
| GET | /audit/summary | Get audit event summary |
| GET | /audit/recent | Get recent audit events |
| GET | /audit/user/:userId | Get events for specific user |
| GET | /audit/resource/:resource | Get events for specific resource |
| GET | /audit/type/:type | Get events by type |
| GET | /audit/report | Generate audit report |
| GET | /audit/:id | Get single event by ID |
| DELETE | /audit/cleanup | Cleanup old events |

### Compliance Routes (`/compliance`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /compliance/status | Check compliance status |
| GET | /compliance/report | Get compliance report |
| GET | /compliance/frameworks | List compliance frameworks |
| GET | /compliance/frameworks/:id | Get framework details |
| POST | /compliance/frameworks | Add new framework |
| PATCH | /compliance/frameworks/:frameworkId/requirements/:requirementId | Update requirement |
| DELETE | /compliance/frameworks/:id | Delete framework |

### Reports Routes (`/reports`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /reports/templates | List report templates |
| POST | /reports/templates | Create report template |
| GET | /reports/executive-summary | Generate executive summary |
| GET | /reports/security | Generate security report |
| POST | /reports/generate | Generate custom report |

## Quick Start

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

## Health Check

```bash
curl http://localhost:3000/health
```

## Deploy to Render

The service is configured for Render deployment via `render.yaml`. Connect your GitHub repository to Render and deploy.

## Event Types

- `authentication` - Login/logout attempts
- `authorization` - Access control checks
- `data_access` - Data retrieval events
- `data_modification` - Data update events
- `data_deletion` - Data removal events
- `configuration_change` - System config changes
- `admin_action` - Administrative operations
- `api_call` - API requests
- `system_event` - System-level events
- `compliance_event` - Compliance-related events
