/**
 * Modules Index - Export all module classes
 */

export { FinanceModule } from './FinanceModule';
export type {
  Transaction,
  PayoutSummary,
  FinancialSummary,
} from './FinanceModule';

export { CatalogModule } from './CatalogModule';
export type {
  Product,
  ProductVariant,
  Category,
  CatalogSummary,
} from './CatalogModule';

export { InventoryModule } from './InventoryModule';
export type {
  InventoryItem,
  Warehouse,
  StockAlert,
  Supplier,
  InventorySummary,
} from './InventoryModule';

export { CRMModule } from './CRMModule';
export type {
  Customer,
  Review,
  Feedback,
  CRMSummary,
} from './CRMModule';

export { LoyaltyModule } from './LoyaltyModule';
export type {
  LoyaltyProgram,
  LoyaltyMember,
  LoyaltyTier,
  LoyaltyTransaction,
  LoyaltySummary,
} from './LoyaltyModule';

export { StaffModule } from './StaffModule';
export type {
  StaffMember,
  Role,
  StaffSummary,
  TimeEntry,
  Schedule,
} from './StaffModule';

export { ComplianceModule } from './ComplianceModule';
export type {
  KYCVerification,
  TaxInfo,
  License,
  ComplianceCheck,
  ComplianceSummary,
} from './ComplianceModule';

export { AnalyticsModule } from './AnalyticsModule';
export type {
  SalesMetrics,
  CustomerMetrics,
  ProductMetrics,
  TrafficMetrics,
  TimeSeriesData,
  DashboardData,
  AnalyticsSummary,
} from './AnalyticsModule';

export { AIMemoryModule } from './AIMemoryModule';
export type {
  MerchantPreference,
  AutomationRule,
  Conversation,
  AIMemorySummary,
  SemanticSearchResult,
} from './AIMemoryModule';
