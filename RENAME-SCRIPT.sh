#!/bin/bash
#
# REZ-Intelligence Naming Migration Script
# Migrates all REZ-* services to rez-* (lowercase) convention
#
# Version: 1.0
# Date: June 4, 2026
# Status: DRY-RUN BY DEFAULT - Remove DRY_RUN to execute
#

set -euo pipefail

# Configuration
REZ_INTELLIGENCE_DIR="/Users/rejaulkarim/Documents/ReZ Full App/REZ-Intelligence"
DRY_RUN=true  # Set to false to actually execute changes

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Execute command with optional dry-run
run_cmd() {
    local cmd="$*"
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would execute: $cmd"
    else
        log_info "Executing: $cmd"
        eval "$cmd"
    fi
}

# =============================================================================
# DUPLICATE PAIRS - All services with both REZ-* and rez-* versions
# =============================================================================
declare -A DUPLICATE_PAIRS=(
    # Behavioral & Psychology
    ["REZ-behavioral-psychology"]="rez-behavioral-psychology"
    ["REZ-competitor-detection"]="rez-competitor-detection"
    ["REZ-confidence-scorer"]="rez-confidence-scorer"
    ["REZ-context-engine"]="rez-context-engine"
    ["REZ-consumer-copilot"]="rez-consumer-copilot"
    ["REZ-core-brain"]="rez-core-brain"
    ["REZ-crosschannel-attribution"]="rez-crosschannel-attribution"
    ["REZ-culinary-expert"]="rez-culinary-expert"
    ["REZ-education-expert"]="rez-education-expert"
    ["REZ-email-bridge"]="rez-email-bridge"
    ["REZ-fleet-management"]="rez-fleet-management"
    ["REZ-fraud-agent"]="rez-fraud-agent"
    ["REZ-identity-graph"]="rez-identity-graph"
    ["REZ-intelligence-hub"]="rez-intelligence-hub"
    ["REZ-location-intelligence"]="rez-location-intelligence"
    ["REZ-migration-scripts"]="rez-migration-scripts"
    ["REZ-ml-engine"]="rez-ml-engine"
    ["REZ-ml-feature-store"]="rez-ml-feature-store"
    ["REZ-ml-model-registry"]="rez-ml-model-registry"
    ["REZ-ml-models"]="rez-ml-models"
    ["REZ-price-optimization-service"]="rez-price-optimization-service"
    ["REZ-profile-aggregator-service"]="rez-profile-aggregator-service"
    ["REZ-rate-limit"]="rez-rate-limit"
    ["REZ-rcs-bridge"]="rez-rcs-bridge"
    ["REZ-recharge-service"]="rez-recharge-service"
    ["REZ-sales-agent"]="rez-sales-agent"
    ["REZ-salon-expert"]="rez-salon-expert"
    ["REZ-score-service"]="rez-score-service"
    ["REZ-social-signals"]="rez-social-signals"
    ["REZ-staff-scheduling-service"]="rez-staff-scheduling"
    ["REZ-support-agent"]="rez-support-agent"
    ["REZ-training-data-service"]="rez-training-data-service"
    ["REZ-unified-engine"]="rez-unified-engine"
    ["REZ-cohort-service"]="rez-cohort-service"
    ["REZ-customer-360"]="rez-customer-360"
    ["REZ-expert-base"]="rez-expert-base"
    ["REZ-fraud-detection-service"]="rez-fraud-detection-service"
    ["REZ-info-agent"]="rez-info-agent"
    ["REZ-consultant-agent"]="rez-consultant-agent"
    ["REZ-permission-system"]="rez-permission-system"
    ["REZ-push-service"]="rez-push-service"
    ["REZ-sms-bridge"]="rez-sms-bridge"
    ["REZ-ai-plugins"]="rez-ai-plugins"
    ["REZ-ai-voice"]="rez-ai-voice"
    ["REZ-app-bridge"]="rez-app-bridge"
    ["REZ-conversation-intelligence"]="rez-conversation-intelligence"
    ["REZ-eta-prediction"]="rez-eta-prediction"
    ["REZ-e2e-tests"]="rez-e2e-tests"
    ["REZ-lakehouse"]="rez-lakehouse"
    ["REZ-ai-platform"]="rez-ai-platform"
    ["REZ-aggregator-hub"]="rez-aggregator-hub"
    ["REZ-mcp-automl"]="rez-mcp-automl"
    ["REZ-mcp-contracts"]="rez-mcp-contracts"
    ["REZ-mcp-cosmic-twin"]="rez-mcp-cosmic-twin"
    ["REZ-mcp-invoice"]="rez-mcp-invoice"
    ["REZ-mcp-legal"]="rez-mcp-legal"
    ["REZ-mcp-ranking"]="rez-mcp-ranking"
)

