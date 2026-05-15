#!/usr/bin/env bash
#
# setup-vault.sh - Initialize and configure HashiCorp Vault for REZ services
# Usage: ./scripts/setup-vault.sh [options]
#

set -euo pipefail

# Configuration
VAULT_ENDPOINT="${VAULT_ENDPOINT:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
VAULT_PREFIX="${VAULT_PREFIX:-secret}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/vault-setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

info() { log "INFO" "${BLUE}$*${NC}"; }
success() { log "SUCCESS" "${GREEN}$*${NC}"; }
warn() { log "WARN" "${YELLOW}$*${NC}"; }
error() { log "ERROR" "${RED}$*${NC}"; }

# Check if Vault is running
check_vault() {
    info "Checking Vault status at ${VAULT_ENDPOINT}..."

    if ! command -v vault &> /dev/null; then
        error "Vault CLI not found. Please install Vault first."
        exit 1
    fi

    export VAULT_ADDR="${VAULT_ENDPOINT}"
    export VAULT_TOKEN="${VAULT_TOKEN}"

    if ! vault status &> /dev/null; then
        error "Cannot connect to Vault. Is Vault running?"
        exit 1
    fi

    success "Vault is accessible"
}

# Enable required secrets engines
enable_secrets_engines() {
    info "Enabling secrets engines..."

    # Enable KV-v2 secrets engine
    if ! vault secrets list "${VAULT_PREFIX}" &> /dev/null; then
        vault secrets enable -path="${VAULT_PREFIX}" -description="REZ services secrets" kv-v2
        success "Enabled KV-v2 at ${VAULT_PREFIX}"
    else
        info "KV-v2 already enabled at ${VAULT_PREFIX}"
    fi

    # Enable transit secrets engine for encryption
    if ! vault secrets list transit &> /dev/null; then
        vault secrets enable -path=transit -description="Encryption as a service" transit
        success "Enabled transit secrets engine"
    else
        info "Transit already enabled"
    fi

    # Enable database secrets engine
    if ! vault secrets list database &> /dev/null; then
        vault secrets enable -path=database -description="Dynamic database credentials" database
        success "Enabled database secrets engine"
    else
        info "Database already enabled"
    fi
}

# Create encryption keys
create_transit_keys() {
    info "Creating transit encryption keys..."

    local keys=("app-keys" "service-keys" "user-keys")

    for key in "${keys[@]}"; do
        if ! vault list transit/keys 2>/dev/null | grep -q "^${key}$"; then
            vault write transit/keys/"${key}" type=rsa-4096
            success "Created key: ${key}"
        else
            info "Key already exists: ${key}"
        fi
    done
}

# Enable and configure AppRole authentication
setup_approle() {
    info "Configuring AppRole authentication..."

    if ! vault auth list approle &> /dev/null; then
        vault auth enable -description="AppRole authentication for services" approle
        success "Enabled AppRole"
    else
        info "AppRole already enabled"
    fi

    # Create a policy for REZ services
    cat > /tmp/rez-services-policy.hcl << 'EOF'
# REZ Services Policy

# Secret paths
path "${VAULT_PREFIX}/*" {
    capabilities = ["read", "list"]
}

path "${VAULT_PREFIX}/services/*" {
    capabilities = ["read", "create", "update", "delete", "list"]
}

# Transit encryption
path "transit/encrypt/*" {
    capabilities = ["update"]
}

path "transit/decrypt/*" {
    capabilities = ["update"]
}

path "transit/keys/*" {
    capabilities = ["read"]
}

# Database credentials
path "database/creds/*" {
    capabilities = ["read"]
}

# Health and status
path "sys/health" {
    capabilities = ["read"]
}
EOF

    vault policy write rez-services /tmp/rez-services-policy.hcl
    success "Created rez-services policy"

    # Create AppRole
    if ! vault list auth/approle/role &> /dev/null | grep -q "rez-service"; then
        vault write auth/approle/role/rez-service \
            token_policies="rez-services" \
            token_ttl=1h \
            token_max_ttl=24h \
            secret_id_ttl=30d

        success "Created AppRole: rez-service"
    else
        info "AppRole rez-service already exists"
    fi

    # Generate role credentials for initial setup
    read_approle_credentials() {
        info "Fetching AppRole credentials..."

        local role_id=$(vault read -format=json auth/approle/role/rez-service/role-id | jq -r '.data.role_id')
        local secret_id=$(vault write -format=json -f auth/approle/role/rez-service/secret-id | jq -r '.data.secret_id')

        echo ""
        echo "========================================"
        success "AppRole Credentials Created"
        echo "========================================"
        echo ""
        echo "ROLE_ID: ${role_id}"
        echo "SECRET_ID: ${secret_id}"
        echo ""
        echo "Add these to your environment:"
        echo "export VAULT_APPROLE_ROLE_ID=${role_id}"
        echo "export VAULT_APPROLE_SECRET_ID=${secret_id}"
        echo "========================================"
        echo ""
    }

    read_approle_credentials
}

# Create sample secrets for testing
create_sample_secrets() {
    info "Creating sample secrets..."

    # Sample service config
    vault kv put "${VAULT_PREFIX}/services/payment-service" \
        api_key="sk_test_sample_key" \
        webhook_secret="whsec_sample_secret" \
        razorpay_key_id="rzp_test_sample"

    success "Created sample payment-service secrets"

    # Sample database config
    vault kv put "${VAULT_PREFIX}/services/database" \
        host="localhost" \
        port="5432" \
        name="rez_db" \
        pool_size="10"

    success "Created sample database config"
}

# Print setup summary
print_summary() {
    echo ""
    echo "========================================"
    info "Vault Setup Complete"
    echo "========================================"
    echo ""
    echo "Secrets Engine: ${VAULT_PREFIX}"
    echo "Transit Engine: transit"
    echo "Database Engine: database"
    echo "Auth Method: AppRole"
    echo ""
    echo "Next steps:"
    echo "1. Copy AppRole credentials to your environment"
    echo "2. Add to .env: VAULT_APPROLE_ROLE_ID and VAULT_APPROLE_SECRET_ID"
    echo "3. Update your service config to use VaultClient"
    echo ""
    echo "Log file: ${LOG_FILE}"
    echo "========================================"
    echo ""
}

# Main execution
main() {
    echo ""
    info "Starting Vault setup for REZ services..."
    echo ""

    check_vault
    enable_secrets_engines
    create_transit_keys
    setup_approle
    create_sample_secrets
    print_summary

    success "Setup complete!"
}

# Run main function
main "$@"
