#!/bin/bash
# Commit script for REZ-Intelligence new services

cd "/Users/rejaulkarim/Documents/ReZ Full App/REZ-Intelligence"

# Stage new services
git add REZ-prompt-studio/
git add REZ-approval-ui/
git add REZ-real-pricing-tracker/
git add REZ-revenue-forecast/
git add REZ-neighborhood-analytics/
git add MERCHANT-GROWTH-OS-AUDIT.md

# Commit
git commit -m "feat: Add 6 new Merchant Growth OS services

- REZ-prompt-studio (Port 4299) - Prompt versioning & A/B testing
- REZ-approval-ui (Port 4211) - Human approval dashboard
- REZ-real-pricing-tracker (Port 4212) - Real-time pricing
- REZ-revenue-forecast (Port 4213) - Revenue prediction
- REZ-neighborhood-analytics (Port 4214) - Hyperlocal intelligence
- MERCHANT-GROWTH-OS-AUDIT.md - Complete audit documentation"

# Push
git push origin main

echo "Done!"
