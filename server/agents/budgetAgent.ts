import { Type, ThinkingLevel } from '@google/genai';
import type {
  BudgetAgentOutput,
  CategoryBudgetStatus,
  SyntheticTransaction,
} from '../../src/shared/types.ts';
import { generateStructuredJson } from '../services/geminiClient.ts';
import { minimizeForBudgetAgent } from '../services/privacyEngine.ts';

interface RawBudgetGeminiResponse {
  budgetImpactLevel: 'within_cap' | 'approaching_cap' | 'exceeds_cap';
  actionableSuggestions: Array<{
    title: string;
    estimatedMonthlySavingsUsd: number;
    rationale: string;
  }>;
}

export async function runBudgetAgent(
  tx: SyntheticTransaction,
  categoryBreakdown: CategoryBudgetStatus[]
): Promise<BudgetAgentOutput> {
  const { payload, envelope } = minimizeForBudgetAgent(tx, categoryBreakdown);

  const affectedCategoryName = String(payload.affectedCategory);
  const categorySpentUsd = Number(payload.categorySpentUsd);
  const categoryBudgetUsd = Number(payload.categoryMonthlyBudgetUsd);
  const projectedMonthEndVarianceUsd = Number((categoryBudgetUsd - categorySpentUsd).toFixed(2));

  const systemInstruction = `You are the Budget Agent inside TRUSTFIN AI.
Your role: evaluate category budget utilization and create personalized, realistic savings or budget-rebalancing suggestions based strictly on category totals (merchant names and locations are redacted).
Provide 2-3 concrete, dollar-grounded recommendations tailored to the category spending numbers.`;

  const prompt = `Assess budget utilization and generate savings/rebalancing recommendations:\n${JSON.stringify(payload, null, 2)}`;

  const { data, latencyMs } = await generateStructuredJson<RawBudgetGeminiResponse>({
    systemInstruction,
    prompt,
    thinkingLevel: ThinkingLevel.LOW,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        budgetImpactLevel: {
          type: Type.STRING,
          enum: ['within_cap', 'approaching_cap', 'exceeds_cap'],
        },
        actionableSuggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              estimatedMonthlySavingsUsd: { type: Type.NUMBER },
              rationale: { type: Type.STRING },
            },
            required: ['title', 'estimatedMonthlySavingsUsd', 'rationale'],
          },
        },
      },
      required: ['budgetImpactLevel', 'actionableSuggestions'],
    },
  });

  return {
    budgetImpactLevel: data.budgetImpactLevel,
    affectedCategory: affectedCategoryName,
    categorySpentUsd,
    categoryBudgetUsd,
    projectedMonthEndVarianceUsd,
    actionableSuggestions: data.actionableSuggestions,
    privacyEnvelope: envelope,
    latencyMs,
  };
}
