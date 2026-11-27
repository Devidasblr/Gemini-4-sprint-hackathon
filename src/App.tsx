import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  CreditCard,
  LayoutDashboard,
  Menu,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { DashboardSnapshot, InvestigationResult } from './shared/types';
import { AssistantView } from './components/AssistantView';
import { MultiAgentLabView } from './components/MultiAgentLabView';
import { OverviewView } from './components/OverviewView';
import { PrivacyAuditView } from './components/PrivacyAuditView';
import { TransactionsView } from './components/TransactionsView';

type ActiveTab = 'overview' | 'transactions' | 'lab' | 'privacy' | 'assistant';

interface HealthStatus {
  status: string;
  model: string;
  geminiConfigured: boolean;
}

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: CreditCard },
  { id: 'lab', label: 'Multi-Agent Lab', icon: Bot },
  { id: 'privacy', label: 'Privacy & Audit', icon: ShieldCheck },
  { id: 'assistant', label: 'AI Assistant', icon: MessageSquare },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTxId, setSelectedTxId] = useState<string>('TX-9482');
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [investigatingTxId, setInvestigatingTxId] = useState<string | null>(null);
  const [investigationError, setInvestigationError] = useState<string | null>(null);
  const [decidingActionId, setDecidingActionId] = useState<string | null>(null);

  const fetchDashboardAndHealth = useCallback(async () => {
    try {
      const [dashRes, healthRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/health'),
      ]);
      if (!dashRes.ok) throw new Error(`Dashboard request failed (${dashRes.status})`);
      const dashData = (await dashRes.json()) as DashboardSnapshot;
      setSnapshot(dashData);

      if (healthRes.ok) {
        const healthData = (await healthRes.json()) as HealthStatus;
        setHealth(healthData);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load TRUSTFIN AI data.');
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardAndHealth();
  }, [fetchDashboardAndHealth]);

  const handleRunInvestigation = useCallback(async (txId: string) => {
    setSelectedTxId(txId);
    setActiveTab('lab');
    setInvestigatingTxId(txId);
    setInvestigationError(null);

    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || `Investigation failed (${res.status})`);
      }
      setInvestigation(payload.result as InvestigationResult);
      setSnapshot(payload.snapshot as DashboardSnapshot);
    } catch (err) {
      setInvestigationError(
        err instanceof Error ? err.message : 'Unexpected orchestration error.'
      );
    } finally {
      setInvestigatingTxId(null);
    }
  }, []);

  const handleHumanDecision = useCallback(
    async (actionId: string, decision: 'hold' | 'verify_safe' | 'open_dispute') => {
      setDecidingActionId(actionId);
      try {
        const res = await fetch('/api/actions/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionId, decision }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.message || 'Failed to apply human decision.');
        }
        setSnapshot(payload.snapshot as DashboardSnapshot);
        setInvestigation((prev) =>
          prev && prev.pendingAction?.id === actionId
            ? { ...prev, pendingAction: payload.action }
            : prev
        );
      } catch (err) {
        setInvestigationError(
          err instanceof Error ? err.message : 'Failed to record decision.'
        );
      } finally {
        setDecidingActionId(null);
      }
    },
    []
  );

  const handleResetDemo = useCallback(async () => {
    try {
      const res = await fetch('/api/reset-demo', { method: 'POST' });
      const payload = await res.json();
      if (res.ok && payload.snapshot) {
        setSnapshot(payload.snapshot as DashboardSnapshot);
        setInvestigation(null);
        setInvestigationError(null);
        setSelectedTxId('TX-9482');
      }
    } catch {
      // ignore transient reset failure
    }
  }, []);

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'Overview';

  return (
    <div className="flex min-h-screen bg-[#060B16] text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#1E2E4E] bg-[#080F1E] lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-[#1E2E4E] px-6">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
            TRUSTFIN AI
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-4" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600/15 text-blue-300'
                    : 'text-slate-400 hover:bg-[#0E182E] hover:text-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-400' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#1E2E4E] p-4 space-y-3">
          <div className="text-xs leading-relaxed text-slate-400">
            Synthetic Ledger Active · Zero Real Banking Credentials
          </div>
          <button
            onClick={() => void handleResetDemo()}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[#1E2E4E] bg-[#0C1426] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Demo State
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col border-r border-[#1E2E4E] bg-[#080F1E]">
            <div className="flex h-16 items-center justify-between border-b border-[#1E2E4E] px-5">
              <span className="font-display text-base font-bold text-white">
                TRUSTFIN AI
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-blue-600/15 text-blue-300'
                        : 'text-slate-400 hover:bg-[#0E182E] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Breadcrumb — Real API Status — 1 Primary Action */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#1E2E4E] bg-[#060B16]/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-md p-1.5 text-slate-400 hover:bg-[#0C1426] hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="font-medium text-slate-400 hidden sm:inline">
                TRUSTFIN AI
              </span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-white truncate">
                {activeNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-xs">
              <Activity
                className={`h-3.5 w-3.5 ${
                  health?.geminiConfigured ? 'text-emerald-400' : 'text-amber-400'
                }`}
              />
              <span className="text-slate-300 whitespace-nowrap">
                {health
                  ? health.geminiConfigured
                    ? `${health.model} Connected`
                    : 'GEMINI_API_KEY Not Set'
                  : 'Checking API...'}
              </span>
            </div>

            <button
              disabled={investigatingTxId !== null}
              onClick={() => void handleRunInvestigation(selectedTxId || 'TX-9482')}
              className="rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {investigatingTxId ? 'Investigating...' : 'Investigate Alert'}
            </button>
          </div>
        </header>

        {/* Main Scroll Area */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
          {loadingSnapshot ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-lg border border-[#1E2E4E] bg-[#0C1426]"
                />
              ))}
            </div>
          ) : loadError || !snapshot ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-6 text-sm text-rose-200">
              {loadError ?? 'Unable to load dashboard state.'}
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  snapshot={snapshot}
                  onSelectForInvestigation={(id) => void handleRunInvestigation(id)}
                  onHumanDecision={(id, decision) => void handleHumanDecision(id, decision)}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  decidingActionId={decidingActionId}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsView
                  transactions={snapshot.recentTransactions}
                  selectedTxId={selectedTxId}
                  onSelectTxId={setSelectedTxId}
                  onRunInvestigation={(id) => void handleRunInvestigation(id)}
                  investigatingTxId={investigatingTxId}
                />
              )}

              {activeTab === 'lab' && (
                <MultiAgentLabView
                  transactions={snapshot.recentTransactions}
                  selectedTxId={selectedTxId}
                  onSelectTxId={setSelectedTxId}
                  onRunInvestigation={(id) => void handleRunInvestigation(id)}
                  investigation={investigation}
                  loading={investigatingTxId !== null}
                  error={investigationError}
                  onHumanDecision={(id, decision) => void handleHumanDecision(id, decision)}
                  decidingActionId={decidingActionId}
                />
              )}

              {activeTab === 'privacy' && (
                <PrivacyAuditView
                  auditLog={snapshot.auditLog}
                  pendingActions={snapshot.pendingActions}
                  onHumanDecision={(id, decision) => void handleHumanDecision(id, decision)}
                  decidingActionId={decidingActionId}
                />
              )}

              {activeTab === 'assistant' && (
                <AssistantView
                  transactions={snapshot.recentTransactions}
                  selectedTxId={selectedTxId}
                  onSelectTxId={setSelectedTxId}
                  geminiConfigured={Boolean(health?.geminiConfigured)}
                  onAuditUpdate={() => void fetchDashboardAndHealth()}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