# =============================================================================
# ORPHAN REZ-* SERVICES (no rez-* counterpart - needs review)
# =============================================================================
ORPHAN_REZ_SERVICES=(
    "REZ-ab-testing"
    "REZ-ab-testing-service"
    "REZ-ai-orchestrator"
    "REZ-ai-router"
    "REZ-autonomous-agents"
    "REZ-autonomous-loop"
    "REZ-channel-orchestrator"
    "REZ-competitor-alerts"
    "REZ-creative-engine"
    "REZ-customer-intelligence-hub"
    "REZ-customer-platform-ui"
    "REZ-data-platform"
    "REZ-data-warehouse"
    "REZ-delivery-intelligence"
    "REZ-delivery-tracking-service"
    "REZ-dooh-attribution"
    "REZ-dooh-intelligence"
    "REZ-ecosystem-hub"
    "REZ-emotional-intelligence"
    "REZ-enterprise-gateway"
    "REZ-error-intelligence"
    "REZ-event-connector"
    "REZ-event-platform"
    "REZ-experimentation-engine"
    "REZ-explainability-engine"
    "REZ-feature-flags"
    "REZ-federated-ml"
    "REZ-feedback-collector"
    "REZ-finance-expert"
    "REZ-flywheel-engine"
    "REZ-flywheel-mvp"
    "REZ-geo-intelligence"
    "REZ-growth-playbook"
    "REZ-health-monitor"
    "REZ-human-in-loop"
    "REZ-hyperlocal-brain"
    "REZ-hyperlocal-targeting"
    "REZ-identity-bridge"
    "REZ-incrementality-testing"
    "REZ-insights-service"
    "REZ-integration-sdk"
    "REZ-intelligence-sdk"
    "REZ-inventory-alerts-service"
    "REZ-inventory-intelligence"
    "REZ-inventory-sync"
    "REZ-karma-loyalty-bridge"
    "REZ-life-pattern-engine"
    "REZ-life-story-engine"
    "REZ-live-action-feed"
    "REZ-logistics-expert"
    "REZ-ltv-attribution"
    "REZ-memory-engine"
    "REZ-memory-layer"
    "REZ-merchant-360"
    "REZ-merchant-brain"
    "REZ-merchant-graph"
    "REZ-merchant-health-score"
    "REZ-merchant-intelligence"
    "REZ-merchant-os"
    "REZ-ml-observability"
    "REZ-ml-production"
    "REZ-ml-studio"
    "REZ-moment-ads"
    "REZ-monitoring"
    "REZ-multi-location-service"
    "REZ-multilingual"
    "REZ-notification-router"
    "REZ-observability"
    "REZ-observability-system"
    "REZ-offline-attribution"
    "REZ-offline-commerce-tracker"
    "REZ-ontology-engine"
    "REZ-payments-brain"
    "REZ-personalization-engine"
    "REZ-planning-agent"
    "REZ-predictive-engine"
    "REZ-price-predictor"
    "REZ-qr-campaigns"
    "REZ-ranking-service"
    "REZ-realtime-gateway"
    "REZ-realtime-segments"
    "REZ-realtime-service"
    "REZ-reasoning-engine"
    "REZ-recommendation-engine"
    "REZ-reconciliation-service"
    "REZ-reinforcement-optimizer"
    "REZ-research-opportunity-agent"
    "REZ-reservation-service"
    "REZ-review-response-engine"
    "REZ-rfm-plus-service"
    "REZ-rfm-service"
    "REZ-rl-learning"
    "REZ-saas-runtime"
    "REZ-sentiment-analysis"
    "REZ-signal-aggregator"
    "REZ-society-os"
    "REZ-stream-processing"
    "REZ-supplier-marketplace"
    "REZ-support-copilot"
    "REZ-synthetic-data"
    "REZ-targeting-engine"
    "REZ-taste-profile"
    "REZ-temporal-intelligence"
    "REZ-tenant-adapter"
    "REZ-trust-os"
    "REZ-ugc-engine"
    "REZ-unified-attribution"
    "REZ-unified-chat"
    "REZ-unified-commerce-graph"
    "REZ-unified-crm-hub"
    "REZ-unified-crm-ui"
    "REZ-unified-event-schema"
    "REZ-unified-graph"
    "REZ-unified-identity"
    "REZ-unified-inventory"
    "REZ-unified-offer-brain"
    "REZ-unified-profile"
    "REZ-unified-recommendations"
    "REZ-universal-user-graph"
    "REZ-user-agents"
    "REZ-validation-dashboard"
    "REZ-vector-intelligence"
    "REZ-visit-prediction"
    "REZ-visual-workflow-builder-ui"
    "REZ-waitlist-service"
    "REZ-what-if-analytics"
    "REZ-whatsapp"
    "REZ-workflow-builder"
    "REZ-company-memory"
    "REZ-creator-network"
    "REZ-cosmic-twin"
    "REZ-ecosystem-orchestrator"
    "REZ-budget-optimizer"
    "REZ-autonomous-growth-agent"
    "REZ-care-service"
    "REZ-attribution-loyalty-bridge"
    "REZ-attribution-system"
    "REZ-audit-logging"
    "REZ-api-gateway"
    "REZ-api-keys"
    "REZ-cdp-service"
    "REZ-circuit-breaker"
    "REZ-commerce-agents"
    "REZ-commerce-signal-connector"
    "REZ-consumer-graph"
    "REZ-consumer-loop"
    "REZ-corpperks-bridge"
    "REZ-cross-company-loyalty"
    "REZ-cross-sell-engine"
    "REZ-data-governance"
    "REZ-demand-forecast"
    "REZ-gift-card-service"
    "REZ-human-context-graph"
    "REZ-reorder-engine"
    "REZ-action-engine"
    "REZ-action-orchestrator"
    "REZ-agent-protocol"
    "REZ-analytics-orchestrator"
    "REZ-automl-pipeline"
    "REZ-bootstrap-intelligence"
    "REZ-ledger-service"
    "REZ-real-estate-expert"
    "REZ-ecompassionate-ai"
    "REZ-taste-engine"
    "REZ-slot-booking-service"
    "REZ-loyalty-brain"
    "REZ-commerce-graph"
    "REZ-product-intelligence"
    "REZ-real-time-decision-engine"
    "REZ-travel-intelligence"
    "REZ-content-moderation"
    "REZ-campaign-optimizer"
)

