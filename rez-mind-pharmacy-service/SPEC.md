# ReZ Mind Pharmacy Service - Technical Specification

## Overview

The ReZ Mind Pharmacy Service is an AI-powered intelligence service that provides pharmacies with drug interaction checking, prescription analysis, inventory management, compliance monitoring, and customer health profile capabilities.

## Architecture

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose ODM)
- **Validation**: Zod
- **Logging**: Winston

### Port Configuration
- **Default Port**: 4070
- **Environment Variable**: `PORT`

## Configuration

### Environment Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| PORT | number | Yes | 4070 | Server port |
| NODE_ENV | string | Yes | development | Environment mode |
| MONGODB_URI | string | Yes | - | MongoDB connection URI |
| INTERNAL_SERVICE_TOKEN | string | Yes | - | Internal service authentication token |
| AUTH_SERVICE_URL | string | No | - | Authentication service URL |
| LOG_LEVEL | string | No | info | Logging level |

## Data Models

### PharmacyMindSession

Stores AI consultation sessions with pharmacy analysis.

```typescript
{
  sessionId: string;          // UUID, unique
  merchantId: string;         // Merchant identifier
  pharmacistId?: string;      // Pharmacist identifier
  patientId?: string;         // Patient identifier
  sessionType: SessionType;   // consult/interaction_check/inventory
  context: {
    drugs?: DrugInfo[];
    prescriptionId?: string;
    customerProfile?: CustomerProfile;
  };
  analysis: {
    interactions?: DrugInteraction[];
    complianceIssues?: ComplianceIssue[];
    inventoryAlerts?: InventoryAlert[];
    recommendations?: string[];
  };
  recommendations: string[];
  createdAt: Date;
  updatedAt: Date;            // TTL index (60 days)
}
```

**Indexes**:
- `sessionId`: unique
- `merchantId`: standard
- `[merchantId, createdAt]`: compound with TTL (60 days)

### DrugInteractionCheck

Stores drug interaction check history.

```typescript
{
  checkId: string;           // UUID, unique
  merchantId: string;         // Merchant identifier
  drugIds: string[];          // Drug identifiers checked
  interactions: [{
    drug1: string;
    drug2: string;
    severity: 'MILD' | 'MODERATE' | 'SEVERE';
    description: string;
    recommendation: string;
  }];
  overallSeverity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
  checkedAt: Date;
  checkedBy: string;
}
```

**Indexes**:
- `checkId`: unique
- `merchantId`: standard
- `drugIds`: standard

### ComplianceAlert

Stores compliance monitoring alerts.

```typescript
{
  alertId: string;            // UUID, unique
  merchantId: string;         // Merchant identifier
  prescriptionId?: string;    // Related prescription
  type: AlertType;           // schedule_drug/invalid_prescription/expiry/refill_needed
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
}
```

**Indexes**:
- `[merchantId, isResolved, severity]`: compound
- `prescriptionId`: standard

## API Endpoints

### Health Endpoints

#### GET /health
Basic health check. Returns 200 if service is running.

#### GET /health/detailed
Returns detailed health including MongoDB connection status and system metrics.

#### GET /health/ready
Readiness check for load balancers. Returns 200 only if all dependencies are available.

### Consult Routes

#### POST /api/consult
AI pharmacy consultation endpoint.

**Request Body**:
```typescript
{
  merchantId: string;
  pharmacistId?: string;
  patientId?: string;
  drugs?: DrugInfo[];
  request: 'interaction_check' | 'refill_reminder' | 'compliance' | 'inventory';
}
```

**Response**:
```typescript
{
  sessionId: string;
  analysis: {
    interactions?: DrugInteraction[];
    complianceIssues?: ComplianceIssue[];
    inventoryAlerts?: InventoryAlert[];
  };
  recommendations: string[];
  alerts: ComplianceAlert[];
  confidence: number;
}
```

#### GET /api/consult/:sessionId
Retrieves a previous consultation session.

### Interaction Routes

#### POST /api/interactions/check
Check drug interactions.

**Request Body**:
```typescript
{
  drugIds: string[];
  prescriptionId?: string;
}
```

**Response**:
```typescript
{
  interactions: InteractionDetail[];
  severity: 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';
  recommendations: string[];
}
```

#### GET /api/interactions/history/:merchantId
Returns interaction check history for a merchant.

### Compliance Routes

