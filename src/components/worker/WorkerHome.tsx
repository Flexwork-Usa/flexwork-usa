"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
import { TokenLogo } from "@/components/dashboard/CryptoNetworkIcons";
import { submitDepositHash } from "@/actions/deposit-actions";
import {
  CUSTOM_PLAN_MINIMUM_USD,
  CUSTOM_PLAN_TITLE,
  DEPOSIT_PLANS,
  WALLET_TYPES,
  tokensForUsd,
  type WalletType,
} from "@/lib/deposits";
import { fieldClass, formatMoney, formatWhen, primaryButtonClass, secondaryButtonClass } from "@/lib/format";

export type WorkerApplication = {
  id: string;
  jobTitle: string;
  company: string | null;
  tokenCost: number;
  status: string;
  appliedAt: string;
};

export type WorkerProfileView = {
  fullName: string;
  email: string;
  tokenBalance: number;
  walletUsdtTron: string | null;
  walletUsdtEth: string | null;
  walletUsdcEth: string | null;
};

export type WorkerDeposit = {
  id: string;
  planTitle: string;
  amountUsd: number;
  tokens: number;
  walletType: string;
  transactionHash: string;
  status: string;
  createdAt: string;
};

type SelectedPlan = {
  title: string;
  amountUsd: number;
  tokens: number;
};

const STATUS_STYLES: Record<string, string> = {
  applied: "border-emerald-200 bg-emerald-50 text-emerald-800",
  reviewing: "border-gray-200 bg-white text-gray-800",
  accepted: "border-gray-900 bg-gray-900 text-white",
  pending: "border-gray-200 bg-gray-50 text-gray-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
};

const WALLET_FIELDS: Record<WalletType, keyof WorkerProfileView> = {
  "USDT (TRC-20)": "walletUsdtTron",
  "USDT (ERC-20)": "walletUsdtEth",
  "USDC (ERC-20)": "walletUsdcEth",
};

function assignedAddress(profile: WorkerProfileView, type: WalletType) {
  const value = profile[WALLET_FIELDS[type]];
  return typeof value === "string" ? value.trim() : "";
}

