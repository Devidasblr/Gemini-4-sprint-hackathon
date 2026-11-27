import { Type, ThinkingLevel } from '@google/genai';
import type {
  DeterministicAssessment,
  RiskAgentOutput,
  SyntheticTransaction,
} from '../../src/shared/types.ts';
import { generateStructuredJson } from '../services/geminiClient.ts';
import { minimizeForRiskAgent } from '../services/privacyEngine.ts';

interface RawRiskGeminiResponse {
  assessmentLevel: 'low' | 'elevated' | 'high';
  indicatorConfidence: number;
  keyIndicators: string[];
  nonFraudAlternatives: string[];
  reasoningSummary: string;
  recommendedHumanOptions: string[];
}

export async function runRiskAgent(
  tx: SyntheticTransaction,
  deterministic: DeterministicAssessment
): Promise<RiskAgentOutput> {
  const { payload, envelope } = minimizeForRiskAgent(tx, deterministic);

  const systemInstruction = `You are the Risk Agent inside TRUSTFIN AI, a privacy-first multi-agent financial intelligence platform.
Your role: analyze a minimized, PII-redacted transaction payload alongside deterministic rule outputs to assess anomaly indicators.
CRITICAL SAFETY & TRANSPARENCY RULES:
1. Never claim fraud is "confirmed" or "proven" based on an AI assessment or risk score alone. Frame findings strictly as risk indicators requiring human verification.
2. Separate deterministic rule facts (amounts, timestamps, geography mismatches) from your probabilistic reasoning.
3. Always provide plausible benign/non-fraud alternatives (e.g., authorized travel, VPN usage, legitimate annual upgrade) alongside risk indicators.
4. Recommend concrete options for human oversight rather than autonomous card cancellation.
Keep all bullet items concise (1 sentence each) and reasoningSummary under 75 words.`;

  const prompt = `Analyze this data-minimized transaction for anomaly indicators:\n${JSON.stringify(payload, null, 2)}`;

  const { data, latencyMs } = await generateStructuredJson<RawRiskGeminiResponse>({
    systemInstruction,
    prompt,
    thinkingLevel: ThinkingLevel.LOW,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        assessmentLevel: {
          type: Type.STRING,
          enum: ['low', 'elevated', 'high'],
          description: 'Overall risk indicator tier.',
        },
        indicatorConfidence: {
          type: Type.INTEGER,
          description: 'Confidence score 0-100 that indicators warrant human verification (not fraud confirmation).',
        },
        keyIndicators: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2-4 specific anomaly indicators observed in the minimized data.',
        },
        nonFraudAlternatives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2 plausible legitimate explanations for these signals.',
        },
        reasoningSummary: {
          type: Type.STRING,
          description: 'Transparent summary distinguishing deterministic triggers from AI risk reasoning.',
        },
        recommendedHumanOptions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2-3 human-in-the-loop actions the user can approve or reject.',
        },
      },
      required: [
        'assessmentLevel',
        'indicatorConfidence',
        'keyIndicators',
        'nonFraudAlternatives',
        'reasoningSummary',
        'recommendedHumanOptions',
      ],
    },
  });

  return {
    assessmentLevel: data.assessmentLevel,
    indicatorConfidence: Math.max(0, Math.min(100, data.indicatorConfidence)),
    fraudConfirmed: false,
    keyIndicators: data.keyIndicators,
    nonFraudAlternatives: data.nonFraudAlternatives,
    reasoningSummary: data.reasoningSummary,
    recommendedHumanOptions: data.recommendedHumanOptions,
    privacyEnvelope: envelope,
    latencyMs,
  };
}
