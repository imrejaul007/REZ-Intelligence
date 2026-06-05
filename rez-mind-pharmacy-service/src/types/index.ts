/**
 * ReZ Mind Pharmacy Service - TypeScript Interfaces
 */

// ==================== Enums ====================

export enum DrugCategory {
  ANALGESIC = 'ANALGESIC',
  ANTIBIOTIC = 'ANTIBIOTIC',
  ANTIVIRAL = 'ANTIVIRAL',
  ANTIFUNGAL = 'ANTIFUNGAL',
  ANTIHISTAMINE = 'ANTIHISTAMINE',
  ANTIHYPERTENSIVE = 'ANTIHYPERTENSIVE',
  DIABETIC = 'DIABETIC',
  CARDIOVASCULAR = 'CARDIOVASCULAR',
  RESPIRATORY = 'RESPIRATORY',
  GASTROINTESTINAL = 'GASTROINTESTINAL',
  NEUROLOGICAL = 'NEUROLOGICAL',
  PSYCHIATRIC = 'PSYCHIATRIC',
  ONCOLOGY = 'ONCOLOGY',
  OPHTHALMIC = 'OPHTHALMIC',
  DERMATOLOGICAL = 'DERMATOLOGICAL',
  HORMONAL = 'HORMONAL',
  VACCINE = 'VACCINE',
  OTHER = 'OTHER',
}

export enum DrugSchedule {
  SCHEDULE_I = 'SCHEDULE_I',
  SCHEDULE_II = 'SCHEDULE_II',
  SCHEDULE_III = 'SCHEDULE_III',
  SCHEDULE_IV = 'SCHEDULE_IV',
  SCHEDULE_V = 'SCHEDULE_V',
  NON_CONTROLLED = 'NON_CONTROLLED',
}

export enum InteractionSeverity {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
  NONE = 'NONE',
}

export enum AlertType {
  SCHEDULE_DRUG = 'schedule_drug',
  INVALID_PRESCRIPTION = 'invalid_prescription',
  EXPIRY = 'expiry',
  REFILL_NEEDED = 'refill_needed',
  STOCK_ALERT = 'stock_alert',
  INTERACTION_WARNING = 'interaction_warning',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SessionType {
  CONSULT = 'consult',
  INTERACTION_CHECK = 'interaction_check',
  INVENTORY = 'inventory',
  PRESCRIPTION_ANALYSIS = 'prescription_analysis',
}

export enum RefillStatus {
  PENDING = 'pending',
  READY = 'ready',
  PICKED_UP = 'picked_up',
  OVERDUE = 'overdue',
}

// ==================== Core Types ====================

export interface DrugInfo {
  drugId: string;
  name: string;
  genericName?: string;
  category: DrugCategory;
  schedule?: DrugSchedule;
  dosage: string;
  form?: string; // tablet, capsule, liquid, etc.
  manufacturer?: string;
  interactions?: string[];
  contraindications?: string[];
  sideEffects?: string[];
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: InteractionSeverity;
  description: string;
  mechanism?: string;
  recommendation: string;
  clinicalEffects?: string[];
  confidence: number; // 0-1
}

export interface InteractionResult {
  interactions: DrugInteraction[];
  overallSeverity: InteractionSeverity;
  hasInteractions: boolean;
  recommendations: string[];
  confidence: number;
}

export interface PrescriptionInfo {
  prescriptionId: string;
  patientId: string;
  prescriberId: string;
  drugs: DrugInfo[];
  issuedDate: Date;
  validUntil: Date;
  refillsRemaining: number;
  isScheduleDrug: boolean;
  schedule?: DrugSchedule;
  status: string;
  notes?: string;
}

export interface ComplianceIssue {
  type: AlertType;
  severity: AlertSeverity;
  description: string;
  relatedPrescriptionId?: string;
  relatedDrugId?: string;
  recommendation: string;
}

export interface ComplianceResult {
  isCompliant: boolean;
  issues: ComplianceIssue[];
  warnings: string[];
  alerts: ComplianceAlert[];
}

export interface CustomerProfile {
  customerId: string;
  merchantId: string;
  medications: DrugInfo[];
  allergies: string[];
  conditions: string[];
  age?: number;
  weight?: number;
  renalImpairment?: boolean;
  hepaticImpairment?: boolean;
  pregnancyStatus?: boolean;
  lastRefillDate?: Date;
  adherenceScore?: number;
}

// ==================== Inventory Types ====================

export interface InventoryItem {
  drugId: string;
  drugName: string;
  category: DrugCategory;
  currentStock: number;
  reorderPoint: number;
  maxStock: number;
  expiryDate: Date;
  batchNumber?: string;
  supplierId?: string;
  costPrice: number;
  sellingPrice: number;
  storageCondition: string;
}

export interface InventoryAlert {
  drugId: string;
  drugName: string;
  alertType: 'out_of_stock' | 'low_stock' | 'expiring' | 'expired' | 'overstocked';
  urgency: AlertSeverity;
  currentStock: number;
  daysRemaining?: number;
  expiryDate?: Date;
  message: string;
  recommendation: string;
}

export interface InventoryRecommendation {
  drugId: string;
  drugName: string;
  action: 'reorder' | 'return' | 'mark_down' | 'transfer';
  quantity: number;
  urgency: AlertSeverity;
  reason: string;
  estimatedCost?: number;
  supplierRecommendation?: string;
}

export interface DemandForecast {
  drugId: string;
  drugName: string;
  currentStock: number;
  predictedDemand: number;
  daysOfSupply: number;
  reorderPoint: number;
  recommendedOrderQuantity: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  seasonality?: {
    factor: number;
    peakMonths: string[];
  };
}

// ==================== Refill Types ====================

export interface RefillPrediction {
  customerId: string;
  drugId: string;
  drugName: string;
  lastFillDate: Date;
  daysSupply: number;
  predictedRefillDate: Date;
  urgency: AlertSeverity;
  confidence: number;
  reasons: string[];
  suggestedActions: string[];
}

export interface RefillReminder {
  customerId: string;
  customerName: string;
  drugName: string;
  prescriptionId: string;
  reminderDate: Date;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  message: string;
}

// ==================== Supplier Types ====================

export interface SupplierInfo {
  supplierId: string;
  name: string;
  contactInfo: string;
  rating: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  averageLeadTimeDays: number;
  drugSpecializations: DrugCategory[];
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    onTimeDelivery: number;
    orderAccuracy: number;
    qualityScore: number;
    responseTime: number;
    priceCompetitiveness: number;
  };
  totalOrders: number;
  issuesCount: number;
  score: number;
  rank: number;
}

