"use client";

import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";
import {
  approveOnboardingApplication,
  createManagedJob,
  deleteLeaderboardEntry,
  deleteManagedJob,
  rejectOnboardingApplication,
  resetWorkerRecoveryPassword,
  reviewPlatformApplication,
  reviewPayoutRequest,
  reviewTreasuryDeposit,
  updateManagedJob,
  updateJobHiringStatus,
  updateWorkerStatus,
  upsertLeaderboardEntry,
} from "@/actions/platform-admin-actions";
import { useOpsNavOptional } from "@/components/admin/AdminOperationsLayout";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import type { AdminDashboardBundle } from "@/lib/admin/dashboard-data";
import { opsHomePath, type OpsPanel } from "@/lib/admin/nav";
import { formatCountdown, JOB_TAG_OPTIONS, parseJobTags } from "@/lib/platform/rules";
import type {
  ApplicationStatus,
  JobHiringStatus,
  LeaderboardEntry,
  ManagedJob,
  ManagedWorker,
  PlatformApplicationRow,
  PayoutRequest,
  TreasuryDeposit,
  WorkerStatus,
} from "@/lib/platform/types";
import { fieldClass, formatMoney, formatWhen, primaryButtonClass, secondaryButtonClass } from "@/lib/format";

const STATUS_LABEL: Record<WorkerStatus, string> = {
  active: "Active",
  under_review: "Under Review",
  temp_disabled: "Disabled",
  suspended: "Suspended",
  banned: "Banned",
};

