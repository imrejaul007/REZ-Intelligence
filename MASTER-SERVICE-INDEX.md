# REZ-Intelligence Complete Service Index
**Last Updated: May 25, 2026**

This document is the COMPLETE index of all AI/ML services in the REZ ecosystem. It must be referenced for ANY question about REZ-Intelligence to ensure nothing is missed.

---

## PRODUCT LAYER - Stage 1 Products

### RezOps AI (Port 4175)
**AI Employee for WhatsApp Businesses**

Stage 1 product - "AI-powered business operating assistant that works through WhatsApp"

Features:
- WhatsApp AI Assistant (queries, FAQs, bookings, order updates)
- Customer Memory (previous visits, preferences, complaints, birthdays)
- Workflow Automation (reminders, follow-ups, confirmations)
- Merchant Knowledge Base (products, pricing, FAQs, policies)
- Human Approval System (refunds, discounts, rescheduling)
- Merchant Dashboard (conversations, sales, metrics)

Target Customers:
- Primary: restaurants, salons, clinics, gyms, local stores
- Secondary: SMB retailers, agencies, repair businesses

Routes:
- `POST /api/merchants` - Register merchant
- `POST /api/customers` - Register customer
- `GET /api/merchants/:id/customers` - List customers
- `GET /api/merchants/:id/conversations` - View conversations
- `POST /api/bookings` - Create booking
- `GET /api/bookings/availability` - Check availability
- `GET /api/merchants/:id/analytics` - Dashboard analytics
- `POST /api/knowledge` - Add to knowledge base
- `POST /api/approvals` - Request approval
- `POST /api/webhook/whatsapp` - WhatsApp webhook

Integrations:
- REZ-whatsapp (Port 4202)
- REZ-memory-layer (Port 4201)
- REZ-flow-runtime (Port 4200)

---

## CORE INTELLIGENCE LAYER

### REZ-autonomous-agents (Port 4062)
**8 Autonomous AI Agents with self-learning capabilities**

Agents:
- `DemandSignalAgent` - Real-time demand aggregation from orders
- `ScarcityAgent` - Supply/demand ratio monitoring, inventory alerts
- `PersonalizationAgent` - A/B test analysis, variant optimization
- `AttributionAgent` - Multi-touch conversion attribution
- `AdaptiveScoringAgent` - ML model retraining, accuracy tracking
- `FeedbackLoopAgent` - Closed-loop optimization, drift detection
- `NetworkEffectAgent` - Collaborative filtering, user clustering
- `RevenueAttributionAgent` - GMV tracking, ROI analysis

Key Files:
- `src/index.ts` - Main entry, all agent logic
- `AgentRun`, `Insight`, `Action` MongoDB models
- CRON schedules: DemandSignalAgent (5min), ScarcityAgent (1min), AdaptiveScoringAgent (hourly)

Security: Internal token authentication, seeded random for determinism

---

### REZ-MIND-CLIENT
**Bidirectional integration with ReZ Mind AI**

Features:
- Send events TO ReZ Mind (Kitchen, Merchant, Consumer)
- Receive insights FROM ReZ Mind (Recommendations, Predictions, Commands)
- WebSocket for real-time communication
- Event queuing with retry

Event Types:
- `KITCHEN_EVENTS`: ORDER_RECEIVED, ORDER_STARTED, ORDER_COMPLETED, ORDER_DELAYED, STATION_CONGESTED, PREP_TIME_ACTUAL
- `MERCHANT_EVENTS`: INVENTORY_LOW, INVENTORY_RECEIVED, ORDER_PLACED, ORDER_COMPLETED, PAYMENT_SUCCESS/FAILED, FRAUD_DETECTED
- `CONSUMER_EVENTS`: SEARCH, ITEM_VIEWED, CART_ADDED, CART_ABANDONED, ORDER_PLACED

Key File: `REZ-MIND-CLIENT/src/ReZMindClient.ts`

---

### REZ-event-bus (Port 4082)
**Shared Event Bus for Agent OS**

Features:
- Redis Pub/Sub for real-time events
- Kafka Producer for durable events
- Event subscriptions with filters
- Dead letter queue

Event Categories (47 event types):
- commerce.* (orders, payments, refunds)
- identity.* (user creation, linking)
- loyalty.* (points, tiers)
- engagement.* (page views, QR scans)
- intelligence.* (intent, churn, predictions)
- support.* (tickets, CSAT)
- media.* (ad impressions, conversions)
- notification.* (sent, opened)

Key Files:
- `src/index.ts` - Main entry
- `services/redisPubSub.ts` - Redis pub/sub
- `services/kafkaProducer.ts` - Kafka producer
- `routes/events.routes.ts` - Event API
- `routes/subscriptions.routes.ts` - Subscription management

---

## PREDICTION & ANALYTICS

### REZ-predictive-engine (Port 4141)
**AI predictions: churn, LTV, revisit, conversion**

Endpoints:
- `/predict/:userId/churn` - Churn probability
- `/predict/:userId/ltv` - Lifetime value prediction
- `/predict/:userId/revisit` - Return probability
- `/predict/:userId/conversion` - Conversion likelihood
- `/predict/:userId/all` - All predictions
- `/predict/batch` - Batch predictions
- `/predict/segments/at-risk` - At-risk segments
- `/predict/segments/high-value` - High-value segments
- `/ml/:userId/churn|ltv|next-purchase|propensity` - ML endpoints

