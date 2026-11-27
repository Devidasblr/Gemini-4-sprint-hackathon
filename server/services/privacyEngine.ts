import crypto from 'node:crypto';
import type {
  AgentPrivacyEnvelope,
  AuditLogEntry,
  CategoryBudgetStatus,
  DeterministicAssessment,
  MonthlySummaryPoint,
  PendingHumanAction,
  SyntheticTransaction,
  TransactionCategory,
} from '../../src/shared/types.ts';
import {
  CATEGORY_BUDGETS,
  MONTHLY_SAVINGS_GOAL_USD,
} from '../data/syntheticTransactions.ts';

function hashIdentifier(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
}

const ALL_TX_FIELDS = [
  'id',
  'date',
  'timestamp',
  'merchant',
  'category',
  'type',
  'amount',
  'location',
  'channel',
  'accountMask',
  'cardLast4',
  'ipAddress',
  'deviceFingerprint',
  'rawMerchantDescriptor',
  'accountHolderAlias',
];

export function minimizeForRiskAgent(
  tx: SyntheticTransaction,
  deterministic: DeterministicAssessment
): {
  payload: Record<string, unknown>;
  envelope: AgentPrivacyEnvelope;
} {
  const payload = {
    txId: tx.id,
    timestampUtc: tx.timestamp,
    merchant: tx.merchant,
    category: tx.category,
    amountUsd: tx.amount,
    location: tx.location,
    channel: tx.channel,
    anonymizedDeviceHash: hashIdentifier(tx.sensitiveMetadata.deviceFingerprint),
    anonymizedNetworkHash: hashIdentifier(tx.sensitiveMetadata.ipAddress),
    deterministicRuleScore: deterministic.ruleScore,
    baselineCategoryAvgUsd: deterministic.baselineCategoryAvg,
    amountRatioToCategoryAvg: deterministic.amountRatioToCategoryAvg,
    triggeredRules: deterministic.triggeredRules.map((r) => ({
      ruleId: r.ruleId,
      severity: r.severity,
      observed: r.observed,
      explanation: r.explanation,
    })),
  };

  const sharedFields = [
    'txId',
    'timestampUtc',
    'merchant',
    'category',
    'amountUsd',
    'location',
    'channel',
    'anonymizedDeviceHash (SHA-256)',
    'anonymizedNetworkHash (SHA-256)',
    'deterministicFlags',
  ];

  const blockedFields = [
    'accountMask',
    'cardLast4',
    'rawIpAddress',
    'rawDeviceFingerprint',
    'rawMerchantDescriptor',
    'accountHolderAlias',
    'unrelatedLedgerHistory',
  ];

  return {
    payload,
    envelope: {
      agentName: 'Risk Agent',
      purpose: 'Evaluate anomaly indicators without accessing card numbers, raw IPs, or account identifiers.',
      sharedFields,
      blockedFields,
      minimizationRatio: Math.round((blockedFields.length / (sharedFields.length + blockedFields.length)) * 100),
      sanitizedPayloadPreview: payload,
    },
  };
}

export function minimizeForFinanceAgent(
  tx: SyntheticTransaction,
  monthlyTotals: {
    monthIncome: number;
    monthExpensesBeforeTx: number;
    monthExpensesIncludingTx: number;
    savingsRateBeforePercent: number;
    savingsRateAfterPercent: number;
    liquidCashReserveEstimateUsd: number;
  }
): {
  payload: Record<string, unknown>;
  envelope: AgentPrivacyEnvelope;
} {
  const payload = {
    txId: tx.id,
    category: tx.category,
    type: tx.type,
    amountUsd: tx.amount,
    date: tx.date,
    monthlyIncomeUsd: monthlyTotals.monthIncome,
    monthExpensesBeforeTxUsd: monthlyTotals.monthExpensesBeforeTx,
    monthExpensesIncludingTxUsd: monthlyTotals.monthExpensesIncludingTx,
    savingsRateBeforePercent: monthlyTotals.savingsRateBeforePercent,
    savingsRateAfterPercent: monthlyTotals.savingsRateAfterPercent,
    liquidCashReserveEstimateUsd: monthlyTotals.liquidCashReserveEstimateUsd,
  };

  const sharedFields = [
    'txId',
    'category',
    'type',
    'amountUsd',
    'date',
    'aggregatedMonthlyIncome',
    'aggregatedMonthlyExpenses',
    'savingsRateDelta',
  ];

  const blockedFields = [
    'merchant',
    'location',
    'channel',
    'accountMask',
    'cardLast4',
    'ipAddress',
    'deviceFingerprint',
    'rawMerchantDescriptor',
    'accountHolderAlias',
  ];

  return {
    payload,
    envelope: {
      agentName: 'Finance Agent',
      purpose: 'Quantify cash-flow and savings impact using strictly aggregated financial totals (merchant & PII withheld).',
      sharedFields,
      blockedFields,
      minimizationRatio: Math.round((blockedFields.length / (sharedFields.length + blockedFields.length)) * 100),
      sanitizedPayloadPreview: payload,
    },
  };
}

