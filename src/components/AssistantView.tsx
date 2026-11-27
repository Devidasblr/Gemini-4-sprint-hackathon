import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Lock,
  Send,
  Shield,
  Sparkles,
} from 'lucide-react';
import type {
  AssistantChatMessage,
  DeterministicAssessment,
  SyntheticTransaction,
} from '../shared/types';

type EnrichedTx = SyntheticTransaction & { deterministic: DeterministicAssessment };

interface AssistantViewProps {
  transactions: EnrichedTx[];
  selectedTxId: string;
  onSelectTxId: (id: string) => void;
  geminiConfigured: boolean;
  onAuditUpdate: () => void;
}

const STARTER_PROMPTS = [
  'Why was TX-9482 flagged, and is fraud confirmed?',
  'How do this month’s flagged charges impact my $2,800 savings goal?',
  'Explain the geo-velocity alert on TX-9480 in plain language.',
  'Which categories are exceeding budget and how can I rebalance?',
];

export function AssistantView({
  transactions,
  selectedTxId,
  onSelectTxId,
  geminiConfigured,
  onAuditUpdate,
}: AssistantViewProps) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsg: AssistantChatMessage = {
      id: `USR-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          selectedTxId,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || `Request failed (${response.status})`);
      }

      setMessages((prev) => [...prev, payload.reply as AssistantChatMessage]);
      onAuditUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Gemini backend.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Main Conversational Panel */}
      <div className="flex h-[calc(100vh-12rem)] min-h-[540px] flex-col rounded-lg border border-[#1E2E4E] bg-[#0C1426] lg:col-span-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2E4E] px-5 py-3.5">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Conversational Financial Coach
            </h2>
            <p className="text-xs text-slate-400">
              Orchestrator dynamically routes questions to Risk, Finance, and Budget scopes via Gemini 4 Hydrogen
            </p>
          </div>
          <div className="font-mono text-xs text-slate-300">
            {geminiConfigured ? 'API: Gemini 4 Hydrogen Ready' : 'API: GEMINI_API_KEY Unset'}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Sparkles className="h-7 w-7 text-blue-400" />
              <h3 className="mt-3 font-display text-base font-semibold text-white">
                Ask About Spending, Risks, or Privacy Controls
              </h3>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                Every prompt is routed through the Central Orchestrator, enforcing field-level data minimization before calling Gemini 4 Hydrogen on the server.
              </p>

              <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-md border border-[#1E2E4E] bg-[#080F1E] p-3 text-left text-xs text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-[#0E1930]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'border border-[#1E2E4E] bg-[#080F1E] text-slate-100'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.role === 'assistant' && msg.routedAgents && (
                    <div className="mt-3 border-t border-[#1E2E4E] pt-2.5 text-[11px] text-slate-400 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-blue-400">
                          Routed: {msg.routedAgents.join(' · ')}
                        </span>
                        {msg.latencyMs && (
                          <span className="font-mono text-slate-500">
                            ({msg.latencyMs}ms · {msg.modelUsed})
                          </span>
                        )}
                      </div>
                      {msg.dataMinimizationNotes && msg.dataMinimizationNotes.length > 0 && (
                        <div className="flex items-start gap-1.5 text-slate-400">
                          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                          <span>{msg.dataMinimizationNotes.join(' ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-blue-300">
              <span className="inline-block h-2 w-2 animate-ping rounded-full bg-blue-400" />
              Orchestrator querying Gemini 4 Hydrogen with minimized context...
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-5 mb-3 flex items-start gap-2 rounded-md border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 border-t border-[#1E2E4E] p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about flagged transactions, cash flow, or budget adjustments..."
            className="flex-1 rounded-md border border-[#1E2E4E] bg-[#080F1E] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </form>
      </div>

      {/* Context & Privacy Guardrails Sidebar */}
      <div className="space-y-5 lg:col-span-4">
        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold text-white">
            Focused Transaction Context
          </h3>
          <p className="text-xs text-slate-400">
            Optionally focus your question on a specific synthetic transaction:
          </p>
          <select
            value={selectedTxId}
            onChange={(e) => onSelectTxId(e.target.value)}
            aria-label="Focused transaction context"
            className="w-full rounded-md border border-[#1E2E4E] bg-[#080F1E] px-3 py-2 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            {transactions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.merchant} (${t.amount.toFixed(2)})
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Shield className="h-4 w-4 text-blue-400" />
            Active AI Guardrails
          </div>
          <ul className="space-y-2.5 text-xs leading-relaxed text-slate-300">
            <li>
              <strong className="text-white">Real Gemini Calls Only:</strong> Responses come directly from{' '}
              <code className="font-mono text-blue-300">gemini-4-hydrogen</code> on the Express backend.
            </li>
            <li>
              <strong className="text-white">No Unilateral Fraud Claims:</strong> AI outputs explain risk indicators; human confirmation is always required.
            </li>
            <li>
              <strong className="text-white">Zero Raw PII Sharing:</strong> Card numbers, account masks, and raw device fingerprints never enter prompts.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
