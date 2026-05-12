#!/bin/bash

# =============================================================================
# REZ Intelligence Platform - Stop All Services
# =============================================================================
# This script stops all REZ Intelligence services gracefully.
#
# Usage: ./stop-all.sh [options]
#
# Options:
#   --force           Force kill all services
#   --keep-infra      Don't stop infrastructure (MongoDB, Redis)
#   --help            Show this help message
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="${SCRIPT_DIR}/.pids"
KEEP_INFRA=false
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --keep-infra)
            KEEP_INFRA=true
            shift
            ;;
        --help)
            head -20 "$0" | tail +2
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  REZ Intelligence Platform - Stopping${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${YELLOW}[STOPPING]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[STOPPED]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to stop a process
stop_process() {
    local name=$1
    local pid_file="${PID_DIR}/${name}.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "${name} (PID: ${pid})..."

            if [ "$FORCE" = true ]; then
                kill -9 "$pid" 2>/dev/null || true
            else
                # Graceful shutdown with SIGTERM
                kill "$pid" 2>/dev/null || true

                # Wait for process to terminate
                local count=0
                while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                    sleep 1
                    ((count++))
                    echo -n "."
                done

                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    echo ""
                    print_warning "${name} did not stop gracefully, forcing..."
                    kill -9 "$pid" 2>/dev/null || true
                fi
            fi

            rm -f "$pid_file"
            print_success "${name}"
        else
            print_warning "${name}: Process not running"
            rm -f "$pid_file"
        fi
    else
        print_warning "${name}: PID file not found"
    fi
}

# Stop services in reverse order (newer services first)
echo -e "${BLUE}--- Stopping Expert Agents ---${NC}"
echo ""

declare -a experts=(
    "rez-education-expert"
    "rez-culinary-expert"
    "rez-salon-expert"
    "rez-fitness-expert"
    "rez-health-expert"
    "rez-retail-expert"
    "rez-hospitality-expert"
    "rez-travel-expert"
)

for expert in "${experts[@]}"; do
    stop_process "$expert"
done

echo ""
echo -e "${BLUE}--- Stopping Bridge & Orchestrator ---${NC}"
echo ""

# Stop bridge services
stop_process "rez-whatsapp-orchestrator-bridge"
stop_process "rez-orchestrator-v2"

# Stop agent registry last (other services depend on it)
stop_process "rez-agent-registry"

echo ""
echo -e "${BLUE}--- Stopping Infrastructure ---${NC}"
echo ""

# Stop infrastructure services
if [ "$KEEP_INFRA" = false ]; then
    # Stop Redis container
    if docker ps --format '{{.Names}}' | grep -q "^rez-intelligence-redis$"; then
        print_status "Redis container..."
        docker stop rez-intelligence-redis 2>/dev/null || true
        print_success "Redis container stopped"
    else
        print_warning "Redis container not running"
    fi

    # Stop MongoDB container
    if docker ps --format '{{.Names}}' | grep -q "^rez-intelligence-mongo$"; then
        print_status "MongoDB container..."
        docker stop rez-intelligence-mongo 2>/dev/null || true
        print_success "MongoDB container stopped"
    else
        print_warning "MongoDB container not running"
    fi
else
    print_warning "Keeping infrastructure services running"
fi

# Clean up PID directory
if [ -d "$PID_DIR" ]; then
    rm -rf "$PID_DIR"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  All Services Stopped${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check for any remaining processes
REMAINING=$(ps aux | grep -E "(rez-|REZ-)" | grep -v grep | grep -v stop-all | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    print_warning "Some REZ processes may still be running:"
    ps aux | grep -E "(rez-|REZ-)" | grep -v grep | grep -v stop-all | awk '{print "  " $11, $12}'
fi

echo ""
echo "Logs are preserved in: ${SCRIPT_DIR}/logs"
echo "To start again: ./start-all.sh"
echo ""
