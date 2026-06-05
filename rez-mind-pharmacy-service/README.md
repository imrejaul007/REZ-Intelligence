# ReZ Mind Pharmacy Service

AI brain for the pharmacy industry - provides intelligent drug interaction checking, prescription analysis, inventory optimization, compliance monitoring, customer health profiles, and refill predictions.

## Features

- **Drug Interaction Checker**: Analyze potential interactions between multiple medications
- **Prescription Analysis & Verification**: Validate prescriptions against patient profiles and regulations
- **Inventory Optimization**: Predict out-of-stock situations and suggest reorder timing
- **Customer Health Profile Analysis**: Build comprehensive health profiles for personalized care
- **Expiry Management & Waste Reduction**: Track medication expiry and minimize waste
- **Compliance Monitoring**: Monitor schedule drugs, prescription validity, and regulatory compliance
- **Supplier Performance Analysis**: Track and evaluate supplier reliability and quality
- **Customer Retention & Refill Prediction**: Predict when customers need refills and improve retention

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with dependencies
- `GET /health/ready` - Readiness check for load balancers

### Consult
- `POST /api/consult` - AI pharmacy consultation (interaction_check, refill_reminder, compliance, inventory)
- `GET /api/consult/:sessionId` - Retrieve consultation session

### Drug Interactions
- `POST /api/interactions/check` - Check drug interactions
- `GET /api/interactions/history/:merchantId` - Interaction check history

### Compliance
- `GET /api/compliance/alerts/:merchantId` - Active compliance alerts
- `GET /api/compliance/alerts/:merchantId/prescription/:prescriptionId` - Prescription alerts
- `PUT /api/compliance/alerts/:id/resolve` - Resolve compliance alert
- `GET /api/compliance/schedule-drugs/:merchantId` - List schedule drugs

### Inventory
- `GET /api/inventory/expiring/:merchantId` - Expiring medications
- `GET /api/inventory/out-of-stock/:merchantId` - Stock alerts
- `POST /api/inventory/predict-demand` - Predict inventory demand

### Refill
- `GET /api/refill/predictions/:merchantId` - Predicted refills
- `POST /api/refill/send-reminder` - Send refill reminder

## Authentication

Internal services use `X-Internal-Token` header with the `INTERNAL_SERVICE_TOKEN` from environment.

## Rate Limits

- AI consultation endpoints: 30 requests/minute
- Read endpoints: 100 requests/minute

## Drug Categories

- ANALGESIC, ANTIBIOTIC, ANTIVIRAL, ANTIFUNGAL, ANTIHISTAMINE
- ANTIHYPERTENSIVE, DIABETIC, CARDIOVASCULAR, RESPIRATORY
- GASTROINTESTINAL, NEUROLOGICAL, PSYCHIATRIC, ONCOLOGY
- OPHTHALMIC, DERMATOLOGICAL, HORMONAL, VACCINE

## License

Proprietary - ReZ Technologies