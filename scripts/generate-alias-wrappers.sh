#!/bin/bash
#
# generate-alias-wrappers.sh
# Generates alias wrapper packages for deprecated REZ-* services
# that have rez-* equivalents
#

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALIAS_DIR="$BASE_DIR/alias-wrappers"

# List of true duplicates (REZ-* with rez-* equivalent)
DUPLICATES=(
  "REZ-behavioral-psychology:rez-behavioral-psychology"
  "REZ-competitor-detection:rez-competitor-detection"
  "REZ-confidence-scorer:rez-confidence-scorer"
  "REZ-context-engine:rez-context-engine"
  "REZ-consumer-copilot:rez-consumer-copilot"
  "REZ-core-brain:rez-core-brain"
  "REZ-crosschannel-attribution:rez-crosschannel-attribution"
  "REZ-culinary-expert:rez-culinary-expert"
  "REZ-education-expert:rez-education-expert"
  "REZ-email-bridge:rez-email-bridge"
  "REZ-fleet-management:rez-fleet-management"
  "REZ-fraud-agent:rez-fraud-agent"
  "REZ-identity-graph:rez-identity-graph"
  "REZ-intelligence-hub:rez-intelligence-hub"
  "REZ-location-intelligence:rez-location-intelligence"
  "REZ-migration-scripts:rez-migration-scripts"
  "REZ-ml-engine:rez-ml-engine"
  "REZ-ml-feature-store:rez-ml-feature-store"
  "REZ-ml-model-registry:rez-ml-model-registry"
  "REZ-ml-models:rez-ml-models"
  "REZ-price-optimization-service:rez-price-optimization-service"
  "REZ-profile-aggregator-service:rez-profile-aggregator-service"
  "REZ-rate-limit:rez-rate-limit"
  "REZ-rcs-bridge:rez-rcs-bridge"
  "REZ-recharge-service:rez-recharge-service"
  "REZ-sales-agent:rez-sales-agent"
  "REZ-salon-expert:rez-salon-expert"
  "REZ-score-service:rez-score-service"
  "REZ-social-signals:rez-social-signals"
  "REZ-staff-scheduling-service:rez-staff-scheduling"
  "REZ-support-agent:rez-support-agent"
  "REZ-training-data-service:rez-training-data-service"
  "REZ-unified-engine:rez-unified-engine"
  "REZ-cohort-service:rez-cohort-service"
  "REZ-customer-360:rez-customer-360"
  "REZ-expert-base:rez-expert-base"
  "REZ-fraud-detection-service:rez-fraud-detection-service"
  "REZ-info-agent:rez-info-agent"
  "REZ-consultant-agent:rez-consultant-agent"
  "REZ-permission-system:rez-permission-system"
  "REZ-push-service:rez-push-service"
  "REZ-sms-bridge:rez-sms-bridge"
  "REZ-ai-plugins:rez-ai-plugins"
  "REZ-ai-voice:rez-ai-voice"
  "REZ-app-bridge:rez-app-bridge"
  "REZ-conversation-intelligence:rez-conversation-intelligence"
  "REZ-eta-prediction:rez-eta-prediction"
  "REZ-e2e-tests:rez-e2e-tests"
  "REZ-lakehouse:rez-lakehouse"
  "REZ-ai-platform:rez-ai-platform"
  "REZ-aggregator-hub:rez-aggregator-hub"
  "REZ-mcp-automl:rez-mcp-automl"
  "REZ-mcp-contracts:rez-mcp-contracts"
  "REZ-mcp-cosmic-twin:rez-mcp-cosmic-twin"
  "REZ-mcp-invoice:rez-mcp-invoice"
  "REZ-mcp-legal:rez-mcp-legal"
  "REZ-mcp-ranking:rez-mcp-ranking"
)

echo "================================================"
echo "  REZ-Intelligence Alias Wrapper Generator"
echo "================================================"
echo ""
echo "Base directory: $BASE_DIR"
echo "Output directory: $ALIAS_DIR"
echo ""
echo "This script will create alias wrappers for ${#DUPLICATES[@]} services"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Create base alias directory
mkdir -p "$ALIAS_DIR"

# Create each alias wrapper
for entry in "${DUPLICATES[@]}"; do
  IFS=':' read -r deprecated canonical <<< "$entry"

  echo "Creating alias: $deprecated -> $canonical"

  alias_dir="$ALIAS_DIR/$deprecated"
  mkdir -p "$alias_dir/src"

  # Create package.json
  cat > "$alias_dir/package.json" << EOF
{
  "name": "@rez-ecosystem/$deprecated",
  "version": "1.0.0-alias",
  "description": "DEPRECATED: Use @rez-ecosystem/$canonical instead",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  },
  "keywords": ["deprecated", "alias"],
  "deprecated": "This package is deprecated. Use @rez-ecosystem/$canonical instead.",
  "dependencies": {
    "@rez-ecosystem/$canonical": "^1.0.0"
  }
}
EOF

  # Create index.js
  cat > "$alias_dir/src/index.js" << EOF
/**
 * DEPRECATED ALIAS - $deprecated
 *
 * This service has been renamed to $canonical.
 * Please update your imports to use $canonical instead.
 *
 * Migration:
 *   FROM: @rez-ecosystem/$deprecated
 *   TO:   @rez-ecosystem/$canonical
 */

console.warn(\`
╔════════════════════════════════════════════════════════════════╗
║                    DEPRECATION WARNING                        ║
╠════════════════════════════════════════════════════════════════╣
║  $deprecated is DEPRECATED                              ║
║                                                                ║
║  Please use: $canonical                                  ║
║                                                                ║
║  See: NAMING-STANDARDS.md for migration instructions          ║
╚════════════════════════════════════════════════════════════════╝
\`);

// Re-export from the canonical service
const canonical = require('@rez-ecosystem/$canonical');
module.exports = canonical;
EOF

  # Create README.md
  cat > "$alias_dir/README.md" << EOF
# DEPRECATED: $deprecated

## This service has been renamed

Please use \`$canonical\` instead.

### Migration

\`\`\`bash
# Update package.json
npm uninstall @rez-ecosystem/$deprecated
npm install @rez-ecosystem/$canonical

# Update imports
# FROM:
import { Service } from '@rez-ecosystem/$deprecated';

# TO:
import { Service } from '@rez-ecosystem/$canonical';
\`\`\`

### Why?

See [NAMING-STANDARDS.md](../NAMING-STANDARDS.md) for the full rationale.

---

**Deprecated:** June 4, 2026
**Canonical Name:** $canonical
EOF

done

echo ""
echo "================================================"
echo "  Complete!"
echo "================================================"
echo ""
echo "Created ${#DUPLICATES[@]} alias wrappers in: $ALIAS_DIR"
echo ""
echo "Next steps:"
echo "  1. Review the created aliases"
echo "  2. Update your package.json to use canonical names"
echo "  3. Update all import statements"
echo "  4. Remove REZ-* directories after migration"
