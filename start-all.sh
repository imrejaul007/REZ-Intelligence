#!/bin/bash

# =============================================================================
# REZ Intelligence Platform - Start All Services
# =============================================================================
# This script starts all REZ Intelligence services including the new bridge
# and registry services.
#
# Usage: ./start-all.sh [options]
#
# Options:
#   --skip-infrastructure    Skip starting MongoDB and Redis
#   --development            Start in development mode (with logs visible)
#   --production             Start in production mode (background)
#   --help                   Show this help message
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
LOG_DIR="${SCRIPT_DIR}/logs"
PID_DIR="${SCRIPT_DIR}/.pids"
SKIP_INFRA=false
DEVELOPMENT=false
PRODUCTION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-infrastructure)
            SKIP_INFRA=true
            shift
            ;;
        --development)
            DEVELOPMENT=true
            shift
            ;;
        --production)
            PRODUCTION=true
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

# Create directories
mkdir -p "${LOG_DIR}"
mkdir -p "${PID_DIR}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  REZ Intelligence Platform - Starting${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}[STARTING]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for a service
wait_for_service() {
    local host=$1
    local port=$2
    local name=$3
    local max_attempts=${4:-30}
    local attempt=1

    echo -n "  Waiting for ${name}..."

    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo -e " ${GREEN}Ready${NC}"
            return 0
        fi
        sleep 1
        echo -n "."
        ((attempt++))
    done

    echo -e " ${RED}Timeout${NC}"
    return 1
}

# Function to start a Node.js service
start_node_service() {
    local name=$1
    local dir=$2
    local port=$3
    local log_file="${LOG_DIR}/${name}.log"
    local pid_file="${PID_DIR}/${name}.pid"

    # Check if already running
    if [ -f "$pid_file" ]; then
        local existing_pid=$(cat "$pid_file")
        if kill -0 "$existing_pid" 2>/dev/null; then
            print_warning "${name} is already running (PID: ${existing_pid})"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi

    # Check if directory exists
    if [ ! -d "$dir" ]; then
        print_error "${name}: Directory not found: ${dir}"
        return 1
    fi

    # Check if node_modules exists
    if [ ! -d "${dir}/node_modules" ]; then
        print_status "${name}: Installing dependencies..."
        cd "$dir" && npm install --silent 2>/dev/null || {
            print_error "${name}: Failed to install dependencies"
            return 1
        }
    fi

    # Build if needed
    if [ -f "${dir}/package.json" ]; then
        local build_script=$(node -p "require('${dir}/package.json').scripts?.build || ''" 2>/dev/null)
        if [ -n "$build_script" ]; then
            print_status "${name}: Building..."
            cd "$dir" && npm run build 2>/dev/null || {
                print_warning "${name}: Build failed, trying to start anyway..."
            }
        fi
    fi

    # Start the service
    print_status "${name}: Starting on port ${port}..."

    cd "$dir"

    if [ "$DEVELOPMENT" = true ]; then
        # Start with dev mode (watch mode)
        npm run dev > "$log_file" 2>&1 &
    elif [ "$PRODUCTION" = true ]; then
        # Start in production mode
        npm start > "$log_file" 2>&1 &
    else
        # Default: npm start
        npm start > "$log_file" 2>&1 &
    fi

    local pid=$!
    echo $pid > "$pid_file"

    # Wait a moment for startup
    sleep 2

    # Check if started successfully
    if kill -0 "$pid" 2>/dev/null; then
        print_success "${name} started (PID: ${pid})"
        return 0
    else
        print_error "${name}: Failed to start"
        cat "$log_file" | tail -20
        rm -f "$pid_file"
        return 1
    fi
}

# Function to start infrastructure services
start_infrastructure() {
    echo ""
    echo -e "${BLUE}--- Infrastructure Services ---${NC}"
    echo ""

    # Check if Docker is available
    if command_exists docker; then
        # Start MongoDB
        if ! docker ps --format '{{.Names}}' | grep -q "^rez-intelligence-mongo$"; then
            print_status "Starting MongoDB..."
            docker run -d \
                --name rez-intelligence-mongo \
                -p 27017:27017 \
                -v rez-mongo-data:/data/db \
                mongo:7 \
                --replSet rs0 \
                --bind_ip_all 2>/dev/null || {
                    print_warning "MongoDB container already exists, starting..."
                    docker start rez-intelligence-mongo 2>/dev/null || true
                }

            wait_for_service localhost 27017 "MongoDB" 30
        else
            print_success "MongoDB is already running"
        fi

        # Start Redis
        if ! docker ps --format '{{.Names}}' | grep -q "^rez-intelligence-redis$"; then
            print_status "Starting Redis..."
            docker run -d \
                --name rez-intelligence-redis \
                -p 6379:6379 \
                -v rez-redis-data:/data \
                redis:7-alpine 2>/dev/null || {
                    print_warning "Redis container already exists, starting..."
                    docker start rez-intelligence-redis 2>/dev/null || true
                }

            wait_for_service localhost 6379 "Redis" 10
        else
            print_success "Redis is already running"
        fi
    else
        print_warning "Docker not found, skipping infrastructure services"
        print_warning "Please ensure MongoDB and Redis are running manually"
    fi

    echo ""
}

# Main startup sequence
main() {
    echo ""
    echo -e "${BLUE}--- Starting Infrastructure ---${NC}"

    if [ "$SKIP_INFRA" = false ]; then
        start_infrastructure
    else
        print_warning "Skipping infrastructure services"
    fi

    echo ""
    echo -e "${BLUE}--- Core Services ---${NC}"
    echo ""

    # Start Agent Registry (MUST start first as other services depend on it)
    start_node_service "rez-agent-registry" \
        "${SCRIPT_DIR}/rez-agent-registry" \
        4011

    # Start Orchestrator v2
    if [ -d "${SCRIPT_DIR}/rez-orchestrator-v2" ]; then
        start_node_service "rez-orchestrator-v2" \
            "${SCRIPT_DIR}/rez-orchestrator-v2" \
            4015
    fi

    # Start WhatsApp Bridge
    start_node_service "rez-whatsapp-orchestrator-bridge" \
        "${SCRIPT_DIR}/rez-whatsapp-orchestrator-bridge" \
        4010

    echo ""
    echo -e "${BLUE}--- Expert Agents ---${NC}"
    echo ""

    # Start expert agents
    declare -a experts=(
        "rez-travel-expert:3003"
        "rez-hospitality-expert:3004"
        "rez-retail-expert:3005"
        "rez-health-expert:3006"
        "rez-fitness-expert:3007"
        "rez-salon-expert:3008"
        "rez-culinary-expert:3009"
        "rez-education-expert:3010"
    )

    for expert_config in "${experts[@]}"; do
        IFS=':' read -r name port <<< "$expert_config"
        if [ -d "${SCRIPT_DIR}/${name}" ]; then
            start_node_service "$name" "${SCRIPT_DIR}/${name}" "$port"
        fi
    done

    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  All Services Started${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""
    echo "Logs directory: ${LOG_DIR}"
    echo "PID directory: ${PID_DIR}"
    echo ""

    if [ "$DEVELOPMENT" = true ]; then
        echo -e "${GREEN}Running in development mode...${NC}"
        echo "Press Ctrl+C to stop"
        tail -f "${LOG_DIR}"/*.log 2>/dev/null || true
    else
        echo "To view logs: tail -f ${LOG_DIR}/<service-name>.log"
        echo "To stop all:  ./stop-all.sh"
        echo ""
    fi
}

# Run main
main "$@"
