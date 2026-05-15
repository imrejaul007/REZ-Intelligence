# REZ Service Discovery MCP

MCP server for discovering and monitoring REZ ecosystem services.

## Tools

- `list_services` - List all services with optional filtering
- `get_service` - Get detailed service information
- `get_service_health` - Check service health status
- `get_service_logs` - Get service logs
- `find_services` - Search services by keyword

## Usage

```bash
npm install
npm run build
npm start
```

## Example

```javascript
// Claude Code will use this as a tool
const services = await list_services({ category: 'intelligence' });
```

## Available Services

| Service | Category | Port | Description |
|---------|----------|------|-------------|
| rez-auth-service | infrastructure | 4002 | Authentication Service |
| rez-payment-service | payments | 4001 | Payment Service |
| rez-order-service | commerce | 4006 | Order Service |
| rez-notifications-service | communication | 4011 | Notifications Service |
| rez-analytics-service | analytics | 4016 | Analytics Service |
| rez-event-bus | intelligence | 4031 | Event Bus |
| rez-flywheel-mvp | intelligence | 4101 | Flywheel MVP |
| rez-reorder-engine | intelligence | 4040 | Reorder Engine |
| rez-identity-graph | intelligence | 4050 | Identity Graph |
| rez-autonomous-agents | intelligence | 4062 | Autonomous Agents |
