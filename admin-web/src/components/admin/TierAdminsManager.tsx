"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  createTierAdminAccount,
  removeTierAdminAccount,
  resetTierAdminRecoveryPassword,
  updateTierAdminRole,
  updateTierAdminStatus,
} from "@/actions/account-admin-actions";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { CredentialsModal } from "@/components/admin/CredentialsModal";
import { Modal } from "@/components/admin/Modal";
import type { AdminAccount, AdminRole, WorkerStatus } from "@/lib/platform/types";
import { fieldClass, formatWhen, primaryButtonClass, secondaryButtonClass } from "@/lib/format";

const STATUS_OPTIONS: Array<{ value: WorkerStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "temp_disabled", label: "Disabled" },
  { value: "banned", label: "Banned" },
  { value: "under_review", label: "Under review" },
];

const ROLE_OPTIONS: Array<{ value: Extract<AdminRole, "admin" | "super_admin">; label: string }> = [
  { value: "admin", label: "admin" },
  { value: "super_admin", label: "super_admin" },
];

export function TierAdminsManager({
  accounts,
  actorEmail,
  canManage = true,
}: {
  accounts: AdminAccount[];
  actorEmail: string;
  canManage?: boolean;
}) {
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

  useEffect(() => {
    setRows(accounts);
  }, [accounts]);

  const tierAdmins = rows.filter((row) => row.role === "admin" || row.role === "super_admin");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Admins</h2>
          <p className="mt-1 text-sm text-slate-600">
            Super Admin ({actorEmail || "Blackman"}) provisions 2nd-tier Admin accounts with auto-generated
            credentials stored on <code className="rounded bg-slate-100 px-1">profiles.temp_recovery_pass</code>.
          </p>
        </div>
        {canManage ? (
          <button type="button" className={primaryButtonClass} onClick={() => setOpen(true)}>
            Add Admin
          </button>
        ) : null}
      </div>

      {!canManage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Only Super Admin can create, edit, or remove 2nd-tier Admins. Use Worker Admins for 3rd-tier accounts.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Recovery pass</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tierAdmins.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No 2nd-tier Admins yet.
                </td>
              </tr>
            ) : (
              tierAdmins.map((account) => {
                const revealed = revealedId === account.id;
                const isSuper = account.role === "super_admin";
                return (
                  <tr key={account.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{account.fullName || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{account.email || account.id}</td>
                    <td className="px-4 py-3">
                      {isSuper || !canManage ? (
                        <span className="capitalize text-slate-700">{account.role.replaceAll("_", " ")}</span>
                      ) : (
                        <select
                          className={`${fieldClass} mt-0 w-auto min-w-[9rem]`}
                          value={account.role}
                          disabled={busy}
                          onChange={async (event) => {
                            const next = event.target.value as Extract<AdminRole, "admin" | "super_admin">;
                            setBusy(true);
                            setError(null);
                            try {
                              await updateTierAdminRole(account.id, next);
                              setRows((prev) =>
                                prev.map((row) => (row.id === account.id ? { ...row, role: next } : row)),
                              );
                              router.refresh();
                            } catch (caught) {
                              console.error("updateTierAdminRole failed:", caught);
                              setError(caught instanceof Error ? caught.message : "Could not update role.");
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSuper || !canManage ? (
                        <span>{STATUS_OPTIONS.find((item) => item.value === account.status)?.label}</span>
                      ) : (
                        <select
                          className={`${fieldClass} mt-0 w-auto min-w-[8rem]`}
                          value={account.status}
                          disabled={busy}
                          onChange={async (event) => {
                            const next = event.target.value as WorkerStatus;
                            setBusy(true);
                            setError(null);
                            try {
                              await updateTierAdminStatus(account.id, next);
                              setRows((prev) =>
                                prev.map((row) => (row.id === account.id ? { ...row, status: next } : row)),
                              );
                              router.refresh();
                            } catch (caught) {
                              console.error("updateTierAdminStatus failed:", caught);
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
                      )}
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
                                setRevealedId((current) => (current === account.id ? null : account.id))
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
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClass}
                            disabled={!account.tempRecoveryPass || busy}
                            onClick={() => {
                              if (!account.tempRecoveryPass || !account.email) return;
                              setCredentials({
                                email: account.email,
                                password: account.tempRecoveryPass,
                                fullName: account.fullName || undefined,
                              });
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className={secondaryButtonClass}
                            disabled={busy || isSuper}
                            onClick={async () => {
                              setBusy(true);
                              setError(null);
                              try {
                                const result = await resetTierAdminRecoveryPassword(account.id);
                                setRows((prev) =>
                                  prev.map((row) =>
                                    row.id === account.id
                                      ? { ...row, tempRecoveryPass: result.tempPassword }
                                      : row,
                                  ),
                                );
                                setCredentials({
                                  email: account.email || "",
                                  password: result.tempPassword,
                                  fullName: account.fullName || undefined,
                                });
                                router.refresh();
                              } catch (caught) {
                                console.error("resetTierAdminRecoveryPassword failed:", caught);
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
                          {!isSuper ? (
                            <button
                              type="button"
                              className={secondaryButtonClass}
                              disabled={busy}
                              onClick={() => setConfirmRemove(account.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">View only</span>
                      )}
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
          title="Add Admin"
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
                const result = await createTierAdminAccount({
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
                console.error("createTierAdminAccount failed:", caught);
                setError(caught instanceof Error ? caught.message : "Could not create Admin.");
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
              Creates a 2nd-tier <code>admin</code> in <code>admin_users</code> plus matching{" "}
              <code>profiles</code> credentials. Restricted to Super Admin.
            </p>
            <button type="submit" className={primaryButtonClass} disabled={busy}>
              {busy ? "Creating…" : "Create Admin"}
            </button>
          </form>
        </Modal>
      ) : null}

      {confirmRemove ? (
        <ConfirmModal
          title="Remove Admin"
          message="Are you sure you want to perform this action? This deletes the admin_users row and demotes the profile."
          confirmLabel="Remove"
          busy={busy}
          onCancel={() => {
            if (!busy) setConfirmRemove(null);
          }}
          onConfirm={async () => {
            setBusy(true);
            setError(null);
            try {
              await removeTierAdminAccount(confirmRemove);
              setRows((prev) => prev.filter((row) => row.id !== confirmRemove));
              setConfirmRemove(null);
              router.refresh();
            } catch (caught) {
              console.error("removeTierAdminAccount failed:", caught);
              setError(caught instanceof Error ? caught.message : "Could not remove Admin.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {credentials ? (
        <CredentialsModal
          title="Admin credentials"
          email={credentials.email}
          password={credentials.password}
          fullName={credentials.fullName}
          onClose={() => setCredentials(null)}
        />
      ) : null}
    </div>
  );
}
