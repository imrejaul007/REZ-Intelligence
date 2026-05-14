#!/bin/bash

# REZ Agent OS - Startup Script
# Starts all services for REZ Agent OS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          REZ AGENT OS - Starting Services            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if port is in use
check_port() {
    lsof -i :$1 2>/dev/null | grep LISTEN > /dev/null
}

# Function to start service in background
start_service() {
    local name=$1
    local dir=$2
    local port=$3
    local cmd=$4

    echo -n "Starting $name (port $port)... "

    if check_port $port; then
        echo -e "${YELLOW}Already running${NC}"
        return 0
    fi

    cd "$SCRIPT_DIR/$dir" 2>/dev/null || {
        echo -e "${RED}Directory not found${NC}"
        return 1
    }

    npm run $cmd > /dev/null 2>&1 &
    sleep 2

    if check_port $port; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAILED${NC}"
    fi
}

# Stop existing services first
echo -e "${YELLOW}Stopping existing services...${NC}"
pkill -f "rez-core-brain" 2>/dev/null || true
pkill -f "rez-orchestrator-v2" 2>/dev/null || true
pkill -f "rez-channel-orchestrator" 2>/dev/null || true
pkill -f "rez-sms-bridge" 2>/dev/null || true
pkill -f "rez-email-bridge" 2>/dev/null || true
pkill -f "rez-rcs-bridge" 2>/dev/null || true
pkill -f "rez-web-widget" 2>/dev/null || true
pkill -f "rez-app-bridge" 2>/dev/null || true
pkill -f "rez-culinary-expert" 2>/dev/null || true
pkill -f "rez-hospitality-expert" 2>/dev/null || true
pkill -f "rez-health-expert" 2>/dev/null || true
pkill -f "rez-fitness-expert" 2>/dev/null || true
pkill -f "rez-retail-expert" 2>/dev/null || true
pkill -f "rez-salon-expert" 2>/dev/null || true
sleep 2
echo -e "${GREEN}Done${NC}"
echo ""

echo -e "${GREEN}=== CORE SERVICES ===${NC}"
start_service "Core Brain" "rez-core-brain" "4000" "dev"
start_service "Orchestrator" "rez-orchestrator-v2" "4006" "dev"
start_service "Channel Orchestrator" "rez-channel-orchestrator" "4070" "dev"

echo ""
echo -e "${GREEN}=== CHANNEL BRIDGES ===${NC}"
start_service "SMS Bridge" "rez-sms-bridge" "4085" "dev"
start_service "Email Bridge" "rez-email-bridge" "4086" "dev"
start_service "RCS Bridge" "rez-rcs-bridge" "4087" "dev"
start_service "Web Widget" "rez-web-widget" "4088" "dev"
start_service "App Bridge" "rez-app-bridge" "4089" "dev"

echo ""
echo -e "${GREEN}=== EXPERT AGENTS ===${NC}"
start_service "Culinary Expert" "rez-culinary-expert" "3001" "dev"
start_service "Hospitality Expert" "rez-hospitality-expert" "3000" "dev"
start_service "Health Expert" "rez-health-expert" "3011" "dev"
start_service "Fitness Expert" "rez-fitness-expert" "3010" "dev"
start_service "Retail Expert" "rez-retail-expert" "3004" "dev"
start_service "Salon Expert" "rez-salon-expert" "3005" "dev"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ALL SERVICES STARTED                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Service Endpoints:${NC}"
echo "  Core Brain:        http://localhost:4000"
echo "  Orchestrator:      http://localhost:4006"
echo "  Channel Orch:      http://localhost:4070"
echo ""
echo -e "${YELLOW}Channel Bridges:${NC}"
echo "  SMS:      http://localhost:4085"
echo "  Email:    http://localhost:4086"
echo "  RCS:      http://localhost:4087"
echo "  Web:      http://localhost:4088"
echo "  App:      http://localhost:4089"
echo ""
echo -e "${YELLOW}Expert Agents:${NC}"
echo "  Culinary:     http://localhost:3001"
echo "  Hospitality:  http://localhost:3000"
echo "  Health:      http://localhost:3011"
echo "  Fitness:     http://localhost:3010"
echo "  Retail:      http://localhost:3004"
echo "  Salon:       http://localhost:3005"
echo ""
echo -e "${YELLOW}Test Commands:${NC}"
echo "  Web:  curl -X POST http://localhost:4070/api/v1/web/message \\"
echo "         -d '{\"sessionId\":\"test\",\"message\":\"order biryani\",\"userId\":\"u1\"}'"
echo ""
