import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const GEMINI_MODEL = 'gemini-4-hydrogen';

let cachedClient: GoogleGenAI | null = null;

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets.'
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('429') ||
    message.includes('503') ||
    message.includes('500') ||
    message.includes('UNAVAILABLE') ||
    message.includes('RESOURCE_EXHAUSTED')
  );
}

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && isRetryableError(error)) {
        const delayMs = 350 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function generateStructuredJson<T>(params: {
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  thinkingLevel?: ThinkingLevel;
}): Promise<{ data: T; latencyMs: number }> {
  const ai = getGeminiClient();
  const startedAt = Date.now();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: params.prompt,
      config: {
        systemInstruction: params.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
        thinkingConfig: {
          thinkingLevel: params.thinkingLevel ?? ThinkingLevel.LOW,
        },
      },
    })
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty structured response.');
  }

  let parsed: T;
  try {
    parsed = JSON.parse(rawText) as T;
  } catch {
    throw new Error(`Gemini returned malformed JSON: ${rawText.slice(0, 180)}`);
  }

  return {
    data: parsed,
    latencyMs: Date.now() - startedAt,
  };
}

export async function generateTextResponse(params: {
  systemInstruction: string;
  prompt: string;
  thinkingLevel?: ThinkingLevel;
}): Promise<{ text: string; latencyMs: number }> {
  const ai = getGeminiClient();
  const startedAt = Date.now();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: params.prompt,
      config: {
        systemInstruction: params.systemInstruction,
        thinkingConfig: {
          thinkingLevel: params.thinkingLevel ?? ThinkingLevel.LOW,
        },
      },
    })
  );

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty text response.');
  }

  return {
    text,
    latencyMs: Date.now() - startedAt,
  };
}
