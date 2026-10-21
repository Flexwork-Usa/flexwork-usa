"use client";

import { memo, useId, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/dashboard/ui";
import { formatMoney } from "@/lib/format";
import {
  EARNINGS_RANGE_DAYS,
  buildWorkerEarningsSeries,
  type EarningsInputPoint,
} from "@/lib/platform/earnings-series";
import type { PayoutRequest } from "@/lib/platform/types";

export type WorkerPipelineStat = { status: string; count: number };
export type WorkerEarningsPoint = EarningsInputPoint;

const COLORS = ["#C85A17", "#ea580c", "#f59e0b", "#A84810", "#64748b"];
const PIPELINE_STAGES = ["submitted", "viewed", "under_review", "hired", "rejected"] as const;

export function ApplicationPipeline({ pipeline }: { pipeline: WorkerPipelineStat[] }) {
  const pipelineData = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const item of pipeline) {
      const status = normalizePipelineStatus(item.status);
      byStatus.set(status, (byStatus.get(status) ?? 0) + Math.max(0, Number(item.count) || 0));
    }
    return PIPELINE_STAGES.map((stage) => ({
      status: stage,
      label: pipelineLabel(stage),
      count: Math.max(0, Number(byStatus.get(stage) ?? 0)),
    }));
  }, [pipeline]);
  const totalApps = pipelineData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Application pipeline</h2>
          <p className="mt-1 text-sm text-slate-600">Submitted → Viewed → Under Review → Hired → Rejected</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#C85A17] ring-1 ring-[#C85A17]/20">
          {totalApps} {totalApps === 1 ? "application" : "applications"}
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pipelineData} dataKey="count" nameKey="label" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {pipelineData.map((entry, index) => (
                  <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [Number(value), "Applications"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-18} textAnchor="end" height={56} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={28} />
              <Tooltip formatter={(value) => [Number(value), "Applications"]} />
              <Bar dataKey="count" fill="#C85A17" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function WorkerAnalytics({
  earnings,
  payouts = [],
  pendingEarnings = 0,
  earnedThisMonth = 0,
  totalEarnings = 0,
}: {
  earnings: WorkerEarningsPoint[];
  payouts?: PayoutRequest[];
  pendingEarnings?: number;
  earnedThisMonth?: number;
  totalEarnings?: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  const earningsSeries = useMemo(
    () =>
      buildWorkerEarningsSeries({
        payouts,
        rpcEarnings: earnings,
        earnedThisMonth,
      }),
    [earnings, earnedThisMonth, payouts],
  );
  const periodTotal = earningsSeries.at(-1)?.total ?? 0;
  const periodDelta = useMemo(() => {
    const mid = Math.floor(earningsSeries.length / 2);
    const earlier = earningsSeries.slice(0, mid).reduce((sum, point) => sum + point.amount, 0);
    const later = earningsSeries.slice(mid).reduce((sum, point) => sum + point.amount, 0);
    return later - earlier;
  }, [earningsSeries]);
  const hasDailyEarnings = periodTotal > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="min-h-[320px] overflow-hidden bg-gradient-to-b from-orange-50/70 via-white to-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Earnings over time</h2>
              <p className="mt-1 text-sm text-slate-600">
                {hasDailyEarnings
                  ? "Recorded earnings across the last 30 days, totaled as they come in."
                  : "Recorded earnings will appear here as payouts are approved or this month is updated."}
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#C85A17] ring-1 ring-[#C85A17]/20">
              Last {EARNINGS_RANGE_DAYS} days
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last 30 days</p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{formatMoney(periodTotal)}</p>
            </div>
            {hasDailyEarnings ? (
              <p className={`text-sm font-semibold tabular-nums ${periodDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {deltaLabel(periodDelta)}
              </p>
            ) : (
              <p className="text-sm font-medium text-slate-500">No recorded earnings yet</p>
            )}
          </div>

          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsSeries} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C85A17" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#C85A17" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                  tickFormatter={(value) => formatChartDay(String(value))}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  tickFormatter={formatAxisMoney}
                  domain={[0, (max: number) => Math.max(50, Math.ceil(max * 1.2))]}
                />
                <Tooltip content={<EarningsTooltip />} cursor={{ stroke: "#C85A17", strokeDasharray: "4 4", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Earnings"
                  stroke="#C85A17"
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  activeDot={{ r: 6, fill: "#C85A17", stroke: "#fff", strokeWidth: 2 }}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-[#C85A17] px-3 py-2.5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-100">Pending</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{formatMoney(pendingEarnings)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">This month</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{formatMoney(earnedThisMonth)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">All-time</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{formatMoney(totalEarnings)}</p>
            </div>
          </div>
        </Card>
    </motion.div>
  );
}

function normalizePipelineStatus(status: string) {
  const text = status.toLowerCase();
  if (text === "hired" || text === "hire" || text === "accepted" || text === "approved" || text === "assigned") {
    return "hired";
  }
  if (text === "rejected") return "rejected";
  if (text === "under_review" || text === "review") return "under_review";
  if (text === "viewed" || text === "view") return "viewed";
  return "submitted";
}

function pipelineLabel(status: string) {
  if (status === "under_review") return "Under Review";
  if (status === "hired") return "Hired";
  if (status === "rejected") return "Rejected";
  if (status === "viewed") return "Viewed";
  return "Submitted";
}

function formatChartDay(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

function formatAxisMoney(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(value)}`;
}

function deltaLabel(delta: number) {
  if (delta === 0) return "Even vs first half";
  const amount = formatMoney(Math.abs(delta));
  return delta > 0 ? `Up ${amount} vs first half` : `Down ${amount} vs first half`;
}

function EarningsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { amount?: number; total?: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{formatChartDay(String(label ?? ""))}</p>
      <p className="mt-1 text-xs text-slate-500">
        Earned this day <span className="font-semibold tabular-nums text-slate-900">{formatMoney(Number(point?.amount ?? 0))}</span>
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{formatMoney(Number(point?.total ?? payload[0]?.value ?? 0))}</p>
    </div>
  );
}

export default memo(WorkerAnalytics);
