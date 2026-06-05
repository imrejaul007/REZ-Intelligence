#!/bin/bash
FAILED=()
BUILT=()

for dir in rez-utilities-platform REZ-observability rez-mcp-invoice REZ-memory-engine REZ-delivery-tracking-service REZ-unified-event-schema REZ-attribution-loyalty-bridge REZ-inventory-alerts-service rez-shared-types REZ-data-governance REZ-dooh-attribution rez-shared-config REZ-reservation-service rez-integration-tests rez-mcp-automl rez-aggregator-hub REZ-creator-network rez-unified-messaging REZ-unified-commerce-graph rez-mcp-event-bus rez-mcp-legal REZ-migration-scripts REZ-rl-learning REZ-karma-loyalty-bridge rez-crosschannel-attribution rez-intelligence-hub REZ-ml-observability REZ-payments-brain REZ-enterprise-gateway REZ-analytics-orchestrator rez-ml-models REZ-society-os rez-mcp-cosmic-twin rez-customer-platform-ui rez-expert-base REZ-event-connector REZ-ml-production REZ-ai-orchestrator rez-conversation-intelligence REZ-cross-company-loyalty REZ-event-platform REZ-supplier-marketplace REZ-corpperks-bridge rez-ml-engine REZ-unified-graph rez-consumer-copilot rez-mcp-ranking packages REZ-personalization-engine rez-ai-plugins REZ-ugc-engine rez-profile-aggregator-service REZ-recommendation-engine REZ-feature-store rez-mcp-contracts rez-permission-system rez-behavioral-psychology REZ-multi-location-service rez-rate-limit rez-training-data-service REZ-merchant-brain rez-customer-360 rez-ai-platform rez-uce REZ-data-platform REZ-ecosystem-hub REZ-waitlist-service REZ-ltv-attribution REZ-data-warehouse rez-fraud-detection-service rez-price-optimization-service REZ-unified-attribution; do
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    echo "Building $dir..."
    cd "$dir" 2>/dev/null || continue
    if npm install --silent 2>/dev/null && npm run build 2>/dev/null; then
      echo "✅ $dir built successfully"
      BUILT+=("$dir")
    else
      echo "❌ $dir FAILED"
      FAILED+=("$dir")
    fi
    cd - > /dev/null
  fi
done

echo ""
echo "========================================="
echo "BUILD SUMMARY"
echo "========================================="
echo "Built: ${#BUILT[@]}"
echo "Failed: ${#FAILED[@]}"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Failed services:"
  for f in "${FAILED[@]}"; do echo "  - $f"; done
fi
