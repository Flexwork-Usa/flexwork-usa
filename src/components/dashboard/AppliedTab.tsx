"use client";

import { memo, useMemo } from "react";
import { ApplicationPipeline, type WorkerPipelineStat } from "@/components/dashboard/WorkerAnalytics";
import type { WorkerApplication } from "@/components/dashboard/types";
import { Card, badgeClass } from "@/components/dashboard/ui";
import { formatWhen } from "@/lib/format";
import { ADVISORY_BID_BANNER, applicationStatusLabel } from "@/lib/platform/rules";
import type { JobBidLeaderboardRow } from "@/lib/platform/types";

function AppliedTab({
  applications,
  error,
  leaderboards = {},
  pipeline = [],
}: {
  applications: WorkerApplication[];
  error?: string;
  leaderboards?: Record<string, JobBidLeaderboardRow[]>;
  pipeline?: WorkerPipelineStat[];
}) {
  const pipelineData = useMemo(
    () => (pipeline.some((item) => item.count > 0) ? pipeline : pipelineFromApplications(applications)),
    [applications, pipeline],
  );

  return (
    <div>
      <h2 className="text-lg font-semibold">Applied Projects</h2>
      <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-[#7A320C]">
        {ADVISORY_BID_BANNER}
      </p>
      <div className="mt-4">
        <ApplicationPipeline pipeline={pipelineData} />
      </div>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {applications.length === 0 ? (
        <Card className="mt-4 text-sm text-slate-600">You have not applied to any projects yet.</Card>
      ) : (
        <div className="mt-4 space-y-4">
          {applications.map((item) => {
            const label = applicationStatusLabel(item.status);
            const board = item.jobId ? leaderboards[item.jobId] ?? [] : [];
            return (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{item.jobTitle}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.tokenCost} tokens bid · {formatWhen(item.appliedAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(label)}`}>{label}</span>
                </div>
                {board.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Top {board.length} bidders
                    </p>
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="border-b border-slate-200 text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Rank</th>
                          <th className="py-2 pr-3 font-medium">Anonymized Name</th>
                          <th className="py-2 font-medium">Bid Amount (Tokens)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {board.map((row) => (
                          <tr key={`${item.id}-${row.rank}`}>
                            <td className="py-2 pr-3 tabular-nums">#{row.rank}</td>
                            <td className="py-2 pr-3">{row.anonymizedName}</td>
                            <td className="py-2 tabular-nums">{row.tokensStaked}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Leaderboard will appear after bids are ranked for this job.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function pipelineFromApplications(applications: WorkerApplication[]): WorkerPipelineStat[] {
  const counts = {
    submitted: 0,
    viewed: 0,
    under_review: 0,
    hired: 0,
    rejected: 0,
  };
  for (const application of applications) {
    const status = application.status.toLowerCase();
    if (status === "hired" || status === "hire" || status === "accepted" || status === "approved" || status === "assigned") {
      counts.hired += 1;
    } else if (status === "rejected") counts.rejected += 1;
    else if (status === "under_review" || status === "review") counts.under_review += 1;
    else if (status === "viewed" || status === "view") counts.viewed += 1;
    else counts.submitted += 1;
  }
  return [
    { status: "submitted", count: counts.submitted },
    { status: "viewed", count: counts.viewed },
    { status: "under_review", count: counts.under_review },
    { status: "hired", count: counts.hired },
    { status: "rejected", count: counts.rejected },
  ];
}

export default memo(AppliedTab);
