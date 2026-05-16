# REZ Commerce Signal Connector

**Port:** 4150

Connects commerce events to signal infrastructure.

## Purpose

Emits signals when commerce events occur:
- Order placed
- Payment completed
- Cart abandoned
- Review submitted

## Webhook Endpoints

```bash
# Order completed
POST /webhook/order

# Payment completed
POST /webhook/payment

# Review submitted
POST /webhook/review

# Cart abandoned
POST /webhook/cart
```

## Signal Flow

```
Commerce Event → Connector → Unified Profile
                         → Signal Aggregator
                         → Predictive Engine
                         → Behavioral Service
```

## Environment

```bash
PORT=4150
UNIFIED_PROFILE_URL=http://localhost:4120
SIGNAL_AGGREGATOR_URL=http://localhost:4121
PREDICTIVE_ENGINE_URL=http://localhost:4123
BEHAVIORAL_SERVICE_URL=http://localhost:4110
```
