# REZ-Intelligence Deploy Commands

**Date:** May 26, 2026

---

## Quick Deploy

```bash
cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/REZ-Intelligence

# Intent Predictor (4018)
cd rez-intent-predictor && npm install && npm run build && cd ..

# Predictive Engine (4123)
cd REZ-predictive-engine && npm install && npm run build && cd ..

# Signal Aggregator (4121)
cd REZ-signal-aggregator && npm install && npm run build && cd ..

# Care Service (4055)
cd REZ-care-service && npm install && npm run build && cd ..
```

---

## Service Status

| Service | Port | Deploy Command |
|---------|------|---------------|
| Intent Predictor | 4018 | `cd rez-intent-predictor && npm run dev` |
| Predictive Engine | 4123 | `cd REZ-predictive-engine && npm run dev` |
| Signal Aggregator | 4121 | `cd REZ-signal-aggregator && npm run dev` |
| Care Service | 4055 | `cd REZ-care-service && npm run dev` |
| Event Bus | 4025 | `cd REZ-event-bus && npm run dev` |
| WhatsApp | 4202 | `cd REZ-whatsapp && npm run dev` |

---

## Docker Deploy

```bash
docker-compose -f docker-compose.intelligence.yml up -d
```

---

## Health Checks

```bash
curl http://localhost:4018/health
curl http://localhost:4123/health
curl http://localhost:4121/health
```

---

**Status: Ready to Deploy 🚀**
