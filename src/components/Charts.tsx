import { useState } from 'react';
import type { CategoryBudgetStatus, MonthlySummaryPoint } from '../shared/types';

export function MonthlyCashFlowChart({ data }: { data: MonthlySummaryPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        No monthly cash flow data available.
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.flatMap((d) => [d.income, d.expenses]),
    1000
  );
  const yCeiling = Math.ceil(maxValue / 2000) * 2000;

  const width = 620;
  const height = 240;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const groupW = plotW / data.length;
  const barW = Math.min(28, groupW * 0.26);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yCeiling * t));

  const savingsPoints = data
    .map((d, idx) => {
      const cx = padLeft + groupW * idx + groupW / 2;
      const clampedSavings = Math.max(0, d.savings);
      const cy = padTop + plotH - (clampedSavings / yCeiling) * plotH;
      return `${cx},${cy}`;
    })
    .join(' ');

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5 text-xs text-slate-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-blue-500" />
            Income
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-slate-500" />
            Expenses
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-sky-300" />
            Net Savings
          </span>
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="font-mono text-xs tabular-nums text-slate-300">
            {data[hoveredIdx].label}: In ${data[hoveredIdx].income.toLocaleString()} · Out $
            {data[hoveredIdx].expenses.toLocaleString()} · Net{' '}
            <span
              className={
                data[hoveredIdx].savings >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }
            >
              {data[hoveredIdx].savings >= 0 ? '+' : '-'}$
              {Math.abs(data[hoveredIdx].savings).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Monthly income, expenses, and net savings chart"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = padTop + plotH - (tick / yCeiling) * plotH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#1E2E4E"
                strokeDasharray={tick === 0 ? undefined : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[10px]"
              >
                ${(tick / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, idx) => {
          const groupCenter = padLeft + groupW * idx + groupW / 2;
          const incH = (d.income / yCeiling) * plotH;
          const expH = (d.expenses / yCeiling) * plotH;
          const incY = padTop + plotH - incH;
          const expY = padTop + plotH - expH;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={d.month}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={padLeft + groupW * idx + 4}
                y={padTop}
                width={groupW - 8}
                height={plotH}
                fill={isHovered ? 'rgba(37, 99, 235, 0.08)' : 'transparent'}
                rx="6"
              />
              <rect
                x={groupCenter - barW - 3}
                y={incY}
                width={barW}
                height={Math.max(2, incH)}
                rx="3"
                fill={isHovered ? '#3B82F6' : '#2563EB'}
              />
              <rect
                x={groupCenter + 3}
                y={expY}
                width={barW}
                height={Math.max(2, expH)}
                rx="3"
                fill={isHovered ? '#94A3B8' : '#64748B'}
              />
              <text
                x={groupCenter}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-300 font-sans text-[11px] font-medium"
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {/* Net savings line overlay */}
        <polyline
          fill="none"
          stroke="#7DD3FC"
          strokeWidth="2"
          points={savingsPoints}
        />
        {data.map((d, idx) => {
          const cx = padLeft + groupW * idx + groupW / 2;
          const cy = padTop + plotH - (Math.max(0, d.savings) / yCeiling) * plotH;
          return (
            <circle
              key={`pt-${d.month}`}
              cx={cx}
              cy={cy}
              r={hoveredIdx === idx ? 4.5 : 3.5}
              fill="#060B16"
              stroke="#7DD3FC"
              strokeWidth="2"
            />
          );
        })}
      </svg>
    </div>
  );
}

export function CategoryBudgetBars({
  categories,
}: {
  categories: CategoryBudgetStatus[];
}) {
  const sorted = [...categories].sort(
    (a, b) => b.utilizationPercent - a.utilizationPercent
  );

  return (
    <div className="space-y-3.5">
      {sorted.map((cat) => {
        const pct = Math.min(100, cat.utilizationPercent);
        const overCap = cat.utilizationPercent > 100;
        const nearCap = cat.utilizationPercent >= 85 && cat.utilizationPercent <= 100;
        const barColor = overCap
          ? 'bg-rose-500'
          : nearCap
          ? 'bg-amber-500'
          : 'bg-blue-500';
        const statusText = overCap
          ? 'Over Cap'
          : nearCap
          ? 'Near Cap'
          : 'On Track';
        const statusColor = overCap
          ? 'text-rose-400'
          : nearCap
          ? 'text-amber-400'
          : 'text-emerald-400';

        return (
          <div key={cat.category} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-medium text-slate-200">
                  {cat.category}
                </span>
                <span className={`shrink-0 font-medium ${statusColor}`}>
                  · {statusText}
                </span>
              </div>
              <div className="shrink-0 font-mono tabular-nums text-slate-300">
                ${cat.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} / $
                {cat.budget.toLocaleString()} ({cat.utilizationPercent}%)
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-800/90">
              <div
                className={`h-full transition-all duration-300 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
