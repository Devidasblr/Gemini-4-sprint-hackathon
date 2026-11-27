import crypto from 'node:crypto';
import { Type, ThinkingLevel } from '@google/genai';
import type {
  AssistantChatMessage,
  AuditLogEntry,
  DashboardSnapshot,
  InvestigationResult,
  PendingHumanAction,
  SyntheticTransaction,
} from '../../src/shared/types.ts';
import {
  MONTHLY_SAVINGS_GOAL_USD,
  createInitialSyntheticTransactions,
} from '../data/syntheticTransactions.ts';
import { evaluateDeterministicRules } from '../services/deterministicRules.ts';
import { GEMINI_MODEL, generateStructuredJson } from '../services/geminiClient.ts';
import {
  computeMonthlyAggregates,
  createAuditEntry,
  createInitialPendingActions,
} from '../services/privacyEngine.ts';
import { runBudgetAgent } from './budgetAgent.ts';
import {
  runCoachAgentSynthesis,
  runCoachConversationalReply,
} from './coachAgent.ts';
import { runFinanceAgent } from './financeAgent.ts';
import { runRiskAgent } from './riskAgent.ts';

class TrustFinOrchestrator {
  private transactions: SyntheticTransaction[] = createInitialSyntheticTransactions();
  private pendingActions: PendingHumanAction[] = createInitialPendingActions(this.transactions);
  private auditLog: AuditLogEntry[] = [
    createAuditEntry({
      actor: 'Deterministic Engine',
      eventType: 'RULE_EVALUATION',
      txId: 'TX-9482',
      purpose: 'Baseline rule evaluation on synthetic ledger startup.',
      sharedFields: ['txId', 'amount', 'category', 'timestamp', 'location'],
      blockedFields: ['accountMask', 'cardLast4', 'ipAddress', 'deviceFingerprint', 'rawMerchantDescriptor'],
      minimizationRatio: 50,
      summary: 'Flagged 4 synthetic anomalies using transparent statistical & geo-velocity thresholds.',
    }),
  ];

  public resetDemoState(): DashboardSnapshot {
    this.transactions = createInitialSyntheticTransactions();
    this.pendingActions = createInitialPendingActions(this.transactions);
    this.auditLog = [
      createAuditEntry({
        actor: 'Orchestrator',
        eventType: 'RULE_EVALUATION',
        purpose: 'Synthetic demo workspace reset to initial baseline state.',
        sharedFields: ['syntheticLedgerSummary'],
        blockedFields: ['accountMask', 'cardLast4', 'ipAddress', 'deviceFingerprint'],
        minimizationRatio: 80,
        summary: 'Restored 26 synthetic transactions and initial human approval queue.',
      }),
    ];
    return this.getDashboardSnapshot();
  }

  public getTransactionsWithRules() {
    return this.transactions.map((tx) => ({
      ...tx,
      deterministic: evaluateDeterministicRules(tx, this.transactions),
    }));
  }

  public getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  public getPendingActions(): PendingHumanAction[] {
    return [...this.pendingActions];
  }

  public getDashboardSnapshot(): DashboardSnapshot {
    const aggregates = computeMonthlyAggregates(this.transactions);
    const enrichedTransactions = this.getTransactionsWithRules();
    const flaggedCount = enrichedTransactions.filter(
      (t) => t.reviewStatus === 'flagged_pending' || t.reviewStatus === 'held_for_review'
    ).length;

    return {
      periodLabel: 'November 2026',
      totalIncome: aggregates.totalIncome,
      totalExpenses: aggregates.totalExpenses,
      netSavings: aggregates.netSavings,
      savingsRatePercent: aggregates.savingsRatePercent,
      monthlyBudgetTarget: MONTHLY_SAVINGS_GOAL_USD,
      flaggedCount,
      pendingActionsCount: this.pendingActions.filter((a) => a.status === 'pending').length,
      monthlySeries: aggregates.monthlySeries,
      categoryBreakdown: aggregates.categoryBreakdown,
      recentTransactions: enrichedTransactions,
      pendingActions: [...this.pendingActions],
      auditLog: [...this.auditLog],
    };
  }

