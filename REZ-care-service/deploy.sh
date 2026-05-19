#!/bin/bash
# REZ Care Service - Deployment Script

set -e

echo "=========================================="
echo "REZ Care Service - Deployment"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please update .env with your values!${NC}"
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build
echo -e "${GREEN}Building...${NC}"
npm run build

# Test health
echo -e "${GREEN}Testing health endpoint...${NC}"
timeout 10 npm run dev &
PID=$!
sleep 5
curl -s http://localhost:4058/health | head -c 200
kill $PID 2>/dev/null || true

echo ""
echo -e "${GREEN}=========================================="
echo "Build complete!"
echo "=========================================="
echo ""
echo "Services connected:"
echo "  - REZ-support-copilot (AI)"
echo "  - Industry Experts (8 agents)"
echo "  - REZ Intelligence ML"
echo "  - RABTUL Core"
echo "  - REZ Media"
echo "  - CorpPerks"
echo ""
echo "To deploy to Render:"
echo "  1. Push to GitHub"
echo "  2. Connect to Render"
echo "  3. Set environment variables"
echo "  4. Deploy!"
echo ""