Key Files:
- `src/index.ts` - Main entry
- `src/routes/predict.ts` - Prediction routes
- `src/routes/ml.ts` - ML routes
- MongoDB for prediction storage
- Redis for caching

---

### REZ-signal-aggregator
**Aggregates behavioral signals from all touchpoints**

Features:
- Real-time signal collection
- Signal scoring and weighting
- Cross-platform correlation

---

### REZ-ml-observability (Port 4130)
**ML model monitoring and drift detection**

Features:
- Latency monitoring
- Drift detection (PSI metrics)
- Model performance tracking

---

## AGENT ORCHESTRATION

### REZ-ai-orchestrator
**Multi-agent coordination system**

Features:
- Agent registry and capability mapping
- Task routing based on capabilities
- Agent health monitoring

---

### REZ-agent-protocol
**Agent Protocol implementation**

Features:
- Standardized agent communication
- Tool definitions
- Approval workflows

---

### REZ-ai-router
**Routes requests to appropriate AI services**

Features:
- Intent classification
- Service routing
- Load balancing

---

### REZ-orchestrator-v2
**Enhanced orchestration with expert selection**

Features:
- Expert selector (domain-specific routing)
- Agent switcher (capability-based)
- Message processor with context

Key Files:
- `tests/expertSelector.test.ts`
- `tests/agentSwitcher.test.ts`
- `tests/messageProcessor.test.ts`

---

## MENTAL MODELS & REASONING

### REZ-vector-intelligence
**Vector embeddings for semantic search**

Features:
- Multi-provider support (OpenAI, Azure, Cohere, Local)
- Redis caching for embeddings
- Cosine similarity search

---

### REZ-reasoning-engine
**Advanced reasoning and planning**

Features:
- Chain-of-thought reasoning
- Multi-step planning
- Constraint satisfaction

---

### REZ-ontology-engine
**Knowledge ontology management**

Features:
- Concept hierarchies
- Relationship mapping
- Inference engine

---

### REZ-causal-ai
**Causal inference and analysis**

Features:
- Causal graph construction
- A/B test analysis
- Effect estimation

---

### REZ-federated-ml
**Federated learning for privacy-preserving ML**

Features:
- Distributed model training
- Privacy-preserving aggregation
- Differential privacy

---

## CUSTOMER INTELLIGENCE

### REZ-care-service (Port 4058)
**Complete Support Operating System**

Services:
- `CSATService` - Satisfaction surveys & tracking
- `ProactiveDetectionService` - Issue detection before escalation
- `SelfServiceService` - Self-service recovery actions
- `AutoTicketService` - Automatic ticket creation
- `SupportMetricsService` - Metrics dashboard
- `MerchantCommunicationService` - Merchant outreach
- `CrossPlatformIssueMemory` - Issue tracking across platforms
- `AgentManagementService` - Agent assignment & routing
- `WhatsAppSupportService` - WhatsApp integration
- `EscalationEngine` - Escalation rules & monitoring
- `ReportsService` - Analytics reports
- `SubscriptionService` - Multi-tenant SaaS billing

Routes (15+ route files):
- `/api/csat/*` - CSAT endpoints
- `/api/alerts/*` - Proactive alerts
- `/api/self-service/*` - Self-service actions
- `/api/auto-tickets/*` - Ticket management
- `/api/merchant/*` - Merchant communication
- `/api/issues/*` - Cross-platform issues
- `/api/agents/*` - Agent management
- `/api/metrics/*` - Dashboard metrics
- `/api/escalation/*` - Escalation rules
- `/api/reports/*` - Reports
- `/api/ecosystem/*` - External integrations
- `/api/subscription/*` - Billing
- `/api/whatsapp/*` - WhatsApp support
- `/api/mobile/*` - Mobile SDK
- `/api/support/*` - Unified support

Integrations:
- REZ-support-copilot (4033) - Sentiment, history
- REZ-merchant-intelligence (4122) - Merchant insights
- rez-knowledge-base-service (4005) - KB search
- RABTUL Services (Auth, Wallet, Payment, Notifications)
- REZ Intelligence (Intent, Predictive, Signals)
- REZ-memory-layer - Customer timeline
- REZ-unified-profile - Customer 360
- REZ-workflow-builder - Automation

---

### REZ-unified-profile (Port 4013)
**Unified customer profile**

Features:
- Profile aggregation
- Segment assignment
- 360-degree view

---

### REZ-unified-crm-hub
**CRM data hub**

Features:
- Contact management
- Activity tracking
- Campaign integration

---

### REZ-customer-intelligence-hub
**Customer data platform**

Features:
- CDP capabilities
- Segment management
- Personalization engine

---

## PERSONALIZATION & RECOMMENDATIONS

### REZ-recommendation-engine (Port 4017)
**Personalized recommendations**

Endpoints:
- `/recommendations/user/:userId` - User recommendations
- `/recommendations/item/:itemId/similar` - Similar items
- `/recommendations/trending` - Trending items
- `/recommendations/rerank` - Re-rank items
- `/recommendations/next-best` - Next best action

---

### REZ-personalization-engine
**Personalization engine**

Features:
- Real-time personalization
- Context awareness
- A/B testing

---

### REZ-unified-recommendations
**Unified recommendation across channels**

Features:
- Cross-channel recommendations
- Omnichannel personalization

---

### REZ-taste-profile
**User taste profiling**

Features:
- Preference learning
- Taste vectors
- Category affinity

---

## IDENTITY & IDENTITY GRAPH

### REZ-identity-graph
**Cross-platform user identity**

