# REZ API Key Management

## Usage

### Create API Key
```bash
curl -X POST http://localhost:4096/keys \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "hotel-ota",
    "appName": "Hotel OTA App",
    "permissions": ["events:write", "recommendations:read"]
  }'
```

### Use API Key
```bash
curl http://localhost:4091/api/events/track \
  -H "X-REZ-API-Key: rez_keyid_secret"
```

## Permissions
- `events:read` - Read events
- `events:write` - Write events
- `recommendations:read` - Get recommendations
- `recommendations:write` - Update recommendations
- `identity:read` - Read identity
- `identity:write` - Write identity
- `*` - Full access
