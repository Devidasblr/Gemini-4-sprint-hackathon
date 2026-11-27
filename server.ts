import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { orchestrator } from './server/agents/orchestrator.ts';
import { GEMINI_MODEL, isGeminiConfigured } from './server/services/geminiClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const investigateSchema = z.object({
  txId: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/),
});

const decisionSchema = z.object({
  actionId: z.string().trim().min(2).max(32),
  decision: z.enum(['hold', 'verify_safe', 'open_dispute']),
});

const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  selectedTxId: z.string().trim().max(32).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

function formatApiError(error: unknown): { status: number; message: string; code: string } {
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (rawMessage.includes('GEMINI_API_KEY')) {
    return {
      status: 503,
      code: 'GEMINI_KEY_MISSING',
      message: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('403')) {
    return {
      status: 403,
      code: 'GEMINI_AUTH_ERROR',
      message: 'Gemini API key rejected (403/invalid). Verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
    return {
      status: 429,
      code: 'GEMINI_RATE_LIMITED',
      message: 'Gemini API rate limit reached (429). Please retry shortly.',
    };
  }
  if (rawMessage.includes('not found')) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: rawMessage,
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: rawMessage || 'Unexpected server error.',
  };
}

async function createServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  // Basic security headers for iframe-compatible Cloud Run & AI Studio preview
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health & Gemini connectivity status (never exposes API keys)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'TRUSTFIN AI',
      model: GEMINI_MODEL,
      geminiConfigured: isGeminiConfigured(),
      privacyMode: 'synthetic-data-minimization',
      timestamp: new Date().toISOString(),
    });
  });

  // Full dashboard snapshot (metrics, charts, transactions, pending actions, audit log)
  app.get('/api/dashboard', (_req, res) => {
    res.json(orchestrator.getDashboardSnapshot());
  });

  // Run 4-agent Gemini investigation on a selected transaction
  app.post('/api/investigate', async (req, res) => {
    const parsed = investigateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid transaction ID provided.',
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const result = await orchestrator.investigateTransaction(parsed.data.txId);
      res.json({
        result,
        snapshot: orchestrator.getDashboardSnapshot(),
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({
        code: formatted.code,
        message: formatted.message,
      });
    }
  });

  // Human-in-the-loop oversight decision
  app.post('/api/actions/decide', (req, res) => {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid human review decision payload.',
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const outcome = orchestrator.applyHumanDecision(parsed.data);
      res.json(outcome);
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({
        code: formatted.code,
        message: formatted.message,
      });
    }
  });

  // Conversational Financial Assistant routed via Central Orchestrator -> Gemini 4 Hydrogen
  app.post('/api/assistant/chat', async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Message must be 1–2000 characters.',
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const reply = await orchestrator.handleAssistantChat(parsed.data);
      res.json({
        reply,
        auditLog: orchestrator.getAuditLog(),
      });
    } catch (error) {
      const formatted = formatApiError(error);
      res.status(formatted.status).json({
        code: formatted.code,
        message: formatted.message,
      });
    }
  });

  // Reset synthetic demo state
  app.post('/api/reset-demo', (_req, res) => {
    const snapshot = orchestrator.resetDemoState();
    res.json({ snapshot });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TRUSTFIN AI server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start TRUSTFIN AI server:', err);
  process.exit(1);
});
