"use client";

import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { formatDelta, formatWhen, secondaryButtonClass, TIER_META, WORKER } from "@/lib/format";

export function WorkerDashboard() {
  const { tokens, applications, tokenLog, setView } = useApp();
  const mine = applications.filter((item) => item.owner === "worker");

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">My Applications</h1>
          <p className="mt-2 text-sm text-gray-600">
            {WORKER.name} · {WORKER.email}
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => setView("marketplace")}>
          Browse jobs
        </button>
      </div>

      <dl className="mt-6 grid grid-cols-1 divide-y divide-gray-200 rounded-xl border border-gray-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-4 py-4">
          <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">Worker</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900">{WORKER.name}</dd>
        </div>
        <div className="px-4 py-4">
          <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">Token balance</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">{tokens}</dd>
        </div>
        <div className="px-4 py-4">
          <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">Applications</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">{mine.length}</dd>
        </div>
      </dl>

      {mine.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-600">
          You have not applied to any jobs yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200">
          {mine.map((application) => (
            <li
              key={application.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{application.jobTitle}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {application.company}
                  <span className="px-1.5 text-gray-300">/</span>
                  {TIER_META[application.tier].label}: {TIER_META[application.tier].name}
                  <span className="px-1.5 text-gray-300">/</span>
                  {formatWhen(application.appliedAt)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {application.tokensSpent > 0
                    ? `${application.tokensSpent} tokens spent`
                    : "No tokens spent"}
                  {application.resumeName ? ` · ${application.resumeName}` : ""}
                </p>
              </div>
              <StatusBadge status={application.status} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <h2 className="text-base font-semibold tracking-tight text-gray-900">Token history</h2>
        <p className="mt-1 text-sm text-gray-600">
          Each line shows the change and the balance remaining after it.
        </p>
        <ul className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200">
          {tokenLog.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{entry.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {entry.detail}
                  <span className="px-1.5 text-gray-300">/</span>
                  {formatWhen(entry.at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 tabular-nums">{formatDelta(entry.delta)}</p>
                <p className="mt-0.5 text-xs text-gray-500 tabular-nums">Balance {entry.balanceAfter}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
