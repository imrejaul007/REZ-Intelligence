#!/bin/bash
#
# migrate-imports.sh
# Updates import statements from REZ-* to rez-* across the codebase
#

set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "================================================"
echo "  REZ-Intelligence Import Migration Script"
echo "================================================"
echo ""
echo "This script will update import statements from:"
echo "  REZ-* -> rez-*"
echo ""
echo "Base directory: $BASE_DIR"
echo ""

# Dry run by default
DRY_RUN=true
if [[ "$1" == "--apply" ]]; then
    DRY_RUN=false
    echo "MODE: APPLY (will modify files)"
else
    echo "MODE: DRY RUN (no changes will be made)"
    echo "      Use --apply flag to actually modify files"
fi
echo ""

# Create a sed script for all known duplicates
# This script handles the most common import patterns

declare -a MIGRATIONS=(
  # Format: "OLD:NEW"
  "REZ-event-bus:rez-event-bus"
  "REZ-identity-graph:rez-identity-graph"
  "REZ-memory-layer:rez-memory-layer"
  "REZ-workflow-builder:rez-workflow-builder"
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
  "REZ-intelligence-hub:rez-intelligence-hub"
  "REZ-location-intelligence:rez-location-intelligence"
  "REZ-ml-engine:rez-ml-engine"
  "REZ-ml-feature-store:rez-ml-feature-store"
  "REZ-ml-model-registry:rez-ml-model-registry"
  "REZ-ml-models:rez-ml-models"
  "REZ-rate-limit:rez-rate-limit"
  "REZ-rcs-bridge:rez-rcs-bridge"
  "REZ-sales-agent:rez-sales-agent"
  "REZ-salon-expert:rez-salon-expert"
  "REZ-social-signals:rez-social-signals"
  "REZ-support-agent:rez-support-agent"
  "REZ-cohort-service:rez-cohort-service"
  "REZ-customer-360:rez-customer-360"
  "REZ-ai-platform:rez-ai-platform"
  "REZ-ai-plugins:rez-ai-plugins"
  "REZ-ai-voice:rez-ai-voice"
  "REZ-sms-bridge:rez-sms-bridge"
  "REZ-aggregator-hub:rez-aggregator-hub"
)

echo "Scanning for files to update..."

# Find all TypeScript and JavaScript files
FILES=$(find "$BASE_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/alias-wrappers/*" \
  2>/dev/null || true)

echo "Found $(echo "$FILES" | wc -l) files to scan"
echo ""

# Count matches
MATCHES=0
for entry in "${MIGRATIONS[@]}"; do
  IFS=':' read -r old new <<< "$entry"

  # Count occurrences
  count=$(echo "$FILES" | xargs grep -l "$old" 2>/dev/null | wc -l || echo "0")
  if [[ $count -gt 0 ]]; then
    MATCHES=$((MATCHES + count))
    echo "  $old -> $new: $count files"
  fi
done

echo ""
echo "Total matches: $MATCHES files"
echo ""

if [[ $MATCHES -eq 0 ]]; then
  echo "No migrations needed!"
  exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY RUN - No changes made"
  echo ""
  echo "Files that would be updated:"
  for entry in "${MIGRATIONS[@]}"; do
    IFS=':' read -r old new <<< "$entry"
    echo "$FILES" | xargs grep -l "$old" 2>/dev/null || true
  done | sort -u
else
  echo "Applying migrations..."

  for entry in "${MIGRATIONS[@]}"; do
    IFS=':' read -r old new <<< "$entry"

    # Find and update files
    while IFS= read -r file; do
      if grep -q "$old" "$file" 2>/dev/null; then
        # Create backup
        cp "$file" "$file.bak"

        # Perform replacement
        sed -i '' "s|$old|$new|g" "$file"

        echo "Updated: $file"
      fi
    done <<< "$(echo "$FILES" | xargs grep -l "$old" 2>/dev/null || true)"
  done

  echo ""
  echo "Migration complete!"
  echo "Backups saved with .bak extension"
fi
