# REZ AI Voice - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** REZ-Intelligence
**Category:** Voice AI

---

## Overview

AI Voice Agent service integrating Twilio for voice calls, OpenAI Whisper for speech-to-text, and ElevenLabs for natural text-to-speech. Powers voice-first customer interactions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REZ AI Voice Agent                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                              │
│  ├── Twilio     → Voice call handling                                   │
│  ├── Whisper    → Speech-to-text transcription                         │
│  ├── ElevenLabs → Natural text-to-speech                               │
│  └── Claude     → Conversational AI backend                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Voice Pipeline

```
Incoming Call → Twilio → Audio Stream → Whisper (STT)
                                           ↓
                                   Claude (AI)
                                           ↓
Audio Output ← ElevenLabs (TTS) ← Text Response
```

---

## API Endpoints

### Voice
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/call` | Initiate outbound call |
| POST | `/webhooks/twilio` | Twilio webhook |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions/:id` | Get call session |
| POST | `/api/sessions/:id/end` | End call |

---

## Dependencies

```json
{
  "twilio": "^4.20.0",
  "openai": "^4.28.0",
  "elevenlabs": "^1.49.0",
  "@anthropic-ai/sdk": "^0.24.0",
  "express": "^4.18.2",
  "zod": "^3.22.4",
  "winston": "^3.11.0"
}
```

---

## Integration Points

| Service | Direction | Purpose |
|---------|-----------|---------|
| REZ-autonomous-agents | Read | Agent logic |
| REZ-conversation-intelligence | Write | Call analytics |

---

## Status

- [x] Service foundation
- [x] Twilio integration
- [x] Whisper STT
- [x] ElevenLabs TTS
- [ ] Conversational AI
- [ ] Call analytics
