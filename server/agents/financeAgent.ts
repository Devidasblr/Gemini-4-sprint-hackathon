import { Type, ThinkingLevel } from '@google/genai';
import type {
  FinanceAgentOutput,
  SyntheticTransaction,
} from '../../src/shared/types.ts';
import { generateStructuredJson } from '../services/geminiClient.ts';
import { minimizeForFinanceAgent } from '../services/privacyEngine.ts';

interface RawFinanceGeminiResponse {
  cashFlowImpactSummary: string;
  liquidityBufferAssessment: string;
  patternObservations: string[];
}

export async function runFinanceAgent(
  tx: SyntheticTransaction,
  allTransactions: SyntheticTransaction[]
): Promise<FinanceAgentOutput> {
  const currentMonthKey = tx.date.slice(0, 7);
  const monthTxs = allTransactions.filter((t) => t.date.startsWith(currentMonthKey));
  const monthIncome = monthTxs
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const monthExpensesIncludingTx = monthTxs
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const monthExpensesBeforeTx =
    tx.type === 'expense'
      ? Math.max(0, monthExpensesIncludingTx - tx.amount)
      : monthExpensesIncludingTx;

  const savingsRateBeforePercent =
    monthIncome > 0
      ? Number((((monthIncome - monthExpensesBeforeTx) / monthIncome) * 100).toFixed(1))
      : 0;
  const savingsRateAfterPercent =
    monthIncome > 0
      ? Number((((monthIncome - monthExpensesIncludingTx) / monthIncome) * 100).toFixed(1))
      : 0;

  const monthlyExpenseDeltaPercent =
    monthExpensesBeforeTx > 0 && tx.type === 'expense'
      ? Number(((tx.amount / monthExpensesBeforeTx) * 100).toFixed(1))
      : 0;

  const liquidCashReserveEstimateUsd = 18450;

  const { payload, envelope } = minimizeForFinanceAgent(tx, {
    monthIncome: Number(monthIncome.toFixed(2)),
    monthExpensesBeforeTx: Number(monthExpensesBeforeTx.toFixed(2)),
    monthExpensesIncludingTx: Number(monthExpensesIncludingTx.toFixed(2)),
    savingsRateBeforePercent,
    savingsRateAfterPercent,
    liquidCashReserveEstimateUsd,
  });

  const systemInstruction = `You are the Finance Agent inside TRUSTFIN AI.
Your role: analyze cash flow, liquidity impact, and spending pattern shifts using strictly aggregated financial figures (note that merchant names, locations, and PII are intentionally hidden from you).
Be quantitative, accurate to the provided USD figures, and concise (cashFlowImpactSummary <= 65 words).`;

  const prompt = `Evaluate the cash-flow and savings-rate impact of this transaction based on anonymized monthly aggregates:\n${JSON.stringify(payload, null, 2)}`;

  const { data, latencyMs } = await generateStructuredJson<RawFinanceGeminiResponse>({
    systemInstruction,
    prompt,
    thinkingLevel: ThinkingLevel.LOW,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        cashFlowImpactSummary: {
          type: Type.STRING,
          description: 'Concise quantitative summary of how this amount affects monthly cash flow and savings rate.',
        },
        liquidityBufferAssessment: {
          type: Type.STRING,
          description: 'Assessment of short-term cash reserve resilience.',
        },
        patternObservations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2-3 specific cash flow or category concentration observations.',
        },
      },
      required: [
        'cashFlowImpactSummary',
        'liquidityBufferAssessment',
        'patternObservations',
      ],
    },
  });

  return {
    cashFlowImpactSummary: data.cashFlowImpactSummary,
    monthlyExpenseDeltaPercent,
    savingsRateBeforePercent,
    savingsRateAfterPercent,
    liquidityBufferAssessment: data.liquidityBufferAssessment,
    patternObservations: data.patternObservations,
    privacyEnvelope: envelope,
    latencyMs,
  };
}
