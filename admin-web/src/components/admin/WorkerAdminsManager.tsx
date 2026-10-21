"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  createWorkerAdminAccount,
  removeWorkerAdminAccount,
  resetWorkerAdminRecoveryPassword,
  updateWorkerAdminMetrics,
  updateWorkerAdminStatus,
} from "@/actions/account-admin-actions";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { CredentialsModal } from "@/components/admin/CredentialsModal";
import { Modal } from "@/components/admin/Modal";
import type { WorkerAdminAccount, WorkerStatus } from "@/lib/platform/types";
import { fieldClass, formatMoney, formatWhen, primaryButtonClass, secondaryButtonClass } from "@/lib/format";

const STATUS_OPTIONS: Array<{ value: WorkerStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "temp_disabled", label: "Disabled" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
  { value: "under_review", label: "Under review" },
];

export function WorkerAdminsManager({ accounts }: { accounts: WorkerAdminAccount[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(accounts);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
    fullName?: string;
  } | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [metricsTarget, setMetricsTarget] = useState<WorkerAdminAccount | null>(null);
  const [pendingEarnings, setPendingEarnings] = useState("0");
  const [earnedThisMonth, setEarnedThisMonth] = useState("0");
  const [totalEarnings, setTotalEarnings] = useState("0");

  useEffect(() => {
    setRows(accounts);
  }, [accounts]);

  function openMetrics(account: WorkerAdminAccount) {
    setMetricsTarget(account);
    setPendingEarnings(String(account.pendingEarnings ?? 0));
    setEarnedThisMonth(String(account.earnedThisMonth ?? 0));
    setTotalEarnings(String(account.totalEarnings ?? 0));
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Worker Admins</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage 3rd-tier Worker Admins. Credentials are stored on{" "}
            <code className="rounded bg-slate-100 px-1">worker_admins.temp_recovery_pass</code> and mirrored to{" "}
            <code className="rounded bg-slate-100 px-1">profiles</code>.
          </p>
        </div>
        <button type="button" className={primaryButtonClass} onClick={() => setOpen(true)}>
          Add Worker Admin
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Earnings</th>
              <th className="px-4 py-3 font-medium">Recovery pass</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No Worker Admins yet.
                </td>
              </tr>
            ) : (
              rows.map((account) => {
                const revealed = revealedId === account.workerId;
                return (
                  <tr key={account.workerId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{account.fullName || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{account.email}</td>
                    <td className="px-4 py-3">
                      <select
                        className={`${fieldClass} mt-0 w-auto min-w-[8rem]`}
                        value={account.status}
                        disabled={busy}
                        onChange={async (event) => {
                          const next = event.target.value as WorkerStatus;
                          setBusy(true);
                          setError(null);
                          try {
                            await updateWorkerAdminStatus(account.workerId, next);
                            setRows((prev) =>
                              prev.map((row) =>
                                row.workerId === account.workerId ? { ...row, status: next } : row,
                              ),
                            );
                            router.refresh();
                          } catch (caught) {
                            console.error("updateWorkerAdminStatus failed:", caught);
                            setError(caught instanceof Error ? caught.message : "Could not update status.");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>Pending {formatMoney(account.pendingEarnings)}</p>
                      <p>Month {formatMoney(account.earnedThisMonth)}</p>
                      <p>All-time {formatMoney(account.totalEarnings)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="max-w-[10rem] truncate font-mono text-xs">
                          {account.tempRecoveryPass
                            ? revealed
                              ? account.tempRecoveryPass
                              : "••••••••••••"
                            : "—"}
                        </code>
                        {account.tempRecoveryPass ? (
                          <>
                            <button
                              type="button"
                              className={secondaryButtonClass}
                              onClick={() =>
                                setRevealedId((current) =>
                                  current === account.workerId ? null : account.workerId,
                                )
                              }
                            >
                              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              className={secondaryButtonClass}
                              onClick={async () => {
                                await navigator.clipboard.writeText(account.tempRecoveryPass || "");
                              }}
                            >
                              Copy
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatWhen(account.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          disabled={busy}
                          onClick={() => openMetrics(account)}
                        >
                          Edit Pay / Metrics
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          disabled={!account.tempRecoveryPass || busy}
                          onClick={() => {
                            if (!account.tempRecoveryPass) return;
                            setCredentials({
                              email: account.email,
                              password: account.tempRecoveryPass,
                              fullName: account.fullName,
                            });
                          }}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setError(null);
                            try {
                              const result = await resetWorkerAdminRecoveryPassword(account.workerId);
                              setRows((prev) =>
                                prev.map((row) =>
                                  row.workerId === account.workerId
                                    ? { ...row, tempRecoveryPass: result.tempPassword }
                                    : row,
                                ),
                              );
                              setCredentials({
                                email: account.email,
                                password: result.tempPassword,
                                fullName: account.fullName,
                              });
                              router.refresh();
                            } catch (caught) {
                              console.error("resetWorkerAdminRecoveryPassword failed:", caught);
                              setError(
                                caught instanceof Error ? caught.message : "Could not reset password.",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Reset pass
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          disabled={busy}
                          onClick={() => setConfirmRemove(account.workerId)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <Modal
          title="Add Worker Admin"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const result = await createWorkerAdminAccount({
                  fullName,
                  email,
                  password: customPassword || undefined,
                });
                setOpen(false);
                setFullName("");
                setEmail("");
                setCustomPassword("");
                setCredentials({
                  email: result.email,
                  password: result.tempPassword,
                  fullName: result.fullName,
                });
                router.refresh();
              } catch (caught) {
                console.error("createWorkerAdminAccount failed:", caught);
                setError(caught instanceof Error ? caught.message : "Could not create Worker Admin.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-sm font-medium">
              Full name
              <input
                className={fieldClass}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Email
              <input
                className={fieldClass}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Temporary password (optional)
              <div className="mt-1.5 flex gap-2">
                <input
                  className={`${fieldClass} mt-0`}
                  type={showPassword ? "text" : "password"}
                  value={customPassword}
                  onChange={(event) => setCustomPassword(event.target.value)}
                  placeholder="Leave blank to auto-generate"
                />
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <p className="text-xs text-slate-500">
              Creates auth + <code>profiles</code> (<code>role = worker_admin</code>) +{" "}
              <code>worker_admins</code> with status Active.
            </p>
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              {busy ? "Creating…" : "Create Worker Admin"}
            </button>
          </form>
        </Modal>
      ) : null}

      {confirmRemove ? (
        <ConfirmModal
          title="Remove Worker Admin"
          message="Are you sure you want to perform this action? This removes the worker_admins record and demotes the profile back to a regular worker."
          confirmLabel="Remove"
          busy={busy}
          onCancel={() => {
            if (!busy) setConfirmRemove(null);
          }}
          onConfirm={async () => {
            setBusy(true);
            setError(null);
            try {
              await removeWorkerAdminAccount(confirmRemove);
              setRows((prev) => prev.filter((row) => row.workerId !== confirmRemove));
              setConfirmRemove(null);
              router.refresh();
            } catch (caught) {
              console.error("removeWorkerAdminAccount failed:", caught);
              setError(caught instanceof Error ? caught.message : "Could not remove Worker Admin.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {metricsTarget ? (
        <Modal
          title="Edit Pay / Metrics"
          onClose={() => {
            if (!busy) setMetricsTarget(null);
          }}
        >
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const result = await updateWorkerAdminMetrics({
                  workerId: metricsTarget.workerId,
                  pendingEarnings: Number(pendingEarnings),
                  earnedThisMonth: Number(earnedThisMonth),
                  totalEarnings: Number(totalEarnings),
                });
                setRows((prev) =>
                  prev.map((row) =>
                    row.workerId === metricsTarget.workerId
                      ? {
                          ...row,
                          pendingEarnings: result.pendingEarnings,
                          earnedThisMonth: result.earnedThisMonth,
                          totalEarnings: result.totalEarnings,
                        }
                      : row,
                  ),
                );
                setMetricsTarget(null);
                router.refresh();
              } catch (caught) {
                console.error("updateWorkerAdminMetrics failed:", caught);
                setError(caught instanceof Error ? caught.message : "Could not update metrics.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-slate-600">
              Override earnings for <span className="font-medium">{metricsTarget.fullName || metricsTarget.email}</span>.
              Values sync to <code className="rounded bg-slate-100 px-1">worker_admins</code> and{" "}
              <code className="rounded bg-slate-100 px-1">profiles</code>.
            </p>
            <label className="block text-sm font-medium">
              Pending Earnings ($)
              <input
                className={fieldClass}
                inputMode="decimal"
                required
                value={pendingEarnings}
                onChange={(event) => setPendingEarnings(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Earned This Month ($)
              <input
                className={fieldClass}
                inputMode="decimal"
                required
                value={earnedThisMonth}
                onChange={(event) => setEarnedThisMonth(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              All-Time Earnings ($)
              <input
                className={fieldClass}
                inputMode="decimal"
                required
                value={totalEarnings}
                onChange={(event) => setTotalEarnings(event.target.value)}
              />
            </label>
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              {busy ? "Saving…" : "Save metrics"}
            </button>
          </form>
        </Modal>
      ) : null}

      {credentials ? (
        <CredentialsModal
          title="Worker Admin credentials"
          email={credentials.email}
          password={credentials.password}
          fullName={credentials.fullName}
          onClose={() => setCredentials(null)}
        />
      ) : null}

      <p className="text-xs text-slate-500">
        {rows.filter((row) => row.status === "active").length} active · {rows.length} total · statuses:{" "}
        {STATUS_OPTIONS.map((item) => item.label).join(" / ")}
      </p>
    </div>
  );
}
