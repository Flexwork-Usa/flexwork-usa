"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { requestPayout } from "@/actions/payout-actions";
import type { WorkerProfileView } from "@/components/dashboard/types";
import { showToast } from "@/components/dashboard/toast";
import { Dialog, fieldClass, orangeButton } from "@/components/dashboard/ui";
import { MIN_PAYOUT_THRESHOLD_MESSAGE, MIN_PAYOUT_USD, PAYOUT_SUBMITTED_MESSAGE } from "@/lib/platform/rules";
import type { PayoutMethod } from "@/lib/platform/types";
import { formatMoney } from "@/lib/format";

export function PayoutModal({
  open,
  availableEarnings,
  profile,
  onClose,
  onChanged,
}: {
  open: boolean;
  availableEarnings: number;
  profile: WorkerProfileView;
  onClose: () => void;
  onChanged: (pendingEarnings?: number) => void;
}) {
  const [method, setMethod] = useState<PayoutMethod>(profile.payoutMethod || "crypto");
  const savedAddress = useMemo(() => {
    if (method === "airtm") return profile.payoutAirtmEmail || "";
    if (method === "paypal") return profile.payoutPaypalEmail || "";
    return profile.payoutUsdtAddress || "";
  }, [method, profile.payoutAirtmEmail, profile.payoutPaypalEmail, profile.payoutUsdtAddress]);
  const [amount, setAmount] = useState(String(MIN_PAYOUT_USD));
  const [address, setAddress] = useState(savedAddress);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function addressFor(next: PayoutMethod) {
    if (next === "airtm") return profile.payoutAirtmEmail || "";
    if (next === "paypal") return profile.payoutPaypalEmail || "";
    return profile.payoutUsdtAddress || "";
  }

  if (!open) return null;

  return (
    <Dialog title="Request payout" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          setNotice(null);
          try {
            if (availableEarnings < MIN_PAYOUT_USD || Number(amount) < MIN_PAYOUT_USD) {
              showToast(MIN_PAYOUT_THRESHOLD_MESSAGE, "error");
              setError(MIN_PAYOUT_THRESHOLD_MESSAGE);
              return;
            }
            const result = await requestPayout({
              method,
              amount: Number(amount),
              address: address || savedAddress,
            });
            if (!result.success) {
              showToast(result.error, "error");
              setError(result.error);
              return;
            }
            const message = result.message || PAYOUT_SUBMITTED_MESSAGE;
            showToast(message, "success");
            setNotice(message);
            setAmount(String(MIN_PAYOUT_USD));
            setMethod(profile.payoutMethod || "crypto");
            setAddress(addressFor(profile.payoutMethod || "crypto"));
            onChanged(result.pendingEarnings);
            router.refresh();
          } catch (caught) {
            const message =
              caught instanceof Error && caught.message ? caught.message : "Payout request failed.";
            showToast(message, "error");
            setError(message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-sm text-slate-600">
          Available balance: {formatMoney(availableEarnings)}. Minimum payout threshold is {formatMoney(MIN_PAYOUT_USD)}.
        </p>
        <label className="block text-sm font-medium">
          Method
          <select
            className={fieldClass}
            value={method}
            onChange={(event) => {
              const next = event.target.value as PayoutMethod;
              setMethod(next);
              setAddress(addressFor(next));
            }}
          >
            <option value="crypto">Crypto (USDT)</option>
            <option value="airtm">Airtm</option>
            <option value="paypal">PayPal</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Amount (USD)
          <input className={fieldClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          {method === "crypto" ? "USDT wallet address" : method === "airtm" ? "Airtm email" : "PayPal email"}
          <input
            className={fieldClass}
            required
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder={savedAddress ? "Using your saved payout method" : "Save a method in Account Settings"}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-800">{notice}</p> : null}
        <button type="submit" className={orangeButton} disabled={busy || availableEarnings < MIN_PAYOUT_USD}>
          {busy ? "Submitting…" : "Submit payout request"}
        </button>
      </form>
    </Dialog>
  );
}
