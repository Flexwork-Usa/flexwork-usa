"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { boostApplicationStake } from "@/actions/application-actions";
import { Card, fieldClass, orangeButton } from "@/components/dashboard/ui";
import type { PlatformApplication } from "@/lib/platform/types";

const STEPS = ["submitted", "viewed", "under_review", "hired"] as const;

function ApplicationsPipeline({
  applications,
  onChanged,
}: {
  applications: PlatformApplication[];
  onChanged: () => void;
}) {
  const [boostAmounts, setBoostAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (applications.length === 0) {
    return <Card className="text-sm text-slate-600">No applications yet. Stake tokens on a platform job to enter the bidding queue.</Card>;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {applications.map((item) => {
        const rejected = item.status === "rejected";
        const activeIndex = rejected ? -1 : STEPS.indexOf(item.status === "hired" ? "hired" : (item.status as (typeof STEPS)[number]));
        return (
          <Card key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{item.jobTitle}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Your Rank: #{item.rankPosition || "—"} of {item.applicantCount || "—"} · {item.tokensStaked} tokens staked
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                {item.status.replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {STEPS.map((step, index) => {
                const done = !rejected && activeIndex >= index;
                return (
                  <motion.span
                    key={step}
                    animate={{ opacity: done ? 1 : 0.45, scale: done ? 1 : 0.98 }}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${done ? "bg-[#C85A17] text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {step.replaceAll("_", " ")}
                  </motion.span>
                );
              })}
              {rejected ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Rejected</span> : null}
            </div>
            {!rejected && item.status !== "hired" ? (
              <form
                className="mt-4 flex flex-wrap items-end gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setBusyId(item.id);
                  setError(null);
                  const result = await boostApplicationStake({
                    applicationId: item.id,
                    additionalTokens: Number(boostAmounts[item.id] || 0),
                  });
                  setBusyId(null);
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  setBoostAmounts((current) => ({ ...current, [item.id]: "" }));
                  onChanged();
                }}
              >
                <label className="text-sm font-medium">
                  Boost tokens
                  <input
                    className={fieldClass}
                    inputMode="numeric"
                    value={boostAmounts[item.id] ?? ""}
                    onChange={(event) => setBoostAmounts((current) => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="5"
                  />
                </label>
                <button type="submit" className={orangeButton} disabled={busyId === item.id}>
                  {busyId === item.id ? "Boosting…" : "Raise bid"}
                </button>
              </form>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

export default memo(ApplicationsPipeline);