Features:
- Unified identity resolution
- Device linking
- Cross-app journey tracking

---

### REZ-consumer-graph
**Consumer relationship graph**

Features:
- Social connections
- Influence scoring
- Relationship types

---

### REZ-unified-identity (Port 4060)
**Single identity management**

Features:
- Identity federation
- Cross-platform linking
- Privacy controls

---

### REZ-user-agents
**User agent analysis**

Features:
- Device detection
- Browser fingerprinting
- Bot detection

---

## KNOWLEDGE & DATA

### REZ-knowledge-graph
**Knowledge graph**

Features:
- Entity extraction
- Relationship mapping
- Query engine

---

### REZ-knowledge-base-service
**Knowledge base**

Features:
- Article management
- Search
- Auto-suggest

---

### REZ-data-platform
**Data processing platform**

Features:
- ETL pipelines
- Data quality
- Governance

---

### REZ-data-warehouse
**Data warehouse**

Features:
- OLAP queries
- Aggregation
- Reporting

---

### REZ-lakehouse
**Lakehouse architecture**

Features:
- Schema evolution
- Time travel
- ACID transactions

---

## LOCATION & GEO

### REZ-geo-intelligence
**Geospatial intelligence**

Features:
- Location analytics
- Geofencing
- Heatmaps

---

### REZ-hyperlocal-targeting
**Hyperlocal ad targeting**

Features:
- Neighborhood targeting
- POI-based targeting
- Distance metrics

---

### rez-location-intelligence
**Location intelligence**

Features:
- Hot zone detection
- Movement patterns
- Density analysis

---

## SUPPORT & OPERATIONS

### REZ-support-copilot (Port 4033)
**AI support assistant**

Features:
- Sentiment analysis
- Ticket suggestions
- Agent assist

---

### REZ-error-intelligence
**Error tracking and analysis**

Features:
- Error aggregation
- Root cause analysis
- Alerting

---

### REZ-incident-response
**Incident management**

Features:
- Escalation rules
- On-call scheduling
- Post-mortems

---

## COMMERCE

### REZ-merchant-intelligence (Port 4122)
**Merchant analytics**

Features:
- Performance metrics
- Comparative analysis
- Recommendations

---

### REZ-merchant-brain
**Merchant AI brain**

Features:
- Decision support
- Opportunity detection
- Risk alerts

---

### REZ-commerce-agents
**Commerce AI agents**

Features:
- Order optimization
- Inventory planning
- Pricing agents

---

### REZ-commerce-signal-connector
**Commerce event connector**

Features:
- Order events
- Payment events
- Refund events

---

### REZ-merchant-os
**Merchant operating system**

Features:
- Dashboard
- Analytics
- Tools

---

## DELIVERY & LOGISTICS

### REZ-delivery-intelligence
**Delivery optimization**

Features:
- ETA prediction
- Route optimization
- Delay detection

---

### REZ-delivery-tracking-service
**Real-time tracking**

Features:
- Live location
- ETA updates
- Status notifications

---

## EVENTS & CAMPAIGNS

### REZ-ab-testing
**A/B testing framework**

Features:
- Experiment management
- Variant allocation
- Statistical significance

---

### REZ-ab-testing-service
**A/B testing service**

Features:
- Feature flags
- Gradual rollout
- Analytics

---

### REZ-targeting-engine
**Ad targeting engine**

Features:
- Audience segmentation
- Lookalike modeling
- Retargeting

---

### REZ-campaign-optimizer
**Campaign optimization**

Features:
- Budget allocation
- Bid optimization
- Performance tuning

---

### REZ-qr-campaigns
**QR-triggered campaigns**

Features:
- Campaign creation
- QR generation
- Analytics

---

### REZ-attribution-system
**Multi-touch attribution**

Features:
- Channel attribution
- Path analysis
- ROI calculation

---

### REZ-attribution-loyalty-bridge
**Attribution to loyalty bridge**

Features:
- Loyalty attribution
- Point calculation
- Reward tracking

---

### REZ-crosschannel-attribution
**Cross-channel attribution**

Features:
- Channel stitching
- View-through attribution
- Attribution models

---

### REZ-ltv-attribution
**LTV-based attribution**

Features:
- Customer LTV
- Acquisition cost
- Profitability

---

## LOYALTY & REWARDS

### REZ-karma-loyalty-bridge
**Karma points integration**

Features:
- Points earning
- Points redemption
- Tier management

---

### REZ-cross-company-loyalty
**Cross-company loyalty**

Features:
- Shared rewards
- Coalition loyalty
- Partner offers

---

### REZ-rfm-service
**RFM analysis**

Features:
- Recency, Frequency, Monetary scoring
- Segment classification
- Campaign targeting

---

### REZ-rfm-plus-service
**Enhanced RFM**

Features:
- Extended RFM
- Behavioral scoring
- Predictive RFM

---

## FINANCIAL

### REZ-payments-brain
**Payment intelligence**

Features:
- Fraud signals
- Success optimization
- Recovery

---

### REZ-ledger-service
**Financial ledger**

Features:
- Transaction recording
- Reconciliation
- Audit trail

---

### REZ-reconciliation-service
**Payment reconciliation**

Features:
- Match detection
- Exception handling
- Reporting

---

### REZ-price-predictor
**Price prediction**

Features:
- Demand-based pricing
- Competitive pricing
- Margin optimization

---

## CONTENT & CREATIVE

### REZ-creative-engine
**Creative generation**

Features:
- Ad copy
- Image generation
- A/B creative

