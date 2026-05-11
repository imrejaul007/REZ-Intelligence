export interface Transaction {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  merchantId: string;
  customerId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface BalanceRecord {
  id: string;
  accountId: string;
  balance: number;
  currency: string;
  timestamp: Date;
  source: 'internal' | 'external';
  checksum?: string;
}

export interface Discrepancy {
  id: string;
  type: 'amount_mismatch' | 'missing_transaction' | 'duplicate_transaction' | 'status_mismatch' | 'timing_difference';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  transactionId?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  status: 'open' | 'investigating' | 'resolved' | 'escalated';
  notes?: string;
}

export interface Dispute {
  id: string;
  transactionId: string;
  disputeId: string;
  type: 'chargeback' | 'fraud' | 'customer_dispute' | 'technical_issue' | 'authorization_error';
  reason: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'under_review' | 'awaiting_evidence' | 'resolved_favor_merchant' | 'resolved_favor_customer' | 'cancelled';
  filedBy: string;
  filedAt: Date;
  resolutionAt?: Date;
  evidence?: DisputeEvidence[];
  notes?: string;
}

export interface DisputeEvidence {
  id: string;
  type: 'receipt' | 'communication' | 'documentation' | 'proof_of_delivery' | 'other';
  description: string;
  fileUrl?: string;
  submittedAt: Date;
  submittedBy: string;
}

export interface AuditReport {
  id: string;
  reportId: string;
  type: 'daily_balance' | 'transaction_summary' | 'discrepancy_analysis' | 'dispute_report' | 'compliance_report';
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  generatedBy: string;
  summary: ReportSummary;
  details: unknown;
  status: 'draft' | 'published' | 'archived';
}

export interface ReportSummary {
  totalTransactions: number;
  totalAmount: number;
  discrepanciesFound: number;
  discrepanciesResolved: number;
  disputesFiled: number;
  disputesResolved: number;
  successRate: number;
}

export interface ReconciliationJob {
  id: string;
  jobId: string;
  type: 'daily_balance' | 'transaction_verify' | 'full_reconciliation';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  recordsProcessed: number;
  discrepanciesFound: number;
  errorMessage?: string;
  triggeredBy: string;
  scheduled?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
