import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type {
  DeterministicAssessment,
  SyntheticTransaction,
} from '../shared/types';

type EnrichedTx = SyntheticTransaction & { deterministic: DeterministicAssessment };

interface TransactionsViewProps {
  transactions: EnrichedTx[];
  selectedTxId: string;
  onSelectTxId: (id: string) => void;
  onRunInvestigation: (txId: string) => void;
  investigatingTxId: string | null;
}

export function TransactionsView({
  transactions,
  selectedTxId,
  onSelectTxId,
  onRunInvestigation,
  investigatingTxId,
}: TransactionsViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'flagged' | 'clear'>('all');

  const categories = useMemo(() => {
    const set = new Set(transactions.map((t) => t.category));
    return ['ALL', ...Array.from(set)];
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
      if (statusFilter === 'flagged' && !tx.deterministic.requiresReview && tx.reviewStatus === 'clear') {
        return false;
      }
      if (statusFilter === 'clear' && (tx.deterministic.requiresReview || tx.reviewStatus !== 'clear')) {
        return false;
      }
      if (!q) return true;
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.merchant.toLowerCase().includes(q) ||
        tx.location.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q)
      );
    });
  }, [transactions, search, categoryFilter, statusFilter]);

  const selectedTx =
    transactions.find((t) => t.id === selectedTxId) ?? filtered[0] ?? transactions[0];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left 8 cols: Search, filters & ledger table */}
      <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 xl:col-span-8">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Transaction Intelligence Ledger
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              100% synthetic banking transactions · Deterministic rule pre-screening active
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-[#1E2E4E] bg-[#080F1E] p-0.5">
              {(['all', 'flagged', 'clear'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                    statusFilter === tab
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search & Category Controls */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search merchant, ID, city, or category..."
              className="w-full rounded-md border border-[#1E2E4E] bg-[#080F1E] py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="rounded-md border border-[#1E2E4E] bg-[#080F1E] px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2E4E] text-slate-400">
                <th className="py-2.5 pr-3 font-medium">ID & Date</th>
                <th className="py-2.5 px-3 font-medium">Merchant & Channel</th>
                <th className="py-2.5 px-3 font-medium">Location</th>
                <th className="py-2.5 px-3 font-medium">Deterministic Rules</th>
                <th className="py-2.5 pl-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2E4E]/70">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                    No synthetic transactions match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const isSelected = selectedTx?.id === tx.id;
                  const score = tx.deterministic.ruleScore;
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onSelectTxId(tx.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600/15'
                          : 'hover:bg-[#111C33]'
                      }`}
                    >
                      <td className="py-3 pr-3 align-top">
                        <div className="font-mono text-slate-200">{tx.id}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                          {tx.date}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-medium text-white">{tx.merchant}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {tx.category} · {tx.channel}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top text-slate-300">
                        {tx.location}
                      </td>
                      <td className="py-3 px-3 align-top">
                        {score >= 30 ? (
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              score >= 60 ? 'text-rose-400' : 'text-amber-400'
                            }`}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Score {score}/100 ({tx.deterministic.triggeredRules.length} rules)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Baseline Clear
                          </span>
                        )}
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          Status: {tx.reviewStatus.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td
                        className={`py-3 pl-3 text-right align-top font-mono text-sm font-semibold tabular-nums ${
                          tx.type === 'income' ? 'text-emerald-400' : 'text-white'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}$
                        {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right 4 cols: Selected Transaction Deterministic & Privacy Inspector */}
      <div className="space-y-5 xl:col-span-4">
        {selectedTx && (
          <div className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-blue-400">{selectedTx.id}</div>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">
                  {selectedTx.merchant}
                </h3>
                <div className="mt-1 text-xs text-slate-400">
                  {selectedTx.category} · {selectedTx.location}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xl font-semibold tabular-nums text-white">
                  ${selectedTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                  {new Date(selectedTx.timestamp).toUTCString().slice(0, 22)}
                </div>
              </div>
            </div>

            <button
              disabled={investigatingTxId === selectedTx.id}
              onClick={() => onRunInvestigation(selectedTx.id)}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {investigatingTxId === selectedTx.id
                ? 'Running 4-Agent Gemini Analysis...'
                : 'Run Multi-Agent Gemini Analysis'}
            </button>

            {/* Deterministic Rule Breakdown */}
            <div className="border-t border-[#1E2E4E] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Deterministic Rules (Non-AI)
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-300">
                  Score {selectedTx.deterministic.ruleScore}/100
                </span>
              </div>

              {selectedTx.deterministic.triggeredRules.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No deterministic thresholds breached. Amount is within{' '}
                  {selectedTx.deterministic.amountRatioToCategoryAvg}x of category baseline ($
                  {selectedTx.deterministic.baselineCategoryAvg.toFixed(2)}).
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedTx.deterministic.triggeredRules.map((rule) => (
                    <div
                      key={rule.ruleId}
                      className="rounded-md border border-[#1E2E4E] bg-[#080F1E] p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-white">{rule.ruleName}</span>
                        <span
                          className={`font-mono ${
                            rule.severity === 'critical'
                              ? 'text-rose-400'
                              : rule.severity === 'warning'
                              ? 'text-amber-400'
                              : 'text-sky-400'
                          }`}
                        >
                          +{rule.points} pts
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        Observed: {rule.observed}
                      </div>
                      <p className="text-xs text-slate-300">{rule.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy Boundary Preview */}
            <div className="border-t border-[#1E2E4E] pt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <EyeOff className="h-3.5 w-3.5 text-sky-400" />
                Sensitive Fields Redacted Before AI Routing
              </div>
              <div className="rounded-md border border-[#1E2E4E] bg-[#080F1E] p-3 font-mono text-[11px] text-slate-400 space-y-1">
                <div>accountMask: {selectedTx.sensitiveMetadata.accountMask} (BLOCKED)</div>
                <div>cardLast4: ****{selectedTx.sensitiveMetadata.cardLast4} (BLOCKED)</div>
                <div>ipAddress: {selectedTx.sensitiveMetadata.ipAddress} (HASHED)</div>
                <div className="truncate">
                  deviceFP: {selectedTx.sensitiveMetadata.deviceFingerprint} (HASHED)
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                Agents receive only task-minimal, hashed, or aggregated attributes.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