---

### REZ-ugc-engine
**User-generated content**

Features:
- Review aggregation
- Content moderation
- Sentiment analysis

---

### REZ-creator-network
**Creator management**

Features:
- Creator profiles
- Content tracking
- Earnings

---

## INVENTORY & OPERATIONS

### REZ-inventory-intelligence (Port 4081)
**Inventory optimization with AI-powered forecasting**

Features:
- Demand forecasting (8 methods: Simple/Weighted/Exponential Moving Average, Holt-Winters, Linear Regression, Seasonal Decomposition, Croston's, Ensemble)
- Stock optimization (ABC analysis, safety stock calculation, reorder points)
- Reorder alerts with supplier lead time intelligence
- Velocity analysis and trend detection
- Seasonal pattern detection

Key Routes:
- `/api/v1/forecast/:sku` - Demand forecasting
- `/api/v1/reorder/:sku` - Reorder suggestions
- `/api/v1/optimize/:sku` - Stock optimization
- `/api/v1/abc-analysis` - ABC classification
- `/api/v1/low-stock-alerts` - Alert management

Models:
- ProductMaster, OrderData, DemandData, ForecastCache, SupplierLeadTime, InventoryAnalysis

---

### REZ-inventory-alerts-service
**Inventory alerts**

Features:
- Low stock alerts
- Overstock alerts
- Expiry alerts

---

### REZ-inventory-sync
**Inventory synchronization**

Features:
- Multi-channel sync
- Real-time updates
- Conflict resolution

---

### REZ-unified-inventory
**Universal inventory**

Features:
- Inventory aggregation
- Availability checking
- Allocation

---

### REZ-demand-forecast
**Demand forecasting**

Features:
- Time series forecasting
- Seasonal patterns
- Promotion impact

---

## SOCIAL & INFLUENCE

### rez-social-signals
**Social signal aggregation**

Features:
- Engagement metrics
- Share tracking
- Influence scoring

---

### REZ-competitor-detection
**Competitor monitoring**

Features:
- Price monitoring
- Product tracking
- Sentiment tracking

---

### rez-confidence-scorer
**Confidence scoring**

Features:
- Model confidence
- Prediction reliability
- Uncertainty quantification

---

## SCHEDULING & WORKFORCE

### REZ-staff-scheduling-service
**Staff scheduling**

Features:
- Demand-based scheduling
- Availability management
- Shift optimization

---

### REZ-fleet-management
**Fleet management**

Features:
- Vehicle tracking
- Maintenance scheduling
- Utilization

---

## ANALYTICS & INSIGHTS

### REZ-insights-service (Port 4017)
**Business insights**

Features:
- Trend detection
- Anomaly detection
- Opportunity identification

---

### REZ-observability
**System observability**

Features:
- Metrics collection
- Log aggregation
- Tracing

---

### REZ-observability-system
**Observability platform**

Features:
- APM
- Infrastructure monitoring
- Alerting

---

### REZ-what-if-analytics
**What-if analysis**

Features:
- Scenario modeling
- Impact analysis
- Simulation

---

### REZ-stream-processing (Port 4132)
**Real-time stream processing**

Features:
- Event processing
- Windowing
- Aggregation

---

## COMMUNICATIONS

### REZ-whatsapp (Port 4202)
**WhatsApp commerce**

Features:
- Session management
- Cart handling
- Order placement
- Template messages
- Broadcast campaigns

Key Services:
- `SessionManager` - 24hr sessions
- `TemplateManager` - WhatsApp templates
- `ConversationEngine` - NLP processing
- `CartService` - Shopping cart
- `OrderService` - Order integration
- `BroadcastService` - Mass messaging

Integrations:
- Twilio WhatsApp API
- RABTUL Payment Service
- RABTUL Delivery Service
- MongoDB + Redis

---

### REZ-notification-router
**Notification routing**

Features:
- Multi-channel (Push, SMS, Email, WhatsApp)
- Template management
- Preference handling

---

### REZ-email-bridge
**Email integration**

Features:
- SendGrid, SES, Mailgun
- Template rendering
- Analytics

---

### REZ-sms-bridge
**SMS integration**

Features:
- Multi-provider
- Opt-out handling
- Delivery tracking

---

### REZ-rcs-bridge (Port 4140)
**RCS messaging bridge for rich communications**

Features:
- Rich messaging with cards and carousels
- Action buttons (URL, phone, quick reply)
- Webhook handling for inbound messages
- Message status tracking (sent, delivered, read)
- Template management for outbound messages

Key Routes:
- `/api/webhook` - Inbound RCS webhooks
- `/api/send` - Send messages
- `/api/messages/:id` - Message status

---

### REZ-whatsapp-orchestrator-bridge
**WhatsApp orchestration**

Features:
- Multi-brand support
- Template approval
- Analytics

---

## DATA & ANALYTICS PIPELINE

### REZ-memory-layer (Port 4201)
**Unified Customer Timeline**

Features:
- Event sourcing
- Timeline aggregation
- Cross-platform memory
- Real-time updates via WebSocket

Routes:
- `/api/timeline` - Customer timeline
- `/api/events` - Event ingestion

Key Services:
- `eventConsumer` - Event Bus subscription
- `cacheService` - Redis caching

Integrations:
- MongoDB (timeline storage)
- Redis (cache)
- REZ Event Bus (event subscription)

---

### REZ-flow-runtime (Port 4200)
**Workflow Execution Engine**

Features:
- Visual workflow builder
- Node-based execution
- Dead letter queue
- Webhook triggers

Models:
- `Workflow` - Workflow definitions
- `Execution` - Run instances

Routes:
- `/api/workflows` - CRUD
- `/api/executions` - Run management
- `/api/dlq` - Dead letter queue
- `/api/triggers/webhook/:workflowId` - Webhook trigger

---

### REZ-workflow-builder (Port 4199)
**Visual workflow builder with drag-and-drop interface**

Features:
- Visual workflow creation and editing
- Multiple node types (trigger, action, condition, transform)
- Execution history and monitoring
- Dead letter queue management
- Webhook integration

Key Routes:
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/:id` - Get workflow
- `PUT /api/workflows/:id` - Update workflow
- `POST /api/workflows/:id/execute` - Execute workflow
- `GET /api/executions` - List executions
- `GET /api/dlq` - Dead letter queue

---

### REZ-planning-agent (Port 4170)
**AI planning and reasoning agent**

Features:
- Multi-step planning with chain-of-thought
- Goal decomposition
- Plan execution and monitoring
- Alternative plan generation
- Reasoning with confidence scores

Key Routes:
- `POST /api/plan` - Generate plan
- `GET /api/plan/:planId` - Get plan
- `POST /api/plan/:planId/execute` - Execute plan
- `GET /api/plan/:planId/status` - Plan status

---

### REZ-human-in-loop (Port 4160)
**Human-in-the-loop approval system**

Features:
- Escalation queue management
- Approval/rejection workflows
- Agent oversight
- Audit logging

Key Routes:
- `GET /api/escalations` - List escalations
- `POST /api/escalations` - Create escalation
- `GET /api/escalations/:id` - Get escalation
- `POST /api/escalations/:id/resolve` - Resolve escalation

---

## MACHINE LEARNING

### REZ-multilingual (Port 4150)
**Multi-language support for 11 Indian languages**

Supported Languages:
- English (en), Hindi (hi), Bengali (bn), Tamil (ta), Telugu (te)
- Marathi (mr), Gujarati (gu), Kannada (kn), Malayalam (ml), Punjabi (pa), Urdu (ur)

Features:
- Text translation between all supported languages
- Batch translation with formality control
- Language detection with confidence scores
- Format preservation

Key Routes:
- `POST /api/translate` - Single text translation
- `POST /api/translate/batch` - Batch translation
- `POST /api/detect` - Language detection

---

### REZ-federated-ml (Port 4165)
**Federated learning for privacy-preserving ML**

Features:
- Distributed model training across client nodes
- Client node registration and management
- Multiple aggregation algorithms (FedAvg, FedProx, SCAFFOLD, FedNova)
- Differential privacy support
- Secure aggregation
- Training progress monitoring

Key Routes:
- `POST /api/federated/clients` - Register client node
- `GET /api/federated/clients` - List clients
- `POST /api/federated/training/start` - Start training
- `GET /api/federated/training/:id` - Training status
- `POST /api/federated/model/update` - Submit model update
- `GET /api/federated/metrics/:id` - Training metrics

---

### REZ-ml-engine
**ML training and inference**

Features:
- Model training
- Feature engineering
- Batch inference

---

### REZ-ml-models
**Production ML models**

Features:
- Model registry
- Version control
- A/B serving

---

### REZ-ml-model-registry
**Model registry**

Features:
- Model versioning
- Metadata storage
- Deployment tracking

---

### REZ-ml-feature-store
**Feature store**

Features:
- Feature engineering
- Feature serving
- Feature versioning

---

### REZ-ml-production
**MLOps platform**

Features:
- CI/CD for ML
- Model monitoring
- Rollback

---

### REZ-bootstrap-intelligence
**Cold start solutions**

Features:
- Transfer learning
- Heuristics
- A/B warmup

---

### REZ-synthetic-data (Port 4145)
**Synthetic data generation for testing and privacy**

Features:
- Schema-based data generation (string, number, boolean, date, email, phone, name, address, uuid, enum, array, object)
- Dataset templates (User Profile, Product Catalog, Transaction, Merchant)
- Data anonymization with format preservation
- Quality report generation
- Batch processing

Key Routes:
- `POST /api/generate` - Generate from schema
- `POST /api/generate/users` - User dataset
- `POST /api/generate/products` - Product dataset
- `POST /api/generate/orders` - Order dataset
- `POST /api/anonymize` - Anonymize PII
- `POST /api/quality-report` - Data quality analysis
- `GET /api/templates` - Available templates

---

### REZ-behavioral-psychology
**Behavioral AI**

Features:
- Psychology models
- Nudge optimization
- Decision architecture

---

### REZ-conversation-intelligence
**Conversation analytics**

Features:
- Transcript analysis
- Sentiment tracking
- Agent coaching

---

### REZ-context-engine
**Context management**

Features:
- Session context
- Cross-turn memory
- Intent resolution

---

### REZ-core-brain
**Core AI brain**

Features:
- General reasoning
- Knowledge access
- Planning

---

## AGENTS & COPILOTS

### REZ-consultant-agent
**Business consultant AI**

Features:
- Strategy advice
- Analysis
- Recommendations

---

### REZ-consumer-copilot
**Consumer assistant**

Features:
- Shopping assist
- Recommendations
- Order help

---

### REZ-support-agent
**Support AI agent**

Features:
- Ticket resolution
- Self-service
- Escalation

---

### REZ-info-agent
**Information agent**

Features:
- Q&A
- Knowledge retrieval
- Summarization

---

### REZ-sales-agent
**Sales AI agent**

Features:
- Lead scoring
- Outreach
- Follow-up

---

### REZ-research-opportunity-agent
**Research opportunities**

Features:
- Market analysis
- Opportunity detection
- Trend identification

---

### REZ-fraud-agent
**Fraud detection agent**

Features:
- Anomaly detection
- Pattern matching
- Alerting

---

## EXPERT DOMAINS

### rez-hospitality-expert (Port 3000)
**Hotel/Hospitality AI**

Features:
- Check-in/out optimization
- Service recommendations
- Revenue management

---

### rez-salon-expert (Port 3005)
**Salon AI**

Features:
- Service recommendations
- Booking optimization
- Product upsell

---

### rez-fitness-expert (Port 3010)
**Fitness AI**

Features:
- Workout recommendations
- Progress tracking
- Nutrition advice

---

### rez-health-expert (Port 3011)
**Health AI**

Features:
- Symptom analysis
- Provider matching
- Appointment booking

---

### rez-travel-expert (Port 3003)
**Travel AI**

Features:
- Destination recommendations
- Booking assist
- Trip planning

---

### rez-education-expert
**Education AI**

Features:
- Course recommendations
- Learning paths
- Progress tracking

---

### rez-culinary-expert
**Culinary AI**

Features:
- Recipe recommendations
- Menu optimization
- Ingredient matching

---

### rez-retail-expert
**Retail AI**

Features:
- Product recommendations
- Inventory optimization
- Pricing strategies

---

## DATA MANAGEMENT

### REZ-data-governance
**Data governance**

Features:
- Policy enforcement
- Compliance tracking
- Audit trails

---

### REZ-audit-logging
**Audit logging**

Features:
- Activity tracking
- Compliance reports
- Forensic analysis

---

### REZ-feature-flags
**Feature flags**

Features:
- Gradual rollouts
- A/B tests
- Kill switches

---

### REZ-api-keys
**API key management**

Features:
- Key generation
- Rate limiting
- Usage tracking

---

## OPERATIONS

### REZ-realtime-service
**Real-time updates**

Features:
- WebSocket server
- Event streaming
- Presence detection

---

### REZ-realtime-gateway
**Real-time gateway**

Features:
- Connection management
- Message routing
- Fan-out

---

### REZ-realtime-segments
**Real-time segmentation**

Features:
- Dynamic segments
- Behavioral triggers
- Immediate activation

---

### REZ-reservation-service
**Reservation management**

Features:
- Booking system
- Availability
- Conflicts

---

### REZ-waitlist-service
**Waitlist management**

Features:
- Queue management
- Notifications
- Conversion tracking

---

### REZ-gift-card-service
**Gift card system**

Features:
- Issuance
- Redemption
- Balance checking

---

### REZ-supplier-marketplace
**Supplier marketplace**

Features:
- Catalog
- Ordering
- Fulfillment

---

### REZ-offline-commerce-tracker
**Offline commerce**

Features:
- Sync queue
- Conflict resolution
- Analytics

---

### REZ-multi-location-service
**Multi-location support**

Features:
- Location management
- Unified inventory
- Reporting

---

### REZ-visit-prediction
**Visit prediction**

Features:
- Next visit time
- Frequency prediction
- Churn signals

---

### REZ-cross-sell-engine
**Cross-sell optimization**

Features:
- Product matching
- Timing optimization
- Personalization

---

### REZ-reorder-engine
**Reorder automation**

Features:
- Subscription management
- Frequency optimization
- Reminders

---

### REZ-flywheel-engine
**Growth flywheel**

Features:
- Loop detection
- Momentum tracking
- Optimization

---

### REZ-flywheel-mvp
**Flywheel MVP**

Features:
- Core flywheel
- Metric tracking
- Iteration

---

### REZ-network-effect
**Network effect tracking**

Features:
- Viral coefficient
- Growth loops
- Engagement

---

### REZ-ecosystem-hub
**Ecosystem orchestration**

Features:
- Service coordination
- Data sharing
- Cross-company

---

### REZ-consumer-loop
**Consumer engagement loop**

Features:
- Habit formation
- Engagement tracking
- Optimization

---

### REZ-enterprise-gateway
**Enterprise integration**

Features:
- SSO/SAML
- Audit
- Admin controls

---

### REZ-validation-dashboard
**Data validation**

Features:
- Quality checks
- Anomaly detection
- Remediation

---

### REZ-user-agent-detection
**User agent analysis**

Features:
- Device detection
- Browser fingerprinting
- Feature detection

---

### REZ-moment-ads
**Contextual advertising**

Features:
- Moment detection
- Ad selection
- Engagement optimization

---

### REZ-dooh-intelligence (Port 4080)
**Digital Out-of-Home advertising intelligence**

Features:
- Real-time audience targeting
- Screen performance analytics
- Campaign optimization with A/B testing
- Engagement metrics tracking
- Geolocation-based ad selection

Key Routes:
- `POST /api/target` - Get targeting options
- `POST /api/engage` - Track engagement
- `GET /api/analytics` - Campaign analytics
- `POST /api/optimize` - Auto-optimize campaign

Integrations:
- RABTUL Platform (Auth, Wallet)
- REZ Intelligence (Intent, Signals, Predictive)

---

### REZ-dooh-attribution
**DOOH attribution**

Features:
- QR scans
- Foot traffic
- Sales correlation

---

### REZ-causal-ai
**Causal AI**

Features:
- Causal inference
- Counterfactual analysis
- Experiment design

---

## AGGREGATION & ORCHESTRATION

### REZ-aggregator-hub
**Data aggregation hub**

Features:
- Multi-source aggregation
- Normalization
- Deduplication

---

### REZ-intelligence-hub
**Intelligence orchestration**

Features:
- Service coordination
- Request routing
- Response aggregation

---

### REZ-channel-orchestrator
**Channel orchestration**

Features:
- Multi-channel coordination
- Message sequencing
- Preference handling

---

### REZ-unified-engine
**Unified processing**

Features:
- Cross-domain processing
- Result merging
- Conflict resolution

---

### REZ-ai-platform
**AI platform**

Features:
- Model hosting
- Inference APIs
- Monitoring

---

### REZ-agent-registry
**Agent registry**

Features:
- Agent discovery
- Capability catalog
- Health monitoring

---

### REZ-unified-event-schema
**Standard event schema**

Features:
- Event standardization
- Schema registry
- Validation

---

### REZ-cohort-service
**Cohort analysis**

Features:
- Cohort creation
- Retention analysis
- Comparison

---

### REZ-mcp-service-discovery
**Service discovery MCP**

Features:
- Service catalog
- Health checking
- Routing

---

## MCP SERVERS (11 total)

Configured in `.mcp.json`:

1. `rez-service-discovery` - Service discovery
2. `rez-event-bus` - Event bus
3. `rez-agent-invoke` - Agent invocation
4. `rez-analytics` - Analytics
5. `rez-identity` - Identity services
6. `rez-payment` - Payment integration
7. `rez-order` - Order integration
8. `rez-notification` - Notifications
9. `rez-inventory` - Inventory
10. `rez-logs` - Logging

---

## SHARED PACKAGES (in /packages)

### rez-unified-agent-sdk
**Universal agent SDK**

Features:
- Agent interface
- Tool registry
- Capability mapping

---

### rez-context-engine
**Context management**

Features:
- Session context
- Cross-service state
- TTL management

---

### rez-ai-plugins
**AI plugin system**

Features:
- Plugin registry
- Capability extensions
- Security sandbox

---

### rez-ai-voice
**Voice AI**

Features:
- Speech recognition
- Text-to-speech
- Voice commands

---

### rez-web-widget
**Embedded AI widget**

Features:
- Chat interface
- Embed code
- Customization

---

## INTEGRATION POINTS

### RABTUL Services Integration
All services can integrate with:

| Service | URL Pattern | Purpose |
|---------|-------------|---------|
| RABTUL Auth | `rez-auth-service.onrender.com` | User auth, OTP |
| RABTUL Payment | `rez-payment-service.onrender.com` | Payments, refunds |
| RABTUL Wallet | `rez-wallet-service.onrender.com` | Coins, balance |
| RABTUL Notifications | `rez-notifications-service.onrender.com` | Push, SMS, WhatsApp |

Standard integration pattern:
```typescript
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
headers: { 'X-Internal-Token': INTERNAL_TOKEN }
```

---

## DOCUMENTATION FILES

| File | Purpose |
|------|---------|
| `README.md` | Overview |
| `REZ-AGENT-OS.md` | Agent OS architecture |
| `MCP-STRATEGY.md` | MCP integration strategy |
| `SERVICE-REGISTRY.md` | Service catalog |
| `SERVICE-DEPENDENCIES.md` | Dependencies |
| `PORT-REGISTRY.md` | Port assignments |
| `COMPETITIVE-GAP-ANALYSIS.md` | Gap analysis |
| `10X-QUALITY-PLAN.md` | Quality roadmap |
| **`TECHNICAL-ROADMAP.md`** | **Gap analysis & strategic direction** |

---

## NEW SERVICES (Built May 25, 2026)

All 8 strategic services have been **fully implemented**:

| Priority | Service | Port | Purpose | Status |
|----------|---------|------|---------|--------|
| **1** | `REZ-explainability-engine` | 4145 | SHAP/LIME, decision explanations, audit trails | 🟢 Built |
| **2** | `REZ-temporal-intelligence` | 4144 | Sequence learning, habit detection, behavioral transitions | 🟢 Built |
| **3** | `REZ-action-orchestrator` | 4146 | Autonomous campaign creation, outcome tracking | 🟢 Built |
| **4** | `REZ-reinforcement-optimizer` | 4147 | Multi-armed bandits, reward signals, auto-optimization | 🟢 Built |
| **5** | `REZ-hyperlocal-brain` | 4148 | Unified location intelligence, foot traffic prediction | 🟢 Built |
| **6** | `REZ-business-orchestrator` | 4149 | Cross-agent coordination, goal decomposition, KPI tracking | 🟢 Built |
| **7** | `REZ-intelligence-sdk` | 4151 | TypeScript SDK for developers | 🟢 Built |
| **8** | `REZ-merchant-graph` | 4150 | 360° merchant view, competitive intelligence | 🟢 Built |

### Service Locations

```
REZ-Intelligence/
├── REZ-explainability-engine/    # Port 4145
│   ├── src/types.ts             # Explanation, Counterfactual, AuditRecord types
│   ├── src/explainabilityService.ts  # SHAP-like, LIME, counterfactual generation
│   └── src/index.ts             # /api/explain, /api/audit, /api/trust endpoints
│
├── REZ-temporal-intelligence/    # Port 4144
│   ├── src/types.ts             # Sequence, Habit, Transition, Lifecycle types
│   ├── src/temporalService.ts    # Sequence analysis, habit detection, lifecycle
│   └── src/index.ts              # /api/sequences, /api/habits, /api/lifecycle
│
├── REZ-action-orchestrator/     # Port 4146
│   ├── src/types.ts             # Action, Tool, Workflow, Plan types
│   ├── src/actionService.ts      # Tool execution, workflow orchestration
│   └── src/index.ts              # /api/actions, /api/workflows, /api/plans
│
├── REZ-reinforcement-optimizer/ # Port 4147
│   ├── src/types.ts             # RLAgent, Environment, Experience, Policy types
│   ├── src/rlService.ts         # Q-Learning, DQN, PPO, SAC implementations
│   └── src/index.ts              # /api/agents, /api/training, /api/experiments
│
├── REZ-hyperlocal-brain/        # Port 4148
│   ├── src/types.ts             # Zone, Hotspot, MicroSegment, GeoPoint types
│   ├── src/hyperlocalService.ts  # Geospatial analytics, hotspot detection
│   └── src/index.ts              # /api/zones, /api/hotspots, /api/search/nearby
│
├── REZ-business-orchestrator/   # Port 4149
│   ├── src/types.ts             # BusinessWorkflow, BusinessRule, CrossDomainContext
│   ├── src/businessService.ts     # Cross-domain workflow execution
│   └── src/index.ts              # /api/workflows, /api/rules, /api/templates
│
├── REZ-merchant-graph/          # Port 4151
│   ├── src/types.ts             # Merchant, Relationship, Network, GraphQuery types
│   ├── src/merchantGraphService.ts  # Graph queries, network analysis
│   └── src/index.ts              # /api/merchants, /api/relationships, /api/graph
│
└── REZ-intelligence-sdk/        # Port 4151
    ├── src/types.ts             # Unified client types
    ├── src/sdk.ts               # IntelligenceClient class
    └── src/index.ts             # SDK proxy endpoints
```

### Partial Implementation (Needs Enhancement)

| Service | Current State | Enhancement Needed |
|---------|---------------|-------------------|
| `REZ-autonomous-agents` | 8 independent agents | Cross-agent orchestration, business goals |
| `REZ-predictive-engine` | Returns predictions | Needs explanation layer (WHY) |
| `REZ-memory-layer` | Timeline storage | Needs temporal sequences, habit detection |
| `REZ-reasoning-engine` | Basic reasoning | Needs chain-of-thought, planning |
| `REZ-geo-intelligence` | Location data | Needs unified hyperlocal brain |

---

---

## PORT REGISTRY (Updated May 25, 2026)

All 8 new services now have assigned ports:

| Port | Service | Purpose |
|------|---------|---------|
| 4144 | REZ-temporal-intelligence | Sequence learning, habit detection, lifecycle |
| 4145 | REZ-explainability-engine | SHAP/LIME explanations, audit trails |
| 4146 | REZ-action-orchestrator | Autonomous execution, workflow orchestration |
| 4147 | REZ-reinforcement-optimizer | RL agents, multi-armed bandits |
| 4148 | REZ-hyperlocal-brain | Geospatial intelligence, hotspot detection |
| 4149 | REZ-business-orchestrator | Cross-domain workflows, business rules |
| 4150 | REZ-merchant-graph | Merchant relationships, network analysis |
| 4151 | REZ-intelligence-sdk | Unified TypeScript client |

---

## QUICK REFERENCE

### By Port Number

| Port | Service |
|------|---------|
| 3000 | Hospitality Expert |
| 3003 | Travel Expert |
| 3004 | Retail Expert |
| 3005 | Salon Expert |
| 3006 | Education Expert |
| 3010 | Fitness Expert |
| 3011 | Health Expert |
| 4017 | Recommendation Engine |
| 4018 | Intent Graph |
| 4033 | Support Copilot |
| 4055 | Care Service |
| 4058 | Care Service (main) |
| 4062 | Autonomous Agents |
| 4082 | Event Bus |
| 4121 | Signal Aggregator |
| 4122 | Merchant Intelligence |
| 4123 | Predictive Engine |
| 4126 | Realtime Segments |
| 4127 | Feature Store |
| 4128 | Decision Engine |
| 4129 | Commerce Graph |
| 4130 | ML Observability |
| 4131 | Intelligence Hub |
| 4132 | Stream Processing |
| 4141 | Predictive Engine |
| **4144** | **REZ-temporal-intelligence** |
| **4145** | **REZ-explainability-engine** |
| **4146** | **REZ-action-orchestrator** |
| **4147** | **REZ-reinforcement-optimizer** |
| **4148** | **REZ-hyperlocal-brain** |
| **4149** | **REZ-business-orchestrator** |
| **4150** | **REZ-merchant-graph** |
| **4151** | **REZ-intelligence-sdk** |
| 4200 | Flow Runtime |
| 4201 | Memory Layer |
| 4202 | WhatsApp |

---

## CRITICAL NOTES

1. **NEVER miss any service** - Always check this index
2. **All services use TypeScript** with strict mode
3. **Security**: Internal token via `X-Internal-Token` header
4. **Logging**: Structured JSON via `createLogger`
5. **Errors**: Use `asyncHandler` wrapper
6. **Rate Limiting**: Apply to all public endpoints
7. **Circuit Breakers**: Use for external service calls
8. **Health Checks**: Implement `/health`, `/health/live`, `/health/ready`

---

*This document is the source of truth. Update when services are added/modified.*
