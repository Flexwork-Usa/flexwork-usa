"use client";

import { memo } from "react";
import { Card, orangeButton } from "@/components/dashboard/ui";
import { formatMoney } from "@/lib/format";
import { MIN_PAYOUT_USD } from "@/lib/platform/rules";

function OverviewTab({
  fullName,
  balance,
  onTopUp,
  onRequestPayout,
  payoutNotice,
  totalEarnings = 0,
  pendingEarnings = 0,
  earnedThisMonth = 0,
}: {
  fullName: string;
  balance: number;
  onTopUp: () => void;
  onRequestPayout: () => void;
  payoutNotice?: string | null;
  totalEarnings?: number;
  pendingEarnings?: number;
  earnedThisMonth?: number;
}) {
  const available = Math.max(0, pendingEarnings);

  return (
    <div className="space-y-4">
      <Card className="border-orange-100 bg-gradient-to-r from-orange-50 via-white to-white">
        <p className="text-2xl font-bold tracking-tight text-slate-900">Welcome back, {fullName}!</p>
        <p className="mt-1 text-sm text-slate-600">Your earnings and tokens in one place.</p>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <section className="flex h-full min-h-[168px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Token balance</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{balance}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Tokens available to apply</p>
          <button type="button" className={`${orangeButton} mt-auto px-3 py-2 font-bold`} onClick={onTopUp}>
            Top up
          </button>
        </section>

        <section className="flex h-full min-h-[168px] flex-col rounded-xl border border-[#A84810] bg-[#C85A17] p-4 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-100">Pending balance</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{formatMoney(available)}</p>
          <p className="mt-1 text-xs font-medium text-orange-50">Ready to withdraw · Min {formatMoney(MIN_PAYOUT_USD)}</p>
          <button
            type="button"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#C85A17] transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onRequestPayout}
          >
            Request Payout
          </button>
        </section>

        <section className="flex h-full min-h-[168px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total earnings</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
            {formatMoney(totalEarnings)}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600">This month {formatMoney(earnedThisMonth)}</p>
          <p className="mt-auto pt-3 text-xs font-semibold text-slate-500">All-time paid earnings</p>
        </section>
      </div>

      {payoutNotice ? <p className="text-sm font-medium text-red-700">{payoutNotice}</p> : null}
    </div>
  );
}

export default memo(OverviewTab);