  public async investigateTransaction(txId: string): Promise<InvestigationResult> {
    const startedAt = Date.now();
    const tx = this.transactions.find((t) => t.id === txId);
    if (!tx) {
      throw new Error(`Transaction "${txId}" not found in synthetic ledger.`);
    }

    const deterministic = evaluateDeterministicRules(tx, this.transactions);
    const aggregates = computeMonthlyAggregates(this.transactions);

    this.auditLog.unshift(
      createAuditEntry({
        actor: 'Deterministic Engine',
        eventType: 'RULE_EVALUATION',
        txId: tx.id,
        purpose: 'Pre-screen transaction against non-AI deterministic thresholds before agent routing.',
        sharedFields: ['txId', 'amount', 'category', 'timestamp', 'location', 'channel'],
        blockedFields: [
          'accountMask',
          'cardLast4',
          'ipAddress',
          'deviceFingerprint',
          'rawMerchantDescriptor',
          'accountHolderAlias',
        ],
        minimizationRatio: 50,
        summary: `Deterministic rule score ${deterministic.ruleScore}/100 (${deterministic.triggeredRules.length} rules triggered).`,
      })
    );

    // Run Risk, Finance, and Budget Agents concurrently, each receiving strictly minimized payloads
    const [riskAgent, financeAgent, budgetAgent] = await Promise.all([
      runRiskAgent(tx, deterministic),
      runFinanceAgent(tx, this.transactions),
      runBudgetAgent(tx, aggregates.categoryBreakdown),
    ]);

    this.auditLog.unshift(
      createAuditEntry({
        actor: 'Risk Agent',
        eventType: 'AGENT_INFERENCE',
        txId: tx.id,
        purpose: riskAgent.privacyEnvelope.purpose,
        sharedFields: riskAgent.privacyEnvelope.sharedFields,
        blockedFields: riskAgent.privacyEnvelope.blockedFields,
        minimizationRatio: riskAgent.privacyEnvelope.minimizationRatio,
        modelUsed: GEMINI_MODEL,
        latencyMs: riskAgent.latencyMs,
        summary: `Assessed "${riskAgent.assessmentLevel}" risk indicator tier (${riskAgent.indicatorConfidence}% indicator confidence; fraud not confirmed).`,
      }),
      createAuditEntry({
        actor: 'Finance Agent',
        eventType: 'AGENT_INFERENCE',
        txId: tx.id,
        purpose: financeAgent.privacyEnvelope.purpose,
        sharedFields: financeAgent.privacyEnvelope.sharedFields,
        blockedFields: financeAgent.privacyEnvelope.blockedFields,
        minimizationRatio: financeAgent.privacyEnvelope.minimizationRatio,
        modelUsed: GEMINI_MODEL,
        latencyMs: financeAgent.latencyMs,
        summary: `Analyzed cash flow impact (${financeAgent.monthlyExpenseDeltaPercent}% of monthly expenses; savings rate ${financeAgent.savingsRateBeforePercent}% -> ${financeAgent.savingsRateAfterPercent}%).`,
      }),
      createAuditEntry({
        actor: 'Budget Agent',
        eventType: 'AGENT_INFERENCE',
        txId: tx.id,
        purpose: budgetAgent.privacyEnvelope.purpose,
        sharedFields: budgetAgent.privacyEnvelope.sharedFields,
        blockedFields: budgetAgent.privacyEnvelope.blockedFields,
        minimizationRatio: budgetAgent.privacyEnvelope.minimizationRatio,
        modelUsed: GEMINI_MODEL,
        latencyMs: budgetAgent.latencyMs,
        summary: `Evaluated ${budgetAgent.affectedCategory} budget (${budgetAgent.budgetImpactLevel}) with ${budgetAgent.actionableSuggestions.length} savings suggestions.`,
      })
    );

    // Financial Coach synthesizes the sanitized multi-agent outputs
    const coachAgent = await runCoachAgentSynthesis({
      tx,
      deterministic,
      risk: riskAgent,
      finance: financeAgent,
      budget: budgetAgent,
    });

    this.auditLog.unshift(
      createAuditEntry({
        actor: 'Financial Coach Agent',
        eventType: 'AGENT_INFERENCE',
        txId: tx.id,
        purpose: coachAgent.privacyEnvelope.purpose,
        sharedFields: coachAgent.privacyEnvelope.sharedFields,
        blockedFields: coachAgent.privacyEnvelope.blockedFields,
        minimizationRatio: coachAgent.privacyEnvelope.minimizationRatio,
        modelUsed: GEMINI_MODEL,
        latencyMs: coachAgent.latencyMs,
        summary: `Synthesized plain-language explanation and human oversight checklist.`,
      })
    );

    // Create or update a pending human approval item if elevated/high risk (never auto-executes!)
    let pendingAction: PendingHumanAction | null =
      this.pendingActions.find((a) => a.txId === tx.id) ?? null;

    if ((riskAgent.assessmentLevel !== 'low' || deterministic.requiresReview) && !pendingAction) {
      pendingAction = {
        id: `ACT-${tx.id.replace('TX-', '')}`,
        txId: tx.id,
        merchant: tx.merchant,
        amount: tx.amount,
        createdAt: new Date().toISOString(),
        proposedAction:
          riskAgent.recommendedHumanOptions[0] ||
          'Place temporary hold pending cardholder verification',
        riskLevel: riskAgent.assessmentLevel,
        rationale: riskAgent.reasoningSummary,
        status: 'pending',
      };
      this.pendingActions.unshift(pendingAction);
    }

    // Keep audit log bounded to latest 80 events
    this.auditLog = this.auditLog.slice(0, 80);

    return {
      investigationId: `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      txId: tx.id,
      transaction: tx,
      modelUsed: GEMINI_MODEL,
      executedAt: new Date().toISOString(),
      totalLatencyMs: Date.now() - startedAt,
      deterministic,
      riskAgent,
      financeAgent,
      budgetAgent,
      coachAgent,
      pendingAction,
    };
  }

  public applyHumanDecision(params: {
    actionId: string;
    decision: 'hold' | 'verify_safe' | 'open_dispute';
  }): { action: PendingHumanAction; snapshot: DashboardSnapshot } {
    const action = this.pendingActions.find((a) => a.id === params.actionId);
    if (!action) {
      throw new Error(`Pending human action "${params.actionId}" not found.`);
    }

    const tx = this.transactions.find((t) => t.id === action.txId);

    if (params.decision === 'hold') {
      action.status = 'approved_hold';
      if (tx) tx.reviewStatus = 'held_for_review';
    } else if (params.decision === 'verify_safe') {
      action.status = 'verified_safe';
      if (tx) tx.reviewStatus = 'verified_safe';
    } else {
      action.status = 'dispute_opened';
      if (tx) tx.reviewStatus = 'dispute_opened';
    }

    action.decidedAt = new Date().toISOString();
    action.decidedBy = 'Human Reviewer';

    this.auditLog.unshift(
      createAuditEntry({
        actor: 'Human Reviewer',
        eventType: 'HUMAN_DECISION',
        txId: action.txId,
        purpose: 'Explicit human-in-the-loop oversight decision on flagged transaction.',
        sharedFields: ['actionId', 'txId', 'decision'],
        blockedFields: ['accountMask', 'cardLast4', 'ipAddress', 'deviceFingerprint'],
        minimizationRatio: 100,
        summary: `Human reviewer decided "${action.status}" for ${action.txId} (${action.merchant}, $${action.amount.toFixed(2)}).`,
      })
    );

    return {
      action,
      snapshot: this.getDashboardSnapshot(),
    };
  }

  public async handleAssistantChat(params: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    selectedTxId?: string;
  }): Promise<AssistantChatMessage> {
    // Step 1: Orchestrator uses Gemini 4 Hydrogen to route which specialist agents are required
    const routerResponse = await generateStructuredJson<{
      needsRiskAgent: boolean;
      needsFinanceAgent: boolean;
      needsBudgetAgent: boolean;
      routingReason: string;
    }>({
      systemInstruction: `You are the TRUSTFIN AI Orchestrator Router. Decide which specialist data scopes are minimally necessary to answer the user's financial question. Follow strict data minimization: only select scopes genuinely required.`,
      prompt: `User message: "${params.message}"\nSelected transaction ID: ${params.selectedTxId ?? 'None'}`,
      thinkingLevel: ThinkingLevel.LOW,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          needsRiskAgent: { type: Type.BOOLEAN },
          needsFinanceAgent: { type: Type.BOOLEAN },
          needsBudgetAgent: { type: Type.BOOLEAN },
          routingReason: { type: Type.STRING },
        },
        required: ['needsRiskAgent', 'needsFinanceAgent', 'needsBudgetAgent', 'routingReason'],
      },
    });

    const routedAgents: Array<
      'Risk Agent' | 'Finance Agent' | 'Budget Agent' | 'Financial Coach Agent'
    > = [];
    const dataMinimizationNotes: string[] = [];
    const routedContext: Record<string, unknown> = {
      orchestratorRoutingReason: routerResponse.data.routingReason,
      humanOversightPendingCount: this.pendingActions.filter((a) => a.status === 'pending').length,
    };

    const aggregates = computeMonthlyAggregates(this.transactions);

    if (routerResponse.data.needsRiskAgent) {
      routedAgents.push('Risk Agent');
      const flaggedTxs = this.transactions
        .filter((t) => {
          const det = evaluateDeterministicRules(t, this.transactions);
          return det.requiresReview || (params.selectedTxId && t.id === params.selectedTxId);
        })
        .map((t) => {
          const det = evaluateDeterministicRules(t, this.transactions);
          return {
            txId: t.id,
            merchant: t.merchant,
            amountUsd: t.amount,
            location: t.location,
            date: t.date,
            reviewStatus: t.reviewStatus,
            deterministicRuleScore: det.ruleScore,
            triggeredRules: det.triggeredRules.map((r) => r.ruleName),
          };
        });
      routedContext.riskScope = { flaggedTransactions: flaggedTxs };
      dataMinimizationNotes.push(
        'Risk scope shared flagged merchant/location summaries only; card numbers, raw IPs & device fingerprints withheld.'
      );
    }

    if (routerResponse.data.needsFinanceAgent) {
      routedAgents.push('Finance Agent');
      routedContext.financeScope = {
        period: 'November 2026',
        totalIncomeUsd: aggregates.totalIncome,
        totalExpensesUsd: aggregates.totalExpenses,
        netSavingsUsd: aggregates.netSavings,
        savingsRatePercent: aggregates.savingsRatePercent,
        monthlyTrend: aggregates.monthlySeries,
      };
      dataMinimizationNotes.push(
        'Finance scope shared monthly cash-flow totals only; individual merchants & PII withheld.'
      );
    }

    if (routerResponse.data.needsBudgetAgent) {
      routedAgents.push('Budget Agent');
      routedContext.budgetScope = {
        monthlySavingsGoalUsd: MONTHLY_SAVINGS_GOAL_USD,
        categoryUtilization: aggregates.categoryBreakdown,
      };
      dataMinimizationNotes.push(
        'Budget scope shared category spending totals vs caps only; merchant & location details withheld.'
      );
    }

    routedAgents.push('Financial Coach Agent');
    if (dataMinimizationNotes.length === 0) {
      dataMinimizationNotes.push(
        'Minimal context shared: zero raw transactions or PII forwarded to Financial Coach.'
      );
    }

    const reply = await runCoachConversationalReply({
      userMessage: params.message,
      history: params.history,
      routedContext,
    });

    this.auditLog.unshift(
      createAuditEntry({
        actor: 'Orchestrator',
        eventType: 'DATA_ACCESS',
        txId: params.selectedTxId,
        purpose: `Routed conversational query to [${routedAgents.join(', ')}] under data minimization.`,
        sharedFields: Object.keys(routedContext),
        blockedFields: ['accountMask', 'cardLast4', 'ipAddress', 'deviceFingerprint', 'rawMerchantDescriptor'],
        minimizationRatio: 85,
        modelUsed: GEMINI_MODEL,
        latencyMs: routerResponse.latencyMs + reply.latencyMs,
        summary: `Assistant reply generated via ${routedAgents.join(' + ')} (${reply.latencyMs}ms).`,
      })
    );

    return {
      id: `MSG-${crypto.randomBytes(3).toString('hex')}`,
      role: 'assistant',
      content: reply.text,
      timestamp: new Date().toISOString(),
      routedAgents,
      dataMinimizationNotes,
      modelUsed: GEMINI_MODEL,
      latencyMs: routerResponse.latencyMs + reply.latencyMs,
    };
  }
}

export const orchestrator = new TrustFinOrchestrator();
