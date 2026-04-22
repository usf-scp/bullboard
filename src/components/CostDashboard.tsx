import type { SearchStats } from "../lib/search";

interface CostDashboardProps {
  stats: SearchStats;
  mode: "original" | "optimized";
}

export default function CostDashboard({ stats, mode }: CostDashboardProps) {
  return (
    <div className="rounded-xl border-2 border-neutral-700 bg-neutral-900/50 p-5 font-mono text-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-blue-500" />
        <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          {mode === "original" ? "Original" : "Optimized"} — Live Cost Dashboard
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="API Calls" value={stats.apiCalls} />
        <StatCard label="Events in Prompt" value={stats.eventsInPrompt} />
        <StatCard label="Tokens / Event" value={stats.tokensPerEvent} />
        <StatCard
          label="Total Tokens"
          value={stats.totalTokensEstimated.toLocaleString()}
        />
        <StatCard
          label="Latency"
          value={`${(stats.totalLatencyMs / 1000).toFixed(1)}s`}
        />
        <StatCard
          label="Est. Cost"
          value={`$${stats.estimatedCost.toFixed(4)}`}
        />
        <StatCard label="Strategy" value={stats.strategy || "—"} />
        <StatCard label="Model Used" value={stats.modelUsed || "—"} />
      </div>

      {stats.apiCalls > 0 && (
        <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-800/50 p-3 text-xs text-neutral-400">
          At scale (10K users/day): ~$
          {(stats.estimatedCost * (10000 / Math.max(stats.apiCalls, 1))).toFixed(2)}
          /day
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <span className="text-base font-bold leading-tight text-neutral-200">
        {value}
      </span>
    </div>
  );
}