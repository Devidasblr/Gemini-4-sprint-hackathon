import { Lock, ShieldCheck, UserCheck } from 'lucide-react';
import type { AuditLogEntry, PendingHumanAction } from '../shared/types';

interface PrivacyAuditViewProps {
  auditLog: AuditLogEntry[];
  pendingActions: PendingHumanAction[];
  onHumanDecision: (
    actionId: string,
    decision: 'hold' | 'verify_safe' | 'open_dispute'
  ) => void;
  decidingActionId: string | null;
}

const PRIVACY_BOUNDARY_MATRIX = [
  {
    agent: 'Risk Agent',
    purpose: 'Anomaly indicator evaluation',
    allowed: ['txId', 'amount', 'merchant', 'location', 'timestamp', 'SHA-256 device/IP hash'],
    blocked: ['accountMask', 'cardLast4', 'rawIpAddress', 'rawDeviceFingerprint', 'unrelatedHistory'],
  },
  {
    agent: 'Finance Agent',
    purpose: 'Cash flow & savings rate modeling',
    allowed: ['amount', 'category', 'monthlyIncome', 'monthlyExpenses', 'savingsRate'],
    blocked: ['merchantName', 'location', 'channel', 'cardLast4', 'ipAddress', 'deviceFingerprint'],
  },
  {
    agent: 'Budget Agent',
    purpose: 'Category budget & savings coaching',
    allowed: ['affectedCategory', 'categorySpent', 'categoryCap', 'savingsGoal'],
    blocked: ['merchantName', 'location', 'timestamp', 'cardLast4', 'accountMask', 'ipAddress'],
  },
  {
    agent: 'Financial Coach Agent',
    purpose: 'Plain-language briefing & Q&A',
    allowed: ['synthesizedAgentSummaries', 'deterministicFlags', 'nonPIIAggregates'],
    blocked: ['accountMask', 'cardLast4', 'rawIpAddress', 'deviceFingerprint', 'rawDescriptor'],
  },
];

export function PrivacyAuditView({
  auditLog,
  pendingActions,
  onHumanDecision,
  decidingActionId,
}: PrivacyAuditViewProps) {
  return (
    <div className="space-y-6">
      {/* Privacy Architecture & Data Minimization Matrix */}
      <section className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Privacy Boundaries & Inter-Agent Data Minimization
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Synthetic ledger only · Zero real banking credentials · Strict least-privilege attribute partitioning
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            PII Redaction Enforced Server-Side
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PRIVACY_BOUNDARY_MATRIX.map((row) => (
            <div
              key={row.agent}
              className="rounded-md border border-[#1E2E4E] bg-[#080F1E] p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold text-white">
                  {row.agent}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                  <Lock className="h-3 w-3" />
                  {row.purpose}
                </span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-emerald-400">Allowed: </span>
                <span className="font-mono text-[11px] text-slate-300">
                  {row.allowed.join(' · ')}
                </span>
              </div>
              <div className="text-xs">
                <span className="font-medium text-rose-400">Blocked: </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {row.blocked.join(' · ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Human Oversight Ledger */}
      <section className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-blue-400" />
          <h2 className="font-display text-base font-semibold text-white">
            Human-in-the-Loop Action Governance
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2E4E] text-slate-400">
                <th className="py-2 pr-3 font-medium">Action ID</th>
                <th className="py-2 px-3 font-medium">Transaction</th>
                <th className="py-2 px-3 font-medium">Proposed Action</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 pl-3 text-right font-medium">Human Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2E4E]/70">
              {pendingActions.map((act) => (
                <tr key={act.id}>
                  <td className="py-3 pr-3 font-mono text-slate-300">{act.id}</td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-white">
                      {act.txId} · {act.merchant}
                    </div>
                    <div className="font-mono text-[11px] tabular-nums text-slate-400">
                      ${act.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-300">{act.proposedAction}</td>
                  <td className="py-3 px-3 font-medium text-slate-200">
                    {act.status.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {act.status === 'pending' ? (
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <button
                          disabled={decidingActionId === act.id}
                          onClick={() => onHumanDecision(act.id, 'hold')}
                          className="rounded border border-amber-500/40 bg-amber-600/20 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-600/30"
                        >
                          Hold
                        </button>
                        <button
                          disabled={decidingActionId === act.id}
                          onClick={() => onHumanDecision(act.id, 'verify_safe')}
                          className="rounded border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-600/30"
                        >
                          Verify Safe
                        </button>
                        <button
                          disabled={decidingActionId === act.id}
                          onClick={() => onHumanDecision(act.id, 'open_dispute')}
                          className="rounded border border-rose-500/40 bg-rose-600/20 px-2.5 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-600/30"
                        >
                          Dispute
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Decided by {act.decidedBy}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Immutable Audit Trail */}
      <section className="rounded-lg border border-[#1E2E4E] bg-[#0C1426] p-5 space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-white">
            Agent Activity & Data Access Audit Trail
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Logs every agent invocation, accessed attributes, redacted attributes, and human decision
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2E4E] text-slate-400">
                <th className="py-2 pr-3 font-medium">Time (UTC)</th>
                <th className="py-2 px-3 font-medium">Actor</th>
                <th className="py-2 px-3 font-medium">Event & Summary</th>
                <th className="py-2 px-3 font-medium">Shared vs Blocked</th>
                <th className="py-2 pl-3 text-right font-medium">Minimization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2E4E]/70">
              {auditLog.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-3 pr-3 align-top font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {entry.timestamp.slice(11, 19)}
                    {entry.latencyMs ? ` · ${entry.latencyMs}ms` : ''}
                  </td>
                  <td className="py-3 px-3 align-top font-medium text-white whitespace-nowrap">
                    <div>{entry.actor}</div>
                    {entry.modelUsed && (
                      <div className="font-mono text-[10px] text-blue-400">
                        {entry.modelUsed}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top">
                    <div className="text-slate-200">{entry.summary}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Purpose: {entry.purpose}
                    </div>
                  </td>
                  <td className="py-3 px-3 align-top font-mono text-[11px]">
                    <div className="text-emerald-400">
                      + {entry.sharedFields.slice(0, 4).join(', ')}
                      {entry.sharedFields.length > 4 ? ` (+${entry.sharedFields.length - 4})` : ''}
                    </div>
                    <div className="mt-0.5 text-rose-400/90">
                      - {entry.blockedFields.slice(0, 4).join(', ')}
                      {entry.blockedFields.length > 4 ? ` (+${entry.blockedFields.length - 4})` : ''}
                    </div>
                  </td>
                  <td className="py-3 pl-3 align-top text-right font-mono tabular-nums text-sky-400">
                    {entry.minimizationRatio}% withheld
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