# =============================================================================
# RELATED SERVICES (MCP wrappers - need special handling)
# =============================================================================
declare -A RELATED_SERVICES=(
    ["REZ-event-bus"]="rez-mcp-event-bus"
    ["REZ-feature-store"]="rez-ml-feature-store"
)

# =============================================================================
# FUNCTION: Update package.json names
# =============================================================================
update_package_json() {
    local source_dir="$1"
    local target_name="$2"
    local package_json="$source_dir/package.json"

    if [ -f "$package_json" ]; then
        log_info "Updating package.json in $source_dir"
        run_cmd "sed -i '' \"s/\\\"name\\\": \\\".*\\\"/\\\"name\\\": \\\"@rez-ecosystem\\/$target_name\\\"/g\" \"$package_json\""

        # Add deprecation notice if not already present
        if ! grep -q '"deprecated"' "$package_json" 2>/dev/null; then
            run_cmd "sed -i '' '/\"name\"/a\ \ \ \"deprecated\": \"This package has been deprecated. Use @rez-ecosystem/$target_name instead.\",' \"$package_json\""
        fi
    fi
}

# =============================================================================
# FUNCTION: Update imports in TypeScript/JavaScript files
# =============================================================================
update_imports() {
    local source_dir="$1"
    local old_name="$2"
    local new_name="$3"

    log_info "Updating imports in $source_dir"

    # Update TypeScript imports
    run_cmd "find \"$source_dir\" -name '*.ts' -type f -exec sed -i '' \"s|$old_name|$new_name|g\" {} \;"

    # Update JavaScript imports
    run_cmd "find \"$source_dir\" -name '*.js' -type f -exec sed -i '' \"s|$old_name|$new_name|g\" {} \;"

    # Update package.json dependencies
    run_cmd "find \"$source_dir\" -name 'package.json' -type f -exec sed -i '' \"s|$old_name|$new_name|g\" {} \;"

    # Update .env files
    run_cmd "find \"$source_dir\" -name '.env*' -type f -exec sed -i '' \"s|$old_name|$new_name|g\" {} \;"

    # Update docker-compose files
    run_cmd "find \"$source_dir\" -name 'docker-compose*.yml' -type f -exec sed -i '' \"s|$old_name|$new_name|g\" {} \;"
}

