import type {
  DeterministicAssessment,
  DeterministicRuleHit,
  SyntheticTransaction,
} from '../../src/shared/types.ts';
import {
  CATEGORY_BUDGETS,
  USER_PRIMARY_CITY,
} from '../data/syntheticTransactions.ts';

/**
 * Deterministic Rule Engine (Non-AI).
 * Evaluates transactions strictly using transparent mathematical thresholds
 * so AI assessments are clearly separated from deterministic rule triggers.
 */
export function evaluateDeterministicRules(
  tx: SyntheticTransaction,
  allTransactions: SyntheticTransaction[]
): DeterministicAssessment {
  if (tx.type === 'income') {
    return {
      txId: tx.id,
      ruleScore: 0,
      requiresReview: false,
      baselineCategoryAvg: tx.amount,
      amountRatioToCategoryAvg: 1,
      triggeredRules: [],
    };
  }

  const triggeredRules: DeterministicRuleHit[] = [];

  // Compute baseline category average from clear historical expenses
  const peerExpenses = allTransactions.filter(
    (other) =>
      other.id !== tx.id &&
      other.type === 'expense' &&
      other.category === tx.category &&
      other.reviewStatus === 'clear'
  );

  const fallbackBaseline =
    tx.category !== 'Income' ? CATEGORY_BUDGETS[tx.category] * 0.35 : 150;

  const baselineCategoryAvg =
    peerExpenses.length > 0
      ? peerExpenses.reduce((sum, item) => sum + item.amount, 0) / peerExpenses.length
      : fallbackBaseline;

  const amountRatio = baselineCategoryAvg > 0 ? tx.amount / baselineCategoryAvg : 1;

  // Rule 1: Amount Outlier vs Category Mean
  if (amountRatio >= 3.0 && tx.amount >= 250) {
    const isSevere = amountRatio >= 6.0;
    triggeredRules.push({
      ruleId: 'DET-AMT-OUTLIER',
      ruleName: 'Amount Outlier vs Category Baseline',
      severity: isSevere ? 'critical' : 'warning',
      threshold: '>= 3.0x category baseline & >= $250',
      observed: `${amountRatio.toFixed(1)}x ($${tx.amount.toFixed(2)} vs $${baselineCategoryAvg.toFixed(2)} avg)`,
      explanation: `Transaction amount is ${amountRatio.toFixed(1)}x higher than clear historical transactions in ${tx.category}.`,
      points: isSevere ? 35 : 22,
    });
  }

  // Rule 2: Geography Mismatch from Primary City
  if (tx.location !== USER_PRIMARY_CITY) {
    const isInternational = !tx.location.endsWith(', CA') && !tx.location.endsWith(', FL') && !tx.location.endsWith(', NY') && !tx.location.endsWith(', TX');
    triggeredRules.push({
      ruleId: 'DET-GEO-MISMATCH',
      ruleName: 'Location Outside Primary Region',
      severity: isInternational ? 'critical' : 'warning',
      threshold: `Expected ${USER_PRIMARY_CITY}`,
      observed: tx.location,
      explanation: isInternational
        ? `Cross-border activity detected in ${tx.location}, outside established domestic pattern (${USER_PRIMARY_CITY}).`
        : `Transaction originated in ${tx.location}, outside primary city (${USER_PRIMARY_CITY}).`,
      points: isInternational ? 28 : 18,
    });
  }

  // Rule 3: Impossible Geo-Velocity (different city within 4 hours of another Card Present charge)
  const txTimeMs = new Date(tx.timestamp).getTime();
  const nearbyCityConflict = allTransactions.find((other) => {
    if (other.id === tx.id || other.location === tx.location) return false;
    if (other.channel !== 'Card Present' && tx.channel !== 'Card Present') return false;
    const diffHours = Math.abs(new Date(other.timestamp).getTime() - txTimeMs) / (1000 * 60 * 60);
    return diffHours <= 4;
  });

  if (nearbyCityConflict) {
    const diffMinutes = Math.round(
      Math.abs(new Date(nearbyCityConflict.timestamp).getTime() - txTimeMs) / (1000 * 60)
    );
    triggeredRules.push({
      ruleId: 'DET-GEO-VELOCITY',
      ruleName: 'Impossible Travel Velocity',
      severity: 'critical',
      threshold: 'Distinct cities within <= 240 min',
      observed: `${diffMinutes} min between ${tx.location} and ${nearbyCityConflict.location}`,
      explanation: `Card-present activity occurred ${diffMinutes} minutes apart from ${nearbyCityConflict.id} (${nearbyCityConflict.location}).`,
      points: 32,
    });
  }

  // Rule 4: Off-Hours Window (00:00 - 05:00 UTC high-value)
  const utcHour = new Date(tx.timestamp).getUTCHours();
  if (utcHour >= 0 && utcHour < 5 && tx.amount >= 500) {
    triggeredRules.push({
      ruleId: 'DET-OFF-HOURS',
      ruleName: 'Off-Hours High-Value Window',
      severity: 'warning',
      threshold: '00:00–05:00 UTC and >= $500',
      observed: `${String(utcHour).padStart(2, '0')}:${String(new Date(tx.timestamp).getUTCMinutes()).padStart(2, '0')} UTC ($${tx.amount.toFixed(2)})`,
      explanation: 'High-value transaction initiated during overnight off-hours window.',
      points: 18,
    });
  }

  // Rule 5: High-Risk Channel / Stored-Value or Offshore Wire
  const lowerMerchant = tx.merchant.toLowerCase();
  if (
    tx.category === 'Digital & Wire Transfers' ||
    lowerMerchant.includes('gift') ||
    lowerMerchant.includes('offshore')
  ) {
    triggeredRules.push({
      ruleId: 'DET-HIGH-RISK-MCC',
      ruleName: 'High-Risk Transfer / Stored-Value Category',
      severity: 'warning',
      threshold: 'Wire / Offshore / Gift Card MCC',
      observed: `${tx.channel} · ${tx.merchant}`,
      explanation: 'Merchant falls into irreversible wire transfer or stored-value category requiring verification.',
      points: 20,
    });
  }

  // Rule 6: Category Budget Overrun
  if (tx.category !== 'Income') {
    const monthPrefix = tx.date.slice(0, 7);
    const monthCategorySpend = allTransactions
      .filter((t) => t.type === 'expense' && t.category === tx.category && t.date.startsWith(monthPrefix))
      .reduce((sum, t) => sum + t.amount, 0);
    const cap = CATEGORY_BUDGETS[tx.category];
    if (monthCategorySpend > cap) {
      triggeredRules.push({
        ruleId: 'DET-BUDGET-CAP',
        ruleName: 'Monthly Category Cap Exceeded',
        severity: 'info',
        threshold: `<= $${cap.toFixed(2)} monthly cap`,
        observed: `$${monthCategorySpend.toFixed(2)} (${Math.round((monthCategorySpend / cap) * 100)}%)`,
        explanation: `Including this charge pushes ${tx.category} monthly spend above the $${cap.toFixed(2)} target.`,
        points: 10,
      });
    }
  }

  const ruleScore = Math.min(
    100,
    triggeredRules.reduce((sum, r) => sum + r.points, 0)
  );

  return {
    txId: tx.id,
    ruleScore,
    requiresReview: ruleScore >= 30 || tx.reviewStatus !== 'clear',
    baselineCategoryAvg: Number(baselineCategoryAvg.toFixed(2)),
    amountRatioToCategoryAvg: Number(amountRatio.toFixed(2)),
    triggeredRules,
  };
}
