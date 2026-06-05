# REZ Prompt Studio

Prompt versioning, rollback, A/B testing, and collaboration for AI prompts.

## Features

- **Version History** - Track all prompt changes with full history
- **Rollback** - Revert to any previous version instantly
- **A/B Testing** - Test different prompt variants with statistical analysis
- **Performance Metrics** - Track invocation, success rate, latency, cost
- **Collaboration** - Add team members as editors or viewers
- **Variable System** - Define and use variables in prompts

## API Endpoints

### Create Prompt
```bash
POST /api/prompts
{
  "name": "Welcome Message",
  "description": "AI message for new customer welcome",
  "merchantId": "m123",
  "content": "Welcome {{customerName}}! We're thrilled to have you.",
  "variables": [{ "name": "customerName", "type": "string" }]
}
```

### Update Prompt (New Version)
```bash
PUT /api/prompts/:promptId/versions
{
  "content": "New improved content...",
  "changeDescription": "Updated greeting tone"
}
```

### Rollback
```bash
POST /api/prompts/:promptId/rollback
{
  "targetVersion": 3,
  "reason": "New version causing issues"
}
```

### A/B Test
```bash
POST /api/tests
{
  "promptId": "p123",
  "name": "Test A vs B",
  "variants": [
    { "versionId": "v1", "percentage": 50 },
    { "versionId": "v2", "percentage": 50 }
  ]
}
```

## Port

Port: **4299**
