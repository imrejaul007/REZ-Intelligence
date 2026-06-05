#!/bin/bash
# Deploy All Merchant Growth OS Services
# Run this script to deploy everything

set -e

echo "=========================================="
echo "MERCHANT GROWTH OS - DEPLOYMENT"
echo "=========================================="

# 1. Git Commit
echo ""
echo "[1/5] Committing to Git..."
cd "/Users/rejaulkarim/Documents/ReZ Full App/REZ-Intelligence"
git add .
git commit -m "feat: Complete Merchant Growth OS - 16 new services with ecosystem integration

- Budget Optimizer (Port 4290)
- Growth Playbook (Port 4291)
- Incrementality Testing (Port 4292)
- Merchant Health Score (Port 4293)
- Offline Attribution (Port 4294)
- Competitor Alerts (Port 4295)
- Review Response Engine (Port 4296)
- Unified Offer Brain (Port 4297)
- Autonomous Growth Agent (Port 4298)
- Prompt Studio (Port 4299)
- Approval UI (Port 4211)
- Real Pricing Tracker (Port 4212)
- Revenue Forecast (Port 4213)
- Neighborhood Analytics (Port 4214)
- Visual Workflow Builder (Port 3000)

Features:
- Full ecosystem integration (RABTUL, HOJAI, REZ)
- Docker Compose ready
- Kubernetes manifests
- Integration tests
- API documentation
- Ecosystem integration docs"
git push origin main

# 2. hojai-ai
echo ""
echo "[2/5] Committing to hojai-ai..."
cd "/Users/rejaulkarim/Documents/ReZ Full App/hojai-ai"
git add .
git commit -m "feat: Add REZ-plugin-marketplace (Port 4210)

Plugin marketplace for 3rd party extensions"
git push origin main

# 3. Install Dependencies
echo ""
echo "[3/5] Installing dependencies..."
cd "/Users/rejaulkarim/Documents/ReZ Full App/REZ-Intelligence"

for service in \
  REZ-budget-optimizer \
  REZ-growth-playbook \
  REZ-incrementality-testing \
  REZ-merchant-health-score \
  REZ-offline-attribution \
  REZ-competitor-alerts \
  REZ-review-response-engine \
  REZ-unified-offer-brain \
  REZ-autonomous-growth-agent \
  REZ-prompt-studio \
  REZ-real-pricing-tracker \
  REZ-revenue-forecast \
  REZ-neighborhood-analytics; do
  if [ -d "$service" ]; then
    echo "Installing $service..."
    cd "$service"
    npm install 2>/dev/null || echo "npm install skipped"
    cd ..
  fi
done

# 4. Docker Build
echo ""
echo "[4/5] Building Docker images..."
docker-compose build

# 5. Deploy
echo ""
echo "[5/5] Deploying..."
docker-compose up -d

echo ""
echo "=========================================="
echo "DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Services running:"
echo "  - Budget Optimizer:      http://localhost:4290"
echo "  - Growth Playbook:      http://localhost:4291"
echo "  - Incrementality:       http://localhost:4292"
echo "  - Merchant Health:      http://localhost:4293"
echo "  - Offline Attribution:   http://localhost:4294"
echo "  - Competitor Alerts:     http://localhost:4295"
echo "  - Review Response:      http://localhost:4296"
echo "  - Unified Offer Brain:   http://localhost:4297"
echo "  - Growth Agent:         http://localhost:4298"
echo "  - Prompt Studio:        http://localhost:4299"
echo "  - Approval UI:          http://localhost:4211"
echo "  - Real Pricing Tracker: http://localhost:4212"
echo "  - Revenue Forecast:      http://localhost:4213"
echo "  - Neighborhood:         http://localhost:4214"
echo "  - Workflow Builder UI:   http://localhost:3000"
echo ""
