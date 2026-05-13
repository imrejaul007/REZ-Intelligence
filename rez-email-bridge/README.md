# REZ Email Bridge

**Port:** 4086

Connects Email to REZ Orchestrator for automated responses and notifications.

## Features

- Send transactional emails (SMTP + SendGrid fallback)
- Inbound email processing with command detection
- Email templates (welcome, order confirmation, etc.)
- Route emails to orchestrator for AI responses
- Attachment support

## Quick Start

```bash
cd rez-email-bridge
npm install
cp .env.example .env
# Edit .env with your SMTP credentials
npm run dev
```

## API Endpoints

### Send Email
```bash
POST /api/email/send
{
  "to": "user@example.com",
  "subject": "Order Confirmation",
  "body": "<h1>Order Placed!</h1>"
}
```

### Send Template
```bash
POST /api/email/send-template
{
  "to": "user@example.com",
  "template": "order_confirmation",
  "data": { "orderId": "ORD123", "total": 299 }
}
```

### Inbound Email Webhook
```bash
POST /api/email/inbound
{
  "from": "user@example.com",
  "subject": "REZ ORDER BIRYANI",
  "body": "I want to order biryani"
}
```

## Email Commands

Users can send commands in email subject:
- `REZ ORDER [item]` - Place order
- `REZ STATUS [orderId]` - Check status
- `REZ CANCEL [orderId]` - Cancel order
- `REZ HELP` - Get help

## Environment Variables

| Variable | Description |
|----------|-------------|
| SMTP_HOST | SMTP server host |
| SMTP_PORT | SMTP port |
| SMTP_USER | SMTP username |
| SMTP_PASS | SMTP password |
| SENDGRID_API_KEY | Backup email service |
| ORCHESTRATOR_URL | REZ Orchestrator URL |
