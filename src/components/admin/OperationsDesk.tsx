"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
import { approveWorkerAndAssignWallets, updateAdminAccountCredentials } from "@/actions/admin-approval-actions";
import { creditTokensToWorker } from "@/actions/admin-token-actions";
import { approveDepositAndCredit, rejectDeposit } from "@/actions/deposit-review-actions";
import { WorkerInspector } from "@/components/admin/WorkerInspector";
import { explorerUrl } from "@/lib/deposits";
import {
  fieldClass,
  formatMoney,
  formatWhen,
  primaryButtonClass,
  secondaryButtonClass,
  TOKEN_PRICE,
} from "@/lib/format";
import type { PendingApplication, PendingDeposit, WorkerProfileRow } from "@/lib/admin/types";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomPassword() {
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join("");
}

function CopyButton({ value, label }: { value: string; label: string }) {
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
      {copied ? "Copied" : label}
    </button>
  );
}

function AddressCell({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-gray-400">—</span>;
  }

  return (
    <span className="flex items-start justify-between gap-2">
      <span className="break-all text-gray-900">{value}</span>
      <CopyButton value={value} label="Copy" />
    </span>
  );
}

function Dialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[min(90vh,44rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function truncateHash(hash: string) {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function OperationsDesk({
  applications,
  profiles,
  deposits,
  loadError,
  adminEmail,
}: {
  applications: PendingApplication[];
  profiles: WorkerProfileRow[];
  deposits: PendingDeposit[];
  loadError?: string;
  adminEmail: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(applications);
  const [workers, setWorkers] = useState(profiles);
  const [selected, setSelected] = useState<PendingApplication | null>(null);
  const [password, setPassword] = useState("");
  const [walletUsdtTron, setWalletUsdtTron] = useState("");
  const [walletUsdtEth, setWalletUsdtEth] = useState("");
  const [walletUsdcEth, setWalletUsdcEth] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [crediting, setCrediting] = useState<WorkerProfileRow | null>(null);
  const [usdAmount, setUsdAmount] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [creditError, setCreditError] = useState<string | null>(null);
  const [creditingNow, setCreditingNow] = useState(false);
  const [creditNotice, setCreditNotice] = useState<string | null>(null);
  const [queue, setQueue] = useState(deposits);
  const [rejecting, setRejecting] = useState<PendingDeposit | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectingNow, setRejectingNow] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "deposits" | "workers">("pending");
  const [securityOpen, setSecurityOpen] = useState(false);

  useEffect(() => {
    setPending(applications);
  }, [applications]);

  useEffect(() => {
    setWorkers(profiles);
  }, [profiles]);

  useEffect(() => {
    setQueue(deposits);
  }, [deposits]);

  const usdValue = Number(usdAmount);
  const calculatedTokens =
    usdAmount.trim() && Number.isFinite(usdValue) && usdValue >= 0
      ? Math.floor(usdValue / TOKEN_PRICE)
      : 0;

  function openApproval(application: PendingApplication) {
    setSelected(application);
    setPassword("");
    setWalletUsdtTron("");
    setWalletUsdtEth("");
    setWalletUsdcEth("");
    setApproveError(null);
    setEmailDraft(null);
    setEmailCopied(false);
  }

  function openCredit(worker: WorkerProfileRow) {
    setCrediting(worker);
    setUsdAmount("");
    setReferenceNote("");
    setCreditError(null);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Records</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Approve applicants, assign payout wallets, and credit tokens after a deposit.
            </p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => setSecurityOpen(true)}>
            Admin settings
          </button>
        </div>

        {loadError ? (
          <p className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
            {loadError}
          </p>
        ) : null}
        {securityOpen ? <AdminSecurityDialog email={adminEmail} onClose={() => setSecurityOpen(false)} /> : null}

        {creditNotice ? (
          <p className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
            {creditNotice}
          </p>
        ) : null}

        <div role="tablist" aria-label="Records" className="mt-8 inline-flex rounded-lg border border-gray-200 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "pending" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setTab("pending")}
          >
            Pending Worker Onboardings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "deposits"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "deposits" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setTab("deposits")}
          >
            Pending Deposits
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "workers"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === "workers" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setTab("workers")}
          >
            Approved Workers & Token Crediting
          </button>
        </div>

        {tab === "pending" ? (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-base font-semibold tracking-tight">Pending Onboardings</h2>
            <p className="text-sm text-gray-500 tabular-nums">{pending.length}</p>
          </div>

          {emailDraft ? (
            <div className="mt-4 rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Copy Email Template</h3>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={async () => {
                    await navigator.clipboard.writeText(emailDraft);
                    setEmailCopied(true);
                    window.setTimeout(() => setEmailCopied(false), 1500);
                  }}
                >
                  {emailCopied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {emailCopied ? "Copied" : "Copy Email to Clipboard"}
                </button>
              </div>
              <textarea
                readOnly
                value={emailDraft}
                aria-label="Welcome email"
                className={`${fieldClass} min-h-56 font-mono text-xs leading-5`}
              />
            </div>
          ) : null}

          {pending.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-600">
              No pending applications.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-gray-200 text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Country</th>
                    <th className="px-4 py-2.5 font-medium">Phone</th>
                    <th className="px-4 py-2.5 font-medium">Submitted</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pending.map((application) => (
                    <tr key={application.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{application.fullName}</td>
                      <td className="px-4 py-3 text-gray-700">{application.email}</td>
                      <td className="px-4 py-3 text-gray-700">{application.country}</td>
                      <td className="px-4 py-3 text-gray-700">{application.phoneNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{formatWhen(application.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className={primaryButtonClass}
                          onClick={() => openApproval(application)}
                        >
                          Approve Worker
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        ) : tab === "deposits" ? (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-base font-semibold tracking-tight">Pending Deposits</h2>
            <p className="text-sm text-gray-500 tabular-nums">{queue.length}</p>
          </div>
          {reviewError ? <p className="mt-4 text-sm text-red-700">{reviewError}</p> : null}
          {queue.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-600">
              No deposits are waiting for review.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-gray-200 text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Worker</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Tokens</th>
                    <th className="px-4 py-2.5 font-medium">Tx hash</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {queue.map((deposit) => {
                    const href = explorerUrl(deposit.walletType, deposit.transactionHash);
                    return (
                      <tr key={deposit.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">{deposit.workerName}</td>
                        <td className="px-4 py-3 tabular-nums">{formatMoney(deposit.amountUsd)}</td>
                        <td className="px-4 py-3 tabular-nums">{deposit.tokens.toLocaleString("en-US")}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono text-xs text-gray-900 underline"
                                  title={deposit.transactionHash}
                                >
                                  {truncateHash(deposit.transactionHash)}
                                </a>
                              ) : (
                                <span className="font-mono text-xs text-gray-900" title={deposit.transactionHash}>
                                  {truncateHash(deposit.transactionHash)}
                                </span>
                              )}
                              <p className="mt-1 text-xs text-gray-500">{deposit.walletType}</p>
                            </div>
                            <CopyButton value={deposit.transactionHash} label="Copy" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatWhen(deposit.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={primaryButtonClass}
                              disabled={reviewingId === deposit.id}
                              onClick={async () => {
                                setReviewingId(deposit.id);
                                setReviewError(null);
                                try {
                                  const result = await approveDepositAndCredit(deposit.id);
                                  setQueue((current) => current.filter((item) => item.id !== deposit.id));
                                  setWorkers((current) =>
                                    current.map((worker) =>
                                      worker.id === result.userId
                                        ? { ...worker, tokenBalance: result.newBalance }
                                        : worker,
                                    ),
                                  );
                                  setCreditNotice(
                                    `Approved and credited ${result.tokensAdded} tokens. New balance is ${result.newBalance}.`,
                                  );
                                  router.refresh();
                                } catch (error) {
                                  setReviewError(error instanceof Error ? error.message : "Approval failed.");
                                } finally {
                                  setReviewingId(null);
                                }
                              }}
                            >
                              {reviewingId === deposit.id ? "Approving…" : "Approve & Credit"}
                            </button>
                            <button
                              type="button"
                              className={secondaryButtonClass}
                              onClick={() => {
                                setRejecting(deposit);
                                setRejectNote("");
                                setRejectError(null);
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        ) : (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-base font-semibold tracking-tight">Approved Workers & Token Crediting</h2>
            <p className="text-sm text-gray-500 tabular-nums">{workers.length}</p>
          </div>
          {workers.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-600">
              No worker profiles yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-gray-200 text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Token balance</th>
                    <th className="px-4 py-2.5 font-medium">TRC-20 address</th>
                    <th className="px-4 py-2.5 font-medium">ERC-20 addresses</th>
                    <th className="px-4 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {workers.map((worker) => (
                    <tr key={worker.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{worker.fullName || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{worker.email || "—"}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 tabular-nums">{worker.tokenBalance}</td>
                      <td className="px-4 py-3">
                        <AddressCell value={worker.walletUsdtTron} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">USDT</p>
                            <AddressCell value={worker.walletUsdtEth} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">USDC</p>
                            <AddressCell value={worker.walletUsdcEth} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <button type="button" className={secondaryButtonClass} onClick={() => setInspectingId(worker.id)}>
                            Inspector / Full Details
                          </button>
                          <button type="button" className={secondaryButtonClass} onClick={() => openCredit(worker)}>
                            Credit Tokens
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}
      </main>

      {selected ? (
        <Dialog
          title={emailDraft ? "Account approved" : "Approve & Assign Wallets"}
          description={emailDraft ? undefined : `${selected.fullName} · ${selected.email}`}
          onClose={() => setSelected(null)}
        >
          {emailDraft ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Copy Email Template</h3>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={async () => {
                    await navigator.clipboard.writeText(emailDraft);
                    setEmailCopied(true);
                  }}
                >
                  {emailCopied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {emailCopied ? "Copied" : "Copy Email to Clipboard"}
                </button>
              </div>
              <textarea
                readOnly
                value={emailDraft}
                aria-label="Welcome email"
                className={`${fieldClass} min-h-64 font-mono text-xs leading-5`}
              />
              <button type="button" className={`${secondaryButtonClass} mt-4`} onClick={() => setSelected(null)}>
                Done
              </button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setApproving(true);
                setApproveError(null);
                try {
                  const result = await approveWorkerAndAssignWallets({
                    applicationId: selected.id,
                    email: selected.email,
                    fullName: selected.fullName,
                    country: selected.country,
                    phoneNumber: selected.phoneNumber,
                    tempPassword: password,
                    walletUsdtTron,
                    walletUsdtEth,
                    walletUsdcEth,
                  });
                  setEmailDraft(result.emailDraft);
                  setEmailCopied(false);
                  setPending((current) => current.filter((item) => item.id !== selected.id));
                  router.refresh();
                } catch (error) {
                  setApproveError(error instanceof Error ? error.message : "Approval failed.");
                } finally {
                  setApproving(false);
                }
              }}
            >
              <label className="block text-sm font-medium text-gray-900" htmlFor="temp-password">
                Temporary password
                <span className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="temp-password"
                    className={`${fieldClass} mt-0 min-w-0 flex-1`}
                    value={password}
                    autoComplete="new-password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Generate or type a password"
                  />
                  <button
                    type="button"
                    className={`${secondaryButtonClass} shrink-0`}
                    onClick={() => setPassword(randomPassword())}
                  >
                    Generate Random
                  </button>
                </span>
              </label>
              <label className="block text-sm font-medium text-gray-900" htmlFor="wallet-tron">
                USDT TRC-20 address
                <input
                  id="wallet-tron"
                  className={fieldClass}
                  value={walletUsdtTron}
                  onChange={(event) => setWalletUsdtTron(event.target.value)}
                  placeholder="T..."
                  spellCheck={false}
                />
              </label>
              <label className="block text-sm font-medium text-gray-900" htmlFor="wallet-usdt-eth">
                USDT ERC-20 address
                <input
                  id="wallet-usdt-eth"
                  className={fieldClass}
                  value={walletUsdtEth}
                  onChange={(event) => setWalletUsdtEth(event.target.value)}
                  placeholder="0x..."
                  spellCheck={false}
                />
              </label>
              <label className="block text-sm font-medium text-gray-900" htmlFor="wallet-usdc-eth">
                USDC ERC-20 address
                <input
                  id="wallet-usdc-eth"
                  className={fieldClass}
                  value={walletUsdcEth}
                  onChange={(event) => setWalletUsdcEth(event.target.value)}
                  placeholder="0x..."
                  spellCheck={false}
                />
              </label>
              {approveError ? <p className="text-sm text-red-700">{approveError}</p> : null}
              <button type="submit" className={primaryButtonClass} disabled={approving}>
                {approving ? "Approving…" : "Approve and create account"}
              </button>
            </form>
          )}
        </Dialog>
      ) : null}

      {rejecting ? (
        <Dialog
          title="Reject deposit"
          description={`${rejecting.workerName} · ${formatMoney(rejecting.amountUsd)}`}
          onClose={() => setRejecting(null)}
        >
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setRejectingNow(true);
              setRejectError(null);
              try {
                await rejectDeposit({ depositId: rejecting.id, note: rejectNote });
                setQueue((current) => current.filter((item) => item.id !== rejecting.id));
                setRejecting(null);
                setCreditNotice("Deposit rejected.");
                router.refresh();
              } catch (error) {
                setRejectError(error instanceof Error ? error.message : "Could not reject the deposit.");
              } finally {
                setRejectingNow(false);
              }
            }}
          >
            <label className="block text-sm font-medium text-gray-900" htmlFor="reject-note">
              Note
              <input
                id="reject-note"
                className={fieldClass}
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                placeholder="Optional"
              />
            </label>
            {rejectError ? <p className="text-sm text-red-700">{rejectError}</p> : null}
            <button type="submit" className={primaryButtonClass} disabled={rejectingNow}>
              {rejectingNow ? "Rejecting…" : "Reject"}
            </button>
          </form>
        </Dialog>
      ) : null}

      {inspectingId ? <WorkerInspector userId={inspectingId} onClose={() => setInspectingId(null)} /> : null}

      {crediting ? (
        <Dialog
          title="Credit tokens"
          description={`${crediting.fullName || "Worker"} · balance ${crediting.tokenBalance}`}
          onClose={() => setCrediting(null)}
        >
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!crediting || calculatedTokens < 1) return;
              setCreditingNow(true);
              setCreditError(null);
              try {
                const result = await creditTokensToWorker({
                  userId: crediting.id,
                  usdAmount: usdValue,
                  referenceNote,
                });
                setWorkers((current) =>
                  current.map((worker) =>
                    worker.id === crediting.id ? { ...worker, tokenBalance: result.newBalance } : worker,
                  ),
                );
                setCreditNotice(
                  `Credited ${result.tokensAdded} tokens. New balance is ${result.newBalance}.`,
                );
                setCrediting(null);
                router.refresh();
              } catch (error) {
                setCreditError(error instanceof Error ? error.message : "Credit failed.");
              } finally {
                setCreditingNow(false);
              }
            }}
          >
            <label className="block text-sm font-medium text-gray-900" htmlFor="usd-amount">
              USD amount
              <input
                id="usd-amount"
                className={fieldClass}
                inputMode="decimal"
                value={usdAmount}
                onChange={(event) => setUsdAmount(event.target.value)}
                placeholder="10"
              />
            </label>
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
              <span className="font-medium tabular-nums">{calculatedTokens} tokens</span>
              <span className="text-gray-600"> @ {formatMoney(TOKEN_PRICE)}/token</span>
            </p>
            <label className="block text-sm font-medium text-gray-900" htmlFor="credit-note">
              Note / reference
              <input
                id="credit-note"
                className={fieldClass}
                value={referenceNote}
                onChange={(event) => setReferenceNote(event.target.value)}
                placeholder="Optional deposit reference"
              />
            </label>
            {creditError ? <p className="text-sm text-red-700">{creditError}</p> : null}
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={creditingNow || calculatedTokens < 1}
            >
              {creditingNow ? "Submitting…" : "Submit Credit"}
            </button>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}

function AdminSecurityDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const [accountEmail, setAccountEmail] = useState(email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  return (
    <Dialog title="Admin settings" description="Security" onClose={onClose}>
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          Current account <span className="font-medium text-gray-900">{accountEmail}</span>
        </p>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPasswordMessage(null);
            setPasswordError(null);
            if (password !== confirmPassword) {
              setPasswordError("Passwords do not match.");
              return;
            }
            setSavingPassword(true);
            const result = await updateAdminAccountCredentials(password);
            setSavingPassword(false);
            if (!result.success) {
              setPasswordError(result.error);
              return;
            }
            setPassword("");
            setConfirmPassword("");
            setPasswordMessage(result.message);
          }}
        >
          <h3 className="text-sm font-semibold text-gray-900">Update password</h3>
          <label className="block text-sm font-medium text-gray-900">
            New Password
            <input className={fieldClass} type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-gray-900">
            Confirm New Password
            <input className={fieldClass} type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          {passwordError ? <p className="text-sm text-red-700" role="alert">{passwordError}</p> : null}
          {passwordMessage ? <p className="text-sm text-gray-900" role="status">{passwordMessage}</p> : null}
          <button type="submit" className={primaryButtonClass} disabled={savingPassword}>
            {savingPassword ? "Updating…" : "Update Password"}
          </button>
        </form>
        <form
          className="space-y-3 border-t border-gray-200 pt-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setEmailMessage(null);
            setEmailError(null);
            setSavingEmail(true);
            const result = await updateAdminAccountCredentials(undefined, nextEmail);
            setSavingEmail(false);
            if (!result.success) {
              setEmailError(result.error);
              return;
            }
            setAccountEmail(nextEmail.trim());
            setNextEmail("");
            setEmailMessage(result.message);
          }}
        >
          <h3 className="text-sm font-semibold text-gray-900">Update email</h3>
          <label className="block text-sm font-medium text-gray-900">
            New Admin Email
            <input className={fieldClass} type="email" autoComplete="email" required value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} />
          </label>
          {emailError ? <p className="text-sm text-red-700" role="alert">{emailError}</p> : null}
          {emailMessage ? <p className="text-sm text-gray-900" role="status">{emailMessage}</p> : null}
          <button type="submit" className={primaryButtonClass} disabled={savingEmail}>
            {savingEmail ? "Updating…" : "Update Email"}
          </button>
        </form>
      </div>
    </Dialog>
  );
}
