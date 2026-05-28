# Cosmic OS

**Port:** 4163

AI-Powered Human Life Intelligence OS - **Built ON RABTUL Platform**

Spiritual abstraction, AI Council of Agents, cosmic context.

## Overview

Cosmic OS transforms raw behavioral data into **symbolic, abstracted insights** that feel wise and helpful without being creepy. It's the trust layer that makes the REZ ecosystem feel like it understands you.

### Key Differentiator

**BAD:**
> "You traveled to Mumbai 4 times this month. You spent ₹50,000 on food. You slept 5 hours last night."

**GOOD:**
> "Fresh environments may bring unexpected inspiration. Exploration aligns with your current energy. Consider how rest supports your momentum."

## Built ON RABTUL Platform

Cosmic OS is fully integrated with RABTUL services:

| RABTUL Service | Integration | Features |
|---------------|------------|----------|
| **Auth Service** | ✅ | OTP login, JWT verification |
| **Wallet Service** | ✅ | Wellness coins rewards |
| **Notifications** | ✅ | Daily readings push |
| **Gamification** | ✅ | Wellness streaks |
| **Profile Service** | ✅ | User data enrichment |
| **Prive** | ✅ | Premium loyalty signals |

## Wellness Rewards System

| Activity | Coins Earned |
|----------|-------------|
| Mood Check-in | 5 coins |
| Mindfulness Session | 15 coins |
| Journal Entry | 5 coins |
| Streak Bonus | Up to 10 coins/day |
| Weekly Goal | 50 coins |
| Monthly Goal | 200 coins |

### Streak Milestones
- 7 days: 50 bonus coins
- 14 days: 100 bonus coins
- 30 days: 300 bonus coins
- 60 days: 750 bonus coins
- 90 days: 1500 bonus coins

## AI Council of Agents

Cosmic OS features **7 specialized AI agents** that interpret human context:

| Agent | Name | Specialty | Voice |
|-------|------|----------|-------|
| mystic | Cosmic Mystic | Intuition, timing, cycles | Sage |
| healer | Inner Healer | Emotions, recovery, wellness | Counselor |
| strategist | Life Strategist | Career, productivity, decisions | Mentor |
| oracle | Pattern Oracle | Patterns, trends, rhythms | Sage |
| connector | Social Connector | Relationships, community | Friend |
| wealth_guide | Abundance Guide | Financial flow, prosperity | Sage |
| explorer | Path Explorer | Adventure, opportunity | Mentor |

## Features

### Cosmic Interpretation
- Mood-to-cosmic-state mapping
- Symbolic abstraction of raw data
- Privacy-safe insights (never surveillance)
- Timing guidance based on energy

### AI Council
- Multi-agent consensus
- Domain-specific insights
- Agent consultation by type
- Category-based guidance (warning, opportunity, pattern)

### Daily Reading
- Primary/secondary themes
- Lucky elements (color, number, direction)
- Affirmations and cautions
- Domain-specific guidance

### RABTUL Integration
- OTP authentication
- Wallet rewards
- Push notifications
- Streak tracking
- Prive engagement signals

## API Endpoints

### Auth (RABTUL)
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `GET /api/auth/verify` - Verify token

### Cosmic Context
- `GET /api/cosmic/:userId` - Get full cosmic context
- `POST /api/cosmic/context` - Generate from input
- `POST /api/cosmic/council` - Consult AI Council

### Mood (with Rewards)
- `POST /api/mood/checkin` - Record mood + earn coins
- `GET /api/mood/:userId/history` - Get mood history

### Domain Guidance
- `POST /api/guidance/:domain` - Get domain guidance
- `GET /api/guidance/:userId/:domain` - User-specific guidance

### Agents
- `GET /api/agents` - List all agents
- `GET /api/agents/:type` - Get agent info
- `POST /api/agents/:type/consult` - Consult specific agent

### User (RABTUL)
- `GET /api/user/:userId` - Get user context
- `GET /api/user/:userId/streak` - Get wellness streak
- `GET /api/user/:userId/wallet` - Get wallet balance

### Rewards (RABTUL)
- `POST /api/rewards/mindfulness` - Record mindfulness + earn
- `POST /api/rewards/journal` - Record journal + earn

## Quick Start

```bash
cd REZ-Intelligence/Cosmic-OS
npm install
npm run dev
```

## Environment Variables

```bash
# RABTUL Services
RABTUL_AUTH_URL=https://rez-auth-service.onrender.com
RABTUL_WALLET_URL=https://rez-wallet-service-36vo.onrender.com
RABTUL_NOTIFICATION_URL=https://rez-notifications-service.onrender.com
RABTUL_PROFILE_URL=https://rez-profile-service.onrender.com
RABTUL_GAMIFICATION_URL=http://localhost:4041
RABTUL_PRIVE_URL=http://localhost:4070

# Internal
INTERNAL_SERVICE_TOKEN=your-internal-token

# Services
EMOTIONAL_SERVICE_URL=http://localhost:4160
LIFE_PATTERN_SERVICE_URL=http://localhost:4161
HUMAN_CONTEXT_URL=http://localhost:4162
```

## Privacy Design

All cosmic outputs follow these principles:
1. **NEVER surface raw data** - Always abstract
2. **Use symbolic language** - "Fresh environments" not "4 flights"
3. **Positive framing** - Growth-oriented, not surveillance
4. **Timing over certainty** - "may" and "suggests" over "did"
5. **User benefit** - Every insight should help, not monitor

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       COSMIC OS (Port 4163)                │
│  AI Council: Mystic, Healer, Strategist, Oracle,        │
│              Connector, Wealth Guide, Explorer              │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐    ┌───────────┐   ┌──────────────┐
   │ RABTUL  │    │   REZ     │   │    REZ      │
   │ Platform│    │ Intelligence│   │ Human Context│
   │         │    │            │   │    Graph     │
   ├─────────┤    ├───────────┤   ├──────────────┤
   │ Auth    │    │ Emotional │   │ 15-Layer    │
   │ Wallet  │    │ Intelligence│   │ Aggregation  │
   │ Notify  │    │ Life      │   │              │
   │ Prive   │    │ Patterns  │   │              │
   │ Gamify  │    │           │   │              │
   └─────────┘    └───────────┘   └──────────────┘
```

## License

Proprietary - RTNM Group