function truncateHash(hash: string) {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
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

function AddressRow({ label, value }: { label: WalletType; value: string | null }) {
  const address = value?.trim() ?? "";

  return (
    <div className="rounded-xl border border-gray-200 px-4 py-4">
      <div className="flex items-center gap-2">
        <TokenLogo asset={label} className="h-6 w-6" />
        <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{label}</p>
      </div>
      {address ? (
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="break-all text-sm text-gray-900">{address}</p>
          <CopyButton value={address} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">Pending Assignment</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "border-gray-200 bg-white text-gray-800";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${style}`}>{status}</span>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
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
          <h2 id={titleId} className="text-base font-semibold text-gray-900">
            {title}
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
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function WorkerHome({
  profile,
  applications,
  applicationsError,
  deposits,
  depositsError,
}: {
  profile: WorkerProfileView;
  applications: WorkerApplication[];
  applicationsError?: string;
  deposits: WorkerDeposit[];
  depositsError?: string;
}) {
  const router = useRouter();
  const [history, setHistory] = useState(deposits);
  const [selected, setSelected] = useState<SelectedPlan | null>(null);
  const [walletType, setWalletType] = useState<WalletType>(WALLET_TYPES[0]);
  const [transactionHash, setTransactionHash] = useState("");
  const [customUsd, setCustomUsd] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setHistory(deposits);
  }, [deposits]);

  const customAmount = Number(customUsd);
  const customTokens =
    customUsd.trim() && Number.isFinite(customAmount) ? tokensForUsd(customAmount) : 0;
  const selectedAddress = selected ? assignedAddress(profile, walletType) : "";
  const hasPending = history.some((deposit) => deposit.status === "pending");

  function openPlan(plan: SelectedPlan) {
    const firstAssigned = WALLET_TYPES.find((type) => assignedAddress(profile, type));
    setSelected(plan);
    setWalletType(firstAssigned ?? WALLET_TYPES[0]);
    setTransactionHash("");
    setSubmitError(null);
  }

  function openCustomPlan() {
    if (!Number.isFinite(customAmount) || customAmount < CUSTOM_PLAN_MINIMUM_USD) {
      setCustomError(`Custom deposits start at ${formatMoney(CUSTOM_PLAN_MINIMUM_USD)}.`);
      return;
    }
    const tokens = tokensForUsd(customAmount);
    if (tokens < 1) {
      setCustomError("Enter a dollar amount that buys at least 1 token.");
      return;
    }
    setCustomError(null);
    openPlan({ title: CUSTOM_PLAN_TITLE, amountUsd: customAmount, tokens });
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Deposit Info / Buy Tokens</h1>
          <p className="mt-2 text-sm text-gray-900">
            <span className="font-medium">{profile.fullName}</span>
            <span className="px-1.5 text-gray-300">/</span>
            <span className="text-gray-600">{profile.email}</span>
            <span className="px-1.5 text-gray-300">/</span>
            <span className="font-semibold tabular-nums">{profile.tokenBalance} tokens</span>
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            1 Token = $0.20. Minimum deposit for affiliate jobs is 10 tokens ($2.00).
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <AddressRow label="USDT (TRC-20)" value={profile.walletUsdtTron} />
            <AddressRow label="USDT (ERC-20)" value={profile.walletUsdtEth} />
            <AddressRow label="USDC (ERC-20)" value={profile.walletUsdcEth} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEPOSIT_PLANS.map((plan) => (
              <article key={plan.title} className="flex flex-col rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{plan.title}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(plan.amountUsd)}</p>
                <p className="mt-1 text-sm text-gray-600 tabular-nums">{plan.tokens.toLocaleString("en-US")} tokens</p>
                <button type="button" className={`${primaryButtonClass} mt-4`} onClick={() => openPlan(plan)}>
                  Select
                </button>
              </article>
            ))}
            <article className="flex flex-col rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Custom Plan</p>
              <label className="mt-2 block text-sm font-medium text-gray-900" htmlFor="custom-usd">
                USD amount
                <input
                  id="custom-usd"
                  className={fieldClass}
                  inputMode="decimal"
                  value={customUsd}
                  onChange={(event) => {
                    setCustomUsd(event.target.value);
                    setCustomError(null);
                  }}
                  placeholder="100"
                />
              </label>
              <p className="mt-2 text-sm text-gray-600 tabular-nums">
                {customTokens > 0 ? `${customTokens.toLocaleString("en-US")} tokens` : "Minimum $100"}
              </p>
              {customError ? <p className="mt-2 text-sm text-red-700">{customError}</p> : null}
              <button type="button" className={`${secondaryButtonClass} mt-4`} onClick={openCustomPlan}>
                Select custom plan
              </button>
            </article>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-base font-semibold tracking-tight">Deposit History</h2>
          {hasPending || notice ? (
            <p role="status" className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
              {notice ?? "You have a deposit pending review. Tokens are credited after an administrator confirms the transaction."}
            </p>
          ) : null}
          {depositsError ? (
            <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
              {depositsError}
            </p>
          ) : null}
          {history.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-600">
              No deposits yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-gray-200 text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Tokens</th>
                    <th className="px-4 py-2.5 font-medium">Wallet</th>
                    <th className="px-4 py-2.5 font-medium">Tx hash</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((deposit) => (
                    <tr key={deposit.id}>
                      <td className="px-4 py-3 text-gray-600">{formatWhen(deposit.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-900 tabular-nums">{formatMoney(Number(deposit.amountUsd))}</td>
                      <td className="px-4 py-3 text-gray-900 tabular-nums">{deposit.tokens.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-gray-700">{deposit.walletType}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700" title={deposit.transactionHash}>
                        {truncateHash(deposit.transactionHash)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={deposit.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-12">
          <div role="tablist" aria-label="Worker records" className="inline-flex rounded-lg border border-gray-200 p-1">
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white"
            >
              My Applications
            </button>
          </div>

          {applicationsError ? (
            <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
              {applicationsError}
            </p>
          ) : null}

          {applications.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-600">
              You have not applied to any jobs yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-gray-200 text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Job</th>
                    <th className="px-4 py-2.5 font-medium">Submitted</th>
                    <th className="px-4 py-2.5 font-medium">Tokens spent</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{application.jobTitle}</p>
                        {application.company ? (
                          <p className="mt-0.5 text-xs text-gray-500">{application.company}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatWhen(application.appliedAt)}</td>
                      <td className="px-4 py-3 text-gray-900 tabular-nums">
                        {application.tokenCost > 0 ? `${application.tokenCost} tokens` : "Free"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={application.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {selected ? (
        <Dialog title="Submit deposit" onClose={() => setSelected(null)}>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!selectedAddress) return;
              setSubmitting(true);
              setSubmitError(null);
              try {
                const result = await submitDepositHash({
                  planTitle: selected.title,
                  amountUsd: selected.amountUsd,
                  tokens: selected.tokens,
                  walletType,
                  transactionHash,
                });
                if (!result.success) {
                  setSubmitError(result.error);
                  return;
                }
                setHistory((current) => [
                  {
                    id: crypto.randomUUID(),
                    planTitle: selected.title,
                    amountUsd: selected.amountUsd,
                    tokens: selected.tokens,
                    walletType,
                    transactionHash: transactionHash.trim(),
                    status: "pending",
                    createdAt: new Date().toISOString(),
                  },
                  ...current,
                ]);
                setNotice("Deposit submitted. Status is pending until an administrator confirms the transaction.");
                setSelected(null);
                router.refresh();
              } catch (caught) {
                setSubmitError(caught instanceof Error ? caught.message : "Could not submit the deposit.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900">
              <p className="font-medium">{selected.title}</p>
              <p className="mt-1 tabular-nums">
                {formatMoney(selected.amountUsd)}
                <span className="px-1.5 text-gray-300">/</span>
                {selected.tokens.toLocaleString("en-US")} tokens
              </p>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-gray-900">Deposit wallet</legend>
              <div className="mt-2 space-y-2">
                {WALLET_TYPES.map((type) => {
                  const address = assignedAddress(profile, type);
                  return (
                    <label key={type} className="flex items-start gap-2 text-sm text-gray-900">
                      <input
                        type="radio"
                        name="wallet-type"
                        className="mt-1"
                        checked={walletType === type}
                        disabled={!address}
                        onChange={() => setWalletType(type)}
                      />
                      <span className="flex items-start gap-2">
                        <TokenLogo asset={type} className="mt-0.5 h-5 w-5" />
                        <span>
                          {type}
                          {address ? null : <span className="mt-0.5 block text-xs text-gray-500">Pending Assignment</span>}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-xl border border-gray-200 px-4 py-4">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{walletType}</p>
              {selectedAddress ? (
                <div className="mt-2 flex items-start justify-between gap-3">
                  <p className="break-all text-sm text-gray-900">{selectedAddress}</p>
                  <CopyButton value={selectedAddress} label="Copy Address" />
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">Pending Assignment</p>
              )}
            </div>

            <label className="block text-sm font-medium text-gray-900" htmlFor="tx-hash">
              Transaction Hash / TxID
              <input
                id="tx-hash"
                className={fieldClass}
                value={transactionHash}
                onChange={(event) => setTransactionHash(event.target.value)}
                required
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}
            <button type="submit" className={primaryButtonClass} disabled={submitting || !selectedAddress}>
              {submitting ? "Submitting…" : "Submit Deposit Notification"}
            </button>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
