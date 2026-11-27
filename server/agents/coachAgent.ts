import { Type, ThinkingLevel } from '@google/genai';
import type {
  BudgetAgentOutput,
  CoachAgentOutput,
  DeterministicAssessment,
  FinanceAgentOutput,
  RiskAgentOutput,
  SyntheticTransaction,
} from '../../src/shared/types.ts';
import {
  generateStructuredJson,
  generateTextResponse,
} from '../services/geminiClient.ts';
import { minimizeForCoachAgent } from '../services/privacyEngine.ts';

interface RawCoachGeminiResponse {
  headline: string;
  plainLanguageExplanation: string;
  humanOversightNotice: string;
  checklistSteps: string[];
}

export async function runCoachAgentSynthesis(params: {
  tx: SyntheticTransaction;
  deterministic: DeterministicAssessment;
  risk: RiskAgentOutput;
  finance: FinanceAgentOutput;
  budget: BudgetAgentOutput;
}): Promise<CoachAgentOutput> {
  const { tx, deterministic, risk, finance, budget } = params;

  const { payload, envelope } = minimizeForCoachAgent({
    txId: tx.id,
    amountUsd: tx.amount,
    category: tx.category,
    merchantDisplay: tx.merchant,
    deterministicRuleScore: deterministic.ruleScore,
    riskAssessmentLevel: risk.assessmentLevel,
    cashFlowImpact: finance.cashFlowImpactSummary,
    budgetImpact: `${budget.affectedCategory}: $${budget.categorySpentUsd} / $${budget.categoryBudgetUsd}`,
  });

  const synthesisInput = {
    transactionContext: payload,
    deterministicFacts: {
      ruleScore: deterministic.ruleScore,
      triggeredRules: deterministic.triggeredRules.map((r) => `${r.ruleName}: ${r.observed}`),
    },
    riskFindings: {
      level: risk.assessmentLevel,
      indicatorConfidence: risk.indicatorConfidence,
      keyIndicators: risk.keyIndicators,
      nonFraudAlternatives: risk.nonFraudAlternatives,
    },
    financeFindings: {
      cashFlowImpactSummary: finance.cashFlowImpactSummary,
      savingsRateBefore: finance.savingsRateBeforePercent,
      savingsRateAfter: finance.savingsRateAfterPercent,
    },
    budgetFindings: {
      impactLevel: budget.budgetImpactLevel,
      topSuggestion: budget.actionableSuggestions[0]?.title ?? 'Review category cap',
    },
  };

  const systemInstruction = `You are the Financial Coach Agent inside TRUSTFIN AI.
Your job: explain multi-agent findings to the user in calm, clear, conversational language.
Rules:
1. Clearly explain WHY the transaction drew attention (deterministic rules vs AI indicators).
2. Never claim fraud is confirmed; frame risk clearly as needing user confirmation.
3. Explain the real dollar impact on savings and budget without jargon.
4. Emphasize that no account hold, dispute, or transfer will happen without explicit human approval.`;

  const prompt = `Synthesize these multi-agent findings into an executive user briefing:\n${JSON.stringify(synthesisInput, null, 2)}`;

  const { data, latencyMs } = await generateStructuredJson<RawCoachGeminiResponse>({
    systemInstruction,
    prompt,
    thinkingLevel: ThinkingLevel.LOW,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        plainLanguageExplanation: { type: Type.STRING },
        humanOversightNotice: { type: Type.STRING },
        checklistSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        'headline',
        'plainLanguageExplanation',
        'humanOversightNotice',
        'checklistSteps',
      ],
    },
  });

  return {
    headline: data.headline,
    plainLanguageExplanation: data.plainLanguageExplanation,
    humanOversightNotice: data.humanOversightNotice,
    checklistSteps: data.checklistSteps,
    privacyEnvelope: envelope,
    latencyMs,
  };
}

export async function runCoachConversationalReply(params: {
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  routedContext: Record<string, unknown>;
}): Promise<{ text: string; latencyMs: number }> {
  const systemInstruction = `You are the TRUSTFIN AI Financial Coach Agent.
You answer user questions grounded ONLY in the sanitized financial context provided by the Orchestrator.
Rules:
- Never fabricate transaction amounts, merchants, or actions you cannot perform.
- Never claim fraud is confirmed solely from an AI indicator; always note that human review confirms/resolves alerts.
- Clearly note when a consequential action (e.g., holding a card, opening a dispute, adjusting a budget lock) requires the user's explicit approval in the Human Oversight queue.
- Keep responses concise, structured, and easy to read (2-4 short paragraphs or crisp bullets).`;

  const historySnippet = params.history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'TRUSTFIN Coach'}: ${m.content}`)
    .join('\n');

  const prompt = `Sanitized Orchestrator Context:\n${JSON.stringify(params.routedContext, null, 2)}\n\nRecent Conversation:\n${historySnippet || '(Start of session)'}\n\nUser Question: ${params.userMessage}`;

  return generateTextResponse({
    systemInstruction,
    prompt,
    thinkingLevel: ThinkingLevel.LOW,
  });
}
