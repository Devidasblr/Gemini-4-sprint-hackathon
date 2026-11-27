import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { DashboardSnapshot } from '../shared/types';
import { CategoryBudgetBars, MonthlyCashFlowChart } from './Charts';

interface OverviewViewProps {
  snapshot: DashboardSnapshot;
  onSelectForInvestigation: (txId: string) => void;
  onHumanDecision: (
    actionId: string,
    decision: 'hold' | 'verify_safe' | 'open_dispute'
  ) => void;
  onNavigateTab: (tab: 'transactions' | 'lab' | 'privacy' | 'assistant') => void;
  decidingActionId: string | null;
}

export function OverviewView({
  snapshot,
  onSelectForInvestigation,
  onHumanDecision,
  onNavigateTab,
  decidingActionId,
}: OverviewViewProps) {
  const flaggedTxs = snapshot.recentTransactions.filter(
    (t) => t.deterministic.requiresReview || t.reviewStatus !== 'clear'
  );

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Monthly Income</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
            ${snapshot.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            {snapshot.periodLabel} · Synthetic Payroll ACH
          </div>
        </div>

        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Monthly Expenses</span>
            <ArrowDownRight className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
            ${snapshot.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Includes {snapshot.flaggedCount} flagged transactions
          </div>
        </div>

        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Monthly Savings</span>
            <span className="font-mono text-xs tabular-nums text-sky-400">
              {snapshot.savingsRatePercent}% rate
            </span>
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              snapshot.netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {snapshot.netSavings >= 0 ? '+' : '-'}$
            {Math.abs(snapshot.netSavings).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Goal ${snapshot.monthlyBudgetTarget.toLocaleString()} / mo
          </div>
        </div>

        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Human Oversight Queue</span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
            {snapshot.pendingActionsCount} Pending
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            No autonomous holds without approval
          </div>
        </div>
      </section>

      {/* Primary Charts Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Monthly Cash Flow & Savings Trend
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Aggregated synthetic ledger totals across August–November 2026
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('assistant')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-600/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-600/20 whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask Finance Coach
            </button>
          </div>
          <MonthlyCashFlowChart data={snapshot.monthlySeries} />
        </div>

        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Category Spending vs. Caps
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {snapshot.periodLabel} deterministic budget utilization
              </p>
            </div>
          </div>
          <CategoryBudgetBars categories={snapshot.categoryBreakdown} />
        </div>
      </section>

      {/* Risk Alerts + Human Approval Queue */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Flagged Activity */}
        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Flagged Activity & Rule Triggers
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Select any transaction to run the 4-agent Gemini 4 Hydrogen investigation
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap"
            >
              View All ({snapshot.recentTransactions.length})
            </button>
          </div>

          <div className="divide-y divide-[#1E2E4E]">
            {flaggedTxs.slice(0, 5).map((tx) => {
              const isHigh = tx.deterministic.ruleScore >= 60;
              return (
                <div
                  key={tx.id}
                  className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{tx.id}</span>
                      <span className="truncate text-sm font-medium text-white">
                        {tx.merchant}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          tx.reviewStatus === 'verified_safe'
                            ? 'text-emerald-400'
                            : isHigh
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Rule Score {tx.deterministic.ruleScore}/100
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {tx.date} · {tx.location} · {tx.channel} · Status:{' '}
                      <span className="text-slate-200">{tx.reviewStatus.replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                    <span className="font-mono text-sm font-semibold tabular-nums text-white">
                      ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      onClick={() => onSelectForInvestigation(tx.id)}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0"
                    >
                      Investigate
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Human Oversight Approval Queue */}
        <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Human Oversight Queue
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Consequential actions always require explicit user approval
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('privacy')}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap"
            >
              Audit Log
            </button>
          </div>

          {snapshot.pendingActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#1E2E4E] py-10 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <p className="mt-2 text-sm text-slate-300">No pending approval requests</p>
              <p className="mt-1 text-xs text-slate-400">
                Investigate a flagged transaction to generate a review item.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshot.pendingActions.map((act) => {
                const isPending = act.status === 'pending';
                const isBusy = decidingActionId === act.id;
                return (
                  <div
                    key={act.id}
                    className="rounded-md border border-[#1E2E4E] bg-[#080F1E] p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-slate-200">
                          {act.txId} · {act.merchant}
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                          ${act.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          isPending
                            ? 'text-amber-400'
                            : act.status === 'verified_safe'
                            ? 'text-emerald-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {act.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-400">
                      {act.rationale}
                    </p>

                    {isPending ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          disabled={isBusy}
                          onClick={() => onHumanDecision(act.id, 'hold')}
                          className="rounded-md bg-amber-600/20 border border-amber-500/40 px-2.5 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-600/30 disabled:opacity-50 whitespace-nowrap"
                        >
                          Approve Hold
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => onHumanDecision(act.id, 'verify_safe')}
                          className="rounded-md bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50 whitespace-nowrap"
                        >
                          Verify Safe
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => onHumanDecision(act.id, 'open_dispute')}
                          className="rounded-md bg-rose-600/20 border border-rose-500/40 px-2.5 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-600/30 disabled:opacity-50 whitespace-nowrap"
                        >
                          Open Dispute
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">
                        Resolved by {act.decidedBy} ·{' '}
                        {act.decidedAt ? new Date(act.decidedAt).toLocaleTimeString() : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
