# REZ Intelligence Gap Report - May 19, 2026

## Connected Services ✅

| Service | URL | App Service |
|---------|-----|------------|
| Intent Capture | https://intent-capture.rezapp.com | intentCaptureService |
| Intent Graph | https://intent-graph.onrender.com | intentGraphApi |
| Taste Profile | https://taste-profile.onrender.com | tasteProfileService |
| Care Service | https://care-service.onrender.com | careService |
| Journey Service | https://journey-service.onrender.com | journeyService |
| Attribution | https://attribution-hub.onrender.com | attributionService |
| Predictive Engine | https://predictive-engine.onrender.com | predictiveService |
| Feature Flags | https://feature-flags.onrender.com | featureFlagsService |
| Intelligence Hub | https://intelligence-hub.onrender.com | - |
| User Intelligence | https://user-intelligence.onrender.com | - |
| Core Intelligence | https://core-intelligence.onrender.com | - |

## App Connections ✅

### HIGH PRIORITY - COMPLETED

| Service | Port | App Hook | Status |
|---------|------|----------|--------|
| REZ-identity-graph | 4050 | `identityGraphService.ts` | ✅ Connected |
| REZ-personalization-engine | 4024 | `usePersonalization.ts` | ✅ Connected |
| REZ-recommendation-engine | 4055 | `useRecommendations.ts` | ✅ Connected |
| REZ-memory-engine | 4058 | `useMemory.ts` | ✅ Connected |
| REZ-context-engine | 4060 | `useContextEngine.ts` | ✅ Connected |

### MEDIUM PRIORITY

| Service | Use Case |
|---------|----------|
| REZ-ab-testing-service | A/B testing |
| REZ-cdp-service | Customer data platform |
| REZ-creative-engine | Ad creatives |
| REZ-experimentation-engine | Feature flags |
| REZ-insights-service | BI dashboards |
| REZ-lead-score-engine | Lead scoring |
| REZ-fraud-detection | Transaction fraud |
| REZ-inventory-alerts | Stock alerts |
| REZ-loyalty-insights | Loyalty analytics |
| REZ-ml-engine | ML predictions |
| REZ-pricing-engine | Dynamic pricing |
| REZ-rfm-service | RFM segmentation |
| REZ-segmentation-engine | User segments |
| REZ-supply-intelligence | Supply chain |
| REZ-ugc-engine | User content |
| REZ-voice-intelligence | Voice commands |
| REZ-waitlist-service | Waitlist management |

### SERVICES WITH NO APP CONNECTION (yet)

```
REZ-ab-testing-service/  ← ✅ Connected via useABTest.ts
REZ-ab-testing/
REZ-ad-intelligence/
REZ-affiliate-engine/
REZ-ai-agent-studio/
REZ-ai-concierge/
REZ-analytics-orchestrator/
REZ-anomaly-detection/
REZ-assistant/
REZ-attribution-engine/
REZ-augmented-reality/
REZ-auto-response/
REZ-basket-analysis/
REZ-behavior-predictor/
REZ-bundling-engine/
REZ-campaign-optimizer/
REZ-churn-predictor/
REZ-clientele-insights/
REZ-conversion-rate-optimizer/
REZ-convoy-tracking/
REZ-cookieless-tracking/
REZ-coupon-optimizer/
REZ-creative-brief-generator/
REZ-creative-intelligence/
REZ-cross-sell-engine/
REZ-customer-lifetime-value/
REZ-data-enrichment/
REZ-data-pipeline/
REZ-delivery-optimization/
REZ-demand-forecast/
REZ-destination-scorer/
REZ-discovery-engine/
REZ-dynamic-pricing/
REZ-early-signals/
REZ-email-ai/
REZ-emotional-intelligence/
REZ-engagement-predictor/
REZ-etl-pipeline/
REZ-event-intelligence/
REZ-experience-engine/
REZ-feedback-loop/
REZ-fraud-detection/
REZ-freshness-scoring/
REZ-geo-intelligence/
REZ-gig-economy-analytics/
REZ-growth-pipeline/
REZ-hyperlocal-targeting/
REZ-insights-bridge/
REZ-inventory-intelligence/
REZ-ltv-predictor/
REZ-magic-search/
REZ-market-basket/
REZ-market-intelligence/
REZ-merchant-insights/
REZ-ml-pipeline/
REZ-ml-serving/
REZ-model-registry/
REZ-momentum-score/
REZ-nps-analyzer/
REZ-notification-optimizer/
REZ-occasion-detector/
REZ-opportunity-scorer/
REZ-orchestration-hub/
REZ-ott-optimizer/
REZ-ourseller-insights/
REZ-outreach-automation/
REZ-path-to-purchase/
REZ-pattern-detector/
REZ-payment-intelligence/
REZ-permission-hub/
REZ-personalization-engine/
REZ-pipeline-orchestrator/
REZ-positioning-engine/
REZ-preprocessing-pipeline/
REZ-pricing-intelligence/
REZ-probability-calibrator/
REZ-product-intelligence/
REZ-product-matchmaking/
REZ-push-notification-ai/
REZ-queue-intelligence/
REZ-realtime-segments/
REZ-recommendation-hub/
REZ-recovery-engine/
REZ-referral-optimization/
REZ-relationship-intelligence/
REZ-replication-service/
REZ-reset-password/
REZ-resource-optimizer/
REZ-response-generator/
REZ-response-optimizer/
REZ-reward-calculator/
REZ-risk-assessment/
REZ-sales-forecasting/
REZ-savings-piggybank/
REZ-schema-registry/
REZ-search-intelligence/
REZ-segment-trends/
REZ-sentiment-analysis/
REZ-service-bridge/
REZ-session-replay/
REZ-shield/
REZ-signals-collector/
REZ-similarity-engine/
REZ-sms-ai/
REZ-solutions-engine/
REZ-spell-correct/
REZ-state-machine/
REZ-stimulus-response/
REZ-storytelling/
REZ-streaming-pipeline/
REZ-substitution-engine/
REZ-success-metrics/
REZ-survey-intelligence/
REZ-swiftAISearch/
REZ-symptom-tracker/
REZ-syndication-service/
REZ-taxonomy-engine/
REZ-telephony-ai/
REZ-thumbnail-generator/
REZ-ticket-insights/
REZ-timestamp-generator/
REZ-tipping-engine/
REZ-training-pipeline/
REZ-translation-engine/
REZ-trend-detector/
REZ-trending-topics/
REZ-upsell-engine/
REZ-user-profile-bridge/
REZ-vectors/
REZ-voice-bot/
REZ-webhook-processor/
REZ-what-if-analytics/
REZ-wins intelligence/
REZ-workflow-automation/
REZ-yield-optimization/
REZ-zen-agents/
```

## Quick Wins - COMPLETED ✅

1. **Identity Graph** - User identity resolution ✅
2. **Personalization Engine** - Real-time recommendations ✅
3. **Recommendation Engine** - Product suggestions ✅
4. **Memory Engine** - Conversation memory ✅
5. **Context Engine** - User context ✅

## Next Steps

```bash
# Check services status
cd REZ-Intelligence
./bootstrap-services.sh status

# Deploy missing services
./deploy.sh <service-name>
```
