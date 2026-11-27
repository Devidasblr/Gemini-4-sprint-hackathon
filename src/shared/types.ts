export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'Income'
  | 'Housing & Utilities'
  | 'Groceries'
  | 'Dining & Coffee'
  | 'Software & Cloud'
  | 'Travel & Transport'
  | 'Retail & Electronics'
  | 'Digital & Wire Transfers';

export type HumanReviewStatus =
  | 'clear'
  | 'flagged_pending'
  | 'held_for_review'
  | 'verified_safe'
  | 'dispute_opened';

export interface SyntheticTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO UTC
  merchant: string;
  category: TransactionCategory;
  type: TransactionType;
  amount: number; // positive USD amount
  location: string;
  channel: 'Card Present' | 'Card Not Present' | 'ACH Direct' | 'Wire / Digital';
  reviewStatus: HumanReviewStatus;
  notes?: string;
  // Sensitive synthetic metadata subject to Data Minimization before agent routing
  sensitiveMetadata: {
    accountMask: string;
    cardLast4: string;
    ipAddress: string;
    deviceFingerprint: string;
    rawMerchantDescriptor: string;
    accountHolderAlias: string;
  };
}

export interface DeterministicRuleHit {
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  threshold: string;
  observed: string;
  explanation: string;
  points: number;
}

export interface DeterministicAssessment {
  txId: string;
  ruleScore: number; // 0-100 deterministic score
  requiresReview: boolean;
  baselineCategoryAvg: number;
  amountRatioToCategoryAvg: number;
  triggeredRules: DeterministicRuleHit[];
}

export interface AgentPrivacyEnvelope {
  agentName: 'Risk Agent' | 'Finance Agent' | 'Budget Agent' | 'Financial Coach Agent';
  purpose: string;
  sharedFields: string[];
  blockedFields: string[];
  minimizationRatio: number; // percentage of sensitive/total fields withheld
  sanitizedPayloadPreview: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor:
    | 'Orchestrator'
    | 'Deterministic Engine'
    | 'Risk Agent'
    | 'Finance Agent'
    | 'Budget Agent'
    | 'Financial Coach Agent'
    | 'Human Reviewer';
  eventType: 'DATA_ACCESS' | 'AGENT_INFERENCE' | 'RULE_EVALUATION' | 'HUMAN_DECISION';
  txId?: string;
  purpose: string;
  sharedFields: string[];
  blockedFields: string[];
  minimizationRatio: number;
  modelUsed?: string;
  latencyMs?: number;
  summary: string;
}

export interface RiskAgentOutput {
  assessmentLevel: 'low' | 'elevated' | 'high';
  indicatorConfidence: number; // 0-100 AI indicator confidence (explicitly NOT confirmed fraud)
  fraudConfirmed: false; // Enforced false: AI never unilaterally confirms fraud
  keyIndicators: string[];
  nonFraudAlternatives: string[];
  reasoningSummary: string;
  recommendedHumanOptions: string[];
  privacyEnvelope: AgentPrivacyEnvelope;
  latencyMs: number;
}

export interface FinanceAgentOutput {
  cashFlowImpactSummary: string;
  monthlyExpenseDeltaPercent: number;
  savingsRateBeforePercent: number;
  savingsRateAfterPercent: number;
  liquidityBufferAssessment: string;
  patternObservations: string[];
  privacyEnvelope: AgentPrivacyEnvelope;
  latencyMs: number;
}

export interface BudgetAgentOutput {
  budgetImpactLevel: 'within_cap' | 'approaching_cap' | 'exceeds_cap';
  affectedCategory: string;
  categorySpentUsd: number;
  categoryBudgetUsd: number;
  projectedMonthEndVarianceUsd: number;
  actionableSuggestions: Array<{
    title: string;
    estimatedMonthlySavingsUsd: number;
    rationale: string;
  }>;
  privacyEnvelope: AgentPrivacyEnvelope;
  latencyMs: number;
}

export interface CoachAgentOutput {
  headline: string;
  plainLanguageExplanation: string;
  humanOversightNotice: string;
  checklistSteps: string[];
  privacyEnvelope: AgentPrivacyEnvelope;
  latencyMs: number;
}

export interface PendingHumanAction {
  id: string;
  txId: string;
  merchant: string;
  amount: number;
  createdAt: string;
  proposedAction: string;
  riskLevel: 'low' | 'elevated' | 'high';
  rationale: string;
  status: 'pending' | 'approved_hold' | 'verified_safe' | 'dispute_opened';
  decidedAt?: string;
  decidedBy?: string;
}

export interface InvestigationResult {
  investigationId: string;
  txId: string;
  transaction: SyntheticTransaction;
  modelUsed: string;
  executedAt: string;
  totalLatencyMs: number;
  deterministic: DeterministicAssessment;
  riskAgent: RiskAgentOutput;
  financeAgent: FinanceAgentOutput;
  budgetAgent: BudgetAgentOutput;
  coachAgent: CoachAgentOutput;
  pendingAction: PendingHumanAction | null;
}

export interface MonthlySummaryPoint {
  month: string; // e.g. "2026-06"
  label: string; // e.g. "Jun"
  income: number;
  expenses: number;
  savings: number;
}

export interface CategoryBudgetStatus {
  category: TransactionCategory;
  spent: number;
  budget: number;
  utilizationPercent: number;
}

export interface DashboardSnapshot {
  periodLabel: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRatePercent: number;
  monthlyBudgetTarget: number;
  flaggedCount: number;
  pendingActionsCount: number;
  monthlySeries: MonthlySummaryPoint[];
  categoryBreakdown: CategoryBudgetStatus[];
  recentTransactions: Array<SyntheticTransaction & { deterministic: DeterministicAssessment }>;
  pendingActions: PendingHumanAction[];
  auditLog: AuditLogEntry[];
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  routedAgents?: Array<'Risk Agent' | 'Finance Agent' | 'Budget Agent' | 'Financial Coach Agent'>;
  dataMinimizationNotes?: string[];
  modelUsed?: string;
  latencyMs?: number;
}
