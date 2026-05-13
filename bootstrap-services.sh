#!/bin/bash
#
# REZ Intelligence Service Bootstrap Script
# Registers all expert services with the Agent Registry
#

set -e

# Configuration
AGENT_REGISTRY_URL="${AGENT_REGISTRY_URL:-http://localhost:4073}"
INTERNAL_TOKEN="${INTERNAL_SERVICE_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if jq is available
check_jq() {
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed. Please install jq first."
        exit 1
    fi
}

# Register a service with the registry
register_service() {
    local name="$1"
    local url="$2"
    local type="$3"
    local capabilities="$4"
    local metadata="$5"

    log_info "Registering $name ($type) at $url..."

    local response
    local status_code

    response=$(curl -s -w "\n%{http_code}" -X POST "$AGENT_REGISTRY_URL/api/registry/register" \
        -H "Content-Type: application/json" \
        ${INTERNAL_TOKEN:+-H "X-Internal-Token: $INTERNAL_TOKEN"} \
        -d "{
            \"name\": \"$name\",
            \"url\": \"$url\",
            \"type\": \"$type\",
            \"capabilities\": $capabilities,
            \"metadata\": $metadata
        }" 2>/dev/null) || true

    status_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "200" ] || [ "$status_code" = "201" ]; then
        log_info "Successfully registered $name"
        return 0
    elif [ "$status_code" = "409" ]; then
        log_warn "$name is already registered (updating instead)..."
        return 0
    else
        log_error "Failed to register $name (HTTP $status_code)"
        log_error "Response: $body"
        return 1
    fi
}

# Update agent status
update_status() {
    local agent_id="$1"
    local status="$2"

    curl -s -X PATCH "$AGENT_REGISTRY_URL/api/registry/agents/$agent_id/status" \
        -H "Content-Type: application/json" \
        ${INTERNAL_TOKEN:+-H "X-Internal-Token: $INTERNAL_TOKEN"} \
        -d "{\"status\": \"$status\"}" > /dev/null 2>&1 || true
}

# Wait for registry to be ready
wait_for_registry() {
    local max_attempts=30
    local attempt=1

    log_info "Waiting for Agent Registry at $AGENT_REGISTRY_URL..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$AGENT_REGISTRY_URL/health" > /dev/null 2>&1; then
            log_info "Agent Registry is ready!"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done

    log_error "Agent Registry did not become ready in time"
    return 1
}

# Main bootstrap process
main() {
    echo "========================================"
    echo "  REZ Intelligence Service Bootstrap"
    echo "========================================"
    echo ""

    check_jq

    # Wait for registry
    wait_for_registry || {
        log_error "Could not connect to Agent Registry"
        exit 1
    }

    echo ""
    log_info "Starting service registration..."
    echo ""

    # Register Orchestrator
    register_service \
        "orchestrator" \
        "http://localhost:4070" \
        "orchestrator" \
        '["routing", "orchestration", "collaboration"]' \
        '{"version": "2.0.0", "serviceName": "rez-orchestrator-v2"}'

    # Register Context Engine
    register_service \
        "context-engine" \
        "http://localhost:4071" \
        "engine" \
        '["context", "session-management", "merchant-context"]' \
        '{"version": "1.0.0", "serviceName": "rez-context-engine"}'

    # Register Core Brain
    register_service \
        "core-brain" \
        "http://localhost:4072" \
        "brain" \
        '["memory", "personalization", "intelligence", "loyalty"]' \
        '{"version": "1.0.0", "serviceName": "rez-core-brain"}'

    # Register Hospitality Expert
    register_service \
        "hospitality-expert" \
        "http://localhost:3000" \
        "expert" \
        '["hotel_booking", "checkin_checkout", "room_service", "concierge", "recommendations", "workflows"]' \
        '{"version": "1.0.0", "serviceName": "rez-hospitality-expert", "domain": "hospitality"}'

    # Register Culinary Expert
    register_service \
        "culinary-expert" \
        "http://localhost:3001" \
        "expert" \
        '["menu_browse", "recommendations", "dietary_check", "order_management", "pairing_suggestions", "cuisine_info"]' \
        '{"version": "1.0.0", "serviceName": "rez-culinary-expert", "domain": "culinary"}'

    echo ""
    log_info "Service registration complete!"
    echo ""

    # List registered agents
    log_info "Registered services:"
    curl -s "$AGENT_REGISTRY_URL/api/registry/agents" | jq -r '.agents[] | "  - \(.name) (\(.type)): \(.url)"' 2>/dev/null || {
        log_warn "Could not fetch registered agents"
    }

    echo ""
    log_info "Bootstrap completed successfully!"
}

# Run main function
main "$@"
