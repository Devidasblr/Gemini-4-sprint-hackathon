import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Lock,
  Play,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import type {
  DeterministicAssessment,
  InvestigationResult,
  SyntheticTransaction,
} from '../shared/types';

type EnrichedTx = SyntheticTransaction & { deterministic: DeterministicAssessment };

interface MultiAgentLabViewProps {
  transactions: EnrichedTx[];
  selectedTxId: string;
  onSelectTxId: (id: string) => void;
  onRunInvestigation: (txId: string) => void;
  investigation: InvestigationResult | null;
  loading: boolean;
  error: string | null;
  onHumanDecision: (
    actionId: string,
    decision: 'hold' | 'verify_safe' | 'open_dispute'
  ) => void;
  decidingActionId: string | null;
}

export function MultiAgentLabView({
  transactions,
  selectedTxId,
  onSelectTxId,
  onRunInvestigation,
  investigation,
  loading,
  error,
  onHumanDecision,
  decidingActionId,
}: MultiAgentLabViewProps) {
  const [inspectEnvelopeAgent, setInspectEnvelopeAgent] = useState<
    'risk' | 'finance' | 'budget' | 'coach' | null
  >(null);

  const suspiciousPresets = transactions.filter(
    (t) => t.deterministic.requiresReview || t.reviewStatus !== 'clear'
  );

  const activeEnvelope =
    investigation && inspectEnvelopeAgent === 'risk'
      ? investigation.riskAgent.privacyEnvelope
      : investigation && inspectEnvelopeAgent === 'finance'
      ? investigation.financeAgent.privacyEnvelope
      : investigation && inspectEnvelopeAgent === 'budget'
      ? investigation.budgetAgent.privacyEnvelope
      : investigation && inspectEnvelopeAgent === 'coach'
      ? investigation.coachAgent.privacyEnvelope
      : null;

  return (
    <div className="space-y-6">
      {/* Workflow Launch Bar */}
      <section className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              End-to-End Multi-Agent Investigation Workflow
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Select a suspicious transaction to orchestrate deterministic pre-checks + 4 real Gemini 4 Hydrogen agents with strict data minimization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedTxId}
              onChange={(e) => onSelectTxId(e.target.value)}
              aria-label="Select transaction to investigate"
              className="rounded-md border border-[#1E2E4E] bg-[#080F1E] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              {transactions
                .filter((t) => t.type === 'expense')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.merchant} (${t.amount.toFixed(2)}) — Rule {t.deterministic.ruleScore}/100
                  </option>
                ))}
            </select>

            <button
              disabled={loading}
              onClick={() => onRunInvestigation(selectedTxId)}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              {loading ? 'Orchestrating 4 Gemini Agents...' : 'Run 7-Step Investigation'}
            </button>
          </div>
        </div>

        {/* Quick Preset Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#1E2E4E] pt-3.5">
          <span className="text-xs text-slate-400">Suspicious Test Cases:</span>
          {suspiciousPresets.map((tx) => (
            <button
              key={tx.id}
              onClick={() => {
                onSelectTxId(tx.id);
                onRunInvestigation(tx.id);
              }}
              disabled={loading}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors whitespace-nowrap ${
                selectedTxId === tx.id
                  ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                  : 'border-[#1E2E4E] bg-[#080F1E] text-slate-300 hover:border-slate-600'
              }`}
            >
              {tx.id} · {tx.merchant.split(' ').slice(0, 2).join(' ')} ($
              {tx.amount.toLocaleString()})
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <div className="font-medium">Gemini Orchestration Error</div>
            <p className="mt-0.5 text-xs text-rose-200/90">{error}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-8">
          <div className="flex items-center gap-3 text-sm font-medium text-blue-300">
            <Cpu className="h-5 w-5 animate-spin text-blue-400" />
            Orchestrator routing minimized payloads to Risk, Finance, Budget, and Financial Coach agents via Gemini 4 Hydrogen...
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            {['Risk Agent', 'Finance Agent', 'Budget Agent', 'Coach Agent'].map((name) => (
              <div
                key={name}
                className="h-28 animate-pulse rounded-md border border-[#1E2E4E] bg-[#080F1E] p-4"
              >
                <div className="h-3 w-24 rounded bg-slate-800" />
                <div className="mt-3 h-2.5 w-full rounded bg-slate-800/70" />
                <div className="mt-2 h-2.5 w-4/5 rounded bg-slate-800/70" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !investigation && !error && (
        <div className="rounded-lg border border-dashed border-[#1E2E4E] bg-[#0C1426]/60 p-10 text-center">
          <ShieldAlert className="mx-auto h-7 w-7 text-blue-400" />
          <h3 className="mt-3 font-display text-base font-semibold text-white">
            Ready to Demonstrate Multi-Agent Reasoning
          </h3>
          <p className="mx-auto mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">
            Click &ldquo;Run 7-Step Investigation&rdquo; or select any suspicious test case above to watch the Orchestrator evaluate deterministic rules, enforce field-level data minimization, invoke all 4 Gemini 4 Hydrogen agents, and queue a human approval decision.
          </p>
        </div>
      )}

      {!loading && investigation && (
        <div className="space-y-6">
          {/* 7-Step Execution Summary Strip */}
          <section className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2E4E] pb-3.5">
              <div>
                <div className="font-mono text-xs text-blue-400">
                  {investigation.investigationId} · {investigation.txId} · Model: {investigation.modelUsed}
                </div>
                <h3 className="mt-0.5 font-display text-lg font-semibold text-white">
                  {investigation.coachAgent.headline}
                </h3>
              </div>
              <div className="text-right font-mono text-xs tabular-nums text-slate-300">
                <div>Total Pipeline: {investigation.totalLatencyMs} ms</div>
                <div className="text-slate-400">
                  Rule Score: {investigation.deterministic.ruleScore}/100 · AI Risk Tier:{' '}
                  <span
                    className={
                      investigation.riskAgent.assessmentLevel === 'high'
                        ? 'text-rose-400'
                        : investigation.riskAgent.assessmentLevel === 'elevated'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                  >
                    {investigation.riskAgent.assessmentLevel.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Coach Plain-Language Briefing */}
            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-8">
                <div className="text-xs font-semibold text-slate-300">
                  Step 6 · Financial Coach Explanation (Gemini 4 Hydrogen)
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  {investigation.coachAgent.plainLanguageExplanation}
                </p>
                <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3 text-xs text-blue-200">
                  <strong>Human Oversight Safeguard:</strong>{' '}
                  {investigation.coachAgent.humanOversightNotice}
                </div>
              </div>

              <div className="space-y-2 lg:col-span-4">
                <div className="text-xs font-semibold text-slate-300">
                  Recommended User Checklist
                </div>
                <ul className="space-y-2">
                  {investigation.coachAgent.checklistSteps.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-slate-300"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Deterministic Rules vs AI Risk Separation */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Deterministic Engine Card */}
            <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-sky-400">
                    Non-AI Mathematical Thresholds
                  </span>
                  <h3 className="font-display text-base font-semibold text-white">
                    Deterministic Rule Engine
                  </h3>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums text-white">
                  {investigation.deterministic.ruleScore}/100
                </span>
              </div>

              {investigation.deterministic.triggeredRules.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No deterministic thresholds breached for this transaction.
                </p>
              ) : (
                <div className="space-y-2">
                  {investigation.deterministic.triggeredRules.map((r) => (
                    <div
                      key={r.ruleId}
                      className="rounded-md border border-[#1E2E4E] bg-[#080F1E] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between font-medium text-white">
                        <span>{r.ruleName}</span>
                        <span className="font-mono text-amber-400">+{r.points} pts</span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-slate-400">
                        Threshold: {r.threshold} · Observed: {r.observed}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Risk Agent Card */}
            <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-amber-400">
                    AI Indicator Assessment · Fraud Not Confirmed
                  </span>
                  <h3 className="font-display text-base font-semibold text-white">
                    Step 3 · Risk Agent ({investigation.riskAgent.latencyMs} ms)
                  </h3>
                </div>
                <button
                  onClick={() =>
                    setInspectEnvelopeAgent(
                      inspectEnvelopeAgent === 'risk' ? null : 'risk'
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  <Lock className="h-3 w-3" />
                  Privacy Scope ({investigation.riskAgent.privacyEnvelope.minimizationRatio}% redacted)
                </button>
              </div>

              <p className="text-xs leading-relaxed text-slate-300">
                {investigation.riskAgent.reasoningSummary}
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] font-semibold text-slate-400">
                    Observed Anomaly Indicators ({investigation.riskAgent.indicatorConfidence}% confidence)
                  </div>
                  <ul className="space-y-1 text-xs text-slate-200">
                    {investigation.riskAgent.keyIndicators.map((ind, i) => (
                      <li key={i}>· {ind}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold text-slate-400">
                    Plausible Benign Explanations
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {investigation.riskAgent.nonFraudAlternatives.map((alt, i) => (
                      <li key={i}>· {alt}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Finance Agent + Budget Agent */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-blue-400">
                    Aggregated Cash-Flow Scope (Merchant Redacted)
                  </span>
                  <h3 className="font-display text-base font-semibold text-white">
                    Step 4 · Finance Agent ({investigation.financeAgent.latencyMs} ms)
                  </h3>
                </div>
                <button
                  onClick={() =>
                    setInspectEnvelopeAgent(
                      inspectEnvelopeAgent === 'finance' ? null : 'finance'
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  <Lock className="h-3 w-3" />
                  Privacy Scope ({investigation.financeAgent.privacyEnvelope.minimizationRatio}% redacted)
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-md border border-[#1E2E4E] bg-[#080F1E] p-3 text-xs">
                <div>
                  <div className="text-slate-400">Expense Share</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                    {investigation.financeAgent.monthlyExpenseDeltaPercent}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Savings Before</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    {investigation.financeAgent.savingsRateBeforePercent}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Savings After</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-amber-400">
                    {investigation.financeAgent.savingsRateAfterPercent}%
                  </div>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-300">
                {investigation.financeAgent.cashFlowImpactSummary}
              </p>
              <div className="text-xs text-slate-400">
                Liquidity: {investigation.financeAgent.liquidityBufferAssessment}
              </div>
            </div>

            <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-blue-400">
                    Category Cap Scope Only
                  </span>
                  <h3 className="font-display text-base font-semibold text-white">
                    Step 5 · Budget Agent ({investigation.budgetAgent.latencyMs} ms)
                  </h3>
                </div>
                <button
                  onClick={() =>
                    setInspectEnvelopeAgent(
                      inspectEnvelopeAgent === 'budget' ? null : 'budget'
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  <Lock className="h-3 w-3" />
                  Privacy Scope ({investigation.budgetAgent.privacyEnvelope.minimizationRatio}% redacted)
                </button>
              </div>

              <div className="flex items-center justify-between rounded-md border border-[#1E2E4E] bg-[#080F1E] px-3 py-2 text-xs">
                <span className="text-slate-300">
                  {investigation.budgetAgent.affectedCategory}
                </span>
                <span className="font-mono tabular-nums text-white">
                  ${investigation.budgetAgent.categorySpentUsd.toLocaleString()} / $
                  {investigation.budgetAgent.categoryBudgetUsd.toLocaleString()} (
                  {investigation.budgetAgent.budgetImpactLevel.replace(/_/g, ' ')})
                </span>
              </div>

              <div className="space-y-2">
                {investigation.budgetAgent.actionableSuggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-[#1E2E4E] bg-[#080F1E] p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 font-medium text-white">
                      <span>{s.title}</span>
                      <span className="font-mono tabular-nums text-emerald-400">
                        +${s.estimatedMonthlySavingsUsd}/mo
                      </span>
                    </div>
                    <p className="mt-1 text-slate-400">{s.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Optional Data Minimization Inspector Drawer */}
          {activeEnvelope && (
            <section className="rounded-lg border border-blue-500/40 bg-[#080F1E] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-semibold text-white">
                  Data Minimization Envelope — {activeEnvelope.agentName}
                </h4>
                <button
                  onClick={() => setInspectEnvelopeAgent(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              <p className="text-xs text-slate-300">{activeEnvelope.purpose}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
                <div>
                  <div className="mb-1 font-semibold text-emerald-400">
                    Shared Fields ({activeEnvelope.sharedFields.length})
                  </div>
                  <div className="font-mono text-[11px] text-slate-300">
                    {activeEnvelope.sharedFields.join(', ')}
                  </div>
                </div>
                <div>
                  <div className="mb-1 font-semibold text-rose-400">
                    Blocked / Redacted Fields ({activeEnvelope.blockedFields.length})
                  </div>
                  <div className="font-mono text-[11px] text-slate-400">
                    {activeEnvelope.blockedFields.join(', ')}
                  </div>
                </div>
              </div>
              <pre className="max-h-48 overflow-auto rounded border border-[#1E2E4E] bg-[#060B16] p-3 font-mono text-[11px] text-slate-300">
                {JSON.stringify(activeEnvelope.sanitizedPayloadPreview, null, 2)}
              </pre>
            </section>
          )}

          {/* Step 7: Human-in-the-Loop Decision Bar */}
          {investigation.pendingAction && (
            <section className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                  <div>
                    <h4 className="font-display text-sm font-semibold text-white">
                      Step 7 · Human Oversight Required ({investigation.pendingAction.id})
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Current status:{' '}
                      <span className="font-medium text-slate-200">
                        {investigation.pendingAction.status.replace(/_/g, ' ')}
                      </span>{' '}
                      · Proposed: {investigation.pendingAction.proposedAction}
                    </p>
                  </div>
                </div>

                {investigation.pendingAction.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      disabled={decidingActionId === investigation.pendingAction.id}
                      onClick={() =>
                        onHumanDecision(investigation.pendingAction!.id, 'hold')
                      }
                      className="rounded-md bg-amber-600/20 border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-600/30 whitespace-nowrap"
                    >
                      Approve Temporary Hold
                    </button>
                    <button
                      disabled={decidingActionId === investigation.pendingAction.id}
                      onClick={() =>
                        onHumanDecision(investigation.pendingAction!.id, 'verify_safe')
                      }
                      className="rounded-md bg-emerald-600/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-600/30 whitespace-nowrap"
                    >
                      Verify Transaction Safe
                    </button>
                    <button
                      disabled={decidingActionId === investigation.pendingAction.id}
                      onClick={() =>
                        onHumanDecision(investigation.pendingAction!.id, 'open_dispute')
                      }
                      className="rounded-md bg-rose-600/20 border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-600/30 whitespace-nowrap"
                    >
                      Open Dispute Case
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