// ==================== Session Types ====================

export interface PharmacyMindSessionData {
  sessionId: string;
  merchantId: string;
  pharmacistId?: string;
  patientId?: string;
  sessionType: SessionType;
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
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsultRequest {
  merchantId: string;
  pharmacistId?: string;
  patientId?: string;
  drugs?: DrugInfo[];
  request: 'interaction_check' | 'refill_reminder' | 'compliance' | 'inventory';
  prescriptionId?: string;
  customerProfile?: CustomerProfile;
}

export interface ConsultResponse {
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

// ==================== Alert Types ====================

export interface ComplianceAlert {
  alertId: string;
  merchantId: string;
  prescriptionId?: string;
  patientId?: string;
  type: AlertType;
  severity: AlertSeverity;
  description: string;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
}

// ==================== Health Check Types ====================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
}

export interface DetailedHealth extends HealthStatus {
  dependencies: {
    mongodb: DependencyHealth;
  };
  memory: MemoryUsage;
}

export interface DependencyHealth {
  status: 'up' | 'down';
  readyState: number;
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

// ==================== API Request/Response Types ====================

export interface InteractionCheckRequest {
  drugIds: string[];
  prescriptionId?: string;
  patientId?: string;
}

export interface InteractionCheckResponse {
  checkId: string;
  interactions: DrugInteraction[];
  overallSeverity: InteractionSeverity;
  recommendations: string[];
  checkedAt: Date;
}

export interface ComplianceAlertRequest {
  merchantId: string;
  isResolved?: boolean;
  severity?: AlertSeverity;
  limit?: number;
}

export interface InventoryExpiringRequest {
  merchantId: string;
  daysBeforeExpiry?: number;
}

export interface PredictDemandRequest {
  merchantId: string;
  drugIds?: string[];
  forecastPeriodDays?: number;
}

export interface RefillPredictionRequest {
  merchantId: string;
  customerId?: string;
  daysAhead?: number;
}

export interface SendReminderRequest {
  customerId: string;
  prescriptionId: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  message?: string;
}

// ==================== Validation Types ====================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ==================== Prescription Analysis Types ====================

export interface PrescriptionAnalysis {
  prescriptionId: string;
  isValid: boolean;
  issues: ComplianceIssue[];
  interactionWarnings: DrugInteraction[];
  dosingIssues: string[];
  refillEligibility: {
    eligible: boolean;
    remainingRefills: number;
    nextRefillDate: Date;
  };
  complianceStatus: {
    scheduleCompliant: boolean;
    durationCompliant: boolean;
    documentationComplete: boolean;
  };
}

// ==================== Supplier Analysis Types ====================

export interface SupplierAnalysis {
  supplierId: string;
  performance: SupplierPerformance;
  drugSupplyQuality: {
    drugId: string;
    qualityIssues: string[];
    recallHistory: string[];
  }[];
  recommendations: string[];
}