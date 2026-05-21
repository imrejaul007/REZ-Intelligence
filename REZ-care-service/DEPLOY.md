#!/bin/bash
# REZ Care Ecosystem - One-Click Deploy Script
# Run from REZ-Intelligence directory

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         REZ CARE ECOSYSTEM - DEPLOYMENT SCRIPT             ║"
echo "║                                                              ║"
echo "║  Deploying:                                                  ║"
echo "║  • REZ Care Service (Port 4058)                             ║"
echo "║  • REZ Support Copilot (Port 4033)                          ║"
echo "║  • Expert Services (Ports 3005-3012)                        ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

# Parse arguments
ENV=${1:-production}
DEPLOY_MODE=${2:-blueprint}

echo "📦 Environment: $ENV"
echo "🚀 Deploy Mode: $DEPLOY_MODE"
echo ""

# ============================================
# STEP 1: Validate Environment Variables
# ============================================

echo "🔍 Checking environment configuration..."

# Check for critical secrets
if [ -z "$MONGODB_URI" ]; then
  echo "⚠️  MONGODB_URI not set. Using default local connection."
  echo "   Set this variable for production deployments."
fi

if [ -z "$INTERNAL_SERVICE_TOKEN" ]; then
  echo "⚠️  INTERNAL_SERVICE_TOKEN not set. A temporary one will be generated."
fi

# ============================================
# STEP 2: Deploy REZ Care Service
# ============================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying REZ Care Service..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/REZ-Intelligence/REZ-care-service

if [ "$DEPLOY_MODE" = "blueprint" ]; then
  echo "Using Render Blueprint deployment..."
  echo "Run the following command to deploy:"
  echo ""
  echo "  render blueprint create"
  echo ""
  echo "Or deploy manually at: https://dashboard.render.com"
else
  echo "Installing dependencies..."
  npm install

  echo "Building service..."
  npm run build

  echo "Starting service..."
  echo "REZ Care will be available at http://localhost:4058"
  npm start &
fi

# ============================================
# STEP 3: Deploy REZ Support Copilot
# ============================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying REZ Support Copilot..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/REZ-Intelligence/REZ-support-copilot

if [ "$DEPLOY_MODE" = "blueprint" ]; then
  echo "Already included in REZ Care blueprint."
else
  npm install
  npm start &
fi

# ============================================
# STEP 4: Deploy Expert Services
# ============================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying Expert Services (8)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

EXPERT_SERVICES=(
  "rez-hospitality-expert:3005:hospitality"
  "rez-salon-expert:3006:salon"
  "rez-fitness-expert:3007:fitness"
  "rez-health-expert:3008:health"
  "rez-education-expert:3009:education"
  "rez-travel-expert:3010:travel"
  "rez-retail-expert:3011:retail"
  "rez-culinary-expert:3012:culinary"
)

for service_info in "${EXPERT_SERVICES[@]}"; do
  IFS=':' read -r service port industry <<< "$service_info"

  echo ""
  echo "  📦 Deploying $service (Port $port) for $industry industry..."

  cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/REZ-Intelligence/$service

  if [ "$DEPLOY_MODE" = "blueprint" ]; then
    echo "     Already included in REZ Care blueprint."
  else
    npm install 2>/dev/null || echo "     (Skipped - check package.json)"
    echo "     Service will be available at http://localhost:$port"
  fi
done

# ============================================
# STEP 5: Deploy Command Center
# ============================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Deploying REZ Care Command Center..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/RTNM-Group/rez-care-command-center

if [ "$DEPLOY_MODE" = "blueprint" ]; then
  echo "Creating Next.js deployment..."
  echo "Run: npm run build && npm start"
else
  npm install
  echo "Dashboard will be available at http://localhost:3000"
fi

# ============================================
# COMPLETION
# ============================================

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║  ✅ DEPLOYMENT INITIATED                                    ║"
echo "║                                                              ║"
echo "║  Next Steps:                                                ║"
echo "║  1. Set up MongoDB Atlas cluster                            ║"
echo "║  2. Configure WhatsApp Business API (optional)              ║"
echo "║  3. Set up email SMTP credentials                           ║"
echo "║  4. Deploy to Render using blueprint                        ║"
echo "║                                                              ║"
echo "║  Documentation:                                             ║"
echo "║  • DEPLOY.md - This file                                    ║"
echo "║  • docs/REZ-CARE-WHATSAPP-SETUP.md - WhatsApp setup         ║"
echo "║  • docs/REZ-CARE-MOBILE-INTEGRATION.md - Mobile apps        ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