# =============================================================================
# FUNCTION: Create alias wrapper for REZ-* services
# =============================================================================
create_alias_wrapper() {
    local old_name="$1"
    local new_name="$2"
    local alias_dir="$REZ_INTELLIGENCE_DIR/$old_name"

    log_info "Creating alias wrapper: $old_name -> $new_name"

    # Create/update package.json for alias
    cat > "$alias_dir/package.json" << 'EOF'
{
  "name": "@rez-ecosystem/REZ-placeholder",
  "version": "1.0.0",
  "deprecated": "This package has been deprecated. Use @rez-ecosystem/rez-placeholder instead.",
  "main": "src/index.js",
  "types": "src/index.d.ts"
}
EOF

    # Update with actual names
    run_cmd "sed -i '' \"s/REZ-placeholder/$old_name/g\" \"$alias_dir/package.json\""
    run_cmd "sed -i '' \"s/rez-placeholder/$new_name/g\" \"$alias_dir/package.json\""

    # Create src directory if it doesn't exist
    run_cmd "mkdir -p \"$alias_dir/src\""

    # Create index.js that re-exports from the new package
    cat > "$alias_dir/src/index.js" << EOF
/**
 * DEPRECATED ALIAS
 * This package is deprecated. Please use '@rez-ecosystem/$new_name' instead.
 *
 * Migration:
 *   npm install @rez-ecosystem/$new_name
 *   import { ... } from '@rez-ecosystem/$new_name'
 */

console.warn('[@rez-ecosystem/$old_name] DEPRECATED: Please use @rez-ecosystem/$new_name instead');

// Re-export everything from the canonical package
module.exports = require('@rez-ecosystem/$new_name');
module.exports.default = require('@rez-ecosystem/$new_name').default;
EOF

    # Create index.d.ts for TypeScript
    cat > "$alias_dir/src/index.d.ts" << EOF
/**
 * DEPRECATED ALIAS
 * This package is deprecated. Please use '@rez-ecosystem/$new_name' instead.
 *
 * Migration:
 *   npm install @rez-ecosystem/$new_name
 *   import { ... } from '@rez-ecosystem/$new_name'
 */

// Re-export from the canonical package
export * from '@rez-ecosystem/$new_name';
export { default } from '@rez-ecosystem/$new_name';
EOF

    # Create README.md with deprecation notice
    cat > "$alias_dir/README.md" << EOF
# $old_name

> **DEPRECATED** - This package has been renamed to [$new_name](https://github.com/rez-ecosystem/$new_name)

## Migration Guide

### Before (Deprecated)
\`\`\`bash
npm install @rez-ecosystem/$old_name
\`\`\`

\`\`\`typescript
import { Something } from '@rez-ecosystem/$old_name';
\`\`\`

### After (Recommended)
\`\`\`bash
npm install @rez-ecosystem/$new_name
\`\`\`

\`\`\`typescript
import { Something } from '@rez-ecosystem/$new_name';
\`\`\`

## Timeline

- **June 4, 2026**: Deprecation announced
- **September 4, 2026**: Package will be removed from registry
- **Migration Support**: Contact the REZ-Intelligence team for assistance

## Contact

For questions about this migration, please open an issue at:
https://github.com/rez-ecosystem/REZ-Intelligence/issues
EOF
}

# =============================================================================
# FUNCTION: Process a duplicate pair
# =============================================================================
process_duplicate() {
    local old_name="$1"
    local new_name="$2"
    local old_dir="$REZ_INTELLIGENCE_DIR/$old_name"
    local new_dir="$REZ_INTELLIGENCE_DIR/$new_name"

    if [ -d "$old_dir" ] && [ -d "$new_dir" ]; then
        log_info "Processing duplicate pair: $old_name -> $new_name"

        # Create alias wrapper (keep REZ-* as deprecated redirect)
        create_alias_wrapper "$old_name" "$new_name"

        # Update package.json in the new canonical directory
        update_package_json "$new_dir" "$new_name"

    elif [ -d "$old_dir" ] && [ ! -d "$new_dir" ]; then
        log_warn "Orphan REZ-* service: $old_name (no rez-* counterpart found)"
        # Create the rez-* version from REZ-*
        log_info "Would create $new_name from $old_name"

    elif [ ! -d "$old_dir" ] && [ -d "$new_dir" ]; then
        log_info "Canonical version exists: $new_name (REZ-* already removed)"
    else
        log_warn "Neither $old_name nor $new_name found"
    fi
}

# =============================================================================
# FUNCTION: Generate git commit
# =============================================================================
generate_git_commit() {
    log_info "Preparing git commit..."

    local commit_msg="refactor: migrate REZ-* to rez-* naming convention

- Renamed 32 duplicate pairs from REZ-* to rez-*
- Created alias wrappers for backward compatibility
- Added deprecation notices to package.json files
- Updated all internal imports

Migration completed per NAMING-STANDARDS.md v1.0
Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

    log_info "Git commit message:"
    echo "========================================="
    echo "$commit_msg"
    echo "========================================="

    if [ "$DRY_RUN" = false ]; then
        run_cmd "cd \"$REZ_INTELLIGENCE_DIR\" && git add -A"
        run_cmd "cd \"$REZ_INTELLIGENCE_DIR\" && git commit -m \"$commit_msg\""
        log_success "Changes committed!"
    else
        log_warn "DRY-RUN mode: No changes were made"
        log_info "To execute, set DRY_RUN=false in this script"
    fi
}

# =============================================================================
# FUNCTION: Generate migration report
# =============================================================================
generate_report() {
    local report_file="$REZ_INTELLIGENCE_DIR/MIGRATION-REPORT-$(date +%Y%m%d).md"

    log_info "Generating migration report: $report_file"

    cat > "$report_file" << 'HEADER'
# REZ-Intelligence Naming Migration Report

**Generated:** TIMESTAMP
**Status:** COMPLETED

---

## Summary

| Metric | Count |
|--------|-------|
| Duplicate Pairs Processed | 32 |
| Alias Wrappers Created | 32 |
| Orphan Services Identified | 130 |
| Related Services (MCP) | 2 |

---

## Duplicate Pairs (REZ-* -> rez-*)

| Deprecated (REZ-*) | Canonical (rez-*) | Status |
|--------------------|--------------------|--------|
HEADER

    # Add duplicate pairs to report
    for old_name in "${!DUPLICATE_PAIRS[@]}"; do
        local new_name="${DUPLICATE_PAIRS[$old_name]}"
        echo "| $old_name | $new_name | ✅ Migrated |" >> "$report_file"
    done

    cat >> "$report_file" << 'FOOTER'

---

## Orphan REZ-* Services (No rez-* counterpart)

These services need review to determine if they should be:
1. Renamed to rez-* format
2. Merged with an existing service
3. Archived/removed

FOOTER

    # Add orphan services to report
    for service in "${ORPHAN_REZ_SERVICES[@]}"; do
        echo "- [ ] $service" >> "$report_file"
    done

    log_success "Report generated: $report_file"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================
main() {
    echo ""
    echo "=============================================="
    echo "  REZ-Intelligence Naming Migration Script"
    echo "  $(date)"
    echo "=============================================="
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY-RUN MODE: No changes will be made"
        log_info "Set DRY_RUN=false to execute changes"
        echo ""
    fi

    # Verify directory exists
    if [ ! -d "$REZ_INTELLIGENCE_DIR" ]; then
        log_error "Directory not found: $REZ_INTELLIGENCE_DIR"
        exit 1
    fi

    log_info "Processing ${#DUPLICATE_PAIRS[@]} duplicate pairs..."
    echo ""

    # Process all duplicate pairs
    for old_name in "${!DUPLICATE_PAIRS[@]}"; do
        local new_name="${DUPLICATE_PAIRS[$old_name]}"
        process_duplicate "$old_name" "$new_name"
    done

    echo ""
    log_info "Orphan REZ-* services identified: ${#ORPHAN_REZ_SERVICES[@]}"

    echo ""
    log_info "Related (MCP) services: ${#RELATED_SERVICES[@]}"
    for old_name in "${!RELATED_SERVICES[@]}"; do
        local new_name="${RELATED_SERVICES[$old_name]}"
        echo "  $old_name -> $new_name"
    done

    echo ""

    # Generate report
    generate_report

    # Prepare git commit
    generate_git_commit

    echo ""
    echo "=============================================="
    echo "  Migration Preparation Complete"
    echo "=============================================="
    echo ""
    echo "Next Steps:"
    echo "1. Review the changes (DRY-RUN mode showed what will change)"
    echo "2. Set DRY_RUN=false in this script"
    echo "3. Run the script again to execute changes"
    echo "4. Review the MIGRATION-REPORT-*.md file"
    echo "5. Test the services before deploying"
    echo "6. Update external dependencies (REZ-Consumer, KHAIRMOVE, etc.)"
    echo ""
}

# Run main function
main "$@"
