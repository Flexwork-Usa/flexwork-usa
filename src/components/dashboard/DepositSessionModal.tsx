"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { motion } from "framer-motion";
import {
  expireTreasuryDepositSession,
  getActiveTreasuryDepositSession,
  startTreasuryDepositSession,
  submitTreasuryTxHash,
} from "@/actions/treasury-actions";
import { NetworkBadge } from "@/components/dashboard/CryptoNetworkIcons";
import { Dialog, fieldClass, orangeButton, quietButton } from "@/components/dashboard/ui";
import {
  CUSTOM_PLAN_MINIMUM_USD,
  CUSTOM_PLAN_TITLE,
  PAYMENT_ASSETS,
  TOKEN_PURCHASE_PLANS,
  WALLET_TYPES,
  makeCustomPlan,
  tokensForUsd,
  treasuryNetworkForAsset,
  walletTypeFromNetwork,
  type TokenPurchasePlan,
  type WalletType,
} from "@/lib/deposits";
import { DEPOSIT_SESSION_MINUTES, formatCountdown, secondsUntil } from "@/lib/platform/rules";
import type { TreasuryDeposit } from "@/lib/platform/types";
import { formatMoney } from "@/lib/format";

const selectPlanButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60";

export function DepositSessionModal({
  open,
  onClose,
  onChanged,
  initialPlan = null,
  initialNetwork = "USDT (TRC-20)",
  initialDeposit = null,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  initialPlan?: TokenPurchasePlan | null;
  initialNetwork?: WalletType;
  initialDeposit?: TreasuryDeposit | null;
}) {
  const [plan, setPlan] = useState<TokenPurchasePlan | null>(initialPlan);
  const [customUsd, setCustomUsd] = useState("");
  const [network, setNetwork] = useState<WalletType>(initialNetwork);
  const [deposit, setDeposit] = useState<TreasuryDeposit | null>(null);
  const [txHash, setTxHash] = useState("");
  const [showTxForm, setShowTxForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingActive, setLoadingActive] = useState(false);
  const [remaining, setRemaining] = useState(DEPOSIT_SESSION_MINUTES * 60);
  const [copied, setCopied] = useState(false);
  const [timerFrozen, setTimerFrozen] = useState(false);
  const expiredSent = useRef(false);

  const sessionActive = deposit?.status === "waiting" && !timerFrozen;
  const sessionSubmitted = deposit?.status === "pending" || timerFrozen;
  const customTokens = tokensForUsd(Number(customUsd) || 0);
  const onSessionStep = Boolean(deposit && deposit.status !== "expired") || busy;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setNotice(null);
    setShowTxForm(false);
    setTxHash("");
    setCopied(false);
    setTimerFrozen(false);
    expiredSent.current = false;
    setPlan(initialPlan);
    setNetwork(initialNetwork);
    setCustomUsd(initialPlan?.id === "custom" ? String(initialPlan.amountUsd) : "");
    setLoadingActive(true);

    async function loadSession() {
      if (initialDeposit) {
        const stillOpen = initialDeposit.status === "waiting" && secondsUntil(initialDeposit.expiresAt) > 0;
        if (!stillOpen) {
          await expireTreasuryDepositSession(initialDeposit.id);
          if (cancelled) return;
          setDeposit({ ...initialDeposit, status: "expired" });
          setPlan(null);
          setLoadingActive(false);
          onChanged();
          return;
        }
        setDeposit(initialDeposit);
        setNetwork(walletTypeFromNetwork(initialDeposit.network, initialNetwork));
        setRemaining(secondsUntil(initialDeposit.expiresAt));
        setLoadingActive(false);
        return;
      }

      const result = await getActiveTreasuryDepositSession();
      if (cancelled) return;
      if (!result.success) {
        setLoadingActive(false);
        setError(result.error);
        return;
      }
      if (result.deposit) {
        setDeposit(result.deposit);
        setNetwork(walletTypeFromNetwork(result.deposit.network, initialNetwork));
        setRemaining(secondsUntil(result.deposit.expiresAt));
        setLoadingActive(false);
        return;
      }
      setDeposit(null);
      setLoadingActive(false);
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPlan, initialNetwork, initialDeposit]);

  useEffect(() => {
    if (!deposit || deposit.status !== "waiting" || timerFrozen) return;
    const tick = () => {
      const next = secondsUntil(deposit.expiresAt);
      setRemaining(next);
      if (next > 0 || expiredSent.current) return;
      expiredSent.current = true;
      setDeposit((current) => (current ? { ...current, status: "expired" } : current));
      setPlan(null);
      void expireTreasuryDepositSession(deposit.id).then(() => onChanged());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deposit, timerFrozen]);

  const qrSrc = useMemo(() => {
    if (!deposit?.depositAddress) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deposit.depositAddress)}`;
  }, [deposit?.depositAddress]);

  async function launchSession(nextPlan: TokenPurchasePlan, nextNetwork: WalletType = network) {
    setPlan(nextPlan);
    setBusy(true);
    setError(null);
    setNotice(null);
    setTimerFrozen(false);
    const result = await startTreasuryDepositSession({
      usdtAmount: nextPlan.amountUsd,
      tokensIssued: nextPlan.tokens,
      planTitle: nextPlan.title,
      network: treasuryNetworkForAsset(nextNetwork),
    });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDeposit(result.deposit);
    setNetwork(walletTypeFromNetwork(result.deposit.network, nextNetwork));
    onChanged();
  }

  function selectCustom() {
    const next = makeCustomPlan(Number(customUsd));
    if (!next) {
      setError(`Custom amounts require at least ${formatMoney(CUSTOM_PLAN_MINIMUM_USD)} USDT.`);
      return;
    }
    setError(null);
    void launchSession(next);
  }

  if (!open) return null;

  return (
    <Dialog title={onSessionStep ? "Complete payment" : "Select a token package"} onClose={onClose} className="max-w-3xl">
      {loadingActive ? (
        <p className="text-sm text-slate-600">Checking for an open payment session…</p>
      ) : !onSessionStep ? (
        <div className="space-y-4">
          {deposit?.status === "expired" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              That 15-minute window ended. Select a package to start a new payment.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Tokens are $0.20 each. Select a package to open a 15-minute USDT payment session.
            </p>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Token for this session</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {WALLET_TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`rounded-xl border p-1 text-left ${
                    network === item ? "border-[#C85A17] ring-2 ring-[#C85A17]/30" : "border-slate-200"
                  }`}
                  onClick={() => setNetwork(item)}
                >
                  <NetworkBadge network={item} />
                </button>
              ))}
            </div>
          </fieldset>
          {plan ? (
            <button
              type="button"
              className={orangeButton}
              disabled={busy}
              onClick={() => void launchSession(plan)}
            >
              {busy ? "Opening…" : `Continue with ${plan.title}`}
            </button>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOKEN_PURCHASE_PLANS.map((item) => (
              <div key={item.id} className="flex flex-col rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#C85A17]">{item.title}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{item.tokens.toLocaleString()}</p>
                <p className="text-sm text-slate-600">tokens</p>
                <p className="mt-2 text-lg font-semibold">{formatMoney(item.amountUsd)} USDT</p>
                <p className="mt-1 text-xs text-slate-500">{item.blurb}</p>
                <button
                  type="button"
                  className={`${selectPlanButton} mt-4`}
                  disabled={busy}
                  onClick={() => void launchSession(item)}
                >
                  Select Plan
                </button>
              </div>
            ))}
            <div className="flex flex-col rounded-xl border border-dashed border-slate-300 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#C85A17]">{CUSTOM_PLAN_TITLE}</p>
              <p className="mt-2 text-sm text-slate-600">Minimum {formatMoney(CUSTOM_PLAN_MINIMUM_USD)} USDT</p>
              <label className="mt-3 block text-sm font-medium">
                USDT amount
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={customUsd}
                  placeholder="100"
                  onChange={(event) => {
                    setCustomUsd(event.target.value);
                    setError(null);
                  }}
                />
              </label>
              <p className="mt-2 text-sm text-slate-600">
                {customTokens > 0 ? `${customTokens.toLocaleString()} tokens` : "Tokens calculate at $0.20 each"}
              </p>
              <button type="button" className={`${selectPlanButton} mt-4`} disabled={busy} onClick={selectCustom}>
                Select Plan
              </button>
            </div>
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
      ) : (
        <div className="space-y-3">
          {busy && !deposit ? <p className="text-sm text-slate-600">Opening your 15-minute payment session…</p> : null}
          {deposit ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                {WALLET_TYPES.map((item) => (
                  <div
                    key={item}
                    className={`rounded-xl border p-1 ${
                      network === item ? "border-[#C85A17] ring-2 ring-[#C85A17]/30" : "border-slate-200"
                    }`}
                  >
                    <NetworkBadge network={item} />
                  </div>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-orange-200 bg-orange-50 p-4"
              >
                <p className="text-sm text-slate-600">
                  {sessionSubmitted ? "Payment received — under review" : "Session expires in 15 minutes."}
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold text-[#C85A17]">
                  {sessionSubmitted ? "Submitted" : formatCountdown(remaining)}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Send exactly{" "}
                  <span className="font-semibold">
                    {formatMoney(deposit.usdtAmount)} {PAYMENT_ASSETS[network].token}
                  </span>{" "}
                  ·{" "}
                  {deposit.tokensIssued.toLocaleString()} tokens
                  {deposit.planTitle ? ` · ${deposit.planTitle}` : plan ? ` · ${plan.title}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">Payment reference: {deposit.memoCode}</p>
              </motion.div>

              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-start">
                {qrSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrSrc}
                    alt="Payment address QR code"
                    width={160}
                    height={160}
                    className="rounded-lg border border-slate-100 bg-white p-2"
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs font-medium text-slate-500">Deposit address</p>
                  <p className="break-all font-mono text-sm text-slate-900">{deposit.depositAddress}</p>
                  <button
                    type="button"
                    className={quietButton}
                    onClick={async () => {
                      await navigator.clipboard.writeText(deposit.depositAddress);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy address"}
                  </button>
                </div>
              </div>

              {sessionSubmitted ? (
                <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-medium text-emerald-900">Transaction submitted</p>
                  <p className="break-all font-mono text-xs text-emerald-800">{deposit.txHash || txHash}</p>
                  <p className="text-sm text-emerald-800">Tokens will appear in your balance after your payment is confirmed.</p>
                </div>
              ) : !showTxForm ? (
                <button
                  type="button"
                  className={orangeButton}
                  disabled={remaining <= 0}
                  onClick={() => {
                    setShowTxForm(true);
                    setError(null);
                  }}
                >
                  I Have Sent
                </button>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError(null);
                    setNotice(null);
                    const result = await submitTreasuryTxHash({ depositId: deposit.id, txHash });
                    setBusy(false);
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    setDeposit(result.deposit);
                    setTimerFrozen(true);
                    setNotice("Payment details submitted. Your tokens will be added after confirmation.");
                    onChanged();
                  }}
                >
                  <label className="block text-sm font-medium">
                    Transaction Hash (TXID)
                    <input
                      className={fieldClass}
                      required
                      value={txHash}
                      onChange={(event) => setTxHash(event.target.value)}
                      placeholder="Paste your blockchain TXID"
                    />
                  </label>
                  {error ? <p className="text-sm text-red-700">{error}</p> : null}
                  {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={quietButton} disabled={busy} onClick={() => setShowTxForm(false)}>
                      Back
                    </button>
                    <button type="submit" className={orangeButton} disabled={busy || remaining <= 0}>
                      {busy ? "Submitting…" : "Submit TXID"}
                    </button>
                  </div>
                </form>
              )}

              {error && sessionActive && !showTxForm ? <p className="text-sm text-red-700">{error}</p> : null}
            </>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                className={quietButton}
                onClick={() => {
                  setPlan(null);
                  setBusy(false);
                }}
              >
                Back to packages
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