const STATUS_BADGE: Record<WorkerStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  under_review: "bg-orange-500/10 text-[#C85A17] border-orange-500/20",
  temp_disabled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  suspended: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  banned: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function AdminConsole({
  data,
  mode = "super_admin",
  initialPanel = "overview",
}: {
  data: AdminDashboardBundle;
  adminEmail?: string;
  loadError?: string;
  mode?: "super_admin" | "admin";
  initialPanel?: OpsPanel;
}) {
  const opsNav = useOpsNavOptional();
  const [fallbackPanel] = useState<OpsPanel>(initialPanel);
  const panel = opsNav?.panel ?? fallbackPanel;
  const pendingDeposits = data.treasuryDeposits.filter((item) => item.status === "pending");
  const pendingPayouts = data.payouts.filter((item) => item.status === "pending");
  const home = opsHomePath(mode);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={panel}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
      >
        {panel === "overview" ? (
          <Overview
            jobs={data.jobs.length}
            pendingDeposits={pendingDeposits.length}
            workers={data.workers.length}
            pendingPayouts={pendingPayouts.length}
            onboarding={data.applications.length}
            workerAdminsHref={`${home}/worker-admins`}
            adminsHref={`${home}/admins`}
          />
        ) : null}
        {panel === "jobs" ? <JobManager jobs={data.jobs} /> : null}
        {panel === "deposits" ? <DepositAuditor deposits={data.treasuryDeposits} /> : null}
        {panel === "workers" ? <WorkersManager workers={data.workers} /> : null}
        {panel === "applications" ? <ApplicationsReview applications={data.platformApplications} /> : null}
        {panel === "payouts" ? <PayoutAuditor payouts={data.payouts} /> : null}
        {panel === "leaderboard" ? <LeaderboardManager entries={data.leaderboard} /> : null}
        {panel === "onboarding" ? <OnboardingQueue applications={data.applications} /> : null}
      </motion.div>
    </AnimatePresence>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

function Overview({
  jobs,
  pendingDeposits,
  workers,
  pendingPayouts,
  onboarding,
  workerAdminsHref,
  adminsHref,
}: {
  jobs: number;
  pendingDeposits: number;
  workers: number;
  pendingPayouts: number;
  onboarding: number;
  workerAdminsHref: string;
  adminsHref: string;
}) {
  const router = useRouter();
  const stats = [
    ["Open jobs", jobs],
    ["Pending deposits", pendingDeposits],
    ["Workers", workers],
    ["Pending payouts", pendingPayouts],
    ["Onboarding queue", onboarding],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Account management</p>
          <p className="mt-1 text-sm text-slate-600">
            Workers stay on the Workers table. Worker Admins and Admins use their own dedicated pages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={workerAdminsHref}
            prefetch
            className={primaryButtonClass}
            onClick={(event) => {
              event.preventDefault();
              startTransition(() => router.push(workerAdminsHref));
            }}
          >
            Worker Admins
          </Link>
          <Link
            href={adminsHref}
            prefetch
            className={secondaryButtonClass}
            onClick={(event) => {
              event.preventDefault();
              startTransition(() => router.push(adminsHref));
            }}
          >
            Admins
          </Link>
        </div>
      </Card>
    </div>
  );
}

function JobManager({ jobs }: { jobs: ManagedJob[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ManagedJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blank: {
    title: string;
    payRate: string;
    tags: string;
    slots: string;
    briefDescription: string;
    fullDescription: string;
    minTokens: string;
    hiringStatus: JobHiringStatus;
  } = {
    title: "",
    payRate: "$18/hr",
    tags: "Hiring, New",
    slots: "5",
    briefDescription: "",
    fullDescription: "",
    minTokens: "5",
    hiringStatus: "hiring",
  };
  const [form, setForm] = useState(blank);

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setForm(blank);
    setError(null);
  }

  function openEdit(job: ManagedJob) {
    setEditing(job);
    setCreating(false);
    setForm({
      title: job.title,
      payRate: job.payLabel || String(job.payRate),
      tags: (job.tags ?? []).join(", "),
      slots: String(job.slotsNeeded),
      briefDescription: job.briefDescription || job.description,
      fullDescription: job.fullDescription || job.description,
      minTokens: String(job.minTokens ?? 5),
      hiringStatus: job.hiringStatus,
    });
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Job Manager</h2>
        <button type="button" className={primaryButtonClass} onClick={openCreate}>
          Create job
        </button>
      </div>
      {jobs.length === 0 ? <Card className="text-sm text-slate-600">No jobs yet.</Card> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {jobs.map((job) => (
          <Card key={job.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{job.title}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {job.payLabel} · {job.slotsNeeded} workers needed · {job.minTokens ?? 5} min tokens
                </p>
                {job.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {job.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-[#C85A17]">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-1">
                {job.isNew ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">NEW</span> : null}
                {job.isHighDemand ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-[#C85A17]">HIGH DEMAND</span> : null}
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-slate-600">{job.description || "No description"}</p>
            <p className="mt-2 text-sm text-slate-600">
              {job.applicationCount} / {job.slotsNeeded} applicants · {job.hiringStatus}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={primaryButtonClass} onClick={() => openEdit(job)}>
                Edit
              </button>
              {(["hiring", "paused", "closed"] as JobHiringStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={job.hiringStatus === status ? primaryButtonClass : secondaryButtonClass}
                  onClick={async () => {
                    await updateJobHiringStatus(job.id, status);
                    router.refresh();
                  }}
                >
                  {status}
                </button>
              ))}
              <button type="button" className={secondaryButtonClass} onClick={() => setConfirmDelete(job.id)}>
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>

      {creating || editing ? (
        <Modal title={editing ? "Edit job" : "Create job"} onClose={() => { setCreating(false); setEditing(null); }}>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                if (editing) {
                  await updateManagedJob({
                    id: editing.id,
                    title: form.title,
                    briefDescription: form.briefDescription,
                    fullDescription: form.fullDescription,
                    tags: form.tags,
                    payRate: form.payRate,
                    slotsNeeded: Number(form.slots),
                    minTokens: Number(form.minTokens),
                    hiringStatus: form.hiringStatus,
                  });
                } else {
                  await createManagedJob({
                    title: form.title,
                    company: "flexwork-usa",
                    briefDescription: form.briefDescription,
                    fullDescription: form.fullDescription,
                    tags: form.tags,
                    payRate: form.payRate,
                    slotsNeeded: Number(form.slots),
                    minTokens: Number(form.minTokens),
                  });
                }
                setCreating(false);
                setEditing(null);
                router.refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Could not save job.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-sm font-medium">Job Title<input className={fieldClass} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="block text-sm font-medium">Pay Rate<input className={fieldClass} required placeholder="$18/hr or $50/quota" value={form.payRate} onChange={(e) => setForm({ ...form, payRate: e.target.value })} /></label>
            <label className="block text-sm font-medium">
              Tags
              <input className={fieldClass} placeholder="Hiring, New, Urgent" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-2">
              {JOB_TAG_OPTIONS.map((tag) => {
                const selected = parseJobTags(form.tags).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={selected ? primaryButtonClass : secondaryButtonClass}
                    onClick={() => {
                      const current = parseJobTags(form.tags);
                      const next = selected ? current.filter((item) => item !== tag) : [...current, tag];
                      setForm({ ...form, tags: next.join(", ") });
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">Workers Needed / Slots<input className={fieldClass} inputMode="numeric" value={form.slots} onChange={(e) => setForm({ ...form, slots: e.target.value })} /></label>
              <label className="block text-sm font-medium">Minimum Tokens Required<input className={fieldClass} inputMode="numeric" value={form.minTokens} onChange={(e) => setForm({ ...form, minTokens: e.target.value })} /></label>
            </div>
            <label className="block text-sm font-medium">Brief Description<textarea className={`${fieldClass} h-20 py-2`} required value={form.briefDescription} onChange={(e) => setForm({ ...form, briefDescription: e.target.value })} /></label>
            <label className="block text-sm font-medium">Full Description / Requirements<textarea className={`${fieldClass} h-28 py-2`} required value={form.fullDescription} onChange={(e) => setForm({ ...form, fullDescription: e.target.value })} /></label>
            {editing ? (
              <label className="block text-sm font-medium">
                Status
                <select className={fieldClass} value={form.hiringStatus} onChange={(e) => setForm({ ...form, hiringStatus: e.target.value as JobHiringStatus })}>
                  <option value="hiring">hiring</option>
                  <option value="paused">paused</option>
                  <option value="closed">closed</option>
                </select>
              </label>
            ) : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button type="submit" className={primaryButtonClass} disabled={busy}>{busy ? "Saving…" : "Save job"}</button>
          </form>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <ConfirmModal
          title="Delete job"
          message="Are you sure you want to perform this action? This job will be permanently deleted."
          confirmLabel="Delete job"
          busy={busy}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await deleteManagedJob(confirmDelete);
              setConfirmDelete(null);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function DepositAuditor({ deposits }: { deposits: TreasuryDeposit[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(deposits);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(0);
  const [confirm, setConfirm] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(deposits);
  }, [deposits]);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((item) =>
      [item.memoCode, item.txHash, item.depositAddress, item.status, item.network].join(" ").toLowerCase().includes(needle),
    );
  }, [query, rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Deposit Auditor</h2>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input className="h-10 bg-transparent text-sm outline-none" placeholder="Search Ref Code or TXID" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <p className="text-sm text-slate-600">
        Approve credits tokens and marks the deposit finished. Reject closes the session without credit.
      </p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {filtered.length === 0 ? <Card className="text-sm text-slate-600">No deposits match.</Card> : null}
      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Ref / Network</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">TXID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((deposit) => {
                const remaining = Math.max(0, Math.floor((new Date(deposit.expiresAt).getTime() - now) / 1000));
                const canReview = deposit.status === "pending" || deposit.status === "waiting";
                return (
                  <tr key={deposit.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{deposit.memoCode}</p>
                      <p className="text-xs text-slate-500">{deposit.network || "—"}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(deposit.usdtAmount)}</td>
                    <td className="px-4 py-3 tabular-nums">{deposit.tokensIssued}</td>
                    <td className="max-w-[240px] px-4 py-3 break-all font-mono text-xs text-slate-600">
                      {deposit.txHash || "Not submitted"}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {deposit.status}
                      {deposit.status === "waiting" ? (
                        <p className="font-mono text-xs text-[#C85A17]">{formatCountdown(remaining)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {canReview ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={primaryButtonClass}
                            onClick={() => {
                              setError(null);
                              setConfirm({ id: deposit.id, decision: "approved" });
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={secondaryButtonClass}
                            onClick={() => {
                              setError(null);
                              setConfirm({ id: deposit.id, decision: "rejected" });
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">No actions</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {confirm ? (
        <ConfirmModal
          title={confirm.decision === "approved" ? "Approve deposit" : "Reject deposit"}
          message={
            confirm.decision === "approved"
              ? "Approve this deposit? Tokens will be credited and the status will be finished."
              : "Reject this deposit? The worker will not receive tokens."
          }
          confirmLabel={confirm.decision === "approved" ? "Approve" : "Reject"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await reviewTreasuryDeposit(confirm.id, confirm.decision);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setRows((current) =>
                current.map((item) => (item.id === confirm.id ? { ...item, status: result.status } : item)),
              );
              setConfirm(null);
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not update deposit.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function WorkersManager({ workers }: { workers: ManagedWorker[] }) {
  const router = useRouter();
  const statuses: WorkerStatus[] = ["active", "under_review", "temp_disabled", "suspended", "banned"];
  const [confirm, setConfirm] = useState<{ id: string; status: WorkerStatus } | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Workers Management</h2>
      <p className="text-sm text-slate-600">
        Regular workers only. Worker Admins are managed separately under Worker Admins.
      </p>
      {workers.length === 0 ? <Card className="text-sm text-slate-600">No workers yet.</Card> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Token balance</th>
              <th className="px-4 py-3 font-medium">Jobs applied</th>
              <th className="px-4 py-3 font-medium">Tokens spent</th>
              <th className="px-4 py-3 font-medium">Earnings</th>
              <th className="px-4 py-3 font-medium">Recovery password</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {workers.map((worker) => {
              const show = revealed[worker.id];
              const pass = worker.tempRecoveryPass || "";
              return (
                <tr key={worker.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{worker.fullName || "Worker"}</p>
                    <p className="text-xs text-slate-500">{worker.email}</p>
                  </td>
                  <td className="px-4 py-3">{worker.country || "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{worker.tokenBalance}</td>
                  <td className="px-4 py-3 tabular-nums">{worker.jobsApplied}</td>
                  <td className="px-4 py-3 tabular-nums">{worker.totalTokensSpent}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(worker.totalEarnings)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="max-w-[140px] truncate text-xs">{pass ? (show ? pass : "••••••••••••") : "—"}</code>
                      {pass ? (
                        <button
                          type="button"
                          className="rounded border border-slate-200 p-1"
                          onClick={() => setRevealed((current) => ({ ...current, [worker.id]: !show }))}
                          aria-label={show ? "Hide password" : "Show password"}
                        >
                          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                      <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setResetId(worker.id)}>
                        Reset Password
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[worker.status]}`}>
                      {STATUS_LABEL[worker.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {statuses.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                          onClick={() => setConfirm({ id: worker.id, status })}
                        >
                          {STATUS_LABEL[status]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirm ? (
        <ConfirmModal
          title="Update worker status"
          message={`Are you sure you want to set this worker to ${STATUS_LABEL[confirm.status]}?`}
          confirmLabel="Update status"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await updateWorkerStatus(confirm.id, confirm.status);
              setConfirm(null);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {resetId ? (
        <ConfirmModal
          title="Reset worker password"
          message="Are you sure you want to perform this action? A new temporary password will be generated."
          confirmLabel="Reset password"
          busy={busy}
          onCancel={() => setResetId(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              const result = await resetWorkerRecoveryPassword(resetId);
              const worker = workers.find((item) => item.id === resetId);
              setCredentials({ email: worker?.email || "", password: result.tempPassword });
              setResetId(null);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {credentials ? <CredentialsModal email={credentials.email} password={credentials.password} onClose={() => setCredentials(null)} /> : null}
    </div>
  );
}

type ApplicationReviewStatus = Extract<ApplicationStatus, "viewed" | "under_review" | "hired" | "rejected">;

const APPLICATION_PIPELINE_LABEL: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  viewed: "Viewed",
  under_review: "Under Review",
  hired: "Hired",
  rejected: "Rejected",
};

function applicationPipelineBadge(status: ApplicationStatus) {
  if (status === "hired") return "bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "bg-red-50 text-red-800";
  if (status === "under_review") return "bg-orange-100 text-[#C85A17]";
  if (status === "viewed") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function ApplicationsReview({ applications }: { applications: PlatformApplicationRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(applications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; status: Extract<ApplicationStatus, "hired" | "rejected"> } | null>(
    null,
  );

  useEffect(() => {
    setRows([...applications].sort((a, b) => b.tokensStaked - a.tokensStaked));
  }, [applications]);

  async function applyStatus(id: string, status: ApplicationReviewStatus) {
    setBusyId(id);
    setError(null);
    try {
      await reviewPlatformApplication(id, status);
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
      setConfirm(null);
      router.refresh();
    } catch (caught) {
      console.error("reviewPlatformApplication failed:", caught);
      setError(caught instanceof Error ? caught.message : "Could not update application.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Job applications</h2>
        <p className="mt-1 text-sm text-slate-600">
          View, review, hire, or reject. These statuses update the worker Application pipeline: Submitted → Viewed →
          Under Review → Hired → Rejected. Reject refunds the worker&apos;s bid.
        </p>
      </div>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {rows.length === 0 ? <Card className="text-sm text-slate-600">No platform applications yet.</Card> : null}
      <div className="space-y-3">
        {rows.map((item) => {
          const open = item.status !== "hired" && item.status !== "rejected";
          return (
            <Card key={item.id} className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{item.jobTitle}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${applicationPipelineBadge(item.status)}`}>
                    {APPLICATION_PIPELINE_LABEL[item.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {item.workerName}
                  {item.workerEmail ? ` · ${item.workerEmail}` : ""}
                  {item.country ? ` · ${item.country}` : ""} · {item.tokensStaked} tokens bid
                </p>
                {item.coverLetter ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.coverLetter}</p> : null}
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {item.cvUrl ? (
                    <a href={item.cvUrl} target="_blank" rel="noreferrer" className="font-medium text-[#C85A17] hover:text-[#A84810]">
                      CV
                    </a>
                  ) : null}
                  {item.portfolioUrl ? (
                    <a href={item.portfolioUrl} target="_blank" rel="noreferrer" className="font-medium text-[#C85A17] hover:text-[#A84810]">
                      Portfolio
                    </a>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatWhen(item.submittedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {open && item.status === "submitted" ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busyId === item.id}
                    onClick={() => void applyStatus(item.id, "viewed")}
                  >
                    View
                  </button>
                ) : null}
                {open && (item.status === "submitted" || item.status === "viewed") ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busyId === item.id}
                    onClick={() => void applyStatus(item.id, "under_review")}
                  >
                    Review
                  </button>
                ) : null}
                {open ? (
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={busyId === item.id}
                    onClick={() => setConfirm({ id: item.id, status: "hired" })}
                  >
                    Hire
                  </button>
                ) : null}
                {open ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busyId === item.id}
                    onClick={() => setConfirm({ id: item.id, status: "rejected" })}
                  >
                    Reject
                  </button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
      {confirm ? (
        <ConfirmModal
          title={confirm.status === "hired" ? "Hire applicant" : "Reject application"}
          message={
            confirm.status === "hired"
              ? "Hire this worker? They will see this job under Active Projects, and the Application pipeline will move to Hired."
              : "Reject this application? Staked tokens will be refunded, and the Application pipeline will move to Rejected."
          }
          confirmLabel={confirm.status === "hired" ? "Hire" : "Reject"}
          busy={busyId === confirm.id}
          onCancel={() => setConfirm(null)}
          onConfirm={() => applyStatus(confirm.id, confirm.status)}
        />
      ) : null}
    </div>
  );
}

function PayoutAuditor({ payouts }: { payouts: PayoutRequest[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(payouts);
  const [confirm, setConfirm] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(payouts);
  }, [payouts]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Payouts Management</h2>
      <p className="text-sm text-slate-600">Incoming worker payout requests. Approve or reject pending rows after confirmation.</p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {rows.length === 0 ? <Card className="text-sm text-slate-600">No payout requests yet.</Card> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Request ID</th>
                <th className="px-4 py-3 font-medium">Worker ID / Email</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Amount ($)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((payout) => (
                <tr key={payout.id}>
                  <td className="px-4 py-3 font-mono text-xs" title={payout.id}>
                    {payout.id}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">{payout.workerId}</p>
                    <p className="text-xs text-slate-500">{payout.workerEmail || payout.workerName}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{payout.method}</td>
                  <td className="max-w-[220px] px-4 py-3 break-all font-mono text-xs">{payout.address || "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(payout.amount)}</td>
                  <td className="px-4 py-3 capitalize">{payout.status}</td>
                  <td className="px-4 py-3">
                    {payout.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={primaryButtonClass}
                          onClick={() => {
                            setError(null);
                            setConfirm({ id: payout.id, decision: "approved" });
                          }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => {
                            setError(null);
                            setConfirm({ id: payout.id, decision: "rejected" });
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {confirm ? (
        <ConfirmModal
          title={confirm.decision === "approved" ? "Approve payout" : "Reject payout"}
          message={
            confirm.decision === "approved"
              ? "Approve this payout request? The amount will be added to the worker's total earnings."
              : "Reject this payout request? The amount will be returned to the worker's pending balance."
          }
          confirmLabel={confirm.decision === "approved" ? "Approve" : "Reject"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await reviewPayoutRequest(confirm.id, confirm.decision);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setRows((current) =>
                current.map((item) => (item.id === confirm.id ? { ...item, status: result.status } : item)),
              );
              setConfirm(null);
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not update payout.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function LeaderboardManager({ entries }: { entries: LeaderboardEntry[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ workerName: "", emailMasked: "", country: "", skill: "", totalEarnings: "0", rankOrder: String(entries.length + 1) });
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Leaderboard Manager</h2>
      <Card>
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await upsertLeaderboardEntry({
              workerName: form.workerName,
              emailMasked: form.emailMasked,
              country: form.country,
              skill: form.skill,
              totalEarnings: Number(form.totalEarnings),
              rankOrder: Number(form.rankOrder),
            });
            setForm({ workerName: "", emailMasked: "", country: "", skill: "", totalEarnings: "0", rankOrder: String(entries.length + 2) });
            router.refresh();
          }}
        >
          <input className={fieldClass} placeholder="Worker name" required value={form.workerName} onChange={(e) => setForm({ ...form, workerName: e.target.value })} />
          <input className={fieldClass} placeholder="Masked email" required value={form.emailMasked} onChange={(e) => setForm({ ...form, emailMasked: e.target.value })} />
          <input className={fieldClass} placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <input className={fieldClass} placeholder="Skill" value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} />
          <input className={fieldClass} placeholder="Earnings" value={form.totalEarnings} onChange={(e) => setForm({ ...form, totalEarnings: e.target.value })} />
          <input className={fieldClass} placeholder="Rank" value={form.rankOrder} onChange={(e) => setForm({ ...form, rankOrder: e.target.value })} />
          <button type="submit" className={primaryButtonClass}>Add / update entry</button>
        </form>
      </Card>
      <div className="space-y-2">
        {entries.map((entry) => (
          <Card key={entry.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">#{entry.rankOrder} {entry.workerName}</p>
              <p className="text-sm text-slate-600">{entry.emailMasked} · {entry.country} · {entry.skill}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-medium tabular-nums">{formatMoney(entry.totalEarnings)}</p>
              <button type="button" className={secondaryButtonClass} onClick={() => setConfirmRemove(entry.id)}>Remove</button>
            </div>
          </Card>
        ))}
      </div>
      {confirmRemove ? (
        <ConfirmModal
          title="Remove leaderboard entry"
          message="Are you sure you want to perform this action?"
          confirmLabel="Remove"
          busy={busy}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await deleteLeaderboardEntry(confirmRemove);
              setConfirmRemove(null);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function OnboardingQueue({ applications }: { applications: AdminDashboardBundle["applications"] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(applications);
  const [confirm, setConfirm] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
    welcomeEmail?: string;
    loginUrl?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    setQueue(applications);
  }, [applications]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Onboarding queue</h2>
      <p className="text-sm text-slate-600">Approve creates the worker account, unlocks dashboard access, and stores a recovery password.</p>
      {error ? <Card className="border-red-200 bg-red-50 text-sm text-red-800">{error}</Card> : null}
      {successNotice ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-900">{successNotice}</Card> : null}
      {queue.length === 0 ? <Card className="text-sm text-slate-600">Queue is clear.</Card> : null}
      <div className="space-y-2">
        {queue.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.fullName}</p>
                <p className="text-sm text-slate-600">{item.email} · {item.country}</p>
                <p className="mt-1 text-xs text-slate-500">{item.phoneNumber} · {formatWhen(item.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={primaryButtonClass} onClick={() => setConfirm({ id: item.id, decision: "approved" })}>
                  Approve Worker
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setConfirm({ id: item.id, decision: "rejected" })}>
                  Reject Worker
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {confirm ? (
        <ConfirmModal
          title={confirm.decision === "approved" ? "Approve worker" : "Reject worker"}
          message={
            confirm.decision === "approved"
              ? "Are you sure you want to perform this action? A secure temporary password will be generated, saved to the worker profile, and shown with a welcome email + Flexwork_Credentials.txt download."
              : "Are you sure you want to perform this action? This application will be rejected."
          }
          confirmLabel={confirm.decision === "approved" ? "Approve Worker" : "Reject Worker"}
          busy={busy}
          onCancel={() => {
            if (!busy) setConfirm(null);
          }}
          onConfirm={async () => {
            setBusy(true);
            setError(null);
            setSuccessNotice(null);
            const applicationId = confirm.id;
            const decision = confirm.decision;
            try {
              if (decision === "approved") {
                const result = await approveOnboardingApplication(applicationId);
                setCredentials({
                  email: result.email,
                  password: result.tempPassword,
                  welcomeEmail: result.welcomeEmail,
                  loginUrl: result.loginUrl,
                });
                setSuccessNotice(
                  `Worker approved. Credentials ready for ${result.email} — download Flexwork_Credentials.txt from the credentials dialog.`,
                );
              } else {
                await rejectOnboardingApplication(applicationId);
                setSuccessNotice("Worker application rejected.");
              }
              setQueue((prev) => prev.filter((item) => item.id !== applicationId));
              setConfirm(null);
              router.refresh();
            } catch (caught) {
              console.error("Worker approval failed:", caught);
              setError(caught instanceof Error ? caught.message : "Could not update the onboarding application.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      {credentials ? (
        <CredentialsModal
          email={credentials.email}
          password={credentials.password}
          welcomeEmail={credentials.welcomeEmail}
          loginUrl={credentials.loginUrl}
          onClose={() => setCredentials(null)}
        />
      ) : null}
    </div>
  );
}

function CredentialsModal({
  email,
  password,
  welcomeEmail,
  loginUrl,
  onClose,
}: {
  email: string;
  password: string;
  welcomeEmail?: string;
  loginUrl?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"email" | "password" | "both" | "welcome" | null>(null);
  const body =
    welcomeEmail ||
    `Welcome to FlexWork-USA!\n\nLogin URL: ${loginUrl || "https://flexwork-usa.com/login"}\nEmail: ${email}\nTemporary Password: ${password}\n\nKeep these credentials safe and change your password on first login from Dashboard → Account Settings.`;

  function downloadTxt() {
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Flexwork_Credentials.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title="Welcome credentials" onClose={onClose}>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Warn the worker to keep these credentials safe and change their password on first login via Dashboard → Account Settings (24-hour cooldown applies).
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">Email</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="break-all text-sm">{email}</p>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={async () => {
                await navigator.clipboard.writeText(email);
                setCopied("email");
              }}
            >
              {copied === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-500">Temporary password</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="break-all font-mono text-sm">{password}</p>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={async () => {
                await navigator.clipboard.writeText(password);
                setCopied("password");
              }}
            >
              {copied === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <label className="block text-sm font-medium">
          Welcome email template
          <textarea className={`${fieldClass} mt-1 h-40 py-2 font-mono text-xs`} readOnly value={body} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={async () => {
            await navigator.clipboard.writeText(body);
            setCopied("welcome");
          }}
        >
          {copied === "welcome" ? "Email copied" : "Copy welcome email"}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={downloadTxt}>
          Download Flexwork_Credentials.txt
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={async () => {
            await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
            setCopied("both");
          }}
        >
          {copied === "both" ? "Copied" : "Copy email & password"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" className={secondaryButtonClass} onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
