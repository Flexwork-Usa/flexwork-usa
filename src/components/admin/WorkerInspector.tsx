"use client";

import { useEffect, useId, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { loadWorkerInspector } from "@/actions/deposit-review-actions";
import type { WorkerInspectorData } from "@/lib/admin/types";
import { explorerUrl } from "@/lib/deposits";
import { formatMoney, formatWhen } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  pending: "border-gray-200 bg-gray-50 text-gray-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
  applied: "border-gray-200 bg-gray-50 text-gray-800",
  reviewing: "border-gray-200 bg-white text-gray-800",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

function truncateHash(hash: string) {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "border-gray-200 bg-white text-gray-800";
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${style}`}>{status}</span>
  );
}

function HashCell({ hash, walletType }: { hash: string; walletType: string }) {
  const href = explorerUrl(walletType, hash);
  return (
    <span className="flex items-center justify-between gap-2">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="font-mono text-xs text-gray-900 underline" title={hash}>
          {truncateHash(hash)}
        </a>
      ) : (
        <span className="font-mono text-xs text-gray-900" title={hash}>
          {truncateHash(hash)}
        </span>
      )}
      <CopyButton value={hash} />
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{label}</p>
      <p className="mt-1 break-all text-sm text-gray-900">{value || "—"}</p>
    </div>
  );
}

export function WorkerInspector({ userId, onClose }: { userId: string; onClose: () => void }) {
  const titleId = useId();
  const [record, setRecord] = useState<WorkerInspectorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"ledger" | "jobs">("ledger");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    loadWorkerInspector(userId)
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load this worker.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[min(90vh,48rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-gray-900">
            Inspector / Full Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {!record && !error ? <p className="text-sm text-gray-600">Loading…</p> : null}
          {record ? (
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Fact label="Full name" value={record.fullName} />
                <Fact label="User ID" value={record.id} />
                <Fact label="Email" value={record.email} />
                <Fact label="Country" value={record.country} />
                <Fact label="Phone number" value={record.phoneNumber} />
                <Fact label="Date joined" value={record.joinedAt ? formatWhen(record.joinedAt) : ""} />
                <Fact label="Token balance" value={`${record.tokenBalance.toLocaleString("en-US")} tokens`} />
              </div>

              <div role="tablist" aria-label="Worker history" className="mt-6 inline-flex rounded-lg border border-gray-200 p-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "ledger"}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "ledger" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => setTab("ledger")}
                >
                  Transaction Ledger
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "jobs"}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "jobs" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => setTab("jobs")}
                >
                  Job Applications
                </button>
              </div>

              {tab === "ledger" ? (
                record.deposits.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-600">
                    No deposits yet.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-gray-200 text-xs font-medium text-gray-500">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">USD</th>
                          <th className="px-4 py-2.5 font-medium">Tokens</th>
                          <th className="px-4 py-2.5 font-medium">Tx hash</th>
                          <th className="px-4 py-2.5 font-medium">Status</th>
                          <th className="px-4 py-2.5 font-medium">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {record.deposits.map((deposit) => (
                          <tr key={deposit.id}>
                            <td className="px-4 py-3 tabular-nums">{formatMoney(deposit.amountUsd)}</td>
                            <td className="px-4 py-3 tabular-nums">{deposit.tokens.toLocaleString("en-US")}</td>
                            <td className="px-4 py-3">
                              <HashCell hash={deposit.transactionHash} walletType={deposit.walletType} />
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={deposit.status} />
                            </td>
                            <td className="px-4 py-3 text-gray-600">{formatWhen(deposit.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : record.applications.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-600">
                  No applications yet.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-gray-200 text-xs font-medium text-gray-500">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Job</th>
                        <th className="px-4 py-2.5 font-medium">Tier</th>
                        <th className="px-4 py-2.5 font-medium">Tokens spent</th>
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {record.applications.map((application) => (
                        <tr key={application.id}>
                          <td className="px-4 py-3 font-medium text-gray-900">{application.jobTitle}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {application.tier ? `Tier ${application.tier}` : "—"}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{application.tokensSpent.toLocaleString("en-US")}</td>
                          <td className="px-4 py-3 text-gray-600">{formatWhen(application.appliedAt)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={application.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
