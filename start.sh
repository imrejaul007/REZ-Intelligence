#!/bin/bash
# =============================================================================
# REZ Intelligence - Start All Services Locally
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$BASE_DIR/logs"
PID_DIR="$BASE_DIR/pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# All services with port
SERVICES=(
  "REZ-identity-bridge:4092"
  "REZ-event-bus:4031"
  "REZ-event-platform:4008"
  "REZ-identity-graph:4050"
  "REZ-memory-engine:4051"
  "REZ-ai-router:4052"
  "REZ-reorder-engine:4040"
  "REZ-taste-profile:4041"
  "REZ-demand-forecast:4042"
  "REZ-price-predictor:4043"
  "REZ-knowledge-graph:4060"
  "REZ-merchant-brain:4061"
  "REZ-autonomous-agents:4062"
  "REZ-payments-brain:4070"
  "REZ-inventory-sync:4071"
  "REZ-creator-network:4072"
  "REZ-merchant-os:4073"
  "REZ-feedback-collector:4085"
  "REZ-unified-recommendations:4090"
  "REZ-integration-sdk:4091"
  "REZ-notification-router:4093"
  "REZ-realtime-gateway:4094"
  "REZ-health-monitor:4095"
  "REZ-validation-dashboard:4100"
  "REZ-flywheel-mvp:4101"
)

start_service() {
  local service=$1
  local port=$2
  local dir="$BASE_DIR/$service"

  if [ ! -d "$dir" ]; then
    warn "Service $service not found"
    return 1
  fi

  # Check if already running
  if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
    echo -e "  → $service (port $port) - already running"
    return 0
  fi

  echo -n "  Starting $service (port $port)... "

  # Install deps
  cd "$dir"
  [ ! -d "node_modules" ] && npm install --silent 2>/dev/null

  # Start
  nohup npm start > "$LOG_DIR/$service.log" 2>&1 &
  echo $! > "$PID_DIR/$service.pid"

  # Wait for health
  for i in {1..10}; do
    curl -s -f "http://localhost:$port/health" > /dev/null 2>&1 && break
    sleep 1
  done

  if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
  fi
}

stop_service() {
  local service=$1
  local pid_file="$PID_DIR/$service.pid"

  if [ -f "$pid_file" ]; then
    kill $(cat "$pid_file") 2>/dev/null || true
    rm -f "$pid_file"
  fi
}

start() {
  log "Starting REZ Intelligence services..."

  for item in "${SERVICES[@]}"; do
    IFS=':' read -r service port <<< "$item"
    start_service "$service" "$port"
  done

  echo ""
  log "Done! Services running:"
  echo ""
  echo "  Validation Dashboard: http://localhost:4100/dashboard"
  echo "  Flywheel Demo: http://localhost:4101/demo"
  echo "  Health Monitor: http://localhost:4095/dashboard"
  echo ""
  echo "  To see logs: tail -f logs/*.log"
  echo "  To stop: ./start.sh stop"
}

stop() {
  log "Stopping services..."
  for item in "${SERVICES[@]}"; do
    IFS=':' read -r service port <<< "$item"
    stop_service "$service"
  done
  log "All stopped."
}

status() {
  echo "Service Status:"
  for item in "${SERVICES[@]}"; do
    IFS=':' read -r service port <<< "$item"
    if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
      echo -e "  ${GREEN}✓${NC} $service (port $port)"
    else
      echo -e "  ${RED}✗${NC} $service (port $port)"
    fi
  done
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "Usage: $0 {start|stop|status}" ;;
esac
