#!/bin/bash

# Cosmic OS - Deploy Script
# Deploys all Cosmic OS backend services

set -e

echo "=========================================="
echo "Cosmic OS - Backend Deployment"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Services to deploy
SERVICES=(
  "REZ-emotional-intelligence:4160"
  "REZ-life-pattern-engine:4161"
  "REZ-human-context-graph:4162"
  "Cosmic-OS:4163"
)

deploy_service() {
  local SERVICE_DIR=$1
  local PORT=$2
  local SERVICE_NAME=$(basename "$SERVICE_DIR")

  echo -e "\n${YELLOW}Deploying $SERVICE_NAME on port $PORT...${NC}"

  if [ ! -d "$SERVICE_DIR" ]; then
    echo -e "${RED}ERROR: Directory $SERVICE_DIR not found${NC}"
    return 1
  fi

  cd "$SERVICE_DIR"

  # Install dependencies
  echo "Installing dependencies..."
  npm install

  # Build TypeScript
  echo "Building TypeScript..."
  npm run build

  # Start service
  echo "Starting $SERVICE_NAME..."
  PORT=$PORT npm run start &

  cd - > /dev/null

  echo -e "${GREEN}✓ $SERVICE_NAME deployed${NC}"
}

# Main deployment
main() {
  echo "Starting Cosmic OS Backend Services..."

  # Get script directory
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REZ_INTEL_DIR="$(dirname "$SCRIPT_DIR")"

  for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r service port <<< "$service_info"
    SERVICE_DIR="$REZ_INTEL_DIR/$service"
    deploy_service "$SERVICE_DIR" "$port"
  done

  echo -e "\n${GREEN}=========================================="
  echo "All Cosmic OS services deployed!"
  echo "=========================================="
  echo ""
  echo "Services:"
  echo "  • REZ Emotional Intelligence: http://localhost:4160"
  echo "  • REZ Life Pattern Engine:     http://localhost:4161"
  echo "  • REZ Human Context Graph:    http://localhost:4162"
  echo "  • Cosmic OS:                 http://localhost:4163"
  echo ""
  echo "Health checks:"
  echo "  • curl http://localhost:4160/health"
  echo "  • curl http://localhost:4161/health"
  echo "  • curl http://localhost:4162/health"
  echo "  • curl http://localhost:4163/health"
  echo ""
}

main "$@"