export function minimizeForBudgetAgent(
  tx: SyntheticTransaction,
  categoryBreakdown: CategoryBudgetStatus[]
): {
  payload: Record<string, unknown>;
  envelope: AgentPrivacyEnvelope;
} {
  const targetCategory = tx.category === 'Income' ? 'Digital & Wire Transfers' : tx.category;
  const affected = categoryBreakdown.find((c) => c.category === targetCategory) ?? {
    category: targetCategory,
    spent: tx.amount,
    budget: 400,
    utilizationPercent: 100,
  };

  const payload = {
    txId: tx.id,
    affectedCategory: affected.category,
    transactionAmountUsd: tx.amount,
    categorySpentUsd: affected.spent,
    categoryMonthlyBudgetUsd: affected.budget,
    categoryUtilizationPercent: affected.utilizationPercent,
    monthlySavingsGoalUsd: MONTHLY_SAVINGS_GOAL_USD,
    categorySummary: categoryBreakdown.map((c) => ({
      category: c.category,
      spentUsd: c.spent,
      budgetUsd: c.budget,
      utilizationPercent: c.utilizationPercent,
    })),
  };

  const sharedFields = [
    'txId',
    'affectedCategory',
    'transactionAmountUsd',
    'categorySpentUsd',
    'categoryMonthlyBudgetUsd',
    'monthlySavingsGoalUsd',
  ];

  const blockedFields = [
    'merchant',
    'timestamp',
    'location',
    'channel',
    'accountMask',
    'cardLast4',
    'ipAddress',
    'deviceFingerprint',
    'rawMerchantDescriptor',
    'accountHolderAlias',
  ];

  return {
    payload,
    envelope: {
      agentName: 'Budget Agent',
      purpose: 'Generate budget & savings recommendations using category caps only, without merchant or location data.',
      sharedFields,
      blockedFields,
      minimizationRatio: Math.round((blockedFields.length / (sharedFields.length + blockedFields.length)) * 100),
      sanitizedPayloadPreview: payload,
    },
  };
}

export function minimizeForCoachAgent(summaryInput: {
  txId: string;
  amountUsd: number;
  category: string;
  merchantDisplay: string;
  deterministicRuleScore: number;
  riskAssessmentLevel: string;
  cashFlowImpact: string;
  budgetImpact: string;
}): {
  payload: Record<string, unknown>;
  envelope: AgentPrivacyEnvelope;
} {
  const sharedFields = [
    'txId',
    'amountUsd',
    'category',
    'merchantDisplay',
    'synthesizedRiskFindings',
    'synthesizedFinanceFindings',
    'synthesizedBudgetFindings',
  ];

  const blockedFields = ALL_TX_FIELDS.filter((f) =>
    ['accountMask', 'cardLast4', 'ipAddress', 'deviceFingerprint', 'rawMerchantDescriptor', 'accountHolderAlias'].includes(f)
  );

  return {
    payload: summaryInput,
    envelope: {
      agentName: 'Financial Coach Agent',
      purpose: 'Translate sanitized multi-agent findings into plain-language guidance with zero raw PII.',
      sharedFields,
      blockedFields,
      minimizationRatio: Math.round((blockedFields.length / (sharedFields.length + blockedFields.length)) * 100),
      sanitizedPayloadPreview: summaryInput,
    },
  };
}

export function computeMonthlyAggregates(transactions: SyntheticTransaction[]): {
  currentMonthKey: string;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRatePercent: number;
  monthlySeries: MonthlySummaryPoint[];
  categoryBreakdown: CategoryBudgetStatus[];
} {
  const currentMonthKey = '2026-11';
  const currentMonthTxs = transactions.filter((t) => t.date.startsWith(currentMonthKey));

  const totalIncome = currentMonthTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = currentMonthTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpenses;
  const savingsRatePercent =
    totalIncome > 0 ? Number(((netSavings / totalIncome) * 100).toFixed(1)) : 0;

  const months = [
    { month: '2026-08', label: 'Aug' },
    { month: '2026-09', label: 'Sep' },
    { month: '2026-10', label: 'Oct' },
    { month: '2026-11', label: 'Nov' },
  ];

  const monthlySeries: MonthlySummaryPoint[] = months.map((m) => {
    const txs = transactions.filter((t) => t.date.startsWith(m.month));
    const inc = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return {
      month: m.month,
      label: m.label,
      income: Number(inc.toFixed(2)),
      expenses: Number(exp.toFixed(2)),
      savings: Number((inc - exp).toFixed(2)),
    };
  });

  const categories = Object.keys(CATEGORY_BUDGETS) as Array<
    Exclude<TransactionCategory, 'Income'>
  >;

  const categoryBreakdown: CategoryBudgetStatus[] = categories.map((category) => {
    const spent = currentMonthTxs
      .filter((t) => t.type === 'expense' && t.category === category)
      .reduce((s, t) => s + t.amount, 0);
    const budget = CATEGORY_BUDGETS[category];
    return {
      category,
      spent: Number(spent.toFixed(2)),
      budget,
      utilizationPercent: Math.round((spent / budget) * 100),
    };
  });

  return {
    currentMonthKey,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netSavings: Number(netSavings.toFixed(2)),
    savingsRatePercent,
    monthlySeries,
    categoryBreakdown,
  };
}

export function createAuditEntry(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): AuditLogEntry {
  return {
    id: `AUD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
}

export function createInitialPendingActions(
  transactions: SyntheticTransaction[]
): PendingHumanAction[] {
  const tx9482 = transactions.find((t) => t.id === 'TX-9482');
  if (!tx9482) return [];
  return [
    {
      id: 'ACT-9482',
      txId: tx9482.id,
      merchant: tx9482.merchant,
      amount: tx9482.amount,
      createdAt: '2026-11-26T03:15:00Z',
      proposedAction: 'Place temporary hold and request cardholder verification',
      riskLevel: 'high',
      rationale:
        'Deterministic rules flagged 9.6x category outlier + off-hours Bucharest offshore wire. Pending human review.',
      status: 'pending',
    },
  ];
}