#### GET /api/compliance/alerts/:merchantId
Returns active compliance alerts.

#### GET /api/compliance/alerts/:merchantId/prescription/:prescriptionId
Returns alerts for a specific prescription.

#### PUT /api/compliance/alerts/:id/resolve
Resolves a compliance alert.

#### GET /api/compliance/schedule-drugs/:merchantId
Returns list of schedule drugs for a merchant.

### Inventory Routes

#### GET /api/inventory/expiring/:merchantId
Returns medications expiring soon.

#### GET /api/inventory/out-of-stock/:merchantId
Returns stock alert recommendations.

#### POST /api/inventory/predict-demand
Predicts inventory demand.

### Refill Routes

#### GET /api/refill/predictions/:merchantId
Returns predicted refills for customers.

#### POST /api/refill/send-reminder
Sends refill reminders to customers.

## Types

### Enums

```typescript
DrugCategory: 'ANALGESIC' | 'ANTIBIOTIC' | 'ANTIVIRAL' | 'ANTIFUNGAL' | 'ANTIHISTAMINE' | 'ANTIHYPERTENSIVE' | 'DIABETIC' | 'CARDIOVASCULAR' | 'RESPIRATORY' | 'GASTROINTESTINAL' | 'NEUROLOGICAL' | 'PSYCHIATRIC' | 'ONCOLOGY' | 'OPHTHALMIC' | 'DERMATOLOGICAL' | 'HORMONAL' | 'VACCINE' | 'OTHER'
InteractionSeverity: 'MILD' | 'MODERATE' | 'SEVERE'
AlertType: 'schedule_drug' | 'invalid_prescription' | 'expiry' | 'refill_needed' | 'stock_alert'
AlertSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
SessionType: 'consult' | 'interaction_check' | 'inventory'
```

## Services

### PharmacyIntelligence Service
Core AI logic for pharmacy operations.

Functions:
- `checkInteractions(drugIds[])` → InteractionResult
- `analyzePrescription(prescription)` → ComplianceCheck
- `predictRefills(customerId)` → RefillPrediction[]
- `optimizeInventory(merchantId)` → InventoryRecommendation[]

### InteractionChecker Service
Drug interaction logic.

Functions:
- `checkDrugInteractions(drug1, drug2)` → InteractionResult
- `getInteractionSeverity(drugPair)` → 'MILD'|'MODERATE'|'SEVERE'

### ComplianceMonitor Service
Compliance monitoring.

Functions:
- `checkScheduleCompliance(prescription)` → ComplianceResult
- `checkPrescriptionValidity(prescription)` → ValidityResult

## Middleware

### Authentication
- JWT token validation
- X-Internal-Token header for internal services
- Rate limiting per client

### Error Handler
- Structured error responses
- Request ID tracking
- Detailed error logging

### Rate Limiter
- AI consultation: 30 req/min
- Read endpoints: 100 req/min

## Knowledge Base

### Drug Categories
- ANALGESIC, ANTIBIOTIC, ANTIVIRAL, ANTIFUNGAL, ANTIHISTAMINE
- ANTIHYPERTENSIVE, DIABETIC, CARDIOVASCULAR, RESPIRATORY
- GASTROINTESTINAL, NEUROLOGICAL, PSYCHIATRIC, ONCOLOGY
- OPHTHALMIC, DERMATOLOGICAL, HORMONAL, VACCINE

### Drug Interactions Database
- Common interaction pairs with severity levels
- Mechanism of interaction
- Clinical recommendations

### Schedule Drug Classifications
- Schedule I-V classifications
- Storage requirements
- Dispensing restrictions

### Dosage Guidelines
- Weight-based dosing
- Age-based adjustments
- Renal/hepatic impairment considerations

### Expiry Patterns
- Room temperature storage patterns
- Refrigerated medication patterns
- Light-sensitive medication patterns

## Integration

### REZ Intelligence Hub
- Connection to central AI intelligence platform
- Model sharing and updates

### RABTUL Platform
- External platform integration
- Notification service for alerts
- Customer profile service integration

### Pharmacy Service
- Integration with main pharmacy service
- Drug database synchronization
- Prescription validation

## Deployment

### Docker
- Multi-stage build
- Node.js 18 Alpine base
- Health checks included
- Non-root user for security

### Environment
- All secrets via environment variables
- No hardcoded credentials
- Separate .env for dev/staging/prod